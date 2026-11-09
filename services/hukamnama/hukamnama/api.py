"""Read-only HTTP API (stdlib ``http.server``). No access log: requests are not recorded.

  GET /v1/hukamnama/today            the current Amritsar day (published | pending)
  GET /v1/hukamnama/YYYY-MM-DD       one day, within ±400 days of today
  GET /v1/hukamnama?limit=N          the latest published days, N in 1..30 (default 7)
  GET /health                        poller liveness + today's status (for the dead-man check)

A held day is reported as ``pending`` to readers: nothing that failed the gate is ever served.
"""
from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

from . import __version__, clock
from .store import Store

# The source commit, baked into the image (Dockerfile) so a deploy is verified by identity.
COMMIT = os.environ.get("HUKAMNAMA_COMMIT") or os.environ.get("RENDER_GIT_COMMIT") or "unknown"

SECURITY_HEADERS = {"X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer"}
SOURCE_CREDIT = "Located by Ang from the Hukamnama published by SGPC (hs.sgpc.net); text from Sri Guru Granth Sahib Ji."


def day_record(store: Store, day, fingerprint: str, now: datetime) -> dict:
    d = store.decision(day)
    if d and d["status"] == "published":
        r = d["resolution"]
        return {"amritsar_date": day.isoformat(), "status": "published", "ang": r["ang"],
                "first_line_id": r["first_line_id"], "last_line_id": r["last_line_id"], "comp_id": r["comp_id"],
                "opening_line_id": r["opening_line_id"], "opening_gurmukhi": r["opening_gurmukhi"],
                "opening_translit": r["opening_translit"], "line_count": r["line_count"],
                "range_sha256": r["range_sha256"], "scripture_sha256": d["scripture_sha256"],
                "citation": f"Sri Guru Granth Sahib Ji · Ang {r['ang']}",
                "published_at": d["decided_at"], "credit": SOURCE_CREDIT}
    return {"amritsar_date": day.isoformat(), "status": "pending", "scripture_sha256": fingerprint,
            "expected_by": clock.at_ist(day, clock.EXPECTED_BY).astimezone(timezone.utc).isoformat(timespec="seconds")}


class State:
    def __init__(self, store: Store, fingerprint: str, now=clock.utcnow) -> None:
        self.store, self.fingerprint, self.now = store, fingerprint, now
        self.last_tick: datetime | None = None
        self.last_tick_action: str | None = None
        self.lock = threading.Lock()


def make_handler(state: State):
    class Handler(BaseHTTPRequestHandler):
        server_version = "hukamnama"
        sys_version = ""

        def log_message(self, *args):          # no access log, by design (privacy)
            pass

        def _send(self, code: int, body: dict, cache: str = "public, max-age=60") -> None:
            raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", cache if code == 200 else "no-store")
            for k, v in SECURITY_HEADERS.items():
                self.send_header(k, v)
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(raw)

        def do_HEAD(self):
            self.do_GET()

        def do_GET(self):
            try:
                self._route()
            except Exception:                   # never leak internals
                self._send(500, {"error": "internal error"})

        def _route(self):
            u = urlsplit(self.path)
            now = state.now()
            today = clock.amritsar_date(now)
            if u.path == "/health":
                with state.lock:
                    last, action = state.last_tick, state.last_tick_action
                rec = day_record(state.store, today, state.fingerprint, now)
                self._send(200, {"ok": True, "version": __version__, "commit": COMMIT, "amritsar_date": today.isoformat(),
                                 "status_today": rec["status"],
                                 "decision_today": (state.store.decision(today) or {}).get("status"),
                                 "last_tick": last.isoformat(timespec="seconds") if last else None,
                                 "last_tick_action": action, "alerts_today": state.store.alerts(today),
                                 "scripture_sha256": state.fingerprint}, cache="no-store")
                return
            if u.path == "/v1/hukamnama":
                q = parse_qs(u.query)
                raw = (q.get("limit") or ["7"])[0]
                if not raw.isdigit() or not 1 <= int(raw) <= 30:
                    self._send(400, {"error": "limit must be 1..30"})
                    return
                days = [r["amritsar_date"] for r in state.store.recent(int(raw))]
                self._send(200, {"items": [day_record(state.store, clock.parse_day(d), state.fingerprint, now)
                                           for d in days]})
                return
            if u.path.startswith("/v1/hukamnama/"):
                arg = u.path[len("/v1/hukamnama/"):]
                if arg == "today":
                    day = today
                else:
                    try:
                        day = clock.parse_day(arg)
                    except ValueError:
                        self._send(400, {"error": "date must be YYYY-MM-DD"})
                        return
                    if abs((day - today).days) > 400:
                        self._send(400, {"error": "date out of range"})
                        return
                    if day > today:
                        self._send(404, {"error": "not yet"})
                        return
                self._send(200, day_record(state.store, day, state.fingerprint, now))
                return
            self._send(404, {"error": "not found"})

    return Handler


def serve(state: State, host: str, port: int) -> ThreadingHTTPServer:
    httpd = ThreadingHTTPServer((host, port), make_handler(state))
    httpd.daemon_threads = True
    return httpd


def tick_loop(state: State, engine, stop: threading.Event) -> None:
    """Poll on the clock's cadence; idle checks every 10 minutes so the window is never missed."""
    import logging
    log = logging.getLogger("hukamnama")
    while not stop.is_set():
        now = state.now()
        try:
            res = engine.tick(now)
            with state.lock:
                state.last_tick, state.last_tick_action = now, res.action
        except Exception:
            log.exception("tick failed")
        step = clock.poll_interval(now) or timedelta(minutes=10)
        stop.wait(step.total_seconds())
