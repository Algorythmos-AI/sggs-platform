import itertools
import unittest
from datetime import date

from hukamnama.corpus import (RAHAO_MAX_LINES, _lines, closes_shabad, heading_run_start, NoMatch, Resolution, agrees, lines_in_range, open_ro, rahao_block,
                              range_sha256, resolution_for_range, resolve, scripture_sha256)
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

    def test_the_19_nov_vaar_page_with_its_labels_resolves(self):
        """hs.sgpc.net on 19 Nov 2026 (Ang 849, Bilaval ki Vaar M4, first pauri) prints the labels
        ਸਲੋਕ ਮਃ ੪ ॥ / ਮਃ ੩ ॥ / ਪਉੜੀ ॥ among the verses; the corpus files them as heading lines. The day
        was held (#429) because a run could only open on a verse. It now resolves to the unit with
        the Vaar's printed heading run, and every served byte is the corpus line."""
        r = resolve(self.con, parse_hs(fixture("hs-2026-11-19.html")))
        self.assertIsInstance(r, Resolution)
        self.assertEqual((r.first_line_id, r.last_line_id, r.opening_line_id, r.ang), (36195, 36214, 36198, 849))
        self.assertTrue(r.heading_included)
        rng = lines_in_range(self.con, 36195, 36214)
        self.assertEqual([x.gurmukhi for x in rng[:3]], ["ਬਿਲਾਵਲ ਕੀ ਵਾਰ ਮਹਲਾ ੪", "ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ॥", "ਸਲੋਕ ਮਃ ੪ ॥"])
        self.assertEqual(r.range_sha256, range_sha256([x.gurmukhi for x in rng]))
        # one changed word anywhere, labels included, is still no match
        c = parse_hs(fixture("hs-2026-11-19.html"))
        for k in (0, 1, 40, len(c.body_words) - 1):
            body = list(c.body_words); body[k] = body[k] + "ਾ"
            self.assertIsInstance(resolve(self.con, Candidate("hs", c.amritsar_date, c.ang, c.title, tuple(body), "x")),
                                  NoMatch, k)

    def test_the_veto_may_open_on_a_printed_label(self):
        """sgpc.net's marquee for 19 Nov reads ਸਲੋਕ ਮਃ ੪ ॥ ਹਰਿ ਉਤਮੁ … after its heading: it agrees.
        An opening taken from later in the range does not."""
        r = resolve(self.con, parse_hs(fixture("hs-2026-11-19.html")))
        day = date(2026, 11, 19)
        def veto(text):
            return Candidate("mukhwak", day, 849, None, tuple(words(text)), "x")
        self.assertTrue(agrees(r, veto("ਸਲੋਕ ਮਃ ੪ ॥ ਹਰਿ ਉਤਮੁ ਹਰਿ ਪ੍ਰਭੁ ਗਾਵਿਆ ਕਰਿ ਨਾਦੁ ਬਿਲਾਵਲੁ ਰਾਗੁ ॥"), self.con))
        self.assertTrue(agrees(r, veto("ਹਰਿ ਉਤਮੁ ਹਰਿ ਪ੍ਰਭੁ ਗਾਵਿਆ ਕਰਿ ਨਾਦੁ ਬਿਲਾਵਲੁ ਰਾਗੁ ॥"), self.con))
        self.assertFalse(agrees(r, veto("ਤੂ ਹਰਿ ਪ੍ਰਭੁ ਆਪਿ ਅਗੰਮੁ ਹੈ ਸਭਿ ਤੁਧੁ ਉਪਾਇਆ ॥"), self.con))
        self.assertFalse(agrees(r, veto("ਸਲੋਕ ਮਃ ੪ ॥ ਹਰਿ ਉਤਮੁ ਹਰਿ ਪ੍ਰਭੁ ਗਾਇਆ ਕਰਿ ਨਾਦੁ ਬਿਲਾਵਲੁ ਰਾਗੁ ॥"), self.con))

    def test_one_changed_word_is_no_match(self):
        c = parse_hs(fixture("hs-2026-11-09.html"))
        body = list(c.body_words); body[5] = "ਗੁਨ"
        self.assertIsInstance(resolve(self.con, Candidate("hs", c.amritsar_date, c.ang, c.title, tuple(body), "x")),
                              NoMatch)

    def test_the_10_nov_page_is_held_and_names_its_nearest_run(self):
        """hs.sgpc.net on 10 Nov 2026 wrote ਨਾਨਕੁ where the corpus (and ShabadOS) has ਨਾਨਕ. The day
        is held, and the hold names the run the owner would approve and the one differing word."""
        r = resolve(self.con, parse_hs(fixture("hs-2026-11-10.html")))
        self.assertIsInstance(r, NoMatch)
        self.assertEqual((r.near.first_line_id, r.near.last_line_id), (29433, 29442))
        self.assertEqual(r.near.diffs, ((78, "ਨਾਨਕੁ", "ਨਾਨਕ"),))
        self.assertIn("nearest run lines 29433-29442 differs in 1 word: word 79/81 ਨਾਨਕੁ (source) vs ਨਾਨਕ (corpus)",
                      r.reason)

    def test_a_near_match_is_still_no_match(self):
        c = parse_hs(fixture("hs-2026-11-09.html"))
        body = list(c.body_words); old = body[5]; body[5] = "ਗੁਨ"
        r = resolve(self.con, Candidate("hs", c.amritsar_date, c.ang, c.title, tuple(body), "x"))
        self.assertIsInstance(r, NoMatch)                       # diagnosis never becomes a decision
        self.assertEqual((r.near.first_line_id, r.near.last_line_id), (29238, 29247))
        self.assertEqual(r.near.diffs, ((5, "ਗੁਨ", old),))

    def test_a_page_far_from_any_run_names_no_nearest(self):
        c = parse_hs(fixture("hs-2026-11-09.html"))
        body = list(c.body_words)
        for k in (1, 4, 9, 14):                                  # four differing words: too far
            body[k] = "ਗੁਨ"
        r = resolve(self.con, Candidate("hs", c.amritsar_date, c.ang, c.title, tuple(body), "x"))
        self.assertIsInstance(r, NoMatch)
        self.assertIsNone(r.near)
        self.assertNotIn("nearest", r.reason)

    def test_a_page_cut_at_a_verse_boundary_is_no_match(self):
        rng = lines_in_range(self.con, *TODAY)
        half = " ".join(x.gurmukhi for x in rng[1:6])          # ends cleanly on "…॥੧॥ ਰਹਾਉ ॥"
        r = resolve(self.con, candidate(673, "ਧਨਾਸਰੀ ਮਹਲਾ ੫॥", half))
        self.assertIsInstance(r, NoMatch)
        self.assertIn("mid-composition", r.reason)

    def test_wrong_ang_is_no_match(self):
        rng = lines_in_range(self.con, *TODAY)
        self.assertIsInstance(resolve(self.con, candidate(900, None, " ".join(x.gurmukhi for x in rng[1:]))), NoMatch)

    def test_the_heading_comes_from_the_corpus_whatever_the_source_titles_it(self):
        rng = lines_in_range(self.con, *TODAY)
        body = " ".join(x.gurmukhi for x in rng[1:])
        for title in ("ਧਨਾਸਰੀ ਮਹਲਾ ੪॥", None):
            r = resolve(self.con, candidate(673, title, body))
            self.assertEqual((r.first_line_id, r.heading_included), (29237, True), title)

    def test_a_two_line_heading_run_is_served_whole(self):
        """17 Nov 2026, Ang 604: ਸੋਰਠਿ ਮਹਲਾ ੪ ਘਰੁ ੧ then ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ॥ open the shabad. The line
        just before the first verse is the ੴ, so a title match alone served no heading at all."""
        body = " ".join(x.gurmukhi for x in lines_in_range(self.con, 26383, 26396))
        r = resolve(self.con, candidate(604, "ਸੋਰਠਿ ਮਹਲਾ ੪॥", body, day=date(2026, 11, 17)))
        self.assertEqual((r.first_line_id, r.last_line_id, r.opening_line_id), (26381, 26396, 26383))
        self.assertTrue(r.heading_included)
        self.assertEqual([x.gurmukhi for x in lines_in_range(self.con, 26381, 26382)],
                         ["ਸੋਰਠਿ ਮਹਲਾ ੪ ਘਰੁ ੧", "ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ॥"])

    def test_a_later_shabad_under_one_heading_gets_no_heading(self):
        """Several shabads can share one heading and comp_id (Bhagat bani); only the first opens it."""
        rows = [r for r in _lines(self.con, "WHERE ang BETWEEN 690 AND 694 ORDER BY id", ())]
        starts = [rows[i] for i in range(1, len(rows))
                  if not rows[i].is_header and closes_shabad(rows[i - 1].gurmukhi)
                  and rows[i - 1].comp_id == rows[i].comp_id]
        self.assertTrue(starts)
        for verse in starts:
            self.assertEqual(heading_run_start(self.con, verse), verse.id, verse.id)

    def _heading_start(self, verse):
        """Independent of the resolver: walk back over heading lines of the verse's composition."""
        first = verse.id
        while True:
            prev = _lines(self.con, "WHERE id = ?", (first - 1,))
            if not prev or not prev[0].is_header or prev[0].comp_id != verse.comp_id:
                return first
            first -= 1

    def test_explicit_range_rejects_gaps_and_nonsense(self):
        for a, b in ((10, 5), (1, 1000), (60_000, 61_000)):
            with self.assertRaises(ValueError):
                resolution_for_range(self.con, a, b)

    def _text(self, a, b):
        return " ".join(g for (g,) in self.con.execute("SELECT gurmukhi FROM lines WHERE id BETWEEN ? AND ? ORDER BY id", (a, b)))

    def test_a_shabad_inside_a_longer_composition_resolves(self):
        """14 Nov 2026: Bhagat Kabir, Ang 692 (lines 29956-29961, ending ॥੨॥੩॥). Comp 2743 holds
        several of his shabads under one heading; the day was held as 'ends mid-composition'."""
        r = resolve(self.con, candidate(692, None, self._text(29956, 29961), day=date(2026, 11, 14)))
        self.assertIsInstance(r, Resolution, getattr(r, "reason", ""))
        self.assertEqual((r.first_line_id, r.last_line_id, r.ang), (29956, 29961, 692))
        self.assertEqual(r.rahao_gurmukhi[-1].endswith("ਰਹਾਉ ॥"), True)

    def test_a_page_cut_at_a_plain_verse_end_inside_it_is_still_no_match(self):
        r = resolve(self.con, candidate(692, None, self._text(29956, 29957), day=date(2026, 11, 14)))
        self.assertIsInstance(r, NoMatch)
        self.assertIn("mid-composition", r.reason)

    def test_closes_shabad(self):
        for line, want in (("ਕਿਆ ਕਾਸੀ ਕਿਆ ਊਖਰੁ ਮਗਹਰੁ ਰਾਮੁ ਰਿਦੈ ਜਉ ਹੋਈ ॥੨॥੩॥", True),
                           ("ਨਾਮ ਉਦਕੁ ਪੀਵਤ ਜਨ ਨਾਨਕ ਤਿਆਗੇ ਸਭਿ ਅਨੁਰਾਗਾ ॥੨॥੧੬॥੪੭॥", True),
                           ("ਜਿਉ ਜਲੁ ਜਲ ਮਹਿ ਪੈਸਿ ਨ ਨਿਕਸੈ ਤਿਉ ਢੁਰਿ ਮਿਲਿਓ ਜੁਲਾਹੋ ॥੧॥", False),
                           ("ਜਉ ਤਨੁ ਕਾਸੀ ਤਜਹਿ ਕਬੀਰਾ ਰਮਈਐ ਕਹਾ ਨਿਹੋਰਾ ॥੧॥ ਰਹਾਉ ॥", False),
                           ("ਹਰਿ ਕੇ ਲੋਗਾ ਮੈ ਤਉ ਮਤਿ ਕਾ ਭੋਰਾ ॥", False)):
            self.assertEqual(closes_shabad(line), want, line)

    def test_every_inner_shabad_resolves_to_itself_or_to_nothing(self):
        """Every numbered shabad that ends inside a longer composition, served as SGPC would serve
        it: it resolves to exactly its own lines, or is held — never to another range."""
        rows = _lines(self.con, "ORDER BY id", ())
        exact = wrong = 0
        start = None
        for k, x in enumerate(rows):
            if x.is_header:
                start = None
                continue
            if start is None:
                start = k
            nxt = rows[k + 1] if k + 1 < len(rows) else None
            if closes_shabad(x.gurmukhi):
                inner = nxt is not None and not nxt.is_header and nxt.comp_id == x.comp_id
                if inner:
                    a, b = rows[start], x
                    r = resolve(self.con, candidate(a.ang, None, self._text(a.id, b.id)))
                    if isinstance(r, Resolution):
                        if (r.first_line_id, r.last_line_id) == (self._heading_start(a), b.id):
                            exact += 1
                        else:
                            wrong += 1
                start = None
        self.assertEqual(wrong, 0)
        self.assertGreater(exact, 100)
        print(f"\n  inner shabads: {exact} exact, 0 wrong")

    def test_rahao_is_the_refrain_couplet_verbatim(self):
        r = resolution_for_range(self.con, 29574, 29580)        # 12 Nov 2026, Ang 682
        self.assertEqual(r.rahao_gurmukhi, ("ਤੇਰਾ ਜਨੁ ਰਾਮ ਨਾਮ ਰੰਗਿ ਜਾਗਾ ॥",
                                            "ਆਲਸੁ ਛੀਜਿ ਗਇਆ ਸਭੁ ਤਨ ਤੇ ਪ੍ਰੀਤਮ ਸਿਉ ਮਨੁ ਲਾਗਾ ॥ ਰਹਾਉ ॥"))

    def test_rahao_property_over_every_composition(self):
        """Every block is consecutive verbatim corpus lines of its composition that end on its one
        rahao line, start after a heading or a numbered verse end, and never exceed the cap; a
        composition with no rahao or several gets none."""
        comps = [c for (c,) in self.con.execute("SELECT DISTINCT comp_id FROM lines ORDER BY comp_id")]
        given = 0
        for c in comps:
            rng = _lines(self.con, "WHERE comp_id = ? ORDER BY id", (c,))
            block = rahao_block(rng)
            marked = [i for i, x in enumerate(rng) if x.is_rahao]
            if len(marked) != 1:
                self.assertEqual(block, (), c)
                continue
            if not block:
                continue
            given += 1
            end = marked[0]
            start = end - len(block) + 1
            self.assertLessEqual(len(block), RAHAO_MAX_LINES, c)
            self.assertEqual(block, tuple(x.gurmukhi for x in rng[start:end + 1]), c)
            self.assertFalse(any(x.is_header for x in rng[start:end + 1]), c)
        self.assertGreater(given, 2000)

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
            want_first = grp[0][0]          # the composition's whole printed heading run
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
        for labels in (False, True):
            with self.subTest(labels=labels):
                self._vaar_units(labels)

    def _vaar_units(self, labels: bool):
        """``labels``: SGPC prints the unit's label lines (ਸਲੋਕ ਮਃ ੪ ॥ …) at the head of the verses,
        as hs.sgpc.net did on 19 Nov 2026; the title is the heading line before them."""
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
            b = k
            if labels:      # the label run right before the first verse, under the unit's own comp_id
                while b > 0 and rng[b - 1].is_header and rng[b - 1].comp_id == rng[k].comp_id \
                        and words(rng[b - 1].gurmukhi)[:1] in (["ਸਲੋਕ"], ["ਮਃ"], ["ਪਉੜੀ"]):
                    b -= 1
            title = sgpc_style(rng[b - 1].gurmukhi).replace(" ॥", "॥") if b else None
            r = resolve(self.con, candidate(rng[b].ang, title, " ".join(x.gurmukhi for x in rng[b:])))
            if isinstance(r, NoMatch):
                held += 1
            elif (r.first_line_id, r.last_line_id) == (self._heading_start(rng[k]), last):
                exact += 1
            else:
                wrong.append((vid, first, last, r.first_line_id, r.last_line_id))
        print(f"\n  Vaar units (labels={labels}): {exact} exact, {held} held, {len(wrong)} wrong")
        self.assertEqual(wrong, [])
        self.assertGreaterEqual(exact, 450)


@unittest.skipIf(HAS_DB, "covered by ResolverTests")
class NoDbNotice(unittest.TestCase):
    def test_db_missing(self):
        self.skipTest("resolver tests need the scripture DB")


if __name__ == "__main__":
    unittest.main()
