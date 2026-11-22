"""One-tap approve from the held_veto alert: it publishes exactly the held run, after re-proving it,
and refuses everything else."""
import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from datetime import date, timedelta
from urllib.parse import parse_qs, urlencode, urlsplit

from hukamnama import approve
from hukamnama.alerts import NtfyAlerts, from_env, message
from hukamnama.api import State, day_record, serve
from hukamnama.corpus import open_ro, resolution_for_range, scripture_sha256
from hukamnama.store import Store
from tests.helpers import DB, needs_db, utc

SECRET = "-".join(["test", "approve", "secret", "not", "real"])   # built at run time (gitleaks)
DAY = date(2026, 11, 21)
NOW = utc(2026, 11, 21, 3, 0)          # 08:30 IST
RANGE = (30485, 30495)                 # Ang 706, the 21 Nov 2026 hold (#445)


@needs_db
class ApproveTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.con = open_ro(DB)
        cls.fp = scripture_sha256(cls.con)
        cls.res = resolution_for_range(cls.con, *RANGE)

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(f"{self.tmp.name}/s.sqlite")
        self.store.hold(DAY, NOW, "auto", "sgpc.net disagrees: …")
        self.store.set_held_range(DAY, self.res)

    def tearDown(self):
        self.tmp.cleanup()

    def fields(self, **over):
        f = approve.fields_for(SECRET, DAY.isoformat(), *RANGE, self.res.range_sha256, self.fp)
        f.update(over)
        return f

    def refused(self, fields, code, *, secret=SECRET, now=NOW, fp=None):
        with self.assertRaises(approve.Refused) as cm:
            approve.approve(self.store, self.con, fp or self.fp, secret, fields, now)
        self.assertEqual(cm.exception.code, code, str(cm.exception))
        self.assertEqual(self.store.decision(DAY)["status"], "held")       # nothing changed

    def test_publishes_exactly_the_held_range(self):
        out = approve.approve(self.store, self.con, self.fp, SECRET, self.fields(), NOW)
        self.assertEqual((out["published"], out["ang"], out["first_line_id"], out["last_line_id"]),
                         ("2026-11-21", 706, *RANGE))
        d = self.store.decision(DAY)
        self.assertEqual((d["status"], d["decided_by"], d["scripture_sha256"]), ("published", approve.BY, self.fp))
        self.assertEqual(d["resolution"]["range_sha256"], self.res.range_sha256)
        self.assertEqual(d["resolution"]["opening_gurmukhi"], self.res.opening_gurmukhi)   # corpus bytes
        # a second tap is refused: the day is no longer an automatic hold
        with self.assertRaises(approve.Refused) as cm:
            approve.approve(self.store, self.con, self.fp, SECRET, self.fields(), NOW)
        self.assertEqual(cm.exception.code, 409)

    def test_refuses_without_a_secret(self):
        self.refused(self.fields(), 404, secret="")

    def test_refuses_a_bad_or_altered_signature(self):
        self.refused(self.fields(sig="0" * 64), 403)
        self.refused(self.fields(last_line=str(RANGE[1] + 1)), 403)        # a longer range, same sig
        self.refused(self.fields(), 403, secret=SECRET + "x")
        self.refused(self.fields(), 403, fp="f" * 64)                       # the corpus changed since

    def test_refuses_malformed_fields(self):
        for bad in (self.fields(day="21-11-2026"), self.fields(first_line="x"), self.fields(sig="abc"),
                    self.fields(range_sha256="Z" * 64), {}):
            self.refused(bad, 400)

    def test_refuses_a_range_other_than_the_held_one(self):
        other = resolution_for_range(self.con, RANGE[0] + 1, RANGE[1])
        f = approve.fields_for(SECRET, DAY.isoformat(), RANGE[0] + 1, RANGE[1], other.range_sha256, self.fp)
        self.refused(f, 409)

    def test_refuses_a_no_match_hold_which_has_no_range(self):
        self.store.del_meta("held_range:" + DAY.isoformat())
        self.refused(self.fields(), 409)

    def test_refuses_a_day_the_owner_decided(self):
        self.store.hold(DAY, NOW, "Sam", "checked by hand", overwrite=True)
        self.refused(self.fields(), 409)

    def test_refuses_outside_the_window(self):
        self.refused(self.fields(), 409, now=NOW + timedelta(days=approve.WINDOW_DAYS + 1))
        self.refused(self.fields(), 409, now=NOW - timedelta(days=1))       # a future day

    def test_refuses_when_the_range_no_longer_proves(self):
        f = approve.fields_for(SECRET, DAY.isoformat(), *RANGE, "a" * 64, self.fp)
        self.store.set_meta("held_range:" + DAY.isoformat(), json.dumps(
            {"first_line_id": RANGE[0], "last_line_id": RANGE[1], "range_sha256": "a" * 64}))
        self.refused(f, 409)

    def test_a_held_range_is_never_served(self):
        rec = day_record(self.store, DAY, self.fp, NOW)
        self.assertNotIn("lines", rec)
        self.assertNotIn(self.res.opening_gurmukhi, json.dumps(rec, ensure_ascii=False))

    def test_alert_carries_the_signed_buttons_and_never_the_secret(self):
        sent = []

        class Resp:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *a): return False

        hook = NtfyAlerts("https://ntfy.sh/" + "t" * 20, "production", opener=lambda req, timeout: (sent.append(req), Resp())[1],
                          approve_secret=SECRET, approve_base="https://svc.example.test/")
        hook(DAY.isoformat(), "held_veto", "sgpc.net disagrees", approve={
            "first_line_id": RANGE[0], "last_line_id": RANGE[1], "range_sha256": self.res.range_sha256,
            "fingerprint": self.fp, "ang": 706, "line_count": 11})
        raw = sent[0].data.decode()
        self.assertNotIn(SECRET, raw)
        body = json.loads(raw)
        a, r = body["actions"][0], body["actions"][1]
        self.assertEqual((a["action"], a["method"], a["url"]), ("http", "POST", "https://svc.example.test/owner/approve"))
        self.assertEqual(json.loads(a["body"]), self.fields())
        self.assertEqual(r["action"], "view")
        self.assertEqual({k: v[0] for k, v in parse_qs(urlsplit(r["url"]).query).items()}, self.fields())
        self.assertIn("30485-30495 (Ang 706, 11 lines)", body["message"])
        self.assertLessEqual(len(body["actions"]), 3)                       # ntfy's limit

    def test_no_buttons_without_a_secret_or_for_other_kinds(self):
        self.assertEqual([a["label"] for a in message("staging", "2026-11-21", "held_veto", "x")["actions"]], ["Runbook"])
        hook = from_env({"HUKAMNAMA_ALERT_NTFY_URL": "https://ntfy.sh/" + "t" * 20,
                         "RENDER_EXTERNAL_URL": "https://svc.example.test"})
        self.assertEqual(hook.approve_secret, "")
        with self.assertRaises(ValueError):
            from_env({"HUKAMNAMA_ALERT_NTFY_URL": "https://ntfy.sh/" + "t" * 20,
                      "HUKAMNAMA_APPROVE_BASE_URL": "http://insecure.example.test"})


@needs_db
class ApproveRouteTests(unittest.TestCase):
    """Over HTTP, as the phone reaches the service."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.con = open_ro(DB)
        self.fp = scripture_sha256(self.con)
        self.res = resolution_for_range(self.con, *RANGE)
        self.store = Store(f"{self.tmp.name}/s.sqlite")
        self.store.hold(DAY, NOW, "auto", "sgpc.net disagrees: …")
        self.store.set_held_range(DAY, self.res)
        self.state = State(self.store, self.fp, now=lambda: NOW)
        self.state.con, self.state.approve_secret = self.con, SECRET
        self.state.origin_required = True          # the route must not depend on the edge
        self.httpd = serve(self.state, "127.0.0.1", 0)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.httpd.server_address[1]}"
        self.fields = approve.fields_for(SECRET, DAY.isoformat(), *RANGE, self.res.range_sha256, self.fp)

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.tmp.cleanup()

    def call(self, method, path, data=None, ctype="application/json"):
        req = urllib.request.Request(self.base + path, data=data, method=method,
                                     headers={"Content-Type": ctype} if data is not None else {})
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, r.headers, r.read().decode()
        except urllib.error.HTTPError as e:
            with e:
                return e.code, e.headers, e.read().decode()

    def test_get_shows_a_confirmation_and_changes_nothing(self):
        code, headers, page = self.call("GET", approve.PATH + "?" + urlencode(self.fields))
        self.assertEqual(code, 200)
        self.assertTrue(headers["Content-Type"].startswith("text/html"))
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertIn(self.res.opening_gurmukhi, page)
        self.assertIn('method="post"', page)
        self.assertEqual(self.store.decision(DAY)["status"], "held")
        code, _, page = self.call("GET", approve.PATH + "?" + urlencode({**self.fields, "sig": "0" * 64}))
        self.assertEqual(code, 403)

    def test_post_json_publishes(self):
        code, _, body = self.call("POST", approve.PATH, json.dumps(self.fields).encode())
        self.assertEqual(code, 200, body)
        self.assertEqual(json.loads(body)["published"], "2026-11-21")
        self.assertEqual(self.store.decision(DAY)["status"], "published")
        code, _, _ = self.call("POST", approve.PATH, json.dumps(self.fields).encode())
        self.assertEqual(code, 409)

    def test_post_form_publishes(self):
        code, headers, page = self.call("POST", approve.PATH, urlencode(self.fields).encode(),
                                        "application/x-www-form-urlencoded")
        self.assertEqual(code, 200, page)
        self.assertIn("is published", page)

    def test_route_is_absent_without_a_secret(self):
        self.state.approve_secret = ""
        self.assertEqual(self.call("POST", approve.PATH, json.dumps(self.fields).encode())[0], 404)
        self.assertEqual(self.call("GET", approve.PATH)[0], 404)

    def test_other_posts_are_still_refused(self):
        self.assertEqual(self.call("POST", "/v1/hukamnama", b"{}")[0], 405)
        self.assertEqual(self.call("POST", approve.PATH + "?x=1", b"{}")[0], 405)
        self.assertEqual(self.call("POST", approve.PATH, b"[1]")[0], 400)
        self.assertEqual(self.call("POST", approve.PATH, b"x" * 5000)[0], 400)


if __name__ == "__main__":
    unittest.main()
