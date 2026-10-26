"""Every common roman spelling of ਵਾਹਿਗੁਰੂ finds the same lines, in the search API and in theme
search. The site shows the Name as "Waheguru"; the theme's slug stays `vahiguru` (URLs, the API,
saved data). Run: python3 -m unittest webapp.tests.test_waheguru_spellings -v
"""
import os, sys, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "webapp"))
import serve  # noqa: E402
from sggs.search import concept_by_fold  # noqa: E402

SPELLINGS = ("waheguru", "Waheguru", "vaheguru", "Vaheguru", "vahiguru", "wahiguru")
JI_FORMS = ("waheguruji", "Waheguruji", "vaheguruji", "vahiguruji", "wahiguruji")
skip_no_db = unittest.skipUnless(os.path.exists(serve.DB), "db/sggs.sqlite not present (run `make dataset`)")


def search(q, mode):
    return serve.api("/api/search", {"q": [q], "mode": [mode], "limit": ["50"]})


@skip_no_db
class WaheguruSpellings(unittest.TestCase):
    def test_auto_search_finds_the_same_lines_for_every_spelling(self):
        want = search("waheguru", "auto")
        self.assertTrue(want["results"])
        ids = [r["id"] for r in want["results"]]
        for q in SPELLINGS + JI_FORMS + ("WAHEGURU",):
            with self.subTest(q=q):
                got = search(q, "auto")
                self.assertEqual([r["id"] for r in got["results"]], ids)
                self.assertEqual(got["mode"], want["mode"])

    def test_every_result_carries_the_name(self):
        # the lines are the ones that say ਵਾਹਿਗੁਰੂ, never a raag header that only folds alike
        for r in search("vaheguru", "auto")["results"]:
            self.assertIn("ਵਾਹਿਗੁਰੂ", r["gurmukhi"])

    def test_the_same_phrase_in_any_spelling(self):
        ids = [r["id"] for r in search("satnam waheguru", "auto")["results"]]
        self.assertTrue(ids)
        for q in ("satnam vaheguru", "satnam vahiguru", "satnam wahiguru"):
            with self.subTest(q=q):
                self.assertEqual([r["id"] for r in search(q, "auto")["results"]], ids)

    def test_theme_search_opens_the_waheguru_theme_for_every_spelling(self):
        want = search("vahiguru", "theme")
        self.assertEqual(want["concept"]["name"], "vahiguru")      # the slug is unchanged
        ids = [r["id"] for r in want["results"]]
        self.assertTrue(ids)
        for q in SPELLINGS:
            with self.subTest(q=q):
                got = search(q, "theme")
                self.assertEqual(got["concept"]["name"], "vahiguru")   # not Naam, whose description mentions Waheguru
                self.assertEqual([r["id"] for r in got["results"]], ids)

    def test_a_fold_shared_by_two_themes_does_not_guess(self):
        # bani and bhana both fold to 'vn': exact slugs still win, a third spelling picks neither by fold
        self.assertEqual(search("bani", "theme")["concept"]["name"], "bani")
        self.assertEqual(search("bhana", "theme")["concept"]["name"], "bhana")
        self.assertIsNone(concept_by_fold("baanee"))


if __name__ == "__main__":
    unittest.main()
