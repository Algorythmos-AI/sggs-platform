"""Device registration: the request shape the app sends, the HTTP routes, and abuse limits."""
import http.client
import json
import tempfile
import threading
import unittest

from hukamnama.api import State, serve
from hukamnama.devices import BadRequest, RateLimiter, parse_registration
from hukamnama.store import Store
from tests.helpers import utc

TOKEN = "ab" * 32
OTHER = "cd" * 32
FP = "0e" * 32


def body(**kw):
    b = {"env": "production", "mode": "asap", "scripture_sha256": FP}
    b.update(kw)
    return json.dumps({k: v for k, v in b.items() if v is not None}).encode()


class ParseTests(unittest.TestCase):
    def test_the_apps_bodies_parse(self):
        r = parse_registration(TOKEN, body())
        self.assertEqual((r.env, r.mode, r.schedule, r.replaces), ("production", "asap", None, None))
        sched = [{"from_utc": 1794300000, "slot_utc_min": 1230}, {"from_utc": 1806000000, "slot_utc_min": 1170}]
        r = parse_registration(TOKEN, body(mode="scheduled", schedule=sched, replaces=OTHER))
        self.assertEqual((r.schedule, r.replaces), (sched, OTHER))

    def test_rejections(self):
        bad = [
            ("AB" * 32, body()),                                   # uppercase token
            ("ab" * 31, body()),                                   # too short
            (TOKEN, b"{"),                                         # not JSON
            (TOKEN, body(env="staging")),
            (TOKEN, body(mode="hourly")),
            (TOKEN, body(timezone="Asia/Kolkata")),                # no zone names, by design
            (TOKEN, body(mode="scheduled")),                       # scheduled without a schedule
            (TOKEN, body(schedule=[{"from_utc": 0, "slot_utc_min": 60}])),   # asap with a schedule
            (TOKEN, body(mode="scheduled", schedule=[{"from_utc": 0, "slot_utc_min": 1440}])),
            (TOKEN, body(mode="scheduled", schedule=[{"from_utc": 5, "slot_utc_min": 1}, {"from_utc": 5, "slot_utc_min": 2}])),
            (TOKEN, body(scripture_sha256="xyz")),
            (TOKEN, body(replaces=TOKEN)),
            (TOKEN, b" " * 2000),
        ]
        for tok, raw in bad:
            with self.subTest(raw=raw[:60]):
                with self.assertRaises(BadRequest):
                    parse_registration(tok, raw)

    def test_rate_limiter(self):
        t = [0.0]
        rl = RateLimiter(per_minute=3, new_per_hour=2, clock=lambda: t[0])
        self.assertEqual([rl.allow("a") for _ in range(4)], [True, True, True, False])
        self.assertTrue(rl.allow("b"))
        t[0] = 61
        self.assertTrue(rl.allow("a"))
        self.assertEqual([rl.allow_new() for _ in range(3)], [True, True, False])


class RouteTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(f"{self.tmp.name}/s.sqlite")
        self.state = State(self.store, FP, now=lambda: utc(2026, 11, 9, 1, 0))
        self.httpd = serve(self.state, "127.0.0.1", 0)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.tmp.cleanup()

    def req(self, method, path, raw=None):
        c = http.client.HTTPConnection("127.0.0.1", self.httpd.server_address[1], timeout=5)
        c.request(method, path, body=raw, headers={"Content-Type": "application/json"} if raw is not None else {})
        r = c.getresponse()
        out = (r.status, json.loads(r.read() or b"{}"))
        c.close()
        return out

    def test_put_then_delete(self):
        self.assertEqual(self.req("PUT", f"/v1/devices/{TOKEN}", body())[0], 200)
        self.assertEqual(self.store.device(TOKEN)["mode"], "asap")
        self.assertEqual(self.req("PUT", f"/v1/devices/{TOKEN}", body(mode="scheduled",
                         schedule=[{"from_utc": 0, "slot_utc_min": 60}]))[0], 200)
        self.assertEqual(self.store.device(TOKEN)["mode"], "scheduled")
        self.assertEqual(self.req("DELETE", f"/v1/devices/{TOKEN}")[0], 200)
        self.assertIsNone(self.store.device(TOKEN))
        self.assertEqual(self.req("DELETE", f"/v1/devices/{TOKEN}")[0], 404)   # the app treats 404 as done

    def test_rotation_replaces_the_old_token_atomically(self):
        self.req("PUT", f"/v1/devices/{OTHER}", body())
        self.assertEqual(self.req("PUT", f"/v1/devices/{TOKEN}", body(replaces=OTHER))[0], 200)
        self.assertIsNone(self.store.device(OTHER))
        self.assertIsNotNone(self.store.device(TOKEN))

    def test_bad_requests(self):
        self.assertEqual(self.req("PUT", "/v1/devices/xyz", body())[0], 400)
        self.assertEqual(self.req("PUT", f"/v1/devices/{TOKEN}", body(env="staging"))[0], 400)
        self.assertEqual(self.req("PUT", f"/v1/devices/{TOKEN}", b"x" * 2000)[0], 413)
        self.assertEqual(self.req("PUT", "/v1/other", body())[0], 404)
        self.assertEqual(self.req("POST", f"/v1/devices/{TOKEN}", body())[0], 405)
        self.assertEqual(self.store.devices(), [])

    def test_health_reports_push_without_tokens(self):
        self.req("PUT", f"/v1/devices/{TOKEN}", body())
        status, h = self.req("GET", "/health")
        self.assertEqual((status, h["push"]["sending"], h["push"]["devices"]), (200, False, {"asap": 1}))
        self.assertNotIn(TOKEN, json.dumps(h))

    def test_rate_limited(self):
        self.state.limiter = RateLimiter(per_minute=2)
        codes = [self.req("PUT", f"/v1/devices/{TOKEN}", body())[0] for _ in range(3)]
        self.assertEqual(codes, [200, 200, 429])
