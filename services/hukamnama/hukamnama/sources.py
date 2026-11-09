"""Source adapters: SGPC page → a typed ``Candidate`` or a ``ParseError``. Never a partial result.

A candidate says *where* the Hukamnama is (its Amritsar date, Ang, heading and the locate-key
words of its verses). Its Gurmukhi is never served: ``resolver`` maps it onto corpus lines.

Pages are parsed with the stdlib ``html.parser`` into a small element list, which tolerates the
malformed markup SGPC serves (hs.sgpc.net puts its whole body after ``</html>``).
"""
from __future__ import annotations

import hashlib
import re
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from html.parser import HTMLParser

from . import USER_AGENT
from .locate import gurmukhi_int, is_gurmukhi_text, words

HS_URL = "https://hs.sgpc.net/"
MUKHWAK_URL = "https://sgpc.net/"
MIN_WORDS = 6          # two short verses at least; a stub or a half-saved page is shorter

_VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
_ANG = re.compile(r"ਅੰਗ\s*[:：]\s*([੦-੯0-9]{1,4})")
_HS_STAMP = re.compile(r"\b(\d{2})-(\d{2})-(\d{4})\s+\d{1,2}:\d{2}\s*(?:AM|PM)\b")
_GM_MONTHS = {"ਜਨਵਰੀ": 1, "ਫ਼ਰਵਰੀ": 2, "ਫਰਵਰੀ": 2, "ਮਾਰਚ": 3, "ਅਪ੍ਰੈਲ": 4, "ਅਪਰੈਲ": 4, "ਮਈ": 5,
              "ਜੂਨ": 6, "ਜੁਲਾਈ": 7, "ਅਗਸਤ": 8, "ਸਤੰਬਰ": 9, "ਅਕਤੂਬਰ": 10, "ਨਵੰਬਰ": 11, "ਦਸੰਬਰ": 12}
_GM_DATE = re.compile(r"([੦-੯]{1,2})\s+(" + "|".join(_GM_MONTHS) + r")\s*,?\s*([੦-੯]{4})")


class ParseError(Exception):
    """The page is not a well-formed, complete Hukamnama page. Never publish from it."""


@dataclass(frozen=True)
class Candidate:
    source: str                 # "hs" | "mukhwak"
    amritsar_date: date
    ang: int
    title: str | None           # the printed heading, e.g. "ਧਨਾਸਰੀ ਮਹਲਾ ੫॥" (locate only)
    body_words: tuple[str, ...]  # locate-key words of the verses; for "mukhwak" only an opening
    structure: str              # hash of the tag/class paths the parser relied on

    def key(self) -> str:
        """Identity for the stability rule: the same key twice, minutes apart, is a settled page."""
        h = hashlib.sha256()
        for part in (self.source, self.amritsar_date.isoformat(), str(self.ang), self.title or "", *self.body_words):
            h.update(part.encode("utf-8") + b"\x00")
        return h.hexdigest()


@dataclass
class _El:
    tag: str
    cls: tuple[str, ...]
    parent: int | None
    text: list[str] = field(default_factory=list)   # direct and descendant text, in order


class _Tree(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.els: list[_El] = []
        self.stack: list[int] = []
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip += 1
            return
        cls = tuple((dict(attrs).get("class") or "").split())
        self.els.append(_El(tag, cls, self.stack[-1] if self.stack else None))
        if tag not in _VOID:
            self.stack.append(len(self.els) - 1)

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self._skip = max(0, self._skip - 1)
            return
        for i in range(len(self.stack) - 1, -1, -1):        # tolerate unclosed children
            if self.els[self.stack[i]].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        if self._skip or not data.strip():
            return
        for i in self.stack:
            self.els[i].text.append(data)

    def text(self, i: int) -> str:
        return " ".join(" ".join(self.els[i].text).split())

    def within(self, i: int, ancestor: int) -> bool:
        p = self.els[i].parent
        while p is not None:
            if p == ancestor:
                return True
            p = self.els[p].parent
        return False

    def path(self, i: int) -> str:
        parts = []
        j: int | None = i
        while j is not None:
            e = self.els[j]
            parts.append(e.tag + "".join("." + c for c in sorted(e.cls)))
            j = e.parent
        return ">".join(reversed(parts))


def _tree(html: str) -> _Tree:
    t = _Tree()
    t.feed(html)
    t.close()
    return t


def _structure(t: _Tree, nodes: list[int]) -> str:
    return hashlib.sha256("\n".join(sorted(t.path(i) for i in nodes)).encode()).hexdigest()[:16]


def parse_hs(html: str) -> Candidate:
    """hs.sgpc.net: the Gurmukhi card (``div.hukamnama-card``), its stamp and its Ang."""
    t = _tree(html)
    cards = [i for i, e in enumerate(t.els) if e.tag == "div" and "hukamnama-card" in e.cls]
    if len(cards) != 1:
        raise ParseError(f"expected exactly one Gurmukhi card, found {len(cards)}")
    card = cards[0]
    texts = [i for i, e in enumerate(t.els)
             if e.tag == "p" and "hukamnama-text" in e.cls and t.within(i, card)]
    if len(texts) != 1:
        raise ParseError(f"expected one verse block in the card, found {len(texts)}")
    verses = t.text(texts[0])
    if not is_gurmukhi_text(verses):
        raise ParseError("verse block is not Unicode Gurmukhi (legacy font?)")
    body = tuple(words(verses))
    if len(body) < MIN_WORDS:
        raise ParseError(f"verse block too short ({len(body)} words): incomplete page?")
    titles = [i for i, e in enumerate(t.els) if e.tag == "h4" and t.within(i, card)]
    title = t.text(titles[0]) if titles else None
    if title is not None and not is_gurmukhi_text(title):
        title = None
    angs = {gurmukhi_int(m) for m in _ANG.findall(t.text(card))}
    if len(angs) != 1:
        raise ParseError(f"expected one Ang in the card, found {sorted(angs)}")
    stamps = {(int(d), int(m), int(y)) for d, m, y in _HS_STAMP.findall(" ".join(t.text(i) for i, e in enumerate(t.els)
                                                                               if e.tag == "strong"))}
    if len(stamps) != 1:
        raise ParseError(f"expected one date stamp, found {len(stamps)}")
    d, m, y = stamps.pop()
    try:
        day = date(y, m, d)
    except ValueError as e:
        raise ParseError(f"bad date stamp: {e}") from None
    return Candidate("hs", day, angs.pop(), title, body, _structure(t, [card, texts[0], *titles]))


def parse_mukhwak(html: str) -> Candidate:
    """sgpc.net: the Mukhwak marquee on every page — heading, opening verse(s), date, Ang.

    It carries only the opening of the Hukamnama, so it is a veto signal, never a source.
    """
    t = _tree(html)
    items = [i for i, e in enumerate(t.els) if e.tag == "span" and "marquee-item13" in e.cls]
    blocks = [t.text(i) for i in items if "ਮੁੱਖਵਾਕ" in t.text(i) and _ANG.search(t.text(i))]
    if len(set(blocks)) != 1:
        raise ParseError(f"expected one Mukhwak marquee, found {len(set(blocks))}")
    s = blocks[0]
    angs = {gurmukhi_int(a) for a in _ANG.findall(s)}
    dates = _GM_DATE.findall(s)
    if len(angs) != 1 or len(dates) != 1:
        raise ParseError("marquee lacks one Ang and one Gregorian date")
    dd, mon, yy = dates[0]
    try:
        day = date(gurmukhi_int(yy), _GM_MONTHS[mon], gurmukhi_int(dd))
    except ValueError as e:
        raise ParseError(f"bad marquee date: {e}") from None
    # the verses sit between the arrow image's heading and the weekday; take the text after the
    # first heading danda up to the date line, which starts with the weekday name
    after = s.split("ਸ੍ਰੀ ਅੰਮ੍ਰਿਤਸਰ", 1)[-1]
    head, _, rest = after.partition("॥")
    opening = rest.split(",", 1)[0]
    opening = re.split(r"(ਐਤਵਾਰ|ਸੋਮਵਾਰ|ਮੰਗਲਵਾਰ|ਬੁੱਧਵਾਰ|ਬੁਧਵਾਰ|ਵੀਰਵਾਰ|ਸ਼ੁੱਕਰਵਾਰ|ਸ਼ੁਕਰਵਾਰ|ਸ਼ਨਿੱਚਰਵਾਰ|ਸ਼ਨੀਵਾਰ)", opening)[0]
    body = tuple(words(opening))
    if len(body) < MIN_WORDS or not is_gurmukhi_text(opening):
        raise ParseError("marquee opening verse missing or not Gurmukhi")
    return Candidate("mukhwak", day, angs.pop(), (head + "॥").strip() or None, body, _structure(t, items))


@dataclass
class Fetched:
    status: int
    body: str | None            # None on 304 Not Modified
    etag: str | None
    fetched_at: datetime


def fetch(url: str, etag: str | None = None, timeout: float = 15.0) -> Fetched:
    """One polite GET: honest User-Agent, no-cache, conditional on the last ETag."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Cache-Control": "no-cache",
                                               "Accept": "text/html", **({"If-None-Match": etag} if etag else {})})
    now = datetime.now(timezone.utc)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:   # noqa: S310 - fixed https URLs
            raw = r.read(2_000_000)
            charset = r.headers.get_content_charset() or "utf-8"
            return Fetched(r.status, raw.decode(charset, "replace"), r.headers.get("ETag"), now)
    except urllib.error.HTTPError as e:
        if e.code == 304:
            return Fetched(304, None, etag, now)
        raise
