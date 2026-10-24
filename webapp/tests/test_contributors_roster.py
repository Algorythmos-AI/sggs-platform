"""The contributor roster (frontend/public/contributors.json) — one source for the web and the app.

Every entry must have the same shape, carry where its dates and region come from (`sources`), and
stay `review: "pending"` until a scholar signs it (gate G3). Facts the sources do not settle are
null, never guessed. Each roster name must be an exact `authors.name` in the pinned DB, and each
`authors` row must be in the roster, so the UI's joins by name never silently drop a voice.
"""
import json, re, sqlite3, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROSTER = ROOT / "frontend" / "public" / "contributors.json"
REAL_DB = ROOT / "db" / "sggs.sqlite"

KINDS = {"guru", "bhagat", "bhatt", "gursikh"}
REVIEW = {"pending", "signed"}
GURMUKHI = re.compile(r"^[਀-੿][਀-੿\s&().,·-]*$")
FIELDS = {
    "name", "roman", "kind", "seq", "born", "died", "circa", "era", "region", "tradition", "blurb",
    "gurmukhi_name", "region_point", "sources", "review",
}
# The voices whose Bani is currently credited to another author in the dataset. Their names are
# exactly the strings the sggs-data attribution change will write. This allow-list is removed in
# P2, the dataset.lock.json bump to that dataset — from then on every roster name must be in the DB.
NOT_YET_IN_DATASET = {
    "Bhagat Dhanna Ji", "Bhagat Pipa Ji", "Bhagat Sain Ji", "Bhagat Sadhna Ji",
    "Bhagat Parmanand Ji", "Bhagat Surdas Ji", "Baba Sundar Ji",
}


def _is_real_sqlite(p):
    try:
        with open(p, "rb") as f:
            return f.read(16) == b"SQLite format 3\x00"
    except OSError:
        return False


def _roster():
    return json.loads(ROSTER.read_text(encoding="utf-8"))["contributors"]


class RosterShape(unittest.TestCase):
    def setUp(self):
        self.rows = _roster()

    def test_names_are_unique_and_the_new_bhagats_are_present(self):
        names = [r["name"] for r in self.rows]
        self.assertEqual(len(names), len(set(names)))
        self.assertLessEqual(NOT_YET_IN_DATASET, set(names))

    def test_every_entry_has_exactly_the_roster_fields(self):
        for r in self.rows:
            with self.subTest(r["name"]):
                self.assertEqual(set(r), FIELDS)

    def test_types_and_ranges(self):
        for r in self.rows:
            with self.subTest(r["name"]):
                for k in ("name", "roman", "era", "region", "tradition", "blurb"):
                    self.assertIsInstance(r[k], str)
                    self.assertTrue(r[k].strip(), k)
                self.assertIn(r["kind"], KINDS)
                self.assertIsInstance(r["circa"], bool)
                if r["kind"] == "guru":
                    self.assertIn(r["seq"], range(1, 11))
                else:
                    self.assertIsNone(r["seq"])
                for k in ("born", "died"):
                    if r[k] is not None:
                        self.assertIsInstance(r[k], int)
                        self.assertTrue(1100 <= r[k] <= 1708, (k, r[k]))
                if r["born"] is not None and r["died"] is not None:
                    self.assertLess(r["born"], r["died"])

    def test_gurmukhi_name_is_gurmukhi(self):
        for r in self.rows:
            with self.subTest(r["name"]):
                g = r["gurmukhi_name"]
                self.assertTrue(g is None or GURMUKHI.match(g), g)

    def test_region_point_is_approximate_and_on_the_subcontinent(self):
        for r in self.rows:
            with self.subTest(r["name"]):
                p = r["region_point"]
                if p is None:
                    continue
                self.assertEqual(set(p), {"lat", "lon", "approx"})
                self.assertIs(p["approx"], True)
                self.assertTrue(5 <= p["lat"] <= 38 and 60 <= p["lon"] <= 97, p)

    def test_every_entry_is_cited_and_awaits_review(self):
        for r in self.rows:
            with self.subTest(r["name"]):
                self.assertIn(r["review"], REVIEW)
                self.assertIsInstance(r["sources"], list)
                self.assertTrue(r["sources"], "an entry without a source")
                for s in r["sources"]:
                    self.assertLessEqual({"title", "url"}, set(s))
                    self.assertTrue(s["title"].strip())
                    self.assertRegex(s["url"], r"^https://")


@unittest.skipUnless(_is_real_sqlite(REAL_DB), "needs the real db/sggs.sqlite (make dataset)")
class RosterJoinsTheDataset(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        con = sqlite3.connect(f"file:{REAL_DB}?mode=ro&immutable=1", uri=True)
        cls.authors = {n for (n,) in con.execute("SELECT name FROM authors")}
        con.close()
        cls.roster = {r["name"] for r in _roster()}

    def test_every_roster_name_is_an_author_in_the_db(self):
        missing = self.roster - self.authors - NOT_YET_IN_DATASET
        self.assertEqual(missing, set(), "roster names with no authors row (exact string match)")

    def test_every_author_in_the_db_is_in_the_roster(self):
        self.assertEqual(self.authors - self.roster, set(), "authors rows with no roster entry")

    def test_the_allow_list_is_not_stale(self):
        landed = NOT_YET_IN_DATASET & self.authors
        self.assertEqual(landed, set(), "now in the dataset: remove them from NOT_YET_IN_DATASET")


if __name__ == "__main__":
    unittest.main()
