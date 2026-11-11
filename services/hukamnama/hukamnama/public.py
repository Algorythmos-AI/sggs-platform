"""The public snapshot: each published day written once, as a file, for the public API and site.

Public readers never query this process. When a day is published (or the owner corrects or holds
it) the service writes::

    v1/hukamnama/<YYYY-MM-DD>.json    the day: the read API's fields plus every line of the range
    v1/hukamnama/index.json           the published days, newest first

to a sink (a directory here; object storage in production), and an edge serves those files. So a
flood or an outage on the public API cannot slow the poller or the push sender, and the API keeps
answering while this process restarts.

Fidelity. A snapshot is written only when its lines, read again from the corpus, hash to the
``range_sha256`` the day was published with, in the corpus it was published in. Anything else is
skipped and reported: a snapshot is never built from text that does not prove.

Layers. ``gurmukhi`` is the verbatim corpus line. ``translit`` is the corpus's own rule-based
transliteration. The English translation is a separate, labelled layer (``lines[].en`` plus the
top-level ``translation``), present only when the meaning layer is switched on
(``HUKAMNAMA_MEANING=on``); it is never blended into the Gurmukhi.

A pending or held day has no file. The edge reports a day without a file as ``pending``.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import sqlite3
from datetime import date

from . import clock
from .api import day_record
from .corpus import range_sha256
from .store import Store

log = logging.getLogger("hukamnama")

SITE = "https://gurbanisoul.com"
TERMS_URL = f"{SITE}/en/developers#terms"
PREFIX = "v1/hukamnama/"
INDEX = PREFIX + "index.json"
META = "public:"                      # store.meta key prefix: public:<path> -> sha256 of what was written
MAX_LINES = 400                       # the same bound the phone enforces (HukamnamaEntry.maxRangeLines)
TRANSLATION = {"lang": "en", "translator": "Dr. Sant Singh Khalsa", "source": "ssk-shabados"}


class NotProven(Exception):
    """The day's lines do not prove against what was published; no snapshot may be written."""


def permalink(day: date, lang: str = "en") -> str:
    return f"{SITE}/{lang}/hukamnama/{day.isoformat()}"


def _range_lines(con: sqlite3.Connection, first: int, last: int) -> list[dict]:
    if first > last or last - first >= MAX_LINES:
        raise NotProven("bad range")
    rows = con.execute("SELECT id, ang, is_header, is_rahao, gurmukhi, translit, author, raag FROM lines "
                       "WHERE id BETWEEN ? AND ? ORDER BY id", (first, last)).fetchall()
    if [r[0] for r in rows] != list(range(first, last + 1)):
        raise NotProven("range has gaps or ids missing from this corpus")
    return [{"id": r[0], "ang": r[1], "is_heading": bool(r[2]), "is_rahao": bool(r[3]), "gurmukhi": r[4] or "",
             "translit": r[5] or "", "author": r[6], "raag": r[7]} for r in rows]


def _english(con: sqlite3.Connection, first: int, last: int) -> dict[int, str]:
    try:
        rows = con.execute("SELECT line_id, text FROM translations WHERE lang = ? AND source = ? "
                           "AND line_id BETWEEN ? AND ?",
                           (TRANSLATION["lang"], TRANSLATION["source"], first, last)).fetchall()
    except sqlite3.OperationalError:          # a Gurmukhi-only corpus has no translations table
        return {}
    return {lid: text for lid, text in rows if text}


def public_record(store: Store, con: sqlite3.Connection, day: date, fingerprint: str, *,
                  meaning: bool = False) -> dict | None:
    """The public record for a published day, or None when the day is not published.

    Raises ``NotProven`` when the day was published in another corpus or its lines no longer hash
    to the published ``range_sha256``.
    """
    d = store.decision(day)
    if not d or d["status"] != "published":
        return None
    if d["scripture_sha256"] != fingerprint:
        raise NotProven(f"published in corpus {d['scripture_sha256'][:12]}, serving {fingerprint[:12]}")
    res = d["resolution"]
    lines = _range_lines(con, res["first_line_id"], res["last_line_id"])
    if range_sha256([x["gurmukhi"] for x in lines]) != res["range_sha256"]:
        raise NotProven("range_sha256 does not match the corpus lines")

    rec = day_record(store, day, fingerprint, clock.utcnow())     # the frozen fields the app reads
    verses = [x for x in lines if not x["is_heading"]]
    authors = {x["author"] for x in verses}
    rec["ang_end"] = lines[-1]["ang"]
    rec["raag"] = verses[0]["raag"]
    # A Vaar day mixes saloks and pauris by different authors: then there is no single author.
    rec["author"] = authors.pop() if len(authors) == 1 else None
    rec["url"] = permalink(day)
    rec["attribution"] = {"text": "Hukamnama · Sri Harmandir Sahib, via Gurbani Soul", "url": permalink(day)}
    rec["terms_url"] = TERMS_URL
    english = _english(con, res["first_line_id"], res["last_line_id"]) if meaning else {}
    out = []
    for x in lines:
        row = {"id": x["id"], "ang": x["ang"], "gurmukhi": x["gurmukhi"], "translit": x["translit"],
               "is_heading": x["is_heading"], "is_rahao": x["is_rahao"], "author": x["author"]}
        if x["id"] in english:
            row["en"] = english[x["id"]]
        out.append(row)
    rec["lines"] = out
    if english:
        rec["translation"] = dict(TRANSLATION)
    return rec


def encode(obj: dict) -> bytes:
    return (json.dumps(obj, ensure_ascii=False) + "\n").encode("utf-8")


class DirSink:
    """Writes objects under a directory, atomically (a reader never sees half a file)."""
    def __init__(self, root: str) -> None:
        self.root = root
        os.makedirs(root, exist_ok=True)

    def _path(self, key: str) -> str:
        p = os.path.normpath(os.path.join(self.root, key))
        if not p.startswith(os.path.normpath(self.root) + os.sep):
            raise ValueError("key escapes the sink")
        return p

    def put(self, key: str, body: bytes) -> None:
        p = self._path(key)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        tmp = p + ".tmp"
        with open(tmp, "wb") as f:
            f.write(body)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, p)

    def delete(self, key: str) -> None:
        try:
            os.remove(self._path(key))
        except FileNotFoundError:
            pass


class Publisher:
    """Keeps the sink equal to the store's published days. ``sync`` is idempotent and cheap when
    nothing changed, so it runs after every poll and once, in full, at start."""
    def __init__(self, store: Store, con: sqlite3.Connection, fingerprint: str, sink, *, meaning: bool = False) -> None:
        self.store, self.con, self.fingerprint, self.sink, self.meaning = store, con, fingerprint, sink, meaning
        self._full_sync_due = True          # the first sync_safely rewrites everything (see there)

    def desired(self) -> tuple[dict[str, bytes], list[str]]:
        objects: dict[str, bytes] = {}
        skipped: list[str] = []
        days = []
        for d in self.store.published():
            day = date.fromisoformat(d["amritsar_date"])
            try:
                rec = public_record(self.store, self.con, day, self.fingerprint, meaning=self.meaning)
            except NotProven as e:
                skipped.append(f"{day}: {e}")
                continue
            if rec is None:
                continue
            objects[f"{PREFIX}{day.isoformat()}.json"] = encode(rec)
            days.append({"amritsar_date": rec["amritsar_date"], "ang": rec["ang"], "raag": rec["raag"],
                         "author": rec["author"], "line_count": rec["line_count"],
                         "range_sha256": rec["range_sha256"], "published_at": rec["published_at"]})
        days.sort(key=lambda x: x["amritsar_date"], reverse=True)
        objects[INDEX] = encode({"scripture_sha256": self.fingerprint, "latest": days[0]["amritsar_date"] if days else None,
                                 "days": days})
        return objects, skipped

    def sync(self, *, force: bool = False) -> dict:
        """Write what changed, delete what is no longer published. ``force`` rewrites everything
        (used at start, so an emptied sink is refilled)."""
        objects, skipped = self.desired()
        written, deleted = [], []
        # day files first, the index last: a reader of the index never finds a day that is not there yet
        for key in sorted(objects, key=lambda k: (k == INDEX, k)):
            digest = hashlib.sha256(objects[key]).hexdigest()
            if not force and self.store.get_meta(META + key) == digest:
                continue
            self.sink.put(key, objects[key])
            self.store.set_meta(META + key, digest)
            written.append(key)
        for key in self.store.meta_keys(META):
            path = key[len(META):]
            if path not in objects:
                self.sink.delete(path)
                self.store.del_meta(key)
                deleted.append(path)
        for s in skipped:
            log.error("public snapshot skipped, %s", s)
        if written or deleted:
            log.info("public snapshot: wrote %d, deleted %d", len(written), len(deleted))
        return {"written": written, "deleted": deleted, "skipped": skipped}

    def sync_safely(self) -> None:
        """For the poll loop: publishing files must never stop polling or sending.

        The first call that succeeds writes everything (so an emptied or newly added sink is
        filled); until one succeeds, every call tries the full write again."""
        try:
            self.sync(force=self._full_sync_due)
            self._full_sync_due = False
        except Exception:
            log.exception("public snapshot sync failed")
