#!/usr/bin/env python3
"""
The corpus facts the traditional-saroop display layer relies on (frontend/src/scripts/saroop.ts,
and Saroop.swift in gurbani-soul-ios). The painter draws every subjoined-yayya run as the yakash
sign U+0A75, and copy/pin map U+0A75 back to the stored doubled form. That round trip is exact only
while the corpus (a) never contains U+0A75 itself and (b) stores every subjoined yayya as exactly
one doubled run. If a dataset change breaks either, this fails before a reader can copy altered text.
"""
import os, re, sqlite3, sys, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "webapp"))
import serve  # noqa: E402

YAKASH = "ੵ"
VERBATIM = "੍ਯ੍ਯ"          # ੍ਯ੍ਯ
RUN = re.compile("(?:੍ਯ)+")          # what the painter collapses


def to_display(s: str) -> str:
    return RUN.sub(YAKASH, s)


def to_verbatim(s: str) -> str:
    return s.replace(YAKASH, VERBATIM)


@unittest.skipUnless(os.path.exists(serve.DB), "db/sggs.sqlite not present (run `make dataset`)")
class SaroopRoundTrip(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        con = sqlite3.connect(f"file:{serve.DB}?mode=ro&immutable=1", uri=True)
        cls.lines = [g for (g,) in con.execute("SELECT gurmukhi FROM lines")]
        con.close()

    def test_the_corpus_never_contains_the_display_mark(self):
        self.assertEqual(sum(g.count(YAKASH) for g in self.lines), 0)

    def test_every_subjoined_yayya_is_one_doubled_run(self):
        runs = [m.group(0) for g in self.lines for m in RUN.finditer(g)]
        self.assertGreater(len(runs), 0)
        self.assertEqual({r for r in runs}, {VERBATIM})

    def test_display_then_verbatim_is_byte_identical_for_every_line(self):
        for g in self.lines:
            self.assertEqual(to_verbatim(to_display(g)), g)


if __name__ == "__main__":
    unittest.main()
