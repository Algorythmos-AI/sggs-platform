"""The sibling dead-man check: on time, liveness only, confirmed, once a day."""
import tempfile
import unittest
from datetime import timedelta

from hukamnama import peer
from hukamnama.store import Store
from tests.helpers import utc

URL = "https://peer.example.test"
T = utc(2026, 11, 22, 1, 0)                   # 06:30 IST


def healthy(now):
    return {"ok": True, "last_tick": (now - timedelta(minutes=1)).isoformat(), "status_today": "pending"}


class PeerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(f"{self.tmp.name}/s.sqlite")
        self.sent = []
        self.reply = None
        self.watch = peer.PeerWatch(self.store, URL, lambda d, k, x: self.sent.append((d, k, x)), fetch=self.fetch)

    def tearDown(self):
        self.tmp.cleanup()

    def fetch(self, url):
        self.assertEqual(url, URL)
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply

    def run_checks(self, start, n):
        return [self.watch.check(start + peer.EVERY * i) for i in range(n)]

    def test_a_healthy_peer_raises_nothing(self):
        for i in range(20):
            now = T + peer.EVERY * i
            self.reply = healthy(now)
            self.assertIsNone(self.watch.check(now))
        self.assertEqual(self.sent, [])

    def test_down_for_three_checks_alerts_once_a_day(self):
        self.reply = OSError("connection refused")
        out = self.run_checks(T, 10)
        self.assertEqual([o is not None for o in out], [False, False, True] + [False] * 7)
        self.assertEqual(len(self.sent), 1)
        day, kind, detail = self.sent[0]
        self.assertEqual((day, kind), ("2026-11-22", "peer_down"))
        self.assertIn("unreachable", detail)
        self.assertIn(URL, detail)
        self.assertEqual(len(self.store.alerts(utc(2026, 11, 22, 1).date())), 1)

    def test_a_blip_does_not_alert(self):
        for i in range(12):
            now = T + peer.EVERY * i
            self.reply = OSError("restart") if i % 3 != 2 else healthy(now)   # two bad, one good
            self.watch.check(now)
        self.assertEqual(self.sent, [])

    def test_a_stale_poller_alerts(self):
        self.reply = {"ok": True, "last_tick": (T - timedelta(hours=1)).isoformat()}
        self.run_checks(T, 3)
        self.assertIn("poller is stale", self.sent[0][2])

    def test_ok_false_alerts(self):
        self.reply = {"ok": False}
        self.run_checks(T, 3)
        self.assertIn("ok=false", self.sent[0][2])

    def test_only_inside_the_morning_window(self):
        self.reply = OSError("down")
        self.run_checks(utc(2026, 11, 21, 20, 0), 10)          # 01:30 IST
        self.run_checks(utc(2026, 11, 22, 9, 0), 10)           # 14:30 IST
        self.assertEqual(self.sent, [])

    def test_a_stale_tick_before_the_poll_window_is_not_a_problem(self):
        now = utc(2026, 11, 21, 23, 40)                         # 05:10 IST: peer idle all night
        self.assertIsNone(peer.problem({"ok": True, "last_tick": (now - timedelta(hours=8)).isoformat()}, now))

    def test_configuration(self):
        self.assertIsNone(peer.from_env({}, self.store, None))
        with self.assertRaises(ValueError):
            peer.from_env({"HUKAMNAMA_PEER_URL": "http://insecure.example.test"}, self.store, None)
        self.assertEqual(peer.from_env({"HUKAMNAMA_PEER_URL": URL + "/"}, self.store, None).url, URL)

    def test_the_alert_is_urgent_on_the_phone(self):
        from hukamnama.alerts import message
        m = message("staging", "2026-11-22", "peer_down", "x")
        self.assertEqual(m["priority"], 5)
        self.assertIn("other Hukamnama service", m["title"])


if __name__ == "__main__":
    unittest.main()
