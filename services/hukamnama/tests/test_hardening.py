"""The service under pressure and under correction.

* Whose address a request is limited by: only the edge, proving itself with the origin secret, may
  say; a direct caller cannot pick its own bucket, and can be refused outright.
* Reads have their own budget, and a stalled connection is dropped.
* ``correct`` replaces a published day's range and keeps the trail.
* ``pause`` stops serving and sending without a deploy; ``resume`` restores everything.
"""
import contextlib
import io
import json
import os
import socket
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from datetime import date
from unittest import mock

from hukamnama import api
from hukamnama.__main__ import main
from hukamnama.api import State, serve
from hukamnama.corpus import open_ro, resolution_for_range, scripture_sha256
from hukamnama.devices import RateLimiter
from hukamnama.public import INDEX, DirSink, Publisher, public_record
from hukamnama.push import send_loop
from hukamnama.store import Store
from tests.helpers import DB, needs_db, utc

NOW = utc(2026, 11, 9, 2, 0)        # 07:30 in Amritsar on the 9th
D8, D9 = date(2026, 11, 8), date(2026, 11, 9)
RANGE, OTHER = (29237, 29247), (29497, 29503)
SECRET = "-".join(["edge", "proof", "for", "tests"])      # built at run time: not a secret-shaped literal
TOKEN = "ab" * 32
BODY = json.dumps({"env": "production", "mode": "asap"}).encode()


class Served:
    """A running service over a temporary store."""
    def __init__(self, case, *, secret="", required=False, reads=None, publish=True):
        tmp = tempfile.TemporaryDirectory()
        case.addCleanup(tmp.cleanup)
        self.con = open_ro(DB)
        case.addCleanup(self.con.close)
        self.fp = scripture_sha256(self.con)
        self.store = Store(f"{tmp.name}/s.sqlite")
        if publish:
            self.store.publish(D8, resolution_for_range(self.con, *RANGE), self.fp, NOW, "auto")
        env = {"HUKAMNAMA_ORIGIN_SECRET": secret, "HUKAMNAMA_ORIGIN_REQUIRED": "on" if required else "off"}
        with mock.patch.dict(os.environ, env):
            self.state = State(self.store, self.fp, now=lambda: NOW)
        if reads is not None:
            self.state.reads = RateLimiter(per_minute=reads)
        self.httpd = serve(self.state, "127.0.0.1", 0)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        case.addCleanup(self.httpd.shutdown)
        self.base = f"http://127.0.0.1:{self.httpd.server_address[1]}"

    def call(self, path, *, method="GET", headers=None, body=None):
        req = urllib.request.Request(self.base + path, method=method, headers=headers or {}, data=body)
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read()), r.headers
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read()), e.headers


@needs_db
class WhoIsAsking(unittest.TestCase):
    def test_without_a_secret_the_proxys_forwarded_address_is_used(self):
        s = Served(self)
        s.state.limiter = RateLimiter(per_minute=1)
        put = lambda ip: s.call(f"/v1/devices/{TOKEN}", method="PUT", body=BODY, headers={"X-Forwarded-For": ip})[0]
        self.assertEqual([put("198.51.100.1"), put("198.51.100.1"), put("198.51.100.2")], [200, 429, 200])

    def test_with_a_secret_a_direct_caller_cannot_choose_its_bucket(self):
        s = Served(self, secret=SECRET)
        s.state.limiter = RateLimiter(per_minute=1)
        forged = lambda ip: s.call(f"/v1/devices/{TOKEN}", method="PUT", body=BODY,
                                   headers={"X-Forwarded-For": ip, "X-Client-IP": ip, "X-Origin-Auth": "guess"})[0]
        # every forged address lands in the one bucket of the socket it really came from
        self.assertEqual([forged("198.51.100.1"), forged("198.51.100.2"), forged("198.51.100.3")], [200, 429, 429])

    def test_with_the_secret_the_edge_names_the_address(self):
        s = Served(self, secret=SECRET)
        s.state.limiter = RateLimiter(per_minute=1)
        edge = lambda ip: s.call(f"/v1/devices/{TOKEN}", method="PUT", body=BODY,
                                 headers={"X-Client-IP": ip, "X-Origin-Auth": SECRET})
        self.assertEqual([edge("198.51.100.1")[0], edge("198.51.100.1")[0], edge("2001:db8::1")[0]], [200, 429, 200])
        self.assertEqual(edge("198.51.100.1")[2]["Retry-After"], "60")
        # an address that is not an address is one shared bucket, never a way to make new ones
        junk = lambda v: s.call(f"/v1/devices/{TOKEN}", method="PUT", body=BODY,
                                headers={"X-Client-IP": v, "X-Origin-Auth": SECRET})[0]
        self.assertEqual([junk("not-an-ip"), junk("also not")], [200, 429])

    def test_required_refuses_everything_that_did_not_come_through_the_edge(self):
        s = Served(self, secret=SECRET, required=True)
        self.assertEqual(s.call("/v1/hukamnama/today")[0], 403)
        self.assertEqual(s.call("/v1/hukamnama/index")[0], 403)
        self.assertEqual(s.call(f"/v1/devices/{TOKEN}", method="PUT", body=BODY)[0], 403)
        self.assertEqual(s.call(f"/v1/devices/{TOKEN}", method="DELETE")[0], 403)
        self.assertEqual(s.call(f"/v1/devices/{TOKEN}", method="PUT", body=BODY, headers={"X-Origin-Auth": SECRET + "x"})[0], 403)
        self.assertIsNone(s.store.device(TOKEN), "a refused request must not store a device")
        self.assertEqual(s.call("/health")[0], 200, "/health stays open for the health checks")
        ok = {"X-Origin-Auth": SECRET, "X-Client-IP": "198.51.100.9"}
        self.assertEqual(s.call("/v1/hukamnama/today", headers=ok)[0], 200)
        self.assertEqual(s.call(f"/v1/devices/{TOKEN}", method="PUT", body=BODY, headers=ok)[0], 200)

    def test_required_without_a_secret_refuses_everyone_rather_than_trusting_everyone(self):
        s = Served(self, required=True)
        self.assertEqual(s.call("/v1/hukamnama/today", headers={"X-Origin-Auth": ""})[0], 403)


@needs_db
class UnderLoad(unittest.TestCase):
    def test_reads_have_their_own_budget(self):
        s = Served(self, reads=3)
        codes = [s.call("/v1/hukamnama/today")[0] for _ in range(5)]
        self.assertEqual(codes, [200, 200, 200, 429, 429])
        self.assertEqual(s.call("/v1/hukamnama/today")[2]["Retry-After"], "60")
        self.assertEqual(s.call("/health")[0], 200, "/health is never limited")
        # a flood of reads has not touched the write budget of the same address
        self.assertEqual(s.call(f"/v1/devices/{TOKEN}", method="PUT", body=BODY)[0], 200)

    def test_a_silent_connection_is_dropped(self):
        with mock.patch.object(api, "SOCKET_TIMEOUT", 0.3):
            s = Served(self)
        port = s.httpd.server_address[1]
        with socket.create_connection(("127.0.0.1", port), timeout=5) as stalled:
            stalled.sendall(b"GET /v1/hukamnama/today HTTP/1.1\r\nHost: x\r\n")      # never finishes its headers
            started = time.monotonic()
            self.assertEqual(stalled.recv(1024), b"", "the server should close a stalled connection")
            self.assertLess(time.monotonic() - started, 4)
        self.assertEqual(s.call("/health")[0], 200, "and keep serving everyone else")


@needs_db
class Correcting(unittest.TestCase):
    def test_a_corrected_day_keeps_its_first_time_and_says_when_it_changed(self):
        s = Served(self)
        before = s.call("/v1/hukamnama/2026-11-08")[1]
        later = utc(2026, 11, 9, 6, 0)
        self.assertTrue(s.store.correct(D8, resolution_for_range(s.con, *OTHER), s.fp, later, "owner", "wrong shabad"))
        after = s.call("/v1/hukamnama/2026-11-08")[1]
        self.assertEqual((after["first_line_id"], after["last_line_id"], after["ang"]), (*OTHER, 680))
        self.assertEqual(after["published_at"], before["published_at"])
        self.assertEqual(after["corrected_at"], "2026-11-09T06:00:00+00:00")
        self.assertNotIn("corrected_at", before)
        self.assertEqual(s.store.correction(D8)["previous_range_sha256"], before["range_sha256"])
        # the public record proves against the corrected range, and the index carries the time
        rec = public_record(s.store, s.con, D8, s.fp)
        self.assertEqual(rec["corrected_at"], after["corrected_at"])
        self.assertEqual([x["id"] for x in rec["lines"]], list(range(OTHER[0], OTHER[1] + 1)))

    def test_a_second_correction_remembers_what_readers_first_saw(self):
        s = Served(self)
        first = s.store.decision(D8)["resolution"]["range_sha256"]
        s.store.correct(D8, resolution_for_range(s.con, *OTHER), s.fp, utc(2026, 11, 9, 6, 0), "owner", "one")
        s.store.correct(D8, resolution_for_range(s.con, *RANGE), s.fp, utc(2026, 11, 9, 7, 0), "owner", "two")
        c = s.store.correction(D8)
        self.assertEqual((c["first_range_sha256"], c["at"]), (first, "2026-11-09T07:00:00+00:00"))
        self.assertNotEqual(c["previous_range_sha256"], first)

    def test_only_a_published_day_can_be_corrected(self):
        s = Served(self)
        res = resolution_for_range(s.con, *OTHER)
        self.assertFalse(s.store.correct(D9, res, s.fp, NOW, "owner", "nothing there"))
        s.store.hold(D9, NOW, "owner", "held")
        self.assertFalse(s.store.correct(D9, res, s.fp, NOW, "owner", "held, not published"))
        self.assertIsNone(s.store.correction(D9))

    def test_the_snapshot_and_the_command_line_follow(self):
        with tempfile.TemporaryDirectory() as t:
            state, out = f"{t}/s.sqlite", f"{t}/public"
            run = lambda *a: main(["--db", DB, "--state", state, *a])
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(run("approve", "2026-11-08", "--first-line", str(RANGE[0]), "--last-line", str(RANGE[1]),
                                     "--by", "owner", "--reason", "first"), 0)
                self.assertEqual(run("export-public", "--out", out), 0)
                was = json.load(open(f"{out}/v1/hukamnama/2026-11-08.json", encoding="utf-8"))
                self.assertEqual(run("correct", "2026-11-09", "--first-line", str(OTHER[0]), "--last-line", str(OTHER[1]),
                                     "--by", "owner", "--reason", "no such day"), 1)
                self.assertEqual(run("correct", "2026-11-08", "--first-line", str(OTHER[0]), "--last-line", str(OTHER[1]),
                                     "--by", "owner", "--reason", "wrong shabad"), 0)
                self.assertEqual(run("export-public", "--out", out), 0)
            now = json.load(open(f"{out}/v1/hukamnama/2026-11-08.json", encoding="utf-8"))
            self.assertEqual((was["ang"], now["ang"]), (673, 680))
            self.assertIn("corrected_at", now)
            self.assertEqual(now["published_at"], was["published_at"])
            index = json.load(open(f"{out}/{INDEX}", encoding="utf-8"))
            self.assertEqual(index["days"][0]["corrected_at"], now["corrected_at"])
            actions = [r[0] for r in Store(state)._x("SELECT action FROM audit ORDER BY id")]
            self.assertIn("correct", actions)


@needs_db
class Pausing(unittest.TestCase):
    def test_paused_nothing_is_served_and_resume_restores_it(self):
        s = Served(self)
        self.assertEqual(s.call("/v1/hukamnama/2026-11-08")[1]["status"], "published")
        s.store.pause(NOW, "owner", "checking a report")
        day = s.call("/v1/hukamnama/2026-11-08")[1]
        self.assertEqual(day["status"], "pending")
        self.assertNotIn("opening_gurmukhi", day)
        self.assertEqual(s.call("/v1/hukamnama")[1], {"items": []})
        self.assertEqual(s.call("/v1/hukamnama/index")[1]["days"], [])
        self.assertTrue(s.call("/health")[1]["paused"])
        self.assertTrue(s.store.resume(NOW, "owner", "all clear"))
        self.assertEqual(s.call("/v1/hukamnama/2026-11-08")[1]["status"], "published")
        self.assertFalse(s.call("/health")[1]["paused"])
        self.assertFalse(s.store.resume(NOW, "owner", "again"), "resuming twice changes nothing")

    def test_paused_the_public_files_are_removed_and_come_back(self):
        s = Served(self)
        with tempfile.TemporaryDirectory() as out:
            pub = Publisher(s.store, s.con, s.fp, DirSink(out))
            pub.sync(force=True)
            day = os.path.join(out, "v1/hukamnama/2026-11-08.json")
            self.assertTrue(os.path.isfile(day))
            s.store.pause(NOW, "owner", "checking")
            report = pub.sync()
            self.assertFalse(os.path.exists(day), "a paused service publishes no day")
            self.assertIn("v1/hukamnama/2026-11-08.json", report["deleted"])
            index = json.load(open(os.path.join(out, INDEX), encoding="utf-8"))
            self.assertEqual((index["paused"], index["days"], index["latest"]), (True, [], None))
            s.store.resume(NOW, "owner", "clear")
            pub.sync()
            self.assertTrue(os.path.isfile(day))
            self.assertNotIn("paused", json.load(open(os.path.join(out, INDEX), encoding="utf-8")))

    def test_paused_nothing_is_sent(self):
        s = Served(self)

        class Sender:
            store, ticks, prunes = s.store, 0, 0
            def tick(self, t): Sender.ticks += 1
            def prune(self, t): Sender.prunes += 1

        def one_pass():
            stop = threading.Event()
            real_wait = stop.wait
            stop.wait = lambda every: (stop.set(), real_wait(0))[1]
            send_loop(Sender(), stop, now=lambda: NOW, every=0)

        one_pass()
        self.assertEqual(Sender.ticks, 1)
        s.store.pause(NOW, "owner", "checking")
        one_pass()
        self.assertEqual(Sender.ticks, 1, "a paused service must not send")
        s.store.resume(NOW, "owner", "clear")
        one_pass()
        self.assertEqual(Sender.ticks, 2)

    def test_the_command_line_switch_is_audited(self):
        with tempfile.TemporaryDirectory() as t:
            state = f"{t}/s.sqlite"
            run = lambda *a: main(["--db", DB, "--state", state, *a])
            with contextlib.redirect_stdout(io.StringIO()) as out:
                self.assertEqual(run("pause", "--by", "owner", "--reason", "a report"), 0)
            self.assertEqual(json.loads(out.getvalue())["paused"]["reason"], "a report")
            with contextlib.redirect_stdout(io.StringIO()) as out:
                self.assertEqual(run("resume", "--by", "owner", "--reason", "clear"), 0)
            self.assertIsNone(json.loads(out.getvalue())["paused"])
            self.assertEqual([r[0] for r in Store(state)._x("SELECT action FROM audit ORDER BY id")], ["pause", "resume"])



@needs_db
class AfterADatasetBump(unittest.TestCase):
    """The corpus fingerprint changed under a running archive: published days move to the new
    corpus only when every one is byte-identical there; otherwise nothing is served."""
    OLD = "0" * 64

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.state = f"{self.tmp.name}/s.sqlite"
        con = open_ro(DB)
        self.addCleanup(con.close)
        self.fp = scripture_sha256(con)
        store = Store(self.state)
        # two days published under an older corpus (same lines, another fingerprint)
        store.publish(D8, resolution_for_range(con, *RANGE), self.OLD, NOW, "auto")
        store.publish(D9, resolution_for_range(con, *OTHER), self.OLD, NOW, "auto")
        store.set_meta("scripture_sha256", self.OLD)

    def run_cli(self, *args):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = main(["--db", DB, "--state", self.state, *args])
        return code, out.getvalue(), err.getvalue()

    def test_days_that_prove_are_repinned_and_served_again(self):
        code, out, _ = self.run_cli("repin")
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out), {"scripture_sha256": self.fp, "published": 2})
        store = Store(self.state)
        self.assertEqual(store.get_meta("scripture_sha256"), self.fp)
        self.assertEqual({d["scripture_sha256"] for d in store.published()}, {self.fp})
        self.assertEqual([r[0] for r in store._x("SELECT action FROM audit WHERE action = 'repin'")], ["repin"])
        # and the public files can be written again: every day proves in the corpus it now names
        code, out, _ = self.run_cli("export-public", "--out", f"{self.tmp.name}/public")
        self.assertEqual((code, json.loads(out)["skipped"]), (0, []))
        # a second start changes nothing more
        self.assertEqual(self.run_cli("repin")[0], 0)
        self.assertEqual(len(Store(self.state)._x("SELECT 1 FROM audit WHERE action = 'repin'")), 1)

    def test_one_day_that_does_not_prove_stops_everything_and_changes_nothing(self):
        store = Store(self.state)
        row = store.decision(D9)["resolution"]
        row["range_sha256"] = "f" * 64                       # its lines are not what was published
        store._con.execute("UPDATE hukamnamas SET resolution = ? WHERE amritsar_date = ?", (json.dumps(row), D9.isoformat()))
        store._con.commit()
        for cmd in (("repin",), ("tick",), ("export-public", "--out", f"{self.tmp.name}/public")):
            code, _, err = self.run_cli(*cmd)
            self.assertEqual(code, 2, cmd)
            self.assertIn("2026-11-09", err)
            self.assertNotIn("2026-11-08", err, "the day that proves is not blamed")
        store = Store(self.state)
        self.assertEqual(store.get_meta("scripture_sha256"), self.OLD, "nothing is re-pinned while a day fails")
        self.assertEqual({d["scripture_sha256"] for d in store.published()}, {self.OLD})
        self.assertFalse(os.path.exists(f"{self.tmp.name}/public"))

    def test_the_owner_can_fix_the_day_and_then_it_starts(self):
        store = Store(self.state)
        row = store.decision(D9)["resolution"]
        row["range_sha256"] = "f" * 64
        store._con.execute("UPDATE hukamnamas SET resolution = ? WHERE amritsar_date = ?", (json.dumps(row), D9.isoformat()))
        store._con.commit()
        # correct is allowed while the archive is stopped: it is the fix
        code, _, _ = self.run_cli("correct", "2026-11-09", "--first-line", str(OTHER[0]), "--last-line", str(OTHER[1]),
                                  "--by", "owner", "--reason", "re-resolved after the dataset bump")
        self.assertEqual(code, 0)
        self.assertEqual(self.run_cli("repin")[0], 0)
        self.assertEqual({d["scripture_sha256"] for d in Store(self.state).published()}, {self.fp})

    def test_a_range_that_left_the_corpus_is_named(self):
        store = Store(self.state)
        row = store.decision(D8)["resolution"]
        row["first_line_id"], row["last_line_id"] = 99_999_990, 99_999_995
        store._con.execute("UPDATE hukamnamas SET resolution = ? WHERE amritsar_date = ?", (json.dumps(row), D8.isoformat()))
        store._con.commit()
        code, _, err = self.run_cli("repin")
        self.assertEqual(code, 2)
        self.assertIn("2026-11-08: lines 99999990-99999995", err)


if __name__ == "__main__":
    unittest.main()
