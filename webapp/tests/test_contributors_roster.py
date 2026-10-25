"""The contributor roster (frontend/public/contributors.json, schema v2) — one source for the web and the app.

tools/check_contributors.py is the gate: every entry keeps the fields the shipped app decodes, every life fact
names the tier-2 source it rests on, facts no source settles stay null, and every entry is a draft until the
scholar signs it (gate G3). Against the pinned DB it also proves that each roster name is an exact
`authors.name` (and each `authors` row is in the roster), that pen-names and notable Banis are verbatim in
the corpus, and that the allow-list of voices awaiting the sggs-data attribution repair cannot go stale.
"""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import check_contributors as cc  # noqa: E402

REAL_DB = ROOT / "db" / "sggs.sqlite"


def _is_real_sqlite(p):
    try:
        with open(p, "rb") as f:
            return f.read(16) == b"SQLite format 3\x00"
    except OSError:
        return False


class RosterShape(unittest.TestCase):
    def test_the_roster_passes_its_gate_without_the_db(self):
        rep = cc.run(cc.ROSTER, None, "testflight")
        self.assertEqual(rep.errors, [])

    def test_the_appstore_channel_refuses_unreviewed_entries(self):
        rep = cc.run(cc.ROSTER, None, "appstore")
        self.assertTrue(any("gate G3" in e for e in rep.errors))


@unittest.skipUnless(_is_real_sqlite(REAL_DB), "needs the real db/sggs.sqlite (make dataset)")
class RosterJoinsTheDataset(unittest.TestCase):
    def test_the_roster_passes_its_gate_against_the_pinned_db(self):
        rep = cc.run(cc.ROSTER, REAL_DB, "testflight")
        self.assertEqual(rep.errors, [])

    def test_the_allow_list_is_not_stale(self):
        import sqlite3
        con = sqlite3.connect(f"file:{REAL_DB}?mode=ro&immutable=1", uri=True)
        authors = {n for (n,) in con.execute("SELECT name FROM authors")}
        con.close()
        landed = cc.PENDING_ATTRIBUTION & authors
        self.assertEqual(landed, set(), "now in the dataset: remove them from PENDING_ATTRIBUTION")


if __name__ == "__main__":
    unittest.main()
