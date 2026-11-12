"""scripts/ci/hukamnama_morning.py and hukamnama_preflight.py: the checks that run from outside.

The morning check reads the real page, feed and embed renderers' output here, so a change to
their markup that would blind it fails this file, not a quiet morning.
"""
import hashlib
import json
import os
import sqlite3
import sys
import unittest
from datetime import date
from pathlib import Path

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = Path(HERE).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "ci"))
sys.path.insert(0, os.path.dirname(HERE))
import hukamnama_feed as hf  # noqa: E402
import hukamnama_morning as m  # noqa: E402
import hukamnama_preflight as pre  # noqa: E402
from test_hukamnama_embed import Base  # noqa: E402
from test_hukamnama_page import AFTER, BEFORE, DB, R673, R680, corpus_lines, record  # noqa: E402

TODAY = "2026-11-11"


def lines_of(rng):
    return [g for _, g, _ in corpus_lines(*rng)]


def api_record(day, rng):
    lines = lines_of(rng)
    return {"amritsar_date": day, "status": "published", "ang": 680, "first_line_id": rng[0], "last_line_id": rng[1],
            "range_sha256": hashlib.sha256("\n".join(lines).encode("utf-8")).hexdigest()}


class ReadsTheRealRenderers(Base):
    def surfaces(self, day, rng, now=AFTER):
        import hukamnama_page as hp
        status, page, _ = self.page_for("en", now)
        self.assertEqual(status, 200)
        # the feed's own writer, over the same proved day the page shows
        proved = hp._prove(hp.published_record(record(day, rng), date.fromisoformat(day)))
        feed = json.loads(hf.json_feed([proved]))
        _, embed, _ = self.embed("", now)
        return {"page": m.page_shows(page), "feed": m.feed_shows(feed), "embed": m.embed_shows(embed)}

    def page_for(self, lang, now):
        import hukamnama_page as hp
        return hp.page_for(lang, None, now)

    def test_every_surface_yields_the_days_date_and_its_exact_lines(self):
        self.api(days={TODAY: record(TODAY)})
        want = lines_of(R680)
        shown = self.surfaces(TODAY, R680)
        for name, got in shown.items():
            self.assertEqual(got, (TODAY, want), name)
        self.assertEqual(m.judge(shown, TODAY, api_record(TODAY, R680), lambda d: None), [])

    def test_before_publication_the_latest_day_under_its_own_date_is_right(self):
        self.api(days={"2026-11-10": record("2026-11-10", R673)}, latest="2026-11-10")
        shown = self.surfaces("2026-11-10", R673, BEFORE)
        self.assertEqual({s[0] for s in shown.values()}, {"2026-11-10"})
        pending = {"amritsar_date": TODAY, "status": "pending", "latest": "2026-11-10"}
        self.assertEqual(m.judge(shown, TODAY, pending, lambda d: api_record(d, R673)), [])

    def test_the_markup_it_reads_is_the_markup_the_shell_and_renderers_write(self):
        shell = (ROOT / "frontend" / "src" / "pages" / "[lang]" / "hukamnama" / "hk-shell.astro").read_text(encoding="utf-8")
        self.assertIn('<section class="hk-shabad" data-date="__HK_DATE_ISO__">', shell)
        page = (ROOT / "webapp" / "hukamnama_page.py").read_text(encoding="utf-8")
        self.assertIn('<p class="hk-gm gm" lang="pa" data-gm="', page)


class Judging(unittest.TestCase):
    def setUp(self):
        if not os.path.isfile(DB):
            self.skipTest("scripture DB not installed; run `make dataset`")
        self.rec = api_record(TODAY, R680)
        self.good = (TODAY, lines_of(R680))

    def judge(self, surfaces, api_today=None, days=None):
        return m.judge(surfaces, TODAY, api_today or self.rec, lambda d: (days or {}).get(d))

    def test_one_changed_character_is_a_mismatch(self):
        lines = list(self.good[1])
        lines[1] += " "
        out = self.judge({"page": (TODAY, lines), "feed": self.good})
        self.assertEqual(len(out), 1)
        self.assertIn("page", out[0])
        self.assertIn("do not hash", out[0])

    def test_a_missing_or_reordered_line_is_a_mismatch(self):
        self.assertTrue(self.judge({"page": (TODAY, self.good[1][:-1])}))
        self.assertTrue(self.judge({"page": (TODAY, list(reversed(self.good[1])))}))
        self.assertTrue(self.judge({"page": (TODAY, [])}))

    def test_yesterday_on_a_surface_after_today_is_published_is_a_mismatch(self):
        old = ("2026-11-10", lines_of(R673))
        out = self.judge({"feed": old}, days={"2026-11-10": api_record("2026-11-10", R673)})
        self.assertIn("the API has published 2026-11-11", out[0])

    def test_a_surface_showing_nothing_after_publication_is_a_mismatch(self):
        self.assertIn("shows no Hukamnama", self.judge({"embed": None})[0])

    def test_before_publication_showing_nothing_is_fine_but_a_wrong_day_is_not(self):
        pending = {"amritsar_date": TODAY, "status": "pending", "latest": None}
        self.assertEqual(self.judge({"page": None}, api_today=pending), [])
        out = self.judge({"page": ("2026-11-10", lines_of(R673))}, api_today=pending, days={})
        self.assertIn("which the API has not published", out[0])

    def test_a_day_ahead_of_amritsar_is_a_mismatch(self):
        self.assertIn("a day ahead", self.judge({"page": ("2026-11-12", self.good[1])})[0])

    def test_an_api_answer_for_another_date_is_never_accepted(self):
        wrong = dict(self.rec, amritsar_date="2026-11-09")
        self.assertTrue(m.judge({"page": self.good}, TODAY, {"status": "pending"}, lambda d: wrong))


@unittest.skipUnless(os.path.isfile(DB), "scripture DB not installed; run `make dataset`")
class Preflight(unittest.TestCase):
    def setUp(self):
        self.con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
        self.addCleanup(self.con.close)

    def test_published_days_prove_in_the_pinned_database(self):
        self.assertEqual(pre.check(self.con, [api_record("2026-11-10", R673), api_record(TODAY, R680)]), [])

    def test_a_range_whose_lines_changed_is_named(self):
        rec = api_record(TODAY, R680)
        rec["range_sha256"] = "0" * 64
        out = pre.check(self.con, [api_record("2026-11-10", R673), rec])
        self.assertEqual(len(out), 1)
        self.assertTrue(out[0].startswith(TODAY))

    def test_a_range_that_is_not_in_the_database_or_is_malformed_is_named(self):
        gone = dict(api_record(TODAY, R680), first_line_id=99_999_990, last_line_id=99_999_995)
        self.assertIn("not all in this database", pre.check(self.con, [gone])[0])
        for bad in ({"amritsar_date": TODAY}, dict(api_record(TODAY, R680), last_line_id=1),
                    dict(api_record(TODAY, R680), first_line_id="29497")):
            self.assertIn("malformed", pre.check(self.con, [bad])[0])


class Dates(unittest.TestCase):
    def test_the_hash_is_the_apis_definition(self):
        self.assertEqual(m.range_sha256(["a", "b"]), hashlib.sha256(b"a\nb").hexdigest())
        self.assertEqual(date.fromisoformat(TODAY).isoformat(), TODAY)


if __name__ == "__main__":
    unittest.main()
