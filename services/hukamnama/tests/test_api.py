import http.client
import json
import re
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from datetime import timedelta

from hukamnama.api import State, serve
from hukamnama.corpus import open_ro, resolution_for_range, scripture_sha256
from hukamnama.store import Store
from tests.helpers import DB, needs_db, utc

NOW = utc(2026, 11, 9, 2, 0)        # 07:30 IST


@needs_db
class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        con = open_ro(DB)
        cls.fp = scripture_sha256(con)
        store = Store(f"{cls.tmp.name}/s.sqlite")
        store.publish(utc(2026, 11, 8).date(), resolution_for_range(con, 29237, 29247), cls.fp, NOW, "auto")
        cls.state = State(store, cls.fp, now=lambda: NOW)
        cls.httpd = serve(cls.state, "127.0.0.1", 0)
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.tmp.cleanup()

    def get(self, path):
        try:
            with urllib.request.urlopen(self.base + path) as r:
                return r.status, json.loads(r.read()), r.headers
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read()), e.headers

    def test_published_day(self):
        code, body, h = self.get("/v1/hukamnama/2026-11-08")
        self.assertEqual(code, 200)
        self.assertEqual(body["status"], "published")
        self.assertEqual((body["first_line_id"], body["last_line_id"], body["ang"]), (29237, 29247, 673))
        self.assertEqual(body["citation"], "Sri Guru Granth Sahib Ji · Ang 673")
        self.assertEqual(body["scripture_sha256"], self.fp)
        self.assertEqual(h["X-Content-Type-Options"], "nosniff")

    def test_today_pending_carries_expected_time(self):
        code, body, _ = self.get("/v1/hukamnama/today")
        self.assertEqual((code, body["status"]), (200, "pending"))
        self.assertEqual(body["expected_by"], "2026-11-09T00:00:00+00:00")
        self.assertNotIn("opening_gurmukhi", body)

    def test_held_day_is_served_as_pending(self):
        self.state.store.hold(utc(2026, 11, 7).date(), NOW, "auto", "test")
        self.assertEqual(self.get("/v1/hukamnama/2026-11-07")[1]["status"], "pending")

    def test_list(self):
        code, body, _ = self.get("/v1/hukamnama?limit=3")
        self.assertEqual(code, 200)
        self.assertEqual([i["amritsar_date"] for i in body["items"]], ["2026-11-08"])

    def test_index_lists_every_published_day_without_text_and_never_a_held_one(self):
        code, body, _ = self.get("/v1/hukamnama/index")
        self.assertEqual(code, 200)
        day, = body["days"]
        record = self.get("/v1/hukamnama/2026-11-08")[1]
        self.assertEqual(day, {"amritsar_date": "2026-11-08", "ang": record["ang"],
                               "range_sha256": record["range_sha256"], "published_at": record["published_at"]})
        self.assertEqual((body["latest"], body["scripture_sha256"]), ("2026-11-08", record["scripture_sha256"]))
        self.assertNotIn("ਿ", str(body)); self.assertNotIn("opening_gurmukhi", str(body))
        self.state.store.hold(utc(2026, 11, 7).date(), NOW, "auto", "test")           # a held day is not listed
        self.assertEqual([d["amritsar_date"] for d in self.get("/v1/hukamnama/index")[1]["days"]], ["2026-11-08"])

    def test_validation(self):
        for path, code in (("/v1/hukamnama/2026-1-1", 400), ("/v1/hukamnama/2020-01-01", 400),
                           ("/v1/hukamnama/2026-11-10", 404), ("/v1/hukamnama?limit=0", 400),
                           ("/v1/hukamnama?limit=31", 400), ("/v1/hukamnama?limit=x", 400), ("/nope", 404),
                           ("/v1/hukamnama/../../etc/passwd", 400)):
            self.assertEqual(self.get(path)[0], code, path)

    def test_health(self):
        code, body, h = self.get("/health")
        self.assertEqual(code, 200)
        self.assertEqual(body["amritsar_date"], "2026-11-09")
        self.assertEqual(h["Cache-Control"], "no-store")


TOKEN, OTHER = "ab" * 32, "cd" * 32
PUB = utc(2026, 11, 9, 0, 4)                                   # 05:34 IST
_Z = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$")


@needs_db
class DevicePlanTests(unittest.TestCase):
    """PUT /v1/devices answers what today means for the device, by the sender's own rules."""
    @classmethod
    def setUpClass(cls):
        cls.con = open_ro(DB)
        cls.fp = scripture_sha256(cls.con)

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(f"{self.tmp.name}/s.sqlite")
        self.now = [PUB - timedelta(hours=1)]
        self.state = State(self.store, self.fp, now=lambda: self.now[0])
        self.httpd = serve(self.state, "127.0.0.1", 0)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.tmp.cleanup()

    def put(self, token=TOKEN, at=None, **body):
        if at is not None:
            self.now[0] = at
        b = {"env": "production", "mode": "asap", "scripture_sha256": self.fp, **body}
        c = http.client.HTTPConnection("127.0.0.1", self.httpd.server_address[1], timeout=5)
        c.request("PUT", f"/v1/devices/{token}", body=json.dumps(b).encode(), headers={"Content-Type": "application/json"})
        r = c.getresponse()
        out = r.status, json.loads(r.read())
        c.close()
        return out

    def publish(self, at=PUB):
        self.store.publish(at.date(), resolution_for_range(self.con, 29226, 29236), self.fp, at, "auto")

    def test_shape(self):
        code, body = self.put()
        self.assertEqual(code, 200)
        self.assertEqual(set(body), {"ok", "today", "next_slot_at"})
        self.assertEqual(set(body["today"]), {"amritsar_date", "status", "delivery", "sent_at", "reason"})
        self.assertEqual(body, {"ok": True, "next_slot_at": None,
                                "today": {"amritsar_date": "2026-11-09", "status": "pending", "delivery": "due",
                                          "sent_at": None, "reason": None}})
        _, body = self.put(mode="scheduled", schedule=[{"from_utc": 0, "slot_utc_min": 193}])
        self.assertEqual(body["next_slot_at"], "2026-11-09T03:13:00Z")
        self.assertRegex(body["next_slot_at"], _Z)

    def test_asap_due_then_sent(self):
        self.put()                                              # registered before the publish
        self.publish()
        _, body = self.put(at=PUB + timedelta(minutes=1))
        self.assertEqual((body["today"]["status"], body["today"]["delivery"]), ("published", "due"))
        self.store.enqueue(PUB.date(), [TOKEN], PUB + timedelta(minutes=1))
        self.assertEqual(self.put(at=PUB + timedelta(minutes=2))[1]["today"]["delivery"], "due")   # queued
        self.store.finish_send(TOKEN, "2026-11-09", "sent", "200", utc(2026, 11, 9, 2, 54, 18))
        _, body = self.put(at=PUB + timedelta(hours=3))
        self.assertEqual(body["today"], {"amritsar_date": "2026-11-09", "status": "published", "delivery": "sent",
                                         "sent_at": "2026-11-09T02:54:18Z", "reason": None})

    def test_asap_registered_after_publish(self):
        self.publish()
        _, body = self.put(at=PUB + timedelta(minutes=5))
        self.assertEqual((body["today"]["delivery"], body["today"]["reason"], body["today"]["sent_at"]),
                         ("not_today", "registered_after_publish", None))

    def test_scheduled_slot_passed(self):
        self.publish()
        _, body = self.put(at=utc(2026, 11, 9, 4, 0), mode="scheduled",
                           schedule=[{"from_utc": 0, "slot_utc_min": 180}])     # 08:30 IST, new after it
        self.assertEqual((body["today"]["delivery"], body["today"]["reason"]), ("not_today", "slot_passed"))
        self.assertEqual(body["next_slot_at"], "2026-11-10T03:00:00Z")

    def test_scheduled_slot_ahead(self):
        self.publish()
        _, body = self.put(at=PUB + timedelta(minutes=10), mode="scheduled",
                           schedule=[{"from_utc": 0, "slot_utc_min": 600}])
        self.assertEqual((body["today"]["delivery"], body["today"]["reason"]), ("due", None))
        self.assertEqual(body["next_slot_at"], "2026-11-09T10:00:00Z")

    def test_held(self):
        self.put()
        self.store.hold(PUB.date(), PUB, "auto", "no match")
        _, body = self.put(at=PUB + timedelta(minutes=1))
        self.assertEqual((body["today"]["status"], body["today"]["delivery"]), ("held", "not_today"))

    def test_rotation_reports_the_old_tokens_day(self):
        self.put(OTHER)
        self.publish()
        _, body = self.put(TOKEN, at=PUB + timedelta(minutes=5), replaces=OTHER)
        self.assertEqual(body["today"]["delivery"], "due")
        self.assertIsNone(self.store.device(OTHER))


if __name__ == "__main__":
    unittest.main()
