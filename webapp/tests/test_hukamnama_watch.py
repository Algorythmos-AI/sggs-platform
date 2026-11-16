"""scripts/ci/hukamnama_watch.py: the external dead-man check's decisions."""
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "ci"))
import hukamnama_watch as w  # noqa: E402


def utc(h, m, day=9):
    return datetime(2026, 11, day, h, m, tzinfo=timezone.utc)


def health(**k):
    base = {"ok": True, "amritsar_date": "2026-11-09", "status_today": "published", "decision_today": "published",
            "last_tick": utc(0, 59).isoformat(), "alerts_today": []}
    base.update(k)
    return base


class DeadmanTests(unittest.TestCase):
    def test_healthy_morning_has_no_problems(self):
        self.assertEqual(w.problems(health(), utc(1, 0)), [])          # 06:30 IST

    def test_stale_poller_inside_the_window(self):
        out = w.problems(health(last_tick=utc(0, 10).isoformat()), utc(1, 0))
        self.assertTrue(any("stale" in p for p in out), out)

    def test_a_quiet_poller_outside_the_window_is_fine(self):
        h = health(last_tick=utc(0, 10).isoformat())
        self.assertEqual(w.problems(h, utc(12, 0)), [])                # 17:30 IST, idle

    def test_nothing_by_seven_ist(self):
        out = w.problems(health(status_today="pending", decision_today=None), utc(1, 31))   # 07:01 IST
        self.assertTrue(any("by 07:00 IST" in p for p in out), out)

    def test_pending_before_seven_is_not_a_problem(self):
        self.assertEqual(w.problems(health(status_today="pending", decision_today=None), utc(0, 30)), [])

    def test_held_day_names_the_decision(self):
        out = w.problems(health(status_today="pending", decision_today="held"), utc(1, 31))
        self.assertTrue(any("decision: held" in p for p in out), out)

    def test_after_the_window_says_fourteen(self):
        h = health(status_today="pending", decision_today=None, last_tick=utc(8, 20).isoformat())
        out = w.problems(h, utc(8, 45))                                # 14:15 IST
        self.assertTrue(any("by 14:00 IST" in p for p in out), out)

    def test_service_alerts_are_reported_but_time_alerts_are_not_doubled(self):
        h = health(alerts_today=[{"kind": "hs_layout_changed", "detail": "structure a -> b"},
                                 {"kind": "late", "detail": "x"}])
        out = w.problems(h, utc(1, 0))
        self.assertEqual(out, ["service alert hs_layout_changed: structure a -> b"])

    def test_not_ok(self):
        self.assertIn("/health reports ok=false", w.problems(health(ok=False), utc(1, 0)))

    def test_never_polled(self):
        out = w.problems(health(last_tick=None), utc(0, 20))
        self.assertTrue(any("has not run" in p for p in out), out)


if __name__ == "__main__":
    unittest.main()
