"""Push: payload contract with the app, scheduling, and the sender against a scripted fake APNs."""
import json
import os
import tempfile
import unittest
from datetime import date, datetime, timedelta, timezone

from hukamnama.corpus import open_ro, resolution_for_range, scripture_sha256
from hukamnama.store import Store
from tests.helpers import DB, FIX, needs_db, utc

try:
    import httpx
    import jwt
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    HAS_DEPS = True
except ImportError:                                   # the sender's deps (requirements.txt)
    if os.environ.get("HUKAMNAMA_REQUIRE_PUSH_DEPS"):
        raise                                         # CI: the push tests must run, never skip
    HAS_DEPS = False
needs_deps = unittest.skipUnless(HAS_DEPS, "push deps not installed: pip install -r services/hukamnama/requirements.txt")

if HAS_DEPS:
    from hukamnama.push import APNs, Sender, date_label, due_tokens, expiration, last_slot, payload

DAY = date(2026, 11, 9)
PUB = utc(2026, 11, 9, 0, 4)                 # 05:34 IST
TOK = [f"{i:02x}" * 32 for i in range(1, 60)]  # 64-hex test tokens


def ec_key_pem() -> str:
    k = ec.generate_private_key(ec.SECP256R1())
    return k.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                           serialization.NoEncryption()).decode()


class FakeAPNs:
    """Answers per token from a script; default 200. Records every request."""
    def __init__(self):
        self.script: dict[str, list] = {}
        self.requests: list[httpx.Request] = []

    def __call__(self, request):
        self.requests.append(request)
        tok = request.url.path.rsplit("/", 1)[-1]
        queue = self.script.get(tok)
        status, body = (queue.pop(0) if queue else (200, None))
        return httpx.Response(status, json=body) if body is not None else httpx.Response(status)

    def hosts_for(self, tok):
        return [r.url.host for r in self.requests if r.url.path.endswith(tok)]


@needs_db
@needs_deps
class PushTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.con = open_ro(DB)
        cls.fp = scripture_sha256(cls.con)
        cls.pem = ec_key_pem()

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(f"{self.tmp.name}/state.sqlite")
        self.fake = FakeAPNs()
        self.clock = [PUB.timestamp()]
        self.apns = APNs(self.pem, "KEYID12345", "TEAMID1234", transport=httpx.MockTransport(self.fake),
                         now=lambda: self.clock[0])
        self.sender = Sender(self.store, self.apns, rng=lambda: 0.5)

    def tearDown(self):
        self.apns.close()
        self.tmp.cleanup()

    def publish(self, first=29226, last=29236, day=DAY, at=PUB):
        self.store.publish(day, resolution_for_range(self.con, first, last), self.fp, at, "auto")

    def register(self, toks, mode="asap", schedule=None, at=PUB - timedelta(days=1), env="production"):
        for t in toks:
            self.store.put_device(t, env, mode, schedule, self.fp, at)

    def drain(self, now=PUB, ticks=6):
        for i in range(ticks):
            self.sender.tick(now + timedelta(seconds=15 * i))

    # -- contract ----------------------------------------------------------------------------
    def test_payload_equals_the_apps_fixture(self):
        """The app's NSE and router are tested against hukamnama.apns (gurbani-soul-ios). The
        server must send exactly that shape, built from the same corpus lines."""
        app = json.loads((FIX / "ios-hukamnama.apns").read_text(encoding="utf-8"))
        app.pop("Simulator Target Bundle")
        self.publish()
        self.assertEqual(payload(self.store.decision(DAY)), app)

    def test_date_label_and_expiry(self):
        self.assertEqual(date_label(date(2026, 11, 9)), "Mon 9 Nov · Amritsar")
        self.assertEqual(date_label(date(2026, 12, 31)), "Thu 31 Dec · Amritsar")
        exp = datetime.fromtimestamp(expiration(PUB), timezone.utc)
        self.assertEqual(exp, utc(2026, 11, 9, 23, 30))          # next 05:00 IST

    # -- scheduling --------------------------------------------------------------------------
    def test_last_slot_follows_the_schedule_entry_in_force(self):
        change = int(utc(2026, 11, 10, 12, 0).timestamp())
        sched = [{"from_utc": 0, "slot_utc_min": 21 * 60}, {"from_utc": change, "slot_utc_min": 20 * 60}]
        self.assertEqual(last_slot(sched, utc(2026, 11, 10, 22, 0)), utc(2026, 11, 10, 20, 0))
        self.assertEqual(last_slot(sched, utc(2026, 11, 10, 11, 0)), utc(2026, 11, 9, 21, 0))
        self.assertIsNone(last_slot([{"from_utc": change, "slot_utc_min": 0}], utc(2026, 11, 10, 11, 0)))

    def test_who_is_due(self):
        self.publish()
        self.register([TOK[0]])                                   # asap, registered before
        self.register([TOK[1]], at=PUB + timedelta(minutes=5))    # asap, registered after publish
        self.register([TOK[2]], "scheduled", [{"from_utc": 0, "slot_utc_min": 3 * 60}])   # 08:30 IST
        self.register([TOK[3]], "scheduled", [{"from_utc": 0, "slot_utc_min": 23 * 60}])  # slot before publish
        d, due = due_tokens(self.store, PUB + timedelta(minutes=1))
        self.assertEqual((d, sorted(due)), (DAY, sorted([TOK[0], TOK[3]])))
        _, later = due_tokens(self.store, utc(2026, 11, 9, 3, 1))
        self.assertIn(TOK[2], later)
        self.assertIsNone(due_tokens(self.store, PUB + timedelta(days=3)))   # never an old day

    def test_held_day_sends_nothing(self):
        self.store.hold(DAY, PUB, "auto", "no match")
        self.register(TOK[:3])
        self.drain()
        self.assertEqual(self.fake.requests, [])

    # -- sender ------------------------------------------------------------------------------
    def test_happy_path_sends_once_with_the_right_headers(self):
        self.publish()
        self.register(TOK[:5])
        self.drain()
        self.assertEqual(self.store.send_stats(DAY), {"sent": 5})
        self.assertEqual(len(self.fake.requests), 5)
        r = self.fake.requests[0]
        self.assertEqual(r.url.host, "api.push.apple.com")
        for k, v in {"apns-push-type": "alert", "apns-priority": "10", "apns-topic": "org.sggs.app",
                     "apns-collapse-id": "hukamnama-2026-11-09"}.items():
            self.assertEqual(r.headers[k], v)
        claims = jwt.decode(r.headers["authorization"].split()[1], options={"verify_signature": False})
        self.assertEqual(claims["iss"], "TEAMID1234")
        self.assertEqual(jwt.get_unverified_header(r.headers["authorization"].split()[1])["kid"], "KEYID12345")
        self.assertEqual(self.apns.minted, 1)
        self.drain(PUB + timedelta(minutes=10))                  # nothing twice
        self.assertEqual(len(self.fake.requests), 5)

    def test_one_provider_token_per_40_minutes(self):
        for i in range(5):
            self.clock[0] = PUB.timestamp() + i * 12 * 60       # 0, 12, 24, 36, 48 min
            self.apns.provider_token()
        self.assertEqual(self.apns.minted, 2)                    # minted at 0 and again at 48

    def test_development_tokens_go_to_the_sandbox(self):
        self.publish()
        self.register([TOK[0]], env="development")
        self.drain()
        self.assertEqual(self.fake.hosts_for(TOK[0]), ["api.sandbox.push.apple.com"])

    def test_410_newer_than_registration_deletes_after_the_run(self):
        self.publish()
        self.register(TOK[:2])
        ts = int((PUB + timedelta(hours=1)).timestamp() * 1000)
        self.fake.script[TOK[0]] = [(410, {"reason": "Unregistered", "timestamp": ts})]
        self.drain()
        self.assertIsNone(self.store.device(TOK[0]))
        self.assertIsNotNone(self.store.device(TOK[1]))

    def test_410_older_than_registration_keeps_the_device(self):
        self.publish()
        self.register([TOK[0]])
        old = int((PUB - timedelta(days=5)).timestamp() * 1000)
        self.fake.script[TOK[0]] = [(410, {"reason": "Unregistered", "timestamp": old})]
        self.drain()
        self.assertIsNotNone(self.store.device(TOK[0]))

    def test_bad_token_retries_the_other_environment(self):
        self.publish()
        self.register([TOK[0]])
        self.fake.script[TOK[0]] = [(400, {"reason": "BadDeviceToken"})]
        self.drain()
        self.assertEqual(self.fake.hosts_for(TOK[0]), ["api.push.apple.com", "api.sandbox.push.apple.com"])
        self.assertEqual(self.store.device(TOK[0])["env"], "development")
        self.assertEqual(self.store.send_stats(DAY), {"sent": 1})

    def test_bad_token_is_deleted_only_after_three_separate_days(self):
        self.register([TOK[0]])
        for i in range(3):
            day = DAY + timedelta(days=i)
            at = PUB + timedelta(days=i)
            self.publish(day=day, at=at)
            self.fake.script[TOK[0]] = [(400, {"reason": "BadDeviceToken"})] * 2
            self.drain(at)
            self.assertEqual(self.store.device(TOK[0]) is None, i == 2, f"day {i + 1}")

    def test_server_errors_back_off_and_retry(self):
        self.publish()
        self.register([TOK[0]])
        self.fake.script[TOK[0]] = [(503, {"reason": "ServiceUnavailable"}), (500, {"reason": "InternalServerError"})]
        for m in range(0, 12):
            self.sender.tick(PUB + timedelta(minutes=m))
        self.assertEqual(self.store.send_stats(DAY), {"sent": 1})
        self.assertEqual(len(self.fake.requests), 3)

    def test_expired_provider_token_is_rebuilt_once(self):
        self.publish()
        self.register([TOK[0]])
        self.fake.script[TOK[0]] = [(403, {"reason": "ExpiredProviderToken"})]
        self.drain()
        self.assertEqual(self.store.send_stats(DAY), {"sent": 1})
        self.assertEqual(self.apns.minted, 2)

    def test_429_is_not_retried_today(self):
        self.publish()
        self.register([TOK[0]])
        self.fake.script[TOK[0]] = [(429, {"reason": "TooManyRequests"})]
        self.drain()
        self.assertEqual(len(self.fake.requests), 1)
        self.assertEqual(self.store.send_stats(DAY), {"failed": 1})

    def test_breaker_trips_and_deletes_nothing(self):
        """100% BadDeviceToken (a wrong key/topic, say) must stop the run and delete no device."""
        self.publish()
        self.register(TOK[:40])
        for t in TOK[:40]:
            self.fake.script[t] = [(400, {"reason": "BadDeviceToken"})] * 2
        self.drain()
        self.assertIn("push_breaker", [a["kind"] for a in self.store.alerts(DAY)])
        self.assertEqual(len(self.store.devices()), 40)

    def test_a_crash_mid_send_is_resent_after_restart(self):
        self.publish()
        self.register(TOK[:3])
        self.store.enqueue(DAY, TOK[:3], PUB)
        self.store.claim_due(PUB, 3, PUB - timedelta(minutes=2))  # claimed, then the process died
        self.sender.tick(PUB + timedelta(seconds=30))             # not stale yet: left alone
        self.assertEqual(len(self.fake.requests), 0)
        self.sender.tick(PUB + timedelta(minutes=3))
        self.assertEqual(self.store.send_stats(DAY), {"sent": 3})

    def test_resend_requeues_the_day(self):
        self.publish()
        self.register(TOK[:2])
        self.drain()
        self.assertEqual(self.store.requeue_day(DAY, PUB + timedelta(hours=1)), 2)
        self.drain(PUB + timedelta(hours=1))
        self.assertEqual(len(self.fake.requests), 4)

