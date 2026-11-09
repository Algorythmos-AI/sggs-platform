import itertools
import unittest
from datetime import date

from hukamnama.corpus import (NoMatch, Resolution, agrees, lines_in_range, open_ro, range_sha256, resolution_for_range,
                              resolve, scripture_sha256)
from hukamnama.locate import words
from hukamnama.sources import Candidate, parse_hs, parse_mukhwak
from tests.helpers import DB, HAS_DB, fixture, needs_db

TODAY = (29237, 29247)     # Ang 673, ਧਨਾਸਰੀ ਮਹਲਾ ੫ — the Hukamnama of 9 Nov 2026


def sgpc_style(text: str) -> str:
    """How SGPC writes corpus text: ੍ਹ as \u0a51 (the legacy-font conversion seen on hs.sgpc.net)."""
    return text.replace("\u0a4d\u0a39", "\u0a51")


def candidate(ang, title, body_text, day=date(2026, 11, 9)):
    return Candidate("hs", day, ang, title, tuple(words(sgpc_style(body_text))), "test")


@needs_db
class ResolverTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.con = open_ro(DB)

    def test_the_live_page_resolves_to_the_shabad_with_its_heading(self):
        r = resolve(self.con, parse_hs(fixture("hs-2026-11-09.html")))
        self.assertIsInstance(r, Resolution)
        self.assertEqual((r.first_line_id, r.last_line_id, r.ang, r.comp_id), (*TODAY, 673, 2667))
        self.assertTrue(r.heading_included)
        self.assertEqual(r.opening_line_id, 29238)
        rng = lines_in_range(self.con, *TODAY)
        self.assertEqual(r.opening_gurmukhi, rng[1].gurmukhi)         # served text = corpus bytes
        self.assertEqual(r.range_sha256, range_sha256([x.gurmukhi for x in rng]))

    def test_veto_agreement(self):
        r = resolve(self.con, parse_hs(fixture("hs-2026-11-09.html")))
        self.assertTrue(agrees(r, parse_mukhwak(fixture("sgpc-home-2026-11-09.html")), self.con))
        other = resolve(self.con, self._comp_candidate(2668))
        self.assertFalse(agrees(other, parse_mukhwak(fixture("sgpc-home-2026-11-09.html")), self.con))

    def test_one_changed_word_is_no_match(self):
        c = parse_hs(fixture("hs-2026-11-09.html"))
        body = list(c.body_words); body[5] = "ਗੁਨ"
        self.assertIsInstance(resolve(self.con, Candidate("hs", c.amritsar_date, c.ang, c.title, tuple(body), "x")),
                              NoMatch)

    def test_a_page_cut_at_a_verse_boundary_is_no_match(self):
        rng = lines_in_range(self.con, *TODAY)
        half = " ".join(x.gurmukhi for x in rng[1:6])          # ends cleanly on "…॥੧॥ ਰਹਾਉ ॥"
        r = resolve(self.con, candidate(673, "ਧਨਾਸਰੀ ਮਹਲਾ ੫॥", half))
        self.assertIsInstance(r, NoMatch)
        self.assertIn("mid-composition", r.reason)

    def test_wrong_ang_is_no_match(self):
        rng = lines_in_range(self.con, *TODAY)
        self.assertIsInstance(resolve(self.con, candidate(900, None, " ".join(x.gurmukhi for x in rng[1:]))), NoMatch)

    def test_a_heading_that_differs_is_left_out_not_guessed(self):
        rng = lines_in_range(self.con, *TODAY)
        r = resolve(self.con, candidate(673, "ਧਨਾਸਰੀ ਮਹਲਾ ੪॥", " ".join(x.gurmukhi for x in rng[1:])))
        self.assertEqual((r.first_line_id, r.heading_included), (29238, False))

    def test_explicit_range_rejects_gaps_and_nonsense(self):
        for a, b in ((10, 5), (1, 1000), (60_000, 61_000)):
            with self.assertRaises(ValueError):
                resolution_for_range(self.con, a, b)

    def test_scripture_fingerprint_matches_the_ios_manifest_definition(self):
        fp = scripture_sha256(self.con)
        self.assertEqual(len(fp), 64)
        self.assertEqual(fp, scripture_sha256(self.con))

    def _comp_candidate(self, comp_id):
        rows = list(self.con.execute("SELECT id, ang, is_header, gurmukhi FROM lines WHERE comp_id = ? ORDER BY id",
                                     (comp_id,)))
        k = next(i for i, r in enumerate(rows) if not r[2])
        title = sgpc_style(rows[k - 1][3]).replace(" ॥", "॥") if k else None
        return candidate(rows[k][1], title, " ".join(r[3] for r in rows[k:]))

    def test_every_composition_resolves_to_itself_or_to_nothing(self):
        """The whole-Granth property: written the way SGPC writes it (one paragraph, \u0a51 for ੍ਹ, a
        heading without the space before ॥), every composition resolves to exactly its own lines
        — or to NoMatch. Never to a different range."""
        rows = list(self.con.execute("SELECT id, comp_id, ang, is_header, gurmukhi FROM lines ORDER BY id"))
        exact = nomatch = 0
        wrong = []
        for cid, grp in itertools.groupby(rows, key=lambda r: r[1]):
            grp = list(grp)
            k = next((i for i, r in enumerate(grp) if not r[3]), None)
            if k is None:
                continue
            title = sgpc_style(grp[k - 1][4]).replace(" ॥", "॥") if k else None
            r = resolve(self.con, candidate(grp[k][2], title, " ".join(x[4] for x in grp[k:])))
            want_first = grp[k - 1][0] if k else grp[k][0]
            if isinstance(r, NoMatch):
                nomatch += 1
            elif (r.first_line_id, r.last_line_id) == (want_first, grp[-1][0]):
                exact += 1
            else:
                wrong.append((cid, r.first_line_id, r.last_line_id))
        print(f"\n  whole-Granth property: {exact} exact, {nomatch} held (no match), {len(wrong)} wrong")
        self.assertEqual(wrong, [], "a composition resolved to a range that is not its own")
        self.assertGreaterEqual(exact / (exact + nomatch), 0.98, f"exact={exact} nomatch={nomatch}")

    def test_every_vaar_unit_resolves_to_itself_or_to_nothing(self):
        """A Vaar Hukamnama is the saloks before a pauri plus the pauri: several comp_ids. Each of the
        Granth's pauri units, written SGPC-style, resolves to exactly its lines or to NoMatch."""
        units = list(self.con.execute("SELECT vaar_id, kind, first_line_id, n_lines FROM vaar_units "
                                      "ORDER BY vaar_id, seq"))
        exact = held = 0
        wrong = []
        start, vaar = None, None
        for vid, kind, first_id, n in units:
            if vid != vaar:
                start, vaar = None, vid
            if kind != "pauri":
                start = start or first_id
                continue
            first, last = start or first_id, first_id + n - 1
            start = None
            rng = lines_in_range(self.con, first, last)
            k = next(i for i, x in enumerate(rng) if not x.is_header)
            title = sgpc_style(rng[k - 1].gurmukhi).replace(" ॥", "॥") if k else None
            r = resolve(self.con, candidate(rng[k].ang, title, " ".join(x.gurmukhi for x in rng[k:])))
            if isinstance(r, NoMatch):
                held += 1
            elif (r.first_line_id, r.last_line_id) == ((rng[k - 1].id if k else rng[k].id), last):
                exact += 1
            else:
                wrong.append((vid, first, last, r.first_line_id, r.last_line_id))
        print(f"\n  Vaar units: {exact} exact, {held} held, {len(wrong)} wrong")
        self.assertEqual(wrong, [])
        self.assertGreaterEqual(exact, 450)


@unittest.skipIf(HAS_DB, "covered by ResolverTests")
class NoDbNotice(unittest.TestCase):
    def test_db_missing(self):
        self.skipTest("resolver tests need the scripture DB")


if __name__ == "__main__":
    unittest.main()
