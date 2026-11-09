"""One poll of the sources and every decision that follows from it. Pure apart from the injected
fetcher and clock, so tests replay whole mornings minute by minute.

Publish rule (all must hold; anything else waits or is held for the owner):
  * hs.sgpc.net parses into a complete candidate whose own date header is today's Amritsar date;
  * it resolves to exactly one run of corpus lines (``corpus.resolve``);
  * the **same** resolution was seen in an unbroken run of polls spanning at least
    ``STABLE_FOR`` (a page saved half-way never publishes);
  * the sgpc.net marquee, if it already shows today, agrees (Ang + opening words). If it still
    shows yesterday it is not waited for.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Callable

from . import clock
from .corpus import NoMatch, Resolution, agrees, resolve
from .sources import HS_URL, MUKHWAK_URL, Candidate, Fetched, ParseError, fetch, parse_hs, parse_mukhwak
from .store import Store

log = logging.getLogger("hukamnama")

STABLE_FOR = timedelta(minutes=2)
NO_MATCH_HOLD_AFTER = timedelta(minutes=5)   # the same unmatched page this long → hold + alert
NO_MATCH_HOLD_COUNT = 3
PARSE_ALERT_AFTER = 5                         # consecutive unparseable polls → the site likely changed

Fetcher = Callable[[str, "str | None"], Fetched]


@dataclass
class TickResult:
    action: str          # idle | waiting | published | held | watching | decided
    detail: str = ""


class Engine:
    def __init__(self, store: Store, con, fingerprint: str, fetcher: Fetcher = fetch,
                 alert_hook: Callable[[str, str, str], None] | None = None) -> None:
        self.store, self.con, self.fingerprint, self.fetcher = store, con, fingerprint, fetcher
        self.alert_hook = alert_hook
        self._etag: dict[str, str | None] = {}
        self._body: dict[str, str] = {}

    # -- helpers -----------------------------------------------------------------------------
    def _get(self, url: str) -> str:
        f = self.fetcher(url, self._etag.get(url))
        if f.status == 304 and url in self._body:
            return self._body[url]
        if f.status != 200 or f.body is None:
            raise OSError(f"HTTP {f.status}")
        self._etag[url], self._body[url] = f.etag, f.body
        return f.body

    def _alert(self, day, kind: str, detail: str, now: datetime) -> None:
        if self.store.alert(day, kind, detail, now):
            log.warning("ALERT %s %s: %s", day, kind, detail)
            if self.alert_hook:
                try:
                    self.alert_hook(day.isoformat(), kind, detail)
                except Exception:                      # an alert channel must never stop polling
                    log.exception("alert hook failed")

    def _candidate(self, url: str, parser, source: str, day, now) -> Candidate | None:
        try:
            cand = parser(self._get(url))
        except (OSError, ValueError) as e:              # network, HTTP, decoding
            self.store.observe(day, source, now, "fetch_error", detail=str(e)[:300])
            return None
        except ParseError as e:
            self.store.observe(day, source, now, "parse_error", detail=str(e)[:300])
            recent = [o["status"] for o in self.store.observations(day, source)[-PARSE_ALERT_AFTER:]]
            if len(recent) == PARSE_ALERT_AFTER and set(recent) == {"parse_error"}:
                self._alert(day, f"{source}_parse_failing", str(e)[:300], now)
            return None
        prev = self.store.last_structure(source)
        if prev and prev != cand.structure:
            self._alert(day, f"{source}_layout_changed", f"structure {prev} -> {cand.structure}", now)
        if cand.amritsar_date != day:
            self.store.observe(day, source, now, "not_today", structure=cand.structure,
                               detail=cand.amritsar_date.isoformat())
            return None
        return cand

    def _stable(self, day, res: Resolution, now: datetime) -> bool:
        run_start = None
        for o in reversed(self.store.observations(day, "hs")):
            if o["status"] == "fetch_error":
                continue                               # a dropped request is not a different page
            if o["status"] != "candidate" or o["res_key"] != res.key():
                break
            run_start = o["at"]
        return run_start is not None and now - run_start >= STABLE_FOR

    # -- the tick ----------------------------------------------------------------------------
    def tick(self, now: datetime, *, force: bool = False) -> TickResult:
        day = clock.amritsar_date(now)
        decided = self.store.decision(day)
        if decided and decided["status"] == "published":
            return self._watch(day, decided, now)
        if decided:
            return TickResult("decided", decided["reason"] or "held")
        if clock.poll_interval(now) is None and not force:
            if clock.amritsar_now(now).time() >= clock.SLOW_WINDOW[1]:
                self._alert(day, "not_published", "no Hukamnama resolved in today's window", now)
            return TickResult("idle")
        if clock.amritsar_now(now).time() >= clock.LATE_ALERT:
            self._alert(day, "late", f"not resolved by {clock.LATE_ALERT.isoformat('minutes')} IST", now)

        cand = self._candidate(HS_URL, parse_hs, "hs", day, now)
        if cand is None:
            return TickResult("waiting", "no complete page for today yet")
        res = resolve(self.con, cand)
        if isinstance(res, NoMatch):
            self.store.observe(day, "hs", now, "no_match", cand_key=cand.key(), structure=cand.structure,
                               detail=res.reason)
            same = [o for o in self.store.observations(day, "hs")
                    if o["status"] == "no_match" and o["cand_key"] == cand.key()]
            if len(same) >= NO_MATCH_HOLD_COUNT and now - same[0]["at"] >= NO_MATCH_HOLD_AFTER:
                reason = f"page does not match the corpus: {res.reason}"
                self.store.hold(day, now, "auto", reason)
                self._alert(day, "held_no_match", f"Ang {cand.ang}: {res.reason}", now)
                return TickResult("held", reason)
            return TickResult("waiting", res.reason)
        self.store.observe(day, "hs", now, "candidate", cand_key=cand.key(), res_key=res.key(),
                           structure=cand.structure)
        if not self._stable(day, res, now):
            return TickResult("waiting", "settling (stability rule)")

        veto = self._candidate(MUKHWAK_URL, parse_mukhwak, "mukhwak", day, now)
        if veto is not None:
            self.store.observe(day, "mukhwak", now, "candidate", cand_key=veto.key(), structure=veto.structure)
            if not agrees(res, veto, self.con):
                reason = f"sgpc.net disagrees: hs Ang {res.ang}, sgpc.net Ang {veto.ang}"
                self.store.hold(day, now, "auto", reason)
                self._alert(day, "held_veto", reason, now)
                return TickResult("held", reason)
        if self.store.publish(day, res, self.fingerprint, now, "auto"):
            log.info("published %s: Ang %s lines %s-%s", day, res.ang, res.first_line_id, res.last_line_id)
            return TickResult("published", res.key())
        return TickResult("decided", "decided concurrently")

    def _watch(self, day, decided: dict, now: datetime) -> TickResult:
        """After publishing, keep reading the sources for a while. A change is never applied
        automatically: it raises an alert and the owner decides."""
        published_at = datetime.fromisoformat(decided["decided_at"])
        if now - published_at > clock.CORRECTION_WATCH or decided["decided_by"] != "auto":
            return TickResult("idle", "published")
        if self.store.observations(day, "hs") and \
                now - self.store.observations(day, "hs")[-1]["at"] < timedelta(minutes=10):
            return TickResult("watching")
        cand = self._candidate(HS_URL, parse_hs, "hs", day, now)
        res_key = decided["resolution"] and "{first_line_id}-{last_line_id}-{range_sha256}".format(**decided["resolution"])
        if cand is not None:
            res = resolve(self.con, cand)
            key = res.key() if isinstance(res, Resolution) else None
            self.store.observe(day, "hs", now, "candidate" if key else "no_match", cand_key=cand.key(),
                               res_key=key, structure=cand.structure)
            if key != res_key:
                self._alert(day, "changed_after_publish", f"hs.sgpc.net now resolves to {key}", now)
        veto = self._candidate(MUKHWAK_URL, parse_mukhwak, "mukhwak", day, now)
        if veto is not None:
            res = Resolution(**decided["resolution"])
            if not agrees(res, veto, self.con):
                self._alert(day, "veto_after_publish", f"sgpc.net shows Ang {veto.ang}", now)
        return TickResult("watching")
