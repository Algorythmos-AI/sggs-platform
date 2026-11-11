import hashlib
import io
import tempfile
import unittest
import urllib.error
from datetime import date
from unittest import mock

from hukamnama import __main__ as cli
from hukamnama.corpus import open_ro, resolution_for_range, scripture_sha256
from hukamnama.public import INDEX, DirSink, Publisher
from hukamnama.r2 import MultiSink, R2Sink, _NoRedirect, from_env, sign_v4
from hukamnama.store import Store
from tests.helpers import DB, needs_db, utc

ENDPOINT = "https://0123456789abcdef.r2.cloudflarestorage.com"
# Built at run time so no secret-shaped literal sits in the repository (these are AWS's public
# documentation example credentials, and a made-up pair for the fake bucket).
AWS_DOC_KEY = "AKIA" + "IOSFODNN7" + "EXAMPLE"
AWS_DOC_SECRET = "/".join(["wJalrXUtnFEMI", "K7MDENG", "bPxRfiCYEXAMPLEKEY"])
KEY_ID, SECRET = "-".join(["test", "key", "id"]), "-".join(["test", "secret", "value"])
NOW = utc(2026, 11, 11, 0, 25, 3)


class FakeOpener:
    def __init__(self, fail=None):
        self.requests, self.fail = [], fail

    def open(self, req, timeout=None):
        self.requests.append((req, timeout))
        if self.fail:
            raise self.fail
        return io.BytesIO(b"")


class _Resp(io.BytesIO):
    def __enter__(self): return self
    def __exit__(self, *a): return False


class Opener(FakeOpener):
    def open(self, req, timeout=None):
        super().open(req, timeout)
        return _Resp(b"")


def sink(opener):
    return R2Sink(ENDPOINT, "hukamnama-public", KEY_ID, SECRET, opener=opener, now=lambda: NOW)


class SigningTests(unittest.TestCase):
    def test_matches_the_aws_published_example(self):
        # AWS docs, "Signature Calculations for the Authorization Header": GET /test.txt, Range bytes=0-9
        empty = hashlib.sha256(b"").hexdigest()
        got = sign_v4("GET", "examplebucket.s3.amazonaws.com", "/test.txt",
                      {"Range": "bytes=0-9", "x-amz-content-sha256": empty, "x-amz-date": "20130524T000000Z"}, empty,
                      access_key=AWS_DOC_KEY, secret_key=AWS_DOC_SECRET, region="us-east-1", service="s3",
                      amz_date="20130524T000000Z")
        self.assertEqual(got, f"AWS4-HMAC-SHA256 Credential={AWS_DOC_KEY}/20130524/us-east-1/s3/aws4_request, "
                              "SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, "
                              "Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41")


class R2SinkTests(unittest.TestCase):
    def test_put_sends_the_exact_bytes_signed_to_the_bucket_path(self):
        op = Opener()
        body = '{"gurmukhi": "ਜਤਨ ਕਰੈ ਮਾਨੁਖ ਡਹਕਾਵੈ ਓਹੁ ਅੰਤਰਜਾਮੀ ਜਾਨੈ ॥"}\n'.encode("utf-8")
        sink(op).put("v1/hukamnama/2026-11-11.json", body)
        (req, timeout), = op.requests
        self.assertEqual(req.get_method(), "PUT")
        self.assertEqual(req.full_url, ENDPOINT + "/hukamnama-public/v1/hukamnama/2026-11-11.json")
        self.assertEqual(req.data, body)
        self.assertEqual(timeout, 10)
        h = {k.lower(): v for k, v in req.header_items()}
        digest = hashlib.sha256(body).hexdigest()
        self.assertEqual((h["x-amz-content-sha256"], h["x-amz-date"]), (digest, "20261111T002503Z"))
        self.assertEqual(h["content-type"], "application/json; charset=utf-8")
        signed = {k: h[k] for k in ("x-amz-content-sha256", "x-amz-date", "content-type", "cache-control")}
        self.assertEqual(h["authorization"], sign_v4(
            "PUT", "0123456789abcdef.r2.cloudflarestorage.com", "/hukamnama-public/v1/hukamnama/2026-11-11.json",
            signed, digest, access_key=KEY_ID, secret_key=SECRET, region="auto", service="s3",
            amz_date="20261111T002503Z"))
        self.assertNotIn(SECRET, h["authorization"])

    def test_delete_has_no_body(self):
        op = Opener()
        sink(op).delete("v1/hukamnama/2026-11-11.json")
        (req, _), = op.requests
        self.assertEqual((req.get_method(), req.data), ("DELETE", None))
        h = {k.lower(): v for k, v in req.header_items()}
        self.assertEqual(h["x-amz-content-sha256"], hashlib.sha256(b"").hexdigest())
        self.assertNotIn("content-type", h)

    def test_bad_keys_are_refused_before_any_request(self):
        op = Opener()
        for key in ("", "/abs.json", "../up.json", "v1/../../x", "v1//x"):
            with self.assertRaises(ValueError, msg=key):
                sink(op).put(key, b"{}")
        self.assertEqual(op.requests, [])

    def test_endpoint_must_be_plain_https(self):
        for bad in ("http://x.r2.cloudflarestorage.com", "https://x.example/path", "https://u:p@x.example",
                    "https://x.example?a=1", "ftp://x", ""):
            with self.assertRaises(ValueError, msg=bad):
                R2Sink(bad, "b", KEY_ID, SECRET)
        with self.assertRaises(ValueError):
            R2Sink(ENDPOINT, "a/b", KEY_ID, SECRET)

    def test_http_and_network_errors_raise_oserror_without_secrets(self):
        http = urllib.error.HTTPError(ENDPOINT, 403, "Forbidden", {}, io.BytesIO(SECRET.encode()))
        for fail, says in ((http, "HTTP 403"), (urllib.error.URLError(TimeoutError("timed out")), "TimeoutError")):
            with self.assertRaises(OSError) as cm:
                sink(FakeOpener(fail)).put("v1/hukamnama/index.json", b"{}")
            self.assertIn(says, str(cm.exception))
            self.assertNotIn(SECRET, str(cm.exception))
            self.assertNotIn(KEY_ID, str(cm.exception))

    def test_redirects_are_never_followed(self):
        self.assertIsNone(_NoRedirect().redirect_request(None, None, 307, "x", {}, "https://elsewhere.example/"))

    def test_multisink_writes_everywhere_and_fails_if_one_fails(self):
        a, b = Opener(), Opener()
        MultiSink(sink(a), sink(b)).put("v1/hukamnama/index.json", b"{}")
        self.assertEqual((len(a.requests), len(b.requests)), (1, 1))
        with self.assertRaises(OSError):
            MultiSink(sink(a), sink(FakeOpener(urllib.error.URLError("down")))).delete("v1/hukamnama/index.json")


class FromEnvTests(unittest.TestCase):
    FULL = {"HUKAMNAMA_PUBLIC_BUCKET": "hukamnama-public", "HUKAMNAMA_R2_ENDPOINT": ENDPOINT,
            "HUKAMNAMA_PUBLIC_ACCESS_KEY_ID": KEY_ID, "HUKAMNAMA_PUBLIC_SECRET_ACCESS_KEY": SECRET}

    def test_unset_means_no_sink(self):
        self.assertIsNone(from_env({}))
        self.assertIsNone(from_env({"HUKAMNAMA_R2_ENDPOINT": ENDPOINT}))     # the backup's endpoint alone

    def test_complete_configuration_builds_a_sink(self):
        self.assertIsInstance(from_env(self.FULL), R2Sink)

    def test_half_configured_is_refused_and_names_what_is_missing(self):
        for missing in ("HUKAMNAMA_R2_ENDPOINT", "HUKAMNAMA_PUBLIC_ACCESS_KEY_ID", "HUKAMNAMA_PUBLIC_SECRET_ACCESS_KEY"):
            env = {k: v for k, v in self.FULL.items() if k != missing}
            with self.assertRaises(ValueError) as cm:
                from_env(env)
            self.assertIn(missing, str(cm.exception))
            self.assertNotIn(SECRET, str(cm.exception))
        with self.assertRaises(ValueError):
            from_env({"HUKAMNAMA_PUBLIC_ACCESS_KEY_ID": KEY_ID})


@needs_db
class PublisherStartTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.con = open_ro(DB)
        self.fp = scripture_sha256(self.con)
        self.store = Store(f"{self.tmp.name}/s.sqlite")
        self.store.publish(date(2026, 11, 8), resolution_for_range(self.con, 29237, 29247), self.fp, NOW, "auto")

    def test_the_first_safe_sync_writes_everything_even_when_the_store_says_written(self):
        Publisher(self.store, self.con, self.fp, DirSink(f"{self.tmp.name}/a")).sync()
        op = Opener()                                   # a bucket added later starts empty
        pub = Publisher(self.store, self.con, self.fp, sink(op))
        pub.sync_safely()
        self.assertEqual([r.full_url.rsplit("/", 1)[1] for r, _ in op.requests], ["2026-11-08.json", "index.json"])
        pub.sync_safely()
        self.assertEqual(len(op.requests), 2)           # nothing changed: nothing written

    def test_a_failed_first_sync_is_tried_again_in_full(self):
        class Flaky:
            def __init__(self): self.calls, self.down = [], True
            def put(self, key, body):
                self.calls.append(key)
                if self.down:
                    raise OSError("R2 PUT: HTTP 503")
            def delete(self, key): pass
        s = Flaky()
        pub = Publisher(self.store, self.con, self.fp, s)
        with self.assertLogs("hukamnama", level="ERROR"):
            pub.sync_safely()
        s.down, s.calls = False, []
        pub.sync_safely()
        self.assertEqual(s.calls, ["v1/hukamnama/2026-11-08.json", INDEX])

    def test_serve_refuses_a_half_configured_bucket(self):
        env = {"HUKAMNAMA_PUBLIC_BUCKET": "hukamnama-public"}
        with mock.patch.dict("os.environ", env, clear=False), mock.patch("sys.stderr", new_callable=io.StringIO) as err:
            code = cli.main(["--db", DB, "--state", f"{self.tmp.name}/s2.sqlite", "serve", "--no-poll", "--port", "0"])
        self.assertEqual(code, 2)
        self.assertIn("HUKAMNAMA_R2_ENDPOINT", err.getvalue())


if __name__ == "__main__":
    unittest.main()
