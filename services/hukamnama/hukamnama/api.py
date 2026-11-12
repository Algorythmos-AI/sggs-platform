"""Read-only HTTP API (stdlib ``http.server``). No access log: requests are not recorded.

  GET /v1/hukamnama/today            the current Amritsar day (published | pending)
  GET /v1/hukamnama/YYYY-MM-DD       one day, within ±400 days of today
  GET /v1/hukamnama?limit=N          the latest published days, N in 1..30 (default 7)
  GET /v1/hukamnama/index            every published day (date, Ang, range hash, when), newest first
  GET /health                        poller liveness + today's status (for the dead-man check)
  PUT /v1/devices/<token>            opt a device in (body: devices.parse_registration); the answer
                                     says what today means for it (push.plan_for_device)
  DELETE /v1/devices/<token>         opt it out: the row is deleted

A held day is reported as ``pending`` to readers: nothing that failed the gate is ever served.
"""
from __future__ import annotations

import hmac
import ipaddress
import json
import os
import threading
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

from . import __version__, clock
from .devices import MAX_BODY, BadRequest, RateLimiter, parse_registration, valid_token
from .push import plan_for_device
from .store import Store

# The source commit, baked into the image (Dockerfile) so a deploy is verified by identity.
COMMIT = os.environ.get("HUKAMNAMA_COMMIT") or os.environ.get("RENDER_GIT_COMMIT") or "unknown"

SECURITY_HEADERS = {"X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer"}
READS_PER_MINUTE = 120      # per client address; the edge serves public reads, so this is a backstop
SOCKET_TIMEOUT = 15         # seconds a connection may sit idle before its thread is released
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
                "published_at": d["decided_at"], "credit": SOURCE_CREDIT,
                **({"corrected_at": c["at"]} if (c := store.correction(day)) else {})}
    return pending_record(day, fingerprint)


def pending_record(day, fingerprint: str) -> dict:
    return {"amritsar_date": day.isoformat(), "status": "pending", "scripture_sha256": fingerprint,
            "expected_by": clock.at_ist(day, clock.EXPECTED_BY).astimezone(timezone.utc).isoformat(timespec="seconds")}


class State:
    def __init__(self, store: Store, fingerprint: str, now=clock.utcnow) -> None:
        self.store, self.fingerprint, self.now = store, fingerprint, now
        self.last_tick: datetime | None = None
        self.last_tick_action: str | None = None
        self.lock = threading.Lock()
        self.limiter = RateLimiter()
        # Reads have their own budget, so a flood of reads cannot use up the write budget of the
        # address it comes from (or the reverse).
        self.reads = RateLimiter(per_minute=READS_PER_MINUTE)
        self.sending = False                 # set by main when HUKAMNAMA_SEND=on and the key loaded
        # The edge in front of this service proves itself with a shared secret (X-Origin-Auth).
        # Only a request that carries it may say which address it is for (X-Client-IP).
        self.origin_secret = os.environ.get("HUKAMNAMA_ORIGIN_SECRET", "")
        self.origin_required = os.environ.get("HUKAMNAMA_ORIGIN_REQUIRED", "off") == "on"


def make_handler(state: State):
    class Handler(BaseHTTPRequestHandler):
        server_version = "hukamnama"
        sys_version = ""
        timeout = SOCKET_TIMEOUT             # a slow or silent client cannot hold a thread open

        def handle(self):
            try:
                super().handle()
            except (TimeoutError, ConnectionError):
                pass                           # the client went away or stalled: nothing to answer

        def log_message(self, *args):          # no access log, by design (privacy)
            pass

        def _send(self, code: int, body: dict, cache: str = "public, max-age=60", headers: dict | None = None) -> None:
            raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", cache if code == 200 else "no-store")
            for k, v in {**SECURITY_HEADERS, **(headers or {})}.items():
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
            paused = state.store.paused() is not None
            if u.path != "/health":
                if not self._allowed():
                    return
                if not state.reads.allow(self._client()):
                    self._send(429, {"error": "slow down"}, headers={"Retry-After": "60"})
                    return
            if u.path == "/health":
                with state.lock:
                    last, action = state.last_tick, state.last_tick_action
                rec = day_record(state.store, today, state.fingerprint, now)
                self._send(200, {"ok": True, "version": __version__, "commit": COMMIT, "amritsar_date": today.isoformat(),
                                 "status_today": rec["status"],
                                 "decision_today": (state.store.decision(today) or {}).get("status"),
                                 "last_tick": last.isoformat(timespec="seconds") if last else None,
                                 "last_tick_action": action, "alerts_today": state.store.alerts(today),
                                 "paused": paused,
                                 "scripture_sha256": state.fingerprint,
                                 "push": {"sending": state.sending, "devices": state.store.device_count(),
                                          "today": state.store.send_stats(today)}}, cache="no-store")
                return
            if u.path == "/v1/hukamnama":
                q = parse_qs(u.query)
                raw = (q.get("limit") or ["7"])[0]
                if not raw.isdigit() or not 1 <= int(raw) <= 30:
                    self._send(400, {"error": "limit must be 1..30"})
                    return
                days = [] if paused else [r["amritsar_date"] for r in state.store.recent(int(raw))]
                self._send(200, {"items": [day_record(state.store, clock.parse_day(d), state.fingerprint, now)
                                           for d in days]})
                return
            if u.path == "/v1/hukamnama/index":
                # every published day, without text: what a sitemap or an archive page lists
                days = [{"amritsar_date": d["amritsar_date"], "ang": d["resolution"]["ang"],
                         "range_sha256": d["resolution"]["range_sha256"], "published_at": d["decided_at"]}
                        for d in reversed(state.store.published())
                        if not paused and clock.parse_day(d["amritsar_date"]) <= today]
                self._send(200, {"scripture_sha256": state.fingerprint,
                                 "latest": days[0]["amritsar_date"] if days else None, "days": days})
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
                # While paused nothing is served: every day reads as pending, as a held day does.
                self._send(200, pending_record(day, state.fingerprint) if paused
                           else day_record(state.store, day, state.fingerprint, now))
                return
            self._send(404, {"error": "not found"})

        # -- device registration ----------------------------------------------------------------
        def _from_edge(self) -> bool:
            """True when the request carries the edge's secret (compared in constant time)."""
            secret = state.origin_secret
            return bool(secret) and hmac.compare_digest(self.headers.get("X-Origin-Auth", "").encode(), secret.encode())

        def _allowed(self) -> bool:
            """With HUKAMNAMA_ORIGIN_REQUIRED=on, /v1 answers only requests that came through the
            edge; a direct call to this host is refused. /health stays open for the health checks."""
            if state.origin_required and not self._from_edge():
                self._send(403, {"error": "forbidden"})
                return False
            return True

        def _client(self) -> str:
            """The address a request is limited by.

            With an origin secret set, only the edge is believed: its X-Client-IP when the secret
            matches, the socket's own peer otherwise, so a caller cannot pick its own bucket by
            sending a header. Without one (a service with no edge in front) the first
            X-Forwarded-For entry is used, as the host's proxy sets it."""
            peer = self.client_address[0] or "?"
            if state.origin_secret:
                if not self._from_edge():
                    return peer
                try:
                    return str(ipaddress.ip_address(self.headers.get("X-Client-IP", "").strip()))
                except ValueError:
                    return "edge"
            fwd = self.headers.get("X-Forwarded-For", "")
            return (fwd.split(",")[0].strip() if fwd else peer) or "?"

        def _device_token(self) -> str | None:
            u = urlsplit(self.path)
            if not u.path.startswith("/v1/devices/") or u.query:
                return None
            return u.path[len("/v1/devices/"):]

        def do_PUT(self):
            try:
                self._put()
            except Exception:
                self._send(500, {"error": "internal error"})

        def do_DELETE(self):
            try:
                self._delete()
            except Exception:
                self._send(500, {"error": "internal error"})

        def do_POST(self):
            self._send(405, {"error": "method not allowed"})

        def _put(self):
            token = self._device_token()
            if token is None:
                self._send(404, {"error": "not found"})
                return
            if not self._allowed():
                return
            if not state.limiter.allow(self._client()):
                self._send(429, {"error": "slow down"}, headers={"Retry-After": "60"})
                return
            raw_len = self.headers.get("Content-Length", "")
            if not raw_len.isdigit() or int(raw_len) > MAX_BODY:
                self._send(413 if raw_len.isdigit() else 411, {"error": "body required, at most 1024 bytes"})
                return
            raw = self.rfile.read(int(raw_len))
            try:
                reg = parse_registration(token, raw)
            except BadRequest as e:
                self._send(400, {"error": str(e)})
                return
            now = state.now()
            if state.store.device(token) is None and not state.limiter.allow_new():
                state.store.alert(clock.amritsar_date(now), "device_flood", "new-device cap reached; refusing new rows",
                                  now)
                self._send(429, {"error": "slow down"})
                return
            state.store.put_device(token, reg.env, reg.mode, reg.schedule, reg.scripture_sha256, now, reg.replaces)
            # The same rules the sender queues by, so the app can say "sent at 08:24" or "today's
            # came before you turned this on" instead of guessing.
            plan = plan_for_device(state.store, state.store.device(token), now)
            self._send(200, {"ok": True, **plan.as_json()}, cache="no-store")

        def _delete(self):
            token = self._device_token()
            if token is None or not valid_token(token):
                self._send(404 if token is None else 400, {"error": "not found" if token is None else "bad token"})
                return
            if not self._allowed():
                return
            if not state.limiter.allow(self._client()):
                self._send(429, {"error": "slow down"}, headers={"Retry-After": "60"})
                return
            gone = state.store.delete_device(token)
            self._send(200 if gone else 404, {"ok": gone}, cache="no-store")

    return Handler


def serve(state: State, host: str, port: int) -> ThreadingHTTPServer:
    httpd = ThreadingHTTPServer((host, port), make_handler(state))
    httpd.daemon_threads = True
    return httpd


def tick_loop(state: State, engine, stop: threading.Event, after_tick=None) -> None:
    """Poll on the clock's cadence; idle checks every 10 minutes so the window is never missed.
    ``after_tick`` runs after every poll (the public snapshot sync); it must not raise."""
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
        if after_tick:
            after_tick()
        step = clock.poll_interval(now) or timedelta(minutes=10)
        stop.wait(step.total_seconds())
