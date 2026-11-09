"""The locate key: how a source's Gurmukhi is compared with the corpus.

This is used ONLY to find where a Hukamnama sits in the corpus. It never produces text anyone
reads; what is served is always the corpus line itself. The table is deliberately tiny and every
entry is justified against the corpus (``tests/test_locate.py`` proves the corpus contains none
of the mapped-from characters, so a mapping can never merge two different corpus words):

* NFC, then drop zero-width characters (ZWJ, ZWNJ, ZWSP, BOM).
* U+0A51 GURMUKHI SIGN UDAAT -> U+0A4D U+0A39 (virama + ha, the subjoined "pairin haha").
  SGPC's pages write ``ਸਮ\u0a51ਾਰੈ`` where the printed Granth (and our corpus) has ``ਸਮ੍ਹਾਰੈ``:
  a legacy-font conversion that used the udaat code point for the subjoined-ha glyph.
* Danda forms (``॥`` ``।`` ``|``) are separators, not words.
* Verse numbers (Gurmukhi or ASCII digits) are markers, not words, in verse bodies. In headings
  (``ਮਹਲਾ ੫``) they are kept, because there they carry meaning.
"""
from __future__ import annotations

import re
import unicodedata

_ZERO_WIDTH = dict.fromkeys(map(ord, "\u200b\u200c\u200d\u2060\ufeff"))
_MAPPINGS = (("\u0a51", "\u0a4d\u0a39"),)
_SEPARATORS = re.compile(r"[\s।॥|]+")
_DIGITS = re.compile(r"^[੦-੯0-9]+$")

GURMUKHI_DIGITS = str.maketrans("੦੧੨੩੪੫੬੭੮੯", "0123456789")


def locate_text(s: str) -> str:
    s = unicodedata.normalize("NFC", s).translate(_ZERO_WIDTH)
    for a, b in _MAPPINGS:
        s = s.replace(a, b)
    return unicodedata.normalize("NFC", s)


def words(s: str, *, keep_numbers: bool = False) -> list[str]:
    """The locate-key word sequence of ``s``."""
    out = [w for w in _SEPARATORS.split(locate_text(s)) if w]
    if not keep_numbers:
        out = [w for w in out if not _DIGITS.match(w)]
    return out


def gurmukhi_int(s: str) -> int:
    """``"੬੭੩"`` → 673 (ASCII digits pass through)."""
    t = s.strip().translate(GURMUKHI_DIGITS)
    if not t.isdigit():
        raise ValueError(f"not a number: {s!r}")
    return int(t)


def is_gurmukhi_text(s: str) -> bool:
    """True when the letters in ``s`` are Gurmukhi (a legacy ASCII font would fail this)."""
    letters = [c for c in s if c.isalpha()]
    return bool(letters) and all(0x0A00 <= ord(c) <= 0x0A7F for c in letters)
