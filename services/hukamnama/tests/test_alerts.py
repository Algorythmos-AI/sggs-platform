"""Phone alerts (ntfy): the message, the priorities, the secret-topic rule, and that a failing
channel never stops the engine."""
import json
import unittest
from datetime import date

from hukamnama import alerts
from hukamnama.alerts import NtfyAlerts, from_env, message, parse_url

TOPIC = "hk" + "-" + "a1b2c3d4e5f6g7h8"      # built at run time: a secret-shaped literal trips gitleaks


class _Resp:
    def __init__(self, status=200):
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class AlertTests(unittest.TestCase):
    def test_url_must_be_https_with_a_secret_looking_topic(self):
        self.assertEqual(parse_url(f"https://ntfy.sh/{TOPIC}"), ("https://ntfy.sh", TOPIC))
        for bad in (f"http://ntfy.sh/{TOPIC}", "https://ntfy.sh/hukamnama", "https://ntfy.sh/",
                    f"https://ntfy.sh/{TOPIC}?x=1", f"https://ntfy.sh/a/{TOPIC}", "ntfy.sh/" + TOPIC):
            with self.assertRaises(ValueError, msg=bad):
                parse_url(bad)

    def test_from_env(self):
        self.assertIsNone(from_env({}))
        self.assertIsNone(from_env({"HUKAMNAMA_ALERT_NTFY_URL": "  "}))
        hook = from_env({"HUKAMNAMA_ALERT_NTFY_URL": f"https://ntfy.sh/{TOPIC}", "HUKAMNAMA_ENV": "production"})
        self.assertEqual((hook.server, hook.topic, hook.where), ("https://ntfy.sh", TOPIC, "production"))
        with self.assertRaises(ValueError):
            from_env({"HUKAMNAMA_ALERT_NTFY_URL": "https://ntfy.sh/short"})

    def test_a_hold_is_urgent_and_says_what_to_do(self):
        m = message("staging", "2026-11-14", "held_no_match",
                    "Ang 692: source ends mid-composition at line 29961 (incomplete page?)")
        self.assertEqual(m["priority"], 5)
        self.assertEqual(m["title"], "Hukamnama (staging) Sat 14 Nov: held: SGPC's page does not match the corpus")
        self.assertIn("Ang 692", m["message"])
        self.assertIn("approve 2026-11-14", m["message"])
        self.assertIn("Delayed today", m["message"])
        self.assertTrue(m["click"].startswith("https://github.com/"))

    def test_priorities(self):
        for kind in ("held_veto", "not_published", "push_breaker", "push_auth_failed", "deadman"):
            self.assertEqual(message("s", "2026-11-14", kind, "x")["priority"], 5, kind)
        for kind in ("late", "changed_after_publish", "hs_layout_changed", "device_flood"):
            self.assertEqual(message("s", "2026-11-14", kind, "x")["priority"], 4, kind)
        self.assertEqual(message("s", "2026-11-14", "something_new", "x")["priority"], 3)
        self.assertEqual(message("s", "not-a-date", "late", "x")["title"], "Hukamnama (s) not-a-date: not published yet")

    def test_post_is_one_json_request_to_the_server_with_the_topic_inside(self):
        seen = []

        def opener(req, timeout):
            seen.append((req.full_url, req.get_method(), json.loads(req.data.decode("utf-8")), timeout))
            return _Resp()
        NtfyAlerts(f"https://ntfy.sh/{TOPIC}", "staging", opener=opener)("2026-11-13", "held_veto",
                                                                         "sgpc.net disagrees: hs Ang 682, sgpc.net Ang 682")
        (url, method, body, timeout), = seen
        self.assertEqual((url, method, body["topic"], body["priority"]), ("https://ntfy.sh", "POST", TOPIC, 5))
        self.assertNotIn(TOPIC, body["message"] + body["title"])
        self.assertLessEqual(timeout, 10)

    def test_a_failing_channel_raises_for_the_caller_to_log(self):
        with self.assertRaises(OSError):
            NtfyAlerts(f"https://ntfy.sh/{TOPIC}", "staging", opener=lambda r, timeout: _Resp(500))("2026-11-13", "late", "x")

    def test_engine_alerts_once_per_day_and_kind_and_survives_a_dead_channel(self):
        from tests.helpers import utc
        import tempfile
        from hukamnama.engine import Engine
        from hukamnama.store import Store
        calls = []

        def hook(day, kind, detail):
            calls.append((day, kind))
            raise OSError("ntfy down")
        with tempfile.TemporaryDirectory() as d, self.assertLogs("hukamnama", "WARNING") as logs:
            e = Engine(Store(f"{d}/s.sqlite"), None, "f" * 64, fetcher=lambda url: None, alert_hook=hook)
            now = utc(2026, 11, 14, 1, 40)
            e._alert(date(2026, 11, 14), "late", "x", now)      # the channel fails: logged, not raised
            e._alert(date(2026, 11, 14), "late", "x", now)      # the same alert again: not re-sent
            e._alert(date(2026, 11, 14), "held_no_match", "y", now)
        self.assertEqual(calls, [("2026-11-14", "late"), ("2026-11-14", "held_no_match")])
        self.assertEqual(sum("alert hook failed" in m for m in logs.output), 2)

    def test_cli_without_a_url_sends_nothing(self):
        import io
        import os
        import sys
        from unittest import mock
        with mock.patch.dict(os.environ, {"HUKAMNAMA_ALERT_NTFY_URL": ""}), \
                mock.patch.object(sys, "stdin", io.StringIO("report")), mock.patch("sys.stdout", new=io.StringIO()) as out:
            self.assertEqual(alerts.main(["2026-11-14", "deadman"]), 0)
        self.assertIn("nothing sent", out.getvalue())


if __name__ == "__main__":
    unittest.main()
