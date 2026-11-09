import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

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


if __name__ == "__main__":
    unittest.main()
