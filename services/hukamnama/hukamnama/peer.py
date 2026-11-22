"""The two Hukamnama services watch each other: a dead-man check that runs on time.

The external dead-man check (``hukamnama-deadman.yml``) runs on GitHub's cron, which started 6-9 h
late every day of November 2026 (the 00:30 UTC run at 06:53-07:50 UTC, the 08:45 UTC one at
15:21-18:56 UTC), so "the service is down" reached the owner in the afternoon. A service cannot
report its own death, but its sibling can: staging watches production and production watches
staging, every ``EVERY`` inside the morning window, and alerts through its own phone channel
when the other one is unreachable, reports ``ok=false``, or its poller has stopped.

Only liveness is checked here. A hold, a late or a missing Hukamnama is already alerted by the
service that saw it, at the minute it happens. A problem must persist for ``CONFIRM`` consecutive
checks (a deploy or a Render restart is a minute or two), and is alerted once per Amritsar day.
The GitHub check stays as the backstop for both services going down together.

Configuration: ``HUKAMNAMA_PEER_URL`` = the other service's own https origin
(``https://sggs-hukamnama-prod.onrender.com`` on staging, the staging origin on production). Unset,
nothing is watched. It reads only ``/health``, which carries no reader data.
"""
from __future__ import annotations

import json
import logging
import threading
import urllib.request
from datetime import datetime, time, timedelta
from typing import Callable

from . import USER_AGENT, clock
from .store import Store

log = logging.getLogger("hukamnama")

WINDOW = (time(5, 15), time(14, 15))      # Amritsar time: from just after polling starts to the close
EVERY = timedelta(minutes=5)
CONFIRM = 3                               # consecutive failed checks before alerting (≥ 10 min)
STALE = timedelta(minutes=15)             # the peer polls 1-10 min apart inside its window
POLL_WINDOW = (time(5, 15), time(14, 0))  # the peer's poll window (05:00-14:00), after its first STALE
KIND = "peer_down"


def get_health(url: str, timeout: float = 20) -> dict:
    req = urllib.request.Request(url.rstrip("/") + "/health",
                                 headers={"User-Agent": USER_AGENT, "Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=timeout) as r:   # noqa: S310 - the configured https URL
        return json.load(r)


def problem(health: dict | Exception, now: datetime) -> str | None:
    """Pure: what is wrong with the peer, or None."""
    if isinstance(health, Exception):
        return f"unreachable ({health.__class__.__name__}: {str(health)[:120]})"
    if not health.get("ok"):
        return "/health reports ok=false"
    t = clock.amritsar_now(now).time()
    if POLL_WINDOW[0] <= t < POLL_WINDOW[1]:
        last = health.get("last_tick")
        if not last:
            return "its poller has not run since it started"
        age = now - datetime.fromisoformat(last)
        if age > STALE:
            return f"its poller is stale: last poll {int(age.total_seconds() // 60)} min ago"
    return None


class PeerWatch:
    def __init__(self, store: Store, url: str, alert: Callable[[str, str, str], None] | None,
                 fetch: Callable[[str], dict] = get_health) -> None:
        if not url.startswith("https://"):
            raise ValueError("HUKAMNAMA_PEER_URL must be an https:// origin")
        self.store, self.url, self.alert, self.fetch = store, url.rstrip("/"), alert, fetch
        self.failures: list[str] = []

    def check(self, now: datetime) -> str | None:
        """One check. Returns the problem when it was alerted (first time today), else None."""
        t = clock.amritsar_now(now).time()
        if not WINDOW[0] <= t < WINDOW[1]:
            self.failures = []
            return None
        try:
            health: dict | Exception = self.fetch(self.url)
        except Exception as e:                     # network, HTTP, JSON: all mean "cannot read it"
            health = e
        p = problem(health, now)
        if p is None:
            self.failures = []
            return None
        self.failures.append(p)
        log.warning("peer %s: %s (%d/%d)", self.url, p, len(self.failures), CONFIRM)
        if len(self.failures) < CONFIRM:
            return None
        day = clock.amritsar_date(now)
        detail = f"{self.url}: {p} (for {len(self.failures)} checks, {EVERY.seconds // 60} min apart)"
        if not self.store.alert(day, KIND, detail, now):
            return None                             # already alerted today
        log.warning("ALERT %s %s: %s", day, KIND, detail)
        if self.alert:
            try:
                self.alert(day.isoformat(), KIND, detail)
            except Exception:
                log.exception("alert hook failed")
        return detail


def loop(watch: PeerWatch, stop: threading.Event, now=clock.utcnow) -> None:
    while not stop.is_set():
        try:
            watch.check(now())
        except Exception:
            log.exception("peer check failed")
        stop.wait(EVERY.total_seconds())


def from_env(env, store: Store, alert) -> PeerWatch | None:
    url = (env.get("HUKAMNAMA_PEER_URL") or "").strip()
    return PeerWatch(store, url, alert) if url else None
