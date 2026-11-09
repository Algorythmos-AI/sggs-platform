"""Replays mornings minute by minute through the engine with a fake clock and scripted pages."""
import tempfile
import unittest
from datetime import date, timedelta

from hukamnama.corpus import open_ro, scripture_sha256
from hukamnama.engine import Engine
from hukamnama.sources import HS_URL, MUKHWAK_URL
from hukamnama.store import Store
from tests.helpers import DB, FakeFetcher, fixture, needs_db, utc

HS = fixture("hs-2026-11-09.html")
HOME = fixture("sgpc-home-2026-11-09.html")
YESTERDAY_HS = HS.replace("09-11-2026", "08-11-2026")
YESTERDAY_HOME = HOME.replace("੯ ਨਵੰਬਰ", "੮ ਨਵੰਬਰ")
DAY = date(2026, 11, 9)
T0 = utc(2026, 11, 9, 0, 0)          # 05:30 IST


@needs_db
class EngineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.con = open_ro(DB)
        cls.fp = scripture_sha256(cls.con)

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(f"{self.tmp.name}/state.sqlite")
        self.alerts = []
        self.fetch = FakeFetcher({HS_URL: HS, MUKHWAK_URL: HOME})
        self.engine = Engine(self.store, self.con, self.fp, self.fetch,
                             alert_hook=lambda d, k, x: self.alerts.append(k))

    def tearDown(self):
        self.tmp.cleanup()

    def run_minutes(self, start, minutes):
        return [self.engine.tick(start + timedelta(minutes=m)).action for m in range(minutes)]

    def test_publishes_only_after_the_page_has_settled(self):
        self.assertEqual(self.run_minutes(T0, 3), ["waiting", "waiting", "published"])
        d = self.store.decision(DAY)
        self.assertEqual((d["status"], d["decided_by"]), ("published", "auto"))
        self.assertEqual((d["resolution"]["first_line_id"], d["resolution"]["last_line_id"]), (29237, 29247))
        self.assertEqual(d["scripture_sha256"], self.fp)

    def test_yesterdays_page_never_publishes_for_today(self):
        self.fetch.pages[HS_URL] = YESTERDAY_HS
        self.assertNotIn("published", self.run_minutes(T0, 10))
        self.assertIsNone(self.store.decision(DAY))

    def test_a_page_that_changes_restarts_the_settling(self):
        verses = HS.split('<p class="hukamnama-text">', 1)[1].split("</p>", 1)[0]
        half = verses[: len(verses) // 2]
        self.fetch.pages[HS_URL] = HS.replace(verses, half)
        self.run_minutes(T0, 2)
        self.fetch.pages[HS_URL] = HS
        acts = self.run_minutes(T0 + timedelta(minutes=2), 3)
        self.assertEqual(acts, ["waiting", "waiting", "published"])

    def test_network_blips_do_not_break_the_run(self):
        self.engine.tick(T0)
        self.fetch.pages[HS_URL] = OSError("timeout")
        self.engine.tick(T0 + timedelta(minutes=1))
        self.fetch.pages[HS_URL] = HS
        self.assertEqual(self.engine.tick(T0 + timedelta(minutes=2)).action, "published")

    def test_veto_holds_the_day(self):
        other = HOME.replace("(ਅੰਗ: ੬੭੩)", "(ਅੰਗ: ੭੦੦)")
        self.fetch.pages[MUKHWAK_URL] = other
        self.assertEqual(self.run_minutes(T0, 3)[-1], "held")
        self.assertEqual(self.store.decision(DAY)["status"], "held")
        self.assertIn("held_veto", self.alerts)
        self.assertEqual(self.run_minutes(T0 + timedelta(minutes=3), 5), ["decided"] * 5)   # owner decides

    def test_veto_still_on_yesterday_is_not_waited_for(self):
        self.fetch.pages[MUKHWAK_URL] = YESTERDAY_HOME
        self.assertEqual(self.run_minutes(T0, 3)[-1], "published")

    def test_veto_unreachable_is_not_waited_for(self):
        self.fetch.pages[MUKHWAK_URL] = None
        self.assertEqual(self.run_minutes(T0, 3)[-1], "published")

    def test_unmatched_page_is_held_after_it_settles(self):
        bad = HS.replace("ਪਾਨੀ ਪਖਾ", "ਪਾਣੀ ਪਖਾ")
        self.fetch.pages[HS_URL] = bad
        acts = self.run_minutes(T0, 8)
        self.assertEqual(acts[-1], "decided")
        self.assertIn("held", acts)
        self.assertIn("held_no_match", self.alerts)
        self.assertEqual(self.store.decision(DAY)["status"], "held")

    def test_restart_is_idempotent(self):
        self.run_minutes(T0, 3)
        again = Engine(Store(f"{self.tmp.name}/state.sqlite"), self.con, self.fp, self.fetch)
        self.assertIn(again.tick(T0 + timedelta(minutes=4)).action, ("watching", "idle"))
        self.assertEqual(len(self.store.recent(10)), 1)

    def test_restart_mid_settling_keeps_the_run(self):
        self.engine.tick(T0)
        self.engine.tick(T0 + timedelta(minutes=1))
        again = Engine(Store(f"{self.tmp.name}/state.sqlite"), self.con, self.fp, self.fetch)
        self.assertEqual(again.tick(T0 + timedelta(minutes=2)).action, "published")

    def test_change_after_publish_alerts_and_never_rewrites(self):
        self.run_minutes(T0, 3)
        self.fetch.pages[HS_URL] = HS.replace("ਪਾਨੀ ਪਖਾ", "ਪਾਣੀ ਪਖਾ")
        self.engine.tick(T0 + timedelta(minutes=20))
        self.assertIn("changed_after_publish", self.alerts)
        self.assertEqual(self.store.decision(DAY)["resolution"]["first_line_id"], 29237)

    def test_idle_outside_the_window_and_late_alert(self):
        self.assertEqual(self.engine.tick(utc(2026, 11, 8, 23, 0)).action, "idle")      # 04:30 IST
        self.assertEqual(self.fetch.calls, [])
        self.fetch.pages[HS_URL] = YESTERDAY_HS
        self.engine.tick(utc(2026, 11, 9, 1, 31))                                         # 07:01 IST
        self.assertIn("late", self.alerts)
        self.engine.tick(utc(2026, 11, 9, 8, 31))                                         # 14:01 IST
        self.assertIn("not_published", self.alerts)

    def test_layout_change_alerts(self):
        self.engine.tick(T0)
        self.fetch.pages[HS_URL] = HS.replace('<h4 class="hukamnama-title">ਧਨਾਸਰੀ ਮਹਲਾ ੫॥ </h4>',
                                              '<div class="new"><h4 class="hukamnama-title">ਧਨਾਸਰੀ ਮਹਲਾ ੫॥ </h4></div>')
        self.engine.tick(T0 + timedelta(minutes=1))
        self.assertIn("hs_layout_changed", self.alerts)

    def test_persistent_parse_failure_alerts(self):
        self.fetch.pages[HS_URL] = "<html><body>maintenance</body></html>"
        self.run_minutes(T0, 4)
        self.assertNotIn("hs_parse_failing", self.alerts)
        self.engine.tick(T0 + timedelta(minutes=4))
        self.assertIn("hs_parse_failing", self.alerts)

    def test_owner_approval_overrides_a_hold(self):
        from hukamnama.corpus import resolution_for_range
        self.store.hold(DAY, T0, "auto", "test")
        self.store.publish(DAY, resolution_for_range(self.con, 29237, 29247), self.fp, T0, "owner", overwrite=True)
        self.assertEqual(self.store.decision(DAY)["decided_by"], "owner")
        self.assertFalse(self.store.publish(DAY, resolution_for_range(self.con, 29238, 29247), self.fp, T0, "auto"))


if __name__ == "__main__":
    unittest.main()
