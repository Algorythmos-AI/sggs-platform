"""One English record covering several printed lines (dataset 1.4.0, translation_spans).

Every member line in a response carries en_span; the English sits on the last member present,
so a list shows it once under the group even when an Ang boundary cuts the span.
"""
import sys, unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
REAL_DB = ROOT / "db" / "sggs.sqlite"


def _real(p):
    try:
        with open(p, "rb") as f:
            return f.read(16) == b"SQLite format 3\x00"
    except OSError:
        return False


@unittest.skipUnless(_real(REAL_DB), "needs the real db/sggs.sqlite (make dataset)")
class EnglishSpans(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sys.path.insert(0, str(ROOT / "webapp"))
        from sggs.core import attach_translations
        cls.attach = staticmethod(attach_translations)

    def lines(self, *ids):
        return self.attach([{"id": i} for i in ids])

    def test_ang_734_span_shows_once_under_its_last_line(self):
        a, b, c = self.lines(31528, 31529, 31530)[0:3]
        self.assertNotIn("en_span", a)
        self.assertEqual(b["en_span"], {"first": 31529, "last": 31530})
        self.assertNotIn("en", b)
        self.assertEqual(c["en_span"], {"first": 31529, "last": 31530})
        self.assertTrue(c["en"].startswith("The devotees of the Lord plant the seed"))

    def test_boundary_puts_the_english_on_the_last_member_present(self):
        (only,) = self.lines(31529)
        self.assertEqual(only["en_span"], {"first": 31529, "last": 31530})
        self.assertTrue(only["en"].startswith("The devotees of the Lord plant the seed"))

    def test_lines_outside_spans_are_unchanged(self):
        (l,) = self.lines(31528)
        self.assertTrue(l["en"].startswith("The Lord's wealth is like jewels"))
        self.assertNotIn("en_span", l)


if __name__ == "__main__":
    unittest.main()
