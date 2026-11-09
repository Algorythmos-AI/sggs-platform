import unicodedata
import unittest

from hukamnama.locate import gurmukhi_int, is_gurmukhi_text, locate_text, words
from tests.helpers import DB, needs_db


class LocateTests(unittest.TestCase):
    def test_udaat_is_read_as_subjoined_ha(self):
        self.assertEqual(words("ਸਮ\u0a51ਾਰੈ"), ["ਸਮ੍ਹਾਰੈ"])

    def test_zero_width_and_nfc(self):
        nfd = unicodedata.normalize("NFD", "ਸ਼ਬਦ")
        self.assertEqual(locate_text("ਸ\u200dਬ\u200cਦ"), "ਸਬਦ")
        self.assertEqual(locate_text(nfd), unicodedata.normalize("NFC", nfd))

    def test_dandas_and_verse_numbers_are_not_words(self):
        self.assertEqual(words("ਗਾਈ ॥੧॥ ਰਹਾਉ ॥"), ["ਗਾਈ", "ਰਹਾਉ"])
        self.assertEqual(words("ਗਾਈ || 1 ||"), ["ਗਾਈ"])
        self.assertEqual(words("ਗਾਈ।।੨।।"), ["ਗਾਈ"])

    def test_heading_numbers_are_kept_when_asked(self):
        self.assertEqual(words("ਧਨਾਸਰੀ ਮਹਲਾ ੫॥", keep_numbers=True), ["ਧਨਾਸਰੀ", "ਮਹਲਾ", "੫"])
        self.assertNotEqual(words("ਮਹਲਾ ੫ ॥", keep_numbers=True), words("ਮਹਲਾ ੪ ॥", keep_numbers=True))

    def test_idempotent(self):
        s = "ਤੁਮ\u0a51 ਕਰਹੁ ਦਇਆ ॥੧॥"
        self.assertEqual(words(" ".join(words(s))), words(s))
        self.assertEqual(locate_text(locate_text(s)), locate_text(s))

    def test_numbers_and_script(self):
        self.assertEqual(gurmukhi_int("੬੭੩"), 673)
        self.assertTrue(is_gurmukhi_text("ਪਾਨੀ ਪਖਾ ॥੧॥"))
        self.assertFalse(is_gurmukhi_text("pwnI pKw pIsau"))      # a legacy ASCII Gurmukhi font

    @needs_db
    def test_corpus_has_none_of_the_mapped_or_stripped_characters(self):
        # if the corpus ever held one of these, the locate key could merge two different words
        import sqlite3
        con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
        text = "".join(g for (g,) in con.execute("SELECT gurmukhi FROM lines"))
        for ch in "\u0a51\u200b\u200c\u200d\u2060\ufeff":
            self.assertNotIn(ch, text, f"U+{ord(ch):04X} appeared in the corpus: review locate.py")
        self.assertEqual(unicodedata.normalize("NFC", text), text)


if __name__ == "__main__":
    unittest.main()
