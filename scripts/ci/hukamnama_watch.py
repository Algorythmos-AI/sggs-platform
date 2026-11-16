#!/usr/bin/env python3
"""Watch the Hukamnama service from outside it (stdlib only).

  hukamnama_watch.py wait    BASE_URL --commit SHA [--timeout 1200]
      Poll BASE_URL/health until the service runs exactly this commit and reports ok.
  hukamnama_watch.py deadman BASE_URL
      The external dead-man check: exit 1, with the reasons on stdout, when the service is
      unreachable, the poller is stale inside the publish window, nothing has resolved by
      07:00 IST, or the service raised an alert today.

The service's own alerts live on /health; this check is what notices when the service itself is
down or wedged, which it cannot report about itself.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
from datetime import datetime, time as dtime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))
WINDOW = (dtime(5, 0), dtime(14, 0))          # the poller's publish window, Amritsar time
LATE = dtime(7, 0)                            # matches the service's own `late` alert
STALE = timedelta(minutes=15)                 # polls are 1–10 min apart inside the window
# kinds the service raises (services/hukamnama/README.md "Polling and alerts")
ALERT_KINDS_INFO = {"late", "not_published"}  # reported by the time checks below already


def get_health(base: str, timeout: float = 20) -> dict:
    req = urllib.request.Request(base.rstrip("/") + "/health",
                                 headers={"User-Agent": "GurbaniSoul-Hukamnama-watch/1.0", "Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=timeout) as r:   # noqa: S310 - our own https URL
        return json.load(r)


def problems(health: dict, now: datetime) -> list[str]:
    """Pure: what is wrong, given /health and the current time (UTC-aware)."""
    out: list[str] = []
    if not health.get("ok"):
        out.append("/health reports ok=false")
    ist = now.astimezone(IST)
    in_window = WINDOW[0] <= ist.time() < WINDOW[1]
    last = health.get("last_tick")
    if in_window:
        if not last:
            out.append("the poller has not run since the service started")
        else:
            age = now - datetime.fromisoformat(last)
            if age > STALE:
                out.append(f"the poller is stale: last poll {int(age.total_seconds() // 60)} min ago")
    if ist.time() >= LATE and health.get("status_today") != "published":
        decision = health.get("decision_today")
        out.append(f"no Hukamnama published for {health.get('amritsar_date')} by "
                   f"{'07:00' if ist.time() < WINDOW[1] else '14:00'} IST"
                   + (f" (decision: {decision})" if decision else ""))
    for a in health.get("alerts_today") or []:
        if a.get("kind") not in ALERT_KINDS_INFO:
            out.append(f"service alert {a.get('kind')}: {a.get('detail')}")
    return out


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    w = sub.add_parser("wait")
    w.add_argument("base_url")
    w.add_argument("--commit", required=True)
    w.add_argument("--timeout", type=int, default=1200)
    w.add_argument("--interval", type=int, default=15)
    d = sub.add_parser("deadman")
    d.add_argument("base_url")
    a = p.parse_args(argv)

    if a.cmd == "wait":
        deadline = time.monotonic() + a.timeout
        seen = None
        while time.monotonic() < deadline:
            try:
                h = get_health(a.base_url)
                seen = h.get("commit")
                if seen == a.commit and h.get("ok"):
                    print(f"running {seen[:7]} ok; scripture {str(h.get('scripture_sha256'))[:12]}")
                    return 0
            except OSError as e:
                seen = f"unreachable ({e.__class__.__name__})"
            time.sleep(a.interval)
        print(f"timed out: service reports {seen!r}, expected {a.commit}")
        return 1

    try:
        h = get_health(a.base_url)
    except (OSError, ValueError) as e:
        print(f"the Hukamnama service is unreachable: {e}")
        return 1
    found = problems(h, datetime.now(timezone.utc))
    print(json.dumps({k: h.get(k) for k in ("amritsar_date", "status_today", "decision_today", "last_tick",
                                            "last_tick_action", "commit")}, ensure_ascii=False))
    for f in found:
        print(f"PROBLEM: {f}")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
