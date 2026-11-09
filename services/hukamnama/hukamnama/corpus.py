"""The fidelity gate: map a source candidate onto corpus lines, exactly or not at all.

A match means the candidate's verse words equal, word for word under the locate key, a run of
consecutive corpus lines that starts with a verse (not a heading) and ends on a line boundary.
There is no fuzzy tier: anything less than exact is ``NoMatch``, and the engine holds the day for
the owner. The served text is the corpus lines themselves, hashed so the phone can prove it holds
the same bytes (``range_sha256``) from the same corpus (``scripture_sha256``).
"""
from __future__ import annotations

import hashlib
import sqlite3
from dataclasses import dataclass

from .locate import words
from .sources import Candidate

ANG_SLACK_BEFORE = 1    # SGPC's Ang may name the page a shabad ends on…
ANG_SLACK_AFTER = 1     # …or our pagination may start it a page later
SPAN_AFTER = 3          # a long shabad or a Vaar unit may run on for pages


@dataclass(frozen=True)
class Line:
    id: int
    ang: int
    comp_id: int
    is_header: bool
    gurmukhi: str
    translit: str


@dataclass(frozen=True)
class Resolution:
    ang: int                    # the Ang of the first verse, as printed in our corpus (the citation)
    first_line_id: int          # includes the heading when the source's heading is the line before
    last_line_id: int
    comp_id: int
    opening_line_id: int
    opening_gurmukhi: str       # verbatim corpus text of the first verse
    opening_translit: str
    range_sha256: str
    line_count: int
    heading_included: bool

    def key(self) -> str:
        return f"{self.first_line_id}-{self.last_line_id}-{self.range_sha256}"


@dataclass(frozen=True)
class NoMatch:
    reason: str


def open_ro(path: str) -> sqlite3.Connection:
    con = sqlite3.connect(f"file:{path}?mode=ro&immutable=1", uri=True, check_same_thread=False)
    con.execute("PRAGMA query_only = ON")
    return con


def scripture_sha256(con: sqlite3.Connection) -> str:
    """Byte-identical to gurbani-soul-ios ``pipeline/build_ios_db.py:scripture_checksum``: it binds
    every line id to its verbatim text, so equal values prove the same ids carry the same text."""
    h = hashlib.sha256()
    for lid, g in con.execute("SELECT id, gurmukhi FROM lines ORDER BY id"):
        h.update(str(lid).encode()); h.update(b"\x00"); h.update((g or "").encode("utf-8")); h.update(b"\n")
    return h.hexdigest()


def range_sha256(texts: list[str]) -> str:
    """sha256 of the range's verbatim lines joined by ``\\n`` (UTF-8; the corpus is already NFC).
    The same definition runs on the phone before it renders a range."""
    return hashlib.sha256("\n".join(texts).encode("utf-8")).hexdigest()


def _lines(con: sqlite3.Connection, sql: str, args: tuple) -> list[Line]:
    return [Line(r[0], r[1], r[2], bool(r[3]), r[4] or "", r[5] or "")
            for r in con.execute(f"SELECT id, ang, comp_id, is_header, gurmukhi, translit FROM lines {sql}", args)]


def lines_in_range(con: sqlite3.Connection, first: int, last: int) -> list[Line]:
    if first > last or last - first > 400:
        raise ValueError("bad range")
    got = _lines(con, "WHERE id BETWEEN ? AND ? ORDER BY id", (first, last))
    if [x.id for x in got] != list(range(first, last + 1)):
        raise ValueError("range has gaps or ids missing from this corpus")
    return got


def resolution_for_range(con: sqlite3.Connection, first: int, last: int) -> Resolution:
    """Build the served record for an explicit range (owner approval, or after a match)."""
    rng = lines_in_range(con, first, last)
    verses = [x for x in rng if not x.is_header]
    if not verses:
        raise ValueError("range holds no verse")
    o = verses[0]
    return Resolution(ang=o.ang, first_line_id=first, last_line_id=last, comp_id=o.comp_id,
                      opening_line_id=o.id, opening_gurmukhi=o.gurmukhi, opening_translit=o.translit,
                      range_sha256=range_sha256([x.gurmukhi for x in rng]), line_count=len(rng),
                      heading_included=rng[0].is_header)


def resolve(con: sqlite3.Connection, cand: Candidate) -> Resolution | NoMatch:
    target = list(cand.body_words)
    if not target:
        return NoMatch("candidate has no verse words")
    window = _lines(con, "WHERE ang BETWEEN ? AND ? ORDER BY id",
                    (cand.ang - ANG_SLACK_BEFORE, cand.ang + ANG_SLACK_AFTER + SPAN_AFTER))
    lw = [words(x.gurmukhi) for x in window]
    matches: list[tuple[int, int]] = []
    for i, start in enumerate(window):
        if start.is_header or not (cand.ang - ANG_SLACK_BEFORE <= start.ang <= cand.ang + ANG_SLACK_AFTER):
            continue
        if not lw[i] or lw[i][0] != target[0]:
            continue
        acc: list[str] = []
        j = i
        while j < len(window) and len(acc) < len(target):
            if j > i and window[j].id != window[j - 1].id + 1:
                break                                    # never bridge an id gap
            acc.extend(lw[j])
            j += 1
        if acc == target:
            matches.append((i, j - 1))
    if not matches:
        return NoMatch(f"no exact run of corpus lines near Ang {cand.ang} equals the source verses")
    if len(matches) > 1:
        return NoMatch(f"{len(matches)} exact runs match (ambiguous)")
    i, j = matches[0]
    last = window[j]
    nxt = _lines(con, "WHERE id = ?", (last.id + 1,))
    if nxt and not (nxt[0].is_header or nxt[0].comp_id != last.comp_id):
        # a page saved half-way can end exactly on a verse; a Hukamnama ends where a composition
        # (shabad, or a Vaar's pauri) ends, so the next corpus line must open something new
        return NoMatch(f"source ends mid-composition at line {last.id} (incomplete page?)")
    first = window[i].id
    if cand.title and i > 0 and window[i - 1].is_header and window[i - 1].id == first - 1 \
            and words(window[i - 1].gurmukhi, keep_numbers=True) == words(cand.title, keep_numbers=True):
        first = window[i - 1].id
    return resolution_for_range(con, first, window[j].id)


def agrees(res: Resolution, veto: Candidate, con: sqlite3.Connection) -> bool:
    """Does a veto source (the sgpc.net marquee: Ang + opening words) agree with a resolution?"""
    if not (veto.ang - ANG_SLACK_BEFORE <= res.ang <= veto.ang + ANG_SLACK_AFTER):
        return False
    rng = lines_in_range(con, res.opening_line_id, res.last_line_id)
    body: list[str] = []
    for x in rng:
        body.extend(words(x.gurmukhi))
        if len(body) >= len(veto.body_words):
            break
    return body[:len(veto.body_words)] == list(veto.body_words)
