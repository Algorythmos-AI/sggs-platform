"""tools/check_contributors.py catches what it promises to: a fixture roster and corpus, broken one way at a time."""
import copy
import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import check_contributors as cc  # noqa: E402

EOS = {"ref": "EoS", "entry": "X", "url": "https://example.org/x",
       "supports": ["born", "died", "birthplace", "place", "range_note", "context"]}


def voice(name, chhap, line_id, ang, **extra):
    v = {"name": name, "roman": name, "display": name, "gurmukhi": "ਭਗਤ ਕਬੀਰ ਜੀ", "kind": "bhagat", "seq": None,
         "born": 1398, "died": None, "circa": True, "range_note": "Death year disputed.", "era": "15th c.",
         "region": "Banaras", "tradition": "Sant", "blurb": "A weaver.", "context": "A weaver of Kashi.",
         "chhap": chhap, "chhap_example": {"line_id": line_id, "ang": ang}, "notable": [],
         "place": {"label": "Kashi", "x": 0.5, "y": 0.5, "lat": 22.5, "lon": 78.0, "approx": True},
         "sources": [dict(EOS), {"ref": "SGGS", "entry": "Ang 92", "supports": ["chhap", "notable"]}],
         "review": {"status": "draft", "reviewer": None, "date": None}}
    v.update(extra)
    return v


class Checker(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        d = Path(self.tmp.name)
        self.db = d / "fixture.sqlite"
        con = sqlite3.connect(self.db)
        con.executescript("""
            CREATE TABLE authors(name TEXT PRIMARY KEY, first_ang INT, last_ang INT, n_lines INT);
            CREATE TABLE lines(id INTEGER PRIMARY KEY, ang INT, author TEXT, comp_id INT, is_header INT, gurmukhi TEXT);
            INSERT INTO authors VALUES ('Bhagat Kabir Ji', 92, 92, 2);
            INSERT INTO lines VALUES (1, 92, 'Bhagat Kabir Ji', 10, 1, 'ਸ੍ਰੀਰਾਗੁ ਕਬੀਰ ਜੀਉ');
            INSERT INTO lines VALUES (2, 92, 'Bhagat Kabir Ji', 10, 0, 'ਕਹਤ ਕਬੀਰ ਛੋਡਿ ਬਿਖਿਆ ਰਸ ॥੧॥');
            INSERT INTO lines VALUES (3, 695, 'Bhagat Kabir Ji', 11, 0, 'ਜਨੁ ਧੰਨਾ ਲੇਵੈ ਮੰਗੀ ॥੨॥੪॥');
            INSERT INTO lines VALUES (4, 1253, 'Guru Arjan Dev Ji (M5)', 12, 0, 'ਸੂਰਦਾਸ ਮਨੁ ਪ੍ਰਭਿ ਹਥਿ ਲੀਨੋ ਦੀਨੋ ਇਹੁ ਪਰਲੋਕ ॥੨॥੧॥੮॥');
        """)
        con.commit()
        con.close()
        self.base = {"source_index": {"EoS": {"title": "EoS"}, "SGGS": {"title": "corpus"}},
                     "map": {"lon": [66.0, 90.0], "lat": [8.0, 37.0]},
                     "contributors": [voice("Bhagat Kabir Ji", ["ਕਬੀਰ"], 2, 92,
                                            notable=[{"title": "Siri", "comp_id": 10, "ang": 92, "anchor": "ਕਬੀਰ ਜੀਉ"}])]}
        self.cc_expected = cc.EXPECTED
        cc.EXPECTED = 1

    def tearDown(self):
        cc.EXPECTED = self.cc_expected
        self.tmp.cleanup()

    def run_with(self, doc, channel="testflight"):
        p = Path(self.tmp.name) / "roster.json"
        p.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
        return cc.run(p, self.db, channel)

    def mutate(self, fn):
        doc = copy.deepcopy(self.base)
        fn(doc["contributors"][0], doc)
        return self.run_with(doc)

    def assertError(self, rep, needle):
        self.assertTrue(any(needle in e for e in rep.errors), (needle, rep.errors))

    def test_the_fixture_passes(self):
        rep = self.run_with(self.base)
        self.assertEqual(rep.errors, [])

    def test_a_chhap_absent_from_the_voices_verses_fails(self):
        self.assertError(self.mutate(lambda c, d: c.update(chhap=["ਨਾਮਾ"])), "chhap ਨਾਮਾ is not found")

    def test_a_chhap_matches_whole_words_only(self):
        self.assertError(self.mutate(lambda c, d: c.update(chhap=["ਕਬੀ"])), "chhap ਕਬੀ is not found")

    def test_a_life_fact_without_a_tier2_source_fails(self):
        def drop(c, d):
            c["sources"][0]["supports"].remove("born")
        self.assertError(self.mutate(drop), "`born` has no tier-2 source")

    def test_the_corpus_cannot_source_a_life_fact(self):
        def corpus_only(c, d):
            c["sources"] = [{"ref": "SGGS", "entry": "Ang 92", "supports": ["born", "context", "range_note", "place"]}]
        self.assertError(self.mutate(corpus_only), "`born` has no tier-2 source")

    def test_an_unresolved_comp_or_anchor_fails(self):
        self.assertError(self.mutate(lambda c, d: c["notable"][0].update(comp_id=99)), "does not resolve")
        self.assertError(self.mutate(lambda c, d: c["notable"][0].update(anchor="ਜਪੁ")), "is not in comp 10")

    def test_an_unknown_name_fails_but_a_pending_one_warns(self):
        self.assertError(self.mutate(lambda c, d: c.update(name="Bhagat Nobody Ji")), "does not join")
        # a voice a pending sggs-data repair will add only warns (dataset 1.3.0 left none pending, so the
        # mechanism is exercised with a name of the test's own)
        orig = cc.PENDING_ATTRIBUTION
        cc.PENDING_ATTRIBUTION = {"Bhagat Pending Ji"}
        try:
            rep = self.mutate(lambda c, d: c.update(name="Bhagat Pending Ji"))
        finally:
            cc.PENDING_ATTRIBUTION = orig
        self.assertTrue(any("attribution repair" in w for w in rep.warnings), rep.warnings)
        self.assertFalse(any("does not join" in e for e in rep.errors), rep.errors)

    def test_an_example_verse_must_carry_the_chhap(self):
        self.assertError(self.mutate(lambda c, d: c.update(chhap_example={"line_id": 1, "ang": 92})), "carries none")

    def test_a_pin_must_agree_with_the_projection(self):
        self.assertError(self.mutate(lambda c, d: c["place"].update(x=0.9)), "disagree with lat/lon")

    def test_old_app_fields_keep_their_types(self):
        self.assertError(self.mutate(lambda c, d: c.update(circa=None)), "`circa` must be a boolean")
        self.assertError(self.mutate(lambda c, d: c.update(blurb=None)), "`blurb` must be a non-empty string")

    def test_appstore_refuses_drafts_and_accepts_signed_entries(self):
        self.assertError(self.run_with(self.base, "appstore"), "gate G3")
        doc = copy.deepcopy(self.base)
        doc["contributors"][0]["review"] = {"status": "approved", "reviewer": "Scholar", "date": "2026-11-01"}
        self.assertEqual(self.run_with(doc, "appstore").errors, [])


if __name__ == "__main__":
    unittest.main()
