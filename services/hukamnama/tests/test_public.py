import hashlib
import json
import os
import re
import tempfile
import unittest
from datetime import date

from hukamnama.api import day_record
from hukamnama.corpus import open_ro, resolution_for_range, scripture_sha256
from hukamnama.public import INDEX, META, DirSink, NotProven, Publisher, public_record
from hukamnama.store import Store
from tests.helpers import DB, FIX, needs_db, utc

NOW = utc(2026, 11, 9, 2, 0)
D8, D9, D10 = date(2026, 11, 8), date(2026, 11, 9), date(2026, 11, 10)
RANGE = (29237, 29247)            # Ang 673, the shabad the API tests publish
OTHER = (29497, 29503)            # Ang 680
LAYER_WORDS = re.compile(r"translation|english|meaning|^en$", re.I)


def keys_of(obj, found=None):
    found = set() if found is None else found
    if isinstance(obj, dict):
        for k, v in obj.items():
            found.add(k)
            keys_of(v, found)
    elif isinstance(obj, list):
        for v in obj:
            keys_of(v, found)
    return found


@needs_db
class PublicTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.con = open_ro(DB)
        cls.fp = scripture_sha256(cls.con)

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.store = Store(f"{self.tmp.name}/s.sqlite")
        self.out = f"{self.tmp.name}/public"

    def publish(self, day, rng=RANGE, *, overwrite=False):
        self.store.publish(day, resolution_for_range(self.con, *rng), self.fp, NOW, "auto", overwrite=overwrite)

    def publisher(self, **kw):
        return Publisher(self.store, self.con, self.fp, DirSink(self.out), **kw)

    def read(self, key):
        with open(os.path.join(self.out, key), encoding="utf-8") as f:
            return json.load(f)

    # -- the record ----------------------------------------------------------------------------
    def test_lines_are_the_corpus_lines_and_prove_the_range_hash(self):
        self.publish(D8)
        rec = public_record(self.store, self.con, D8, self.fp)
        rows = self.con.execute("SELECT id, gurmukhi, translit, is_header, ang FROM lines WHERE id BETWEEN ? AND ? "
                                "ORDER BY id", RANGE).fetchall()
        self.assertEqual([(x["id"], x["gurmukhi"], x["translit"], x["is_heading"], x["ang"]) for x in rec["lines"]],
                         [(i, g, t, bool(h), a) for i, g, t, h, a in rows])
        joined = "\n".join(x["gurmukhi"] for x in rec["lines"]).encode("utf-8")
        self.assertEqual(hashlib.sha256(joined).hexdigest(), rec["range_sha256"])
        self.assertEqual(len(rec["lines"]), rec["line_count"])
        self.assertEqual(rec["url"], "https://gurbanisoul.com/en/hukamnama/2026-11-08")
        self.assertEqual(rec["citation"], "Sri Guru Granth Sahib Ji · Ang 673")
        self.assertEqual((rec["ang"], rec["ang_end"]), (673, rows[-1][4]))

    def test_record_keeps_every_field_the_read_api_serves(self):
        self.publish(D8)
        rec = public_record(self.store, self.con, D8, self.fp)
        for k, v in day_record(self.store, D8, self.fp, NOW).items():
            self.assertEqual(rec[k], v, k)

    def test_record_carries_the_keys_the_ios_app_decodes(self):
        with open(FIX / "ios-read-keys.json", encoding="utf-8") as f:
            frozen = json.load(f)
        self.publish(D8)
        rec = public_record(self.store, self.con, D8, self.fp)
        types = {"string": str, "integer": int}
        for key, kind in frozen["published"].items():
            self.assertIn(key, rec)
            self.assertIs(type(rec[key]), types[kind], key)
        self.assertIn(rec["status"], frozen["status_values"])
        self.assertRegex(rec["published_at"], frozen["timestamp_pattern"])

    def test_no_translation_layer_unless_switched_on(self):
        self.publish(D8)
        rec = public_record(self.store, self.con, D8, self.fp)
        self.assertEqual([k for k in keys_of(rec) if LAYER_WORDS.search(k)], [])
        on = public_record(self.store, self.con, D8, self.fp, meaning=True)
        self.assertEqual(on["translation"]["translator"], "Dr. Sant Singh Khalsa")
        english = dict(self.con.execute("SELECT line_id, text FROM translations WHERE lang='en' AND "
                                        "line_id BETWEEN ? AND ?", RANGE))
        self.assertTrue(english)
        for x in on["lines"]:
            self.assertEqual(x.get("en"), english.get(x["id"]))
        # the layer is separate: the Gurmukhi is byte-identical with it on or off
        self.assertEqual([x["gurmukhi"] for x in on["lines"]], [x["gurmukhi"] for x in rec["lines"]])

    def test_mixed_authors_have_no_single_author(self):
        row = self.con.execute(
            "SELECT a.id FROM lines a JOIN lines b ON b.id = a.id + 1 WHERE a.is_header = 0 AND b.is_header = 0 "
            "AND a.author IS NOT NULL AND b.author IS NOT NULL AND a.author <> b.author LIMIT 1").fetchone()
        if row is None:
            self.skipTest("no adjacent verses by different authors in this corpus")
        self.publish(D8, (row[0], row[0] + 1))
        rec = public_record(self.store, self.con, D8, self.fp)
        self.assertIsNone(rec["author"])
        self.assertEqual(len({x["author"] for x in rec["lines"]}), 2)

    def test_single_author_is_named(self):
        self.publish(D8, OTHER)
        rec = public_record(self.store, self.con, D8, self.fp)
        self.assertEqual(rec["author"], "Guru Arjan Dev Ji (M5)")
        self.assertTrue(rec["lines"][0]["is_heading"])
        self.assertEqual([x["id"] for x in rec["lines"] if x["is_rahao"]], [29501])

    def test_unpublished_days_have_no_record(self):
        self.assertIsNone(public_record(self.store, self.con, D8, self.fp))
        self.store.hold(D9, NOW, "auto", "held")
        self.assertIsNone(public_record(self.store, self.con, D9, self.fp))

    def test_a_day_published_in_another_corpus_is_refused(self):
        self.store.publish(D8, resolution_for_range(self.con, *RANGE), "0" * 64, NOW, "auto")
        with self.assertRaises(NotProven):
            public_record(self.store, self.con, D8, self.fp)

    def test_a_range_whose_hash_does_not_match_is_refused(self):
        res = resolution_for_range(self.con, *RANGE)
        bad = type(res)(**{**res.__dict__, "range_sha256": "f" * 64})
        self.store.publish(D8, bad, self.fp, NOW, "auto")
        with self.assertRaises(NotProven):
            public_record(self.store, self.con, D8, self.fp)

    # -- the publisher -------------------------------------------------------------------------
    def test_sync_writes_days_and_index_then_nothing_until_something_changes(self):
        self.publish(D8)
        self.publish(D9, OTHER)
        pub = self.publisher()
        first = pub.sync()
        self.assertEqual(sorted(first["written"]), ["v1/hukamnama/2026-11-08.json", "v1/hukamnama/2026-11-09.json", INDEX])
        self.assertEqual(first["written"][-1], INDEX)                      # the index is written last
        idx = self.read(INDEX)
        self.assertEqual((idx["latest"], [d["amritsar_date"] for d in idx["days"]]),
                         ("2026-11-09", ["2026-11-09", "2026-11-08"]))
        self.assertEqual(idx["scripture_sha256"], self.fp)
        self.assertEqual(self.read("v1/hukamnama/2026-11-08.json"), public_record(self.store, self.con, D8, self.fp))
        self.assertEqual(pub.sync(), {"written": [], "deleted": [], "skipped": []})

    def test_a_correction_rewrites_the_day_and_the_index(self):
        self.publish(D8)
        pub = self.publisher()
        pub.sync()
        self.publish(D8, OTHER, overwrite=True)
        self.assertEqual(sorted(pub.sync()["written"]), ["v1/hukamnama/2026-11-08.json", INDEX])
        self.assertEqual(self.read("v1/hukamnama/2026-11-08.json")["ang"], 680)

    def test_a_day_the_owner_holds_is_withdrawn(self):
        self.publish(D8)
        self.publish(D9, OTHER)
        pub = self.publisher()
        pub.sync()
        self.store.hold(D9, NOW, "owner", "wrong shabad", overwrite=True)
        r = pub.sync()
        self.assertEqual(r["deleted"], ["v1/hukamnama/2026-11-09.json"])
        self.assertFalse(os.path.exists(os.path.join(self.out, "v1/hukamnama/2026-11-09.json")))
        self.assertEqual(self.read(INDEX)["latest"], "2026-11-08")
        self.assertEqual(self.store.meta_keys(META), [META + "v1/hukamnama/2026-11-08.json", META + INDEX])

    def test_an_unproven_day_is_skipped_and_the_rest_still_publish(self):
        self.publish(D8)
        self.store.publish(D9, resolution_for_range(self.con, *OTHER), "0" * 64, NOW, "auto")
        r = self.publisher().sync()
        self.assertEqual(len(r["skipped"]), 1)
        self.assertIn("2026-11-09", r["skipped"][0])
        self.assertEqual([d["amritsar_date"] for d in self.read(INDEX)["days"]], ["2026-11-08"])
        self.assertFalse(os.path.exists(os.path.join(self.out, "v1/hukamnama/2026-11-09.json")))

    def test_force_refills_an_emptied_sink(self):
        self.publish(D8)
        pub = self.publisher()
        pub.sync()
        os.remove(os.path.join(self.out, "v1/hukamnama/2026-11-08.json"))
        self.assertEqual(pub.sync()["written"], [])
        self.assertIn("v1/hukamnama/2026-11-08.json", pub.sync(force=True)["written"])

    def test_switching_the_meaning_layer_off_removes_it_from_the_files(self):
        self.publish(D8)
        self.publisher(meaning=True).sync()
        self.assertIn("translation", self.read("v1/hukamnama/2026-11-08.json"))
        self.publisher(meaning=False).sync()
        self.assertEqual([k for k in keys_of(self.read("v1/hukamnama/2026-11-08.json")) if LAYER_WORDS.search(k)], [])

    def test_sync_safely_never_raises(self):
        class Broken:
            def put(self, *a): raise OSError("disk full")
            def delete(self, *a): raise OSError("disk full")
        self.publish(D8)
        with self.assertLogs("hukamnama", level="ERROR"):
            Publisher(self.store, self.con, self.fp, Broken()).sync_safely()

    def test_sink_refuses_keys_outside_its_root(self):
        with self.assertRaises(ValueError):
            DirSink(self.out).put("../escape.json", b"{}")


if __name__ == "__main__":
    unittest.main()
