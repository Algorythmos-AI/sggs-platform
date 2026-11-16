"""The fetch archive: every distinct page the poller saw, kept as raw bytes for replay.

The soak exists to measure SGPC's real behaviour (publish minute, the hs.sgpc.net ↔ sgpc.net lag,
half-saved pages, layout changes) and to build the replay corpus the engine tests run against.
So the archive records each response whose body differs from the previous one for that URL,
gzip-compressed, under the Amritsar date it was fetched on::

    <dir>/2026-11-09/000512Z-hs.html.gz
    <dir>/2026-11-09/index.ndjson      one line per fetch: time, source, status, etag, sha256, file

Unchanged bodies (and 304s) add only an index line, so a morning of minute polls costs a few
files. The archive never affects a decision: any error writing it is logged and swallowed.
Nothing here is scripture; it is SGPC's page as served, kept for evidence.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import logging
import os
from datetime import datetime, timedelta

from . import clock
from .sources import HS_URL, MUKHWAK_URL, Fetched

log = logging.getLogger("hukamnama")

SOURCES = {HS_URL: "hs", MUKHWAK_URL: "mukhwak"}
KEEP_DAYS = 60


class Archive:
    def __init__(self, root: str, keep_days: int = KEEP_DAYS) -> None:
        self.root, self.keep_days = root, keep_days
        self._last: dict[str, str] = {}
        self._pruned = None
        os.makedirs(root, exist_ok=True)

    def record(self, url: str, f: Fetched) -> None:
        try:
            self._record(url, f)
        except Exception:                               # evidence must never stop polling
            log.exception("archive write failed")

    def _record(self, url: str, f: Fetched) -> None:
        source = SOURCES.get(url, "other")
        day = clock.amritsar_date(f.fetched_at).isoformat()
        d = os.path.join(self.root, day)
        os.makedirs(d, exist_ok=True)
        entry = {"at": f.fetched_at.isoformat(timespec="seconds"), "source": source, "status": f.status,
                 "etag": f.etag, "sha256": None, "file": None}
        if f.body is not None:
            raw = f.body.encode("utf-8")
            digest = hashlib.sha256(raw).hexdigest()
            entry["sha256"] = digest
            if self._last.get(url) != digest:
                name = f"{f.fetched_at.strftime('%H%M%SZ')}-{source}.html.gz"
                tmp = os.path.join(d, name + ".tmp")
                with gzip.open(tmp, "wb") as g:
                    g.write(raw)
                os.replace(tmp, os.path.join(d, name))
                entry["file"] = name
                self._last[url] = digest
        with open(os.path.join(d, "index.ndjson"), "a", encoding="utf-8") as idx:
            idx.write(json.dumps(entry) + "\n")

    def prune(self, now: datetime) -> int:
        """Delete day folders older than keep_days (by their Amritsar date). Returns the count."""
        cutoff = (clock.amritsar_date(now) - timedelta(days=self.keep_days)).isoformat()
        gone = 0
        for name in sorted(os.listdir(self.root)):
            p = os.path.join(self.root, name)
            if len(name) == 10 and name < cutoff and os.path.isdir(p):
                for f in os.listdir(p):
                    os.remove(os.path.join(p, f))
                os.rmdir(p)
                gone += 1
        return gone

    def wrap(self, fetcher):
        """A fetcher that archives what the given fetcher returns (errors pass through)."""
        def archived(url: str, etag: str | None = None) -> Fetched:
            f = fetcher(url, etag)
            day = clock.amritsar_date(f.fetched_at)
            if day != self._pruned:
                self._pruned = day
                try:
                    self.prune(f.fetched_at)
                except OSError:
                    log.exception("archive prune failed")
            self.record(url, f)
            return f
        return archived
