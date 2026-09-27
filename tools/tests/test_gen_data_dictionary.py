"""tools/gen_data_dictionary.py: the page lists exactly the database's tables, never a tokenizer's characters."""
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import gen_data_dictionary as g  # noqa: E402

LOCK = {"repository": "o/data", "commit": "c" * 40, "dataset_version": "9.9.9",
        "database": {"path": "db/x.sqlite", "sha256": "a" * 64, "size": 1048576}}
# A tokenizer character list built at run time (two Gurmukhi vowel signs), so no literal is typed here.
SIGNS = chr(0x0A3E) + chr(0x0A3F)


def fixture(extra_table: bool = False) -> Path:
    d = Path(tempfile.mkdtemp())
    db = d / "t.sqlite"
    con = sqlite3.connect(db)
    con.execute("CREATE TABLE lines (id INTEGER PRIMARY KEY, text TEXT)")
    con.execute("INSERT INTO lines (text) VALUES ('a'), ('b')")
    con.execute("CREATE TABLE meta (key TEXT, value TEXT)")
    con.executemany("INSERT INTO meta VALUES (?, ?)", [("version", "1.2.3"), ("built", "2026-01-01"),
                                                       ("total_lines", "2"), ("total_angs", "1")])
    con.execute(f"CREATE VIRTUAL TABLE fts USING fts5(text, tokenize=\"unicode61 tokenchars '{SIGNS}'\")")
    if extra_table:
        con.execute("CREATE TABLE surprise (x)")
    con.commit()
    con.close()
    return db


DESCRIBED = {"lines": ("scripture", "The lines."), "meta": ("scripture", "Facts."), "fts": ("search", "Index.")}
CONTEXTS = {"reader": frozenset({"lines", "meta"}), "search": frozenset({"lines", "fts"})}


class GenDataDictionary(unittest.TestCase):
    def test_lists_tables_rows_and_readers_and_hides_fts_shadows(self):
        page = g.render(g.read(fixture(), CONTEXTS), LOCK, DESCRIBED)
        self.assertIn("| [`lines`](#lines) | 2 | reader, search | The lines. |", page)
        self.assertIn("3 tables, of which 1 are full-text indexes", page)
        self.assertNotIn("fts_data", page)
        self.assertIn("`9.9.9`", page)
        self.assertIn("`1.2.3`, built 2026-01-01", page)

    def test_tokenizer_characters_are_summarised_never_printed(self):
        page = g.render(g.read(fixture(), CONTEXTS), LOCK, DESCRIBED)
        self.assertIn("with 2 Gurmukhi signs counted as part of a token", page)
        self.assertFalse(any("਀" <= ch <= "੿" for ch in page))

    def test_an_undescribed_table_fails(self):
        with self.assertRaises(SystemExit) as e:
            g.render(g.read(fixture(extra_table=True), CONTEXTS), LOCK, DESCRIBED)
        self.assertIn("surprise", str(e.exception))

    def test_a_described_table_the_database_lacks_fails(self):
        with self.assertRaises(SystemExit) as e:
            g.render(g.read(fixture(), CONTEXTS), LOCK, {**DESCRIBED, "ghost": ("build", "Nothing.")})
        self.assertIn("ghost", str(e.exception))

    def test_every_described_layer_exists(self):
        layers = {k for k, _, _ in g.LAYERS}
        self.assertEqual(set(), {layer for layer, _ in g.TABLES.values()} - layers)


if __name__ == "__main__":
    unittest.main()
