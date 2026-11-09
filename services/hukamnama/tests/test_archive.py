import gzip
import json
import os
import tempfile
import unittest

from hukamnama.archive import Archive
from hukamnama.sources import HS_URL, MUKHWAK_URL, Fetched

from .helpers import utc


def lines(path):
    with open(path, encoding="utf-8") as f:
        return [json.loads(x) for x in f]


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = self.tmp.name
        self.addCleanup(self.tmp.cleanup)

    def test_keeps_each_distinct_body_once_and_indexes_every_fetch(self):
        a = Archive(self.root)
        t = utc(2026, 11, 9, 0, 5, 12)                 # 05:35 IST
        a.record(HS_URL, Fetched(200, "<p>one</p>", '"e1"', t))
        a.record(HS_URL, Fetched(200, "<p>one</p>", '"e1"', utc(2026, 11, 9, 0, 6)))
        a.record(HS_URL, Fetched(304, None, '"e1"', utc(2026, 11, 9, 0, 7)))
        a.record(HS_URL, Fetched(200, "<p>two</p>", '"e2"', utc(2026, 11, 9, 0, 8)))
        a.record(MUKHWAK_URL, Fetched(200, "<p>one</p>", None, utc(2026, 11, 9, 0, 8)))
        d = os.path.join(self.root, "2026-11-09")
        files = sorted(f for f in os.listdir(d) if f.endswith(".gz"))
        self.assertEqual(files, ["000512Z-hs.html.gz", "000800Z-hs.html.gz", "000800Z-mukhwak.html.gz"])
        with gzip.open(os.path.join(d, "000512Z-hs.html.gz")) as g:
            self.assertEqual(g.read().decode(), "<p>one</p>")
        idx = lines(os.path.join(d, "index.ndjson"))
        self.assertEqual(len(idx), 5)
        self.assertEqual([e["file"] for e in idx],
                         ["000512Z-hs.html.gz", None, None, "000800Z-hs.html.gz", "000800Z-mukhwak.html.gz"])
        self.assertEqual(idx[2]["status"], 304)

    def test_files_go_under_the_amritsar_date(self):
        a = Archive(self.root)
        a.record(HS_URL, Fetched(200, "x", None, utc(2026, 11, 9, 18, 31)))   # 00:01 IST on the 10th
        self.assertTrue(os.path.isdir(os.path.join(self.root, "2026-11-10")))

    def test_a_write_error_never_reaches_the_poller(self):
        a = Archive(self.root)
        os.chmod(self.root, 0o500)
        self.addCleanup(os.chmod, self.root, 0o700)
        with self.assertLogs("hukamnama", "ERROR"):
            a.record(HS_URL, Fetched(200, "x", None, utc(2026, 11, 9, 1)))

    def test_wrap_passes_the_response_through_and_prunes_old_days(self):
        old = os.path.join(self.root, "2026-08-01")
        os.makedirs(old)
        open(os.path.join(old, "index.ndjson"), "w").close()
        a = Archive(self.root, keep_days=60)
        want = Fetched(200, "body", None, utc(2026, 11, 9, 1))
        got = a.wrap(lambda url, etag=None: want)(HS_URL)
        self.assertIs(got, want)
        self.assertFalse(os.path.exists(old))
        self.assertTrue(os.path.isdir(os.path.join(self.root, "2026-11-09")))

    def test_wrap_lets_fetch_errors_through(self):
        def boom(url, etag=None):
            raise OSError("down")
        with self.assertRaises(OSError):
            Archive(self.root).wrap(boom)(HS_URL)


if __name__ == "__main__":
    unittest.main()
