import unittest
from datetime import date

from hukamnama.sources import ParseError, parse_hs, parse_mukhwak
from tests.helpers import fixture

HS = fixture("hs-2026-11-09.html")
HOME = fixture("sgpc-home-2026-11-09.html")
HOME_FRIDAY = fixture("sgpc-home-2026-11-20.html")   # a Friday: weekday written with U+0A36


class HsParserTests(unittest.TestCase):
    def test_reads_the_live_page_shape(self):
        c = parse_hs(HS)
        self.assertEqual((c.source, c.amritsar_date, c.ang), ("hs", date(2026, 11, 9), 673))
        self.assertEqual(c.title, "ਧਨਾਸਰੀ ਮਹਲਾ ੫॥")
        self.assertEqual(c.body_words[:3], ("ਪਾਨੀ", "ਪਖਾ", "ਪੀਸਉ"))
        self.assertIn("ਸਮ੍ਹਾਰੈ", c.body_words)              # SGPC's ੑ read as ੍ਹ
        self.assertNotIn("੧", c.body_words)
        self.assertEqual(c.key(), parse_hs(HS).key())      # deterministic

    def assertRejects(self, html, msg):
        with self.assertRaises(ParseError, msg=msg):
            parse_hs(html)

    def test_mutations_never_yield_a_candidate(self):
        verses = HS.split('<p class="hukamnama-text">', 1)[1].split("</p>", 1)[0]
        self.assertRejects(HS.replace(verses, verses[:12]), "a stub of the page")
        self.assertRejects(HS.replace("09-11-2026", "date pending"), "no date stamp")
        self.assertRejects(HS.replace("(ਅੰਗ: ੬੭੩)", ""), "no Ang")
        self.assertRejects(HS.replace("(ਅੰਗ: ੬੭੩)", "(ਅੰਗ: ੬੭੩) (ਅੰਗ: ੬੭੪)"), "two Angs")
        self.assertRejects(HS.replace('class="hukamnama-card mt-4"', 'class="other"'), "card missing")
        card = HS.split('<div class="hukamnama-card mt-4">', 1)[1]
        self.assertRejects(HS + '<div class="hukamnama-card mt-4">' + card, "two Hukamnama cards")
        self.assertRejects(HS.replace(verses, "pwnI pKw pIsau sMq AwgY gux goivMd jsu gweI ] swis swis mnu nwmu"),
                           "legacy ASCII font")
        self.assertRejects(HS.replace("09-11-2026", "31-02-2026"), "impossible date")
        self.assertRejects(HS.replace("09-11-2026", "09-11-2026 05:30 AM 10-11-2026"), "two dates")
        self.assertRejects("", "empty body")
        self.assertRejects("<html><body>Service Unavailable</body></html>", "an error page")

    def test_yesterdays_page_parses_with_its_own_date(self):
        self.assertEqual(parse_hs(HS.replace("09-11-2026", "08-11-2026")).amritsar_date, date(2026, 11, 8))


class MukhwakParserTests(unittest.TestCase):
    def test_reads_the_marquee(self):
        c = parse_mukhwak(HOME)
        self.assertEqual((c.source, c.amritsar_date, c.ang), ("mukhwak", date(2026, 11, 9), 673))
        self.assertEqual(c.body_words[0], "ਪਾਨੀ")
        self.assertEqual(c.body_words[-1], "ਪਾਈ")

    def test_cuts_every_weekday_in_every_spelling(self):
        # The weekday is cut by position (after the last danda, before the first comma), so every
        # spelling goes: with or without addak, ਸ਼ precomposed (U+0A36) or ਸ + nukta, long forms.
        sha = ("\u0a36", "\u0a38\u0a3c")
        days = ["ਐਤਵਾਰ", "ਸੋਮਵਾਰ", "ਮੰਗਲਵਾਰ", "ਬੁੱਧਵਾਰ", "ਬੁਧਵਾਰ", "ਵੀਰਵਾਰ", "ਬ੍ਰਹਸਪਤਿਵਾਰ", "ਬ੍ਰਹਸਪਤੀਵਾਰ",
                "ਸਨਿੱਚਰਵਾਰ", "ਸਨਿਚਰਵਾਰ", "ਛਨਿੱਚਰਵਾਰ"]
        for s in sha:
            days += [s + "ੁੱਕਰਵਾਰ", s + "ੁਕਰਵਾਰ", s + "ਨਿੱਚਰਵਾਰ", s + "ਨਿਚਰਵਾਰ", s + "ਨੀਚਰਵਾਰ", s + "ਨੀਵਾਰ"]
        for day in days:
            for joiner in (" ", "", "\u200d "):          # a space, none, or a zero-width joiner
                text = HOME.replace("॥੧॥\nਸੋਮਵਾਰ,", f"॥੧॥{joiner}{day},")
                self.assertNotEqual(text, HOME)
                c = parse_mukhwak(text)
                self.assertEqual(c.body_words[-1], "ਪਾਈ", msg=f"weekday {day!r} left in the opening")
                self.assertEqual(len(c.body_words), len(parse_mukhwak(HOME).body_words))

    def test_reads_the_21_november_saturday_marquee(self):
        # #445: sgpc.net wrote Saturday ਸ਼ਨਿਚਰਵਾਰ, without the addak, and the veto held Ang 706.
        # The marquee text is rebuilt from the alert and corpus lines 30485-30487 (SGPC's page
        # itself is only in the service's archive): the weekday must go, all 15 verse words stay.
        opening = ("ਸਲੋਕ ॥ ਮਨ ਇਛਾ ਦਾਨ ਕਰਣੰ ਸਰਬਤ੍ਰ ਆਸਾ ਪੂਰਨਹ ॥ "
                   "ਖੰਡਣੰ ਕਲਿ ਕਲੇਸਹ ਪ੍ਰਭ ਸਿਮਰਿ ਨਾਨਕ ਨਹ ਦੂਰਣਹ ॥੧॥ ")
        friday = parse_mukhwak(HOME_FRIDAY)
        html = HOME_FRIDAY
        s = html.index("ਜੈਤਸਰੀ ਮਹਲਾ ੪ ਘਰੁ ੧")
        e = html.index("(ਅੰਗ: ੬੯੬)")
        self.assertGreater(e, s)
        html = (html[:s] + opening + "\u0a36ਨਿਚਰਵਾਰ, ੬ ਮੱਘਰ (ਸੰਮਤ ੫੫੮ ਨਾਨਕਸ਼ਾਹੀ) ੨੧ ਨਵੰਬਰ, ੨੦੨੬ (ਅੰਗ: ੭੦੬)"
                + html[e + len("(ਅੰਗ: ੬੯੬)"):])
        c = parse_mukhwak(html)
        self.assertEqual((c.amritsar_date, c.ang), (date(2026, 11, 21), 706))
        self.assertEqual(c.body_words, tuple("ਮਨ ਇਛਾ ਦਾਨ ਕਰਣੰ ਸਰਬਤ੍ਰ ਆਸਾ ਪੂਰਨਹ ਖੰਡਣੰ ਕਲਿ ਕਲੇਸਹ ਪ੍ਰਭ ਸਿਮਰਿ "
                                                "ਨਾਨਕ ਨਹ ਦੂਰਣਹ".split()))
        self.assertNotEqual(c.body_words, friday.body_words)

    def test_never_cuts_a_gurbani_word(self):
        # Only one ਵਾਰ-word straight after a danda is the weekday. A verse word left before the date
        # line (no danda after it, or two words) stays in the opening, so the veto compares it and
        # holds the day rather than silently shortening what is compared.
        for tail, kept in (("ਪਾਈ ਸੋਮਵਾਰ", "ਸੋਮਵਾਰ"),           # no danda after the verse word
                           ("॥੧॥ ਗੁਰ ਸੋਮਵਾਰ", "ਸੋਮਵਾਰ"),       # two words after the danda
                           ("॥੧॥ ਗਾਈ", "ਗਾਈ")):               # one word, not a weekday
            text = HOME.replace("ਪਾਈ ॥੧॥\nਸੋਮਵਾਰ,", f"{tail},")
            self.assertNotEqual(text, HOME)
            c = parse_mukhwak(text)
            self.assertEqual(c.body_words[-1], kept, msg=tail)

    def test_reads_a_friday_marquee(self):
        c = parse_mukhwak(HOME_FRIDAY)
        self.assertEqual((c.amritsar_date, c.ang), (date(2026, 11, 20), 696))
        self.assertEqual(c.body_words[-1], "ਲਾਥਾ")
        self.assertFalse(any("ਵਾਰ" == w[-3:] and w.startswith(("ਸ਼", "ਸ਼")) for w in c.body_words))

    def test_marquee_mutations(self):
        for bad, why in ((HOME.replace("(ਅੰਗ: ੬੭੩)", ""), "no Ang"),
                         (HOME.replace("੯ ਨਵੰਬਰ, ੨੦੨੬", ""), "no date"),
                         (HOME.replace("ਮੁੱਖਵਾਕ", "ਖ਼ਬਰ"), "not the Mukhwak")):
            with self.assertRaises(ParseError, msg=why):
                parse_mukhwak(bad)


if __name__ == "__main__":
    unittest.main()
