import unittest
from datetime import date

from hukamnama.sources import ParseError, parse_hs, parse_mukhwak
from tests.helpers import fixture

HS = fixture("hs-2026-11-09.html")
HOME = fixture("sgpc-home-2026-11-09.html")


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

    def test_marquee_mutations(self):
        for bad, why in ((HOME.replace("(ਅੰਗ: ੬੭੩)", ""), "no Ang"),
                         (HOME.replace("੯ ਨਵੰਬਰ, ੨੦੨੬", ""), "no date"),
                         (HOME.replace("ਮੁੱਖਵਾਕ", "ਖ਼ਬਰ"), "not the Mukhwak")):
            with self.assertRaises(ParseError, msg=why):
                parse_mukhwak(bad)


if __name__ == "__main__":
    unittest.main()
