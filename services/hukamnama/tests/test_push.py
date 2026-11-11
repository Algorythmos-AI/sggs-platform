"""Push: payload contract with the app, scheduling, and the sender against a scripted fake APNs."""
import json
import os
import tempfile
import time
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
    from hukamnama.push import (STOP_FOR, APNs, Sender, date_label, due_tokens, expiration, last_slot, next_slot,
                                payload, plan_for_device)

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
        # the first entry is in force from the beginning of time (the app rebuilds "from now")
        self.assertEqual(last_slot([{"from_utc": change, "slot_utc_min": 0}], utc(2026, 11, 10, 11, 0)),
                         utc(2026, 11, 10, 0, 0))
        self.assertEqual(next_slot(sched, utc(2026, 11, 10, 11, 0)), utc(2026, 11, 10, 20, 0))

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

    def test_429_backs_off_and_retries(self):
        self.publish()
        self.register([TOK[0]])
        self.fake.script[TOK[0]] = [(429, {"reason": "TooManyRequests"})]
        for m in range(0, 3):
            self.sender.tick(PUB + timedelta(minutes=m))
        self.assertEqual(len(self.fake.requests), 2)
        self.assertEqual(self.store.send_stats(DAY), {"sent": 1})

    def test_429_does_not_trip_the_breaker(self):
        """Throttling is Apple's pace, not a bad request: even when every attempt is 429 until the
        rows give up, the breaker stays untripped."""
        self.publish()
        self.register(TOK[:40])
        for t in TOK[:40]:
            self.fake.script[t] = [(429, {"reason": "TooManyRequests"})] * 5
        for i in range(60):
            self.sender.tick(PUB + timedelta(seconds=15 * i))
        self.assertEqual(self.store.send_stats(DAY), {"failed": 40})
        self.assertNotIn("push_breaker", [a["kind"] for a in self.store.alerts(DAY)])

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

    # -- regressions (review 2026-11-11) -----------------------------------------------------
    def collapse_ids(self, tok):
        return [r.headers["apns-collapse-id"] for r in self.fake.requests if r.url.path.endswith(tok)]

    def test_yesterday_is_never_pushed_on_todays_date(self):
        """A day approved late (or SGPC late) must not be pushed on the next Amritsar date, and
        then today's as a second push: only the current Amritsar day is ever sent."""
        d0 = DAY - timedelta(days=1)
        self.register([TOK[0]], "scheduled", [{"from_utc": 0, "slot_utc_min": 180}], at=utc(2026, 11, 1))
        self.register([TOK[1]], at=utc(2026, 11, 1))
        self.publish(day=d0, at=utc(2026, 11, 8, 19, 0))         # owner approves 11-08 at 00:30 IST 11-09
        self.drain(utc(2026, 11, 8, 19, 0, 30))
        self.drain(utc(2026, 11, 9, 3, 0, 30))                    # TOK[0]'s slot; today not yet published
        self.assertEqual(self.fake.requests, [])
        self.publish(at=utc(2026, 11, 9, 4, 0))                    # today, late
        self.drain(utc(2026, 11, 9, 4, 0, 30))
        self.assertEqual(self.collapse_ids(TOK[0]), ["hukamnama-2026-11-09"])
        self.assertEqual(self.collapse_ids(TOK[1]), ["hukamnama-2026-11-09"])

    def test_moving_the_time_earlier_keeps_todays_push(self):
        """The app rebuilds the schedule with from_utc = now; today's slot, now passed, still counts."""
        self.publish()
        self.register([TOK[0]], "scheduled", [{"from_utc": 0, "slot_utc_min": 180}], at=utc(2026, 11, 1))
        now = utc(2026, 11, 9, 2, 50)                             # 03:00 → 02:30 UTC, at 02:50
        self.store.put_device(TOK[0], "production", "scheduled",
                              [{"from_utc": int(now.timestamp()), "slot_utc_min": 150}], self.fp, now)
        for h in range(3, 18):
            self.drain(utc(2026, 11, 9, h, 0), ticks=1)
        self.assertEqual(self.collapse_ids(TOK[0]), ["hukamnama-2026-11-09"])

    def test_switching_to_asap_keeps_todays_push_once(self):
        """Scheduled (10:00) → asap at 07:00, more than 6 h after the publish: sent then, and a
        further switch back does not send it twice."""
        self.publish()
        self.register([TOK[0]], "scheduled", [{"from_utc": 0, "slot_utc_min": 600}], at=utc(2026, 11, 1))
        self.store.put_device(TOK[0], "production", "asap", None, self.fp, utc(2026, 11, 9, 7))
        self.drain(utc(2026, 11, 9, 7, 0), ticks=2)
        self.assertEqual(self.collapse_ids(TOK[0]), ["hukamnama-2026-11-09"])   # at the switch, not at 10:00
        self.store.put_device(TOK[0], "production", "scheduled", [{"from_utc": 0, "slot_utc_min": 600}], self.fp,
                              utc(2026, 11, 9, 8))
        for h in range(8, 18):
            self.drain(utc(2026, 11, 9, h, 0), ticks=1)
        self.assertEqual(self.collapse_ids(TOK[0]), ["hukamnama-2026-11-09"])

    def test_resend_clears_the_breaker(self):
        self.publish()
        self.register(TOK[:30])
        for t in TOK[:30]:
            self.fake.script[t] = [(400, {"reason": "BadExpirationDate"})]
        self.drain()
        self.assertIsNotNone(self.store.get_meta(f"push_breaker:{DAY}"))
        self.assertEqual(self.store.requeue_day(DAY, PUB + timedelta(hours=1)), 30)
        self.drain(PUB + timedelta(hours=1))
        self.assertEqual(self.store.send_stats(DAY), {"sent": 30})
        self.assertIsNone(self.store.get_meta(f"push_breaker:{DAY}"))
        audit = self.store._x("SELECT actor, action FROM audit WHERE action = 'breaker_cleared'")
        self.assertEqual(audit, [("owner", "breaker_cleared")])

    def test_one_403_pauses_the_day_and_it_resumes(self):
        """One InvalidProviderToken must not fail every remaining device: the rows stay queued and
        resume when the pause lifts, and a device whose slot comes later still gets its push."""
        self.publish()
        self.register(TOK[:12])
        self.register([TOK[50]], "scheduled", [{"from_utc": 0, "slot_utc_min": 600}], at=utc(2026, 11, 1))
        self.fake.script[TOK[0]] = [(403, {"reason": "InvalidProviderToken"})]
        self.drain()
        stats = self.store.send_stats(DAY)
        self.assertNotIn("failed", stats)
        self.assertIn("push_auth_failed", [a["kind"] for a in self.store.alerts(DAY)])
        self.drain(PUB + STOP_FOR + timedelta(minutes=1))
        self.assertEqual(self.store.send_stats(DAY), {"sent": 12})
        self.drain(utc(2026, 11, 9, 10, 0, 5), ticks=1)
        self.assertEqual(self.store.send_stats(DAY), {"sent": 13})

    def test_a_pause_expires_for_the_owners_resend(self):
        """``resend`` runs in another process and cannot clear the sender's memory: the pause
        must expire on its own."""
        self.publish()
        self.register([TOK[0]])
        self.fake.script[TOK[0]] = [(403, {"reason": "InvalidProviderToken"})] * 5
        for m in range(0, 120, 2):
            self.sender.tick(PUB + timedelta(minutes=m))
        self.assertEqual(self.store.send_stats(DAY), {"failed": 1})        # gave up after 5 tries
        self.store.requeue_day(DAY, PUB + timedelta(hours=3))
        self.drain(PUB + timedelta(hours=3))
        self.assertEqual(self.store.send_stats(DAY), {"sent": 1})

    def test_concurrent_expired_provider_token_mints_once(self):
        """Eight workers rejected together must mint ONE new token (Apple: 1 per 20 minutes)."""
        self.publish()
        self.register(TOK[:40])
        first = {}

        def app(req):
            auth = req.headers["authorization"]
            first.setdefault("tok", auth)
            time.sleep(0.05)                                      # real network latency
            if auth == first["tok"]:
                return httpx.Response(403, json={"reason": "ExpiredProviderToken"})
            return httpx.Response(200)
        self.apns.client = httpx.Client(transport=httpx.MockTransport(app))
        self.apns.provider_token()
        m0 = self.apns.minted
        self.drain(ticks=1)
        self.assertEqual(self.apns.minted - m0, 1)
        self.assertEqual(self.store.send_stats(DAY), {"sent": 40})

    def test_env_fallback_keeps_a_concurrent_put(self):
        """The sender's environment fix must not write back its older copy of the device."""
        self.publish()
        self.register([TOK[0]], env="development")
        self.fake.script[TOK[0]] = [(400, {"reason": "BadDeviceToken"})]
        orig = self.fake.__call__

        def racing(req):
            if req.url.host == "api.push.apple.com":              # the fallback request is in flight
                self.store.put_device(TOK[0], "development", "scheduled", [{"from_utc": 0, "slot_utc_min": 600}],
                                      self.fp, PUB)
            return orig(req)
        self.apns.client = httpx.Client(transport=httpx.MockTransport(racing))
        self.drain()
        dev = self.store.device(TOK[0])
        self.assertEqual((dev["env"], dev["mode"], dev["schedule"]),
                         ("production", "scheduled", [{"from_utc": 0, "slot_utc_min": 600}]))

    def test_rotated_token_keeps_todays_push(self):
        """A rotated token is the same phone: it keeps created_at (so it still gets today's) and
        the sends it already had (so it never gets a day twice)."""
        self.publish()
        self.register([TOK[0], TOK[1]])
        self.store.put_device(TOK[2], "production", "asap", None, self.fp, PUB + timedelta(minutes=5), TOK[0])
        self.assertEqual(self.store.device(TOK[2])["created_at"], PUB - timedelta(days=1))
        self.drain(PUB + timedelta(minutes=6))
        self.assertEqual(self.collapse_ids(TOK[2]), ["hukamnama-2026-11-09"])
        self.store.put_device(TOK[3], "production", "asap", None, self.fp, PUB + timedelta(minutes=30), TOK[1])
        self.drain(PUB + timedelta(minutes=31))
        self.assertEqual(self.collapse_ids(TOK[3]), [])                     # TOK[1] already had it

    def test_a_delivered_push_keeps_the_device_from_pruning(self):
        self.publish()
        self.register([TOK[0], TOK[1]], at=PUB - timedelta(days=179))
        self.fake.script[TOK[1]] = [(400, {"reason": "PayloadEmpty"})]
        self.drain()
        self.assertEqual(self.sender.prune(PUB + timedelta(days=2)), 1)
        self.assertIsNotNone(self.store.device(TOK[0]))                    # delivered: alive
        self.assertIsNone(self.store.device(TOK[1]))

    # -- the plan the app is told (PUT /v1/devices) ------------------------------------------
    def plan(self, tok, now):
        return plan_for_device(self.store, self.store.device(tok), now)

    def test_plan_asap(self):
        self.register([TOK[0]])
        p = self.plan(TOK[0], PUB - timedelta(minutes=30))                  # day not yet published
        self.assertEqual((p.status, p.delivery, p.reason, p.next_slot_at), ("pending", "due", None, None))
        self.publish()
        self.register([TOK[1]], at=PUB + timedelta(minutes=5))
        self.assertEqual((self.plan(TOK[0], PUB + timedelta(minutes=6)).delivery), "due")
        p = self.plan(TOK[1], PUB + timedelta(minutes=6))
        self.assertEqual((p.status, p.delivery, p.reason), ("published", "not_today", "registered_after_publish"))
        self.drain(PUB + timedelta(minutes=6))
        p = self.plan(TOK[0], PUB + timedelta(minutes=7))
        self.assertEqual((p.delivery, p.sent_at, p.reason), ("sent", PUB + timedelta(minutes=6), None))

    def test_plan_scheduled(self):
        three = [{"from_utc": 0, "slot_utc_min": 180}]                      # 03:00 UTC = 08:30 IST
        self.register([TOK[0]], "scheduled", three)
        p = self.plan(TOK[0], utc(2026, 11, 9, 2, 0))                        # pending, slot ahead
        self.assertEqual((p.status, p.delivery, p.next_slot_at), ("pending", "due", utc(2026, 11, 9, 3, 0)))
        p = self.plan(TOK[0], utc(2026, 11, 9, 5, 0))                        # pending, inside the late window
        self.assertEqual((p.delivery, p.next_slot_at), ("due", utc(2026, 11, 10, 3, 0)))
        p = self.plan(TOK[0], utc(2026, 11, 9, 10, 0))                       # pending, window over
        self.assertEqual((p.delivery, p.reason), ("not_today", "slot_passed"))
        self.register([TOK[1]], "scheduled", three, at=utc(2026, 11, 9, 4, 0))   # registered after its slot
        self.publish()
        p = self.plan(TOK[1], utc(2026, 11, 9, 4, 1))
        self.assertEqual((p.status, p.delivery, p.reason), ("published", "not_today", "slot_passed"))
        self.assertTrue(self.plan(TOK[0], utc(2026, 11, 9, 3, 1)).push_now)
        self.store.enqueue(DAY, [TOK[0]], utc(2026, 11, 9, 3, 1))
        self.assertEqual(self.plan(TOK[0], utc(2026, 11, 9, 3, 1)).delivery, "due")   # queued

    def test_plan_held_and_failed(self):
        self.register([TOK[0], TOK[1]])
        self.store.hold(DAY, PUB, "auto", "no match")
        p = self.plan(TOK[0], PUB + timedelta(minutes=1))
        self.assertEqual((p.status, p.delivery, p.reason), ("held", "not_today", None))
        self.store.publish(DAY, resolution_for_range(self.con, 29226, 29236), self.fp, PUB + timedelta(hours=1),
                           "owner", overwrite=True)
        self.fake.script[TOK[1]] = [(400, {"reason": "PayloadEmpty"})]
        self.drain(PUB + timedelta(hours=1))
        self.assertEqual(self.plan(TOK[0], PUB + timedelta(hours=2)).delivery, "sent")
        self.assertEqual(self.plan(TOK[1], PUB + timedelta(hours=2)).delivery, "not_today")
