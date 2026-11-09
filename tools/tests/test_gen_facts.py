import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import gen_facts  # noqa: E402

FACTS = {
    "routes": gen_facts.Fact("routes", "fixture", lambda root: 29),
    "lines": gen_facts.Fact("lines", "fixture", lambda root: 60658, needs_db=True),
    "app_version": gen_facts.Fact("version", "fixture", lambda root: "1.6.3"),
}


class Markers(unittest.TestCase):
    def test_a_current_value_passes_and_nothing_changes(self):
        text = "Serves <!--fact:routes-->29<!--/fact--> routes; build <!--fact:app_version-->1.6.3<!--/fact-->.\n"
        r = gen_facts.process(text, "p.md", {"routes": 29, "app_version": "1.6.3"}, FACTS)
        self.assertEqual((r.text, r.errors, r.mismatches, r.used), (text, [], [], 2))

    def test_write_replaces_only_the_value(self):
        text = "Before | <!--fact:routes-->27<!--/fact--> | after\n"
        r = gen_facts.process(text, "p.md", {"routes": 29}, FACTS)
        self.assertEqual(r.text, "Before | <!--fact:routes-->29<!--/fact--> | after\n")
        self.assertEqual(len(r.mismatches), 1)
        self.assertIn("'27'", r.mismatches[0])

    def test_formats(self):
        r = gen_facts.process("<!--fact:lines-->x<!--/fact--> <!--fact:lines:plain-->x<!--/fact--> <!--fact:routes:words-->x<!--/fact-->",
                              "p.md", {"lines": 60658, "routes": 5}, FACTS)
        self.assertEqual(r.text, "<!--fact:lines-->60,658<!--/fact--> <!--fact:lines:plain-->60658<!--/fact--> <!--fact:routes:words-->five<!--/fact-->")
        bad = gen_facts.process("<!--fact:app_version:words-->1<!--/fact-->", "p.md", {"app_version": "1.6.3"}, FACTS)
        self.assertEqual(len(bad.errors), 1)

    def test_unknown_name_is_an_error(self):
        r = gen_facts.process("<!--fact:nope-->3<!--/fact-->", "p.md", {}, FACTS)
        self.assertEqual(len(r.errors), 1)
        self.assertIn("unknown fact 'nope'", r.errors[0])

    def test_a_malformed_marker_is_an_error(self):
        r = gen_facts.process("<!--fact:routes-->29\n<!--/fact-->", "p.md", {"routes": 29}, FACTS)
        self.assertTrue(any("malformed" in e for e in r.errors))

    def test_markers_in_code_are_examples(self):
        text = "Write `<!--fact:routes-->1<!--/fact-->`.\n\n```md\n<!--fact:nope-->1<!--/fact-->\n```\n"
        r = gen_facts.process(text, "p.md", {"routes": 29}, FACTS)
        self.assertEqual((r.text, r.errors, r.used), (text, [], 0))

    def test_a_database_fact_is_skipped_without_the_database(self):
        with tempfile.TemporaryDirectory() as d:
            vals, missing = gen_facts.values(Path(d), {"lines": gen_facts.FACTS["lines"], "routes": FACTS["routes"]})
        self.assertEqual((vals, missing), ({"routes": 29}, {"lines"}))
        r = gen_facts.process("<!--fact:lines-->1<!--/fact-->", "p.md", vals, FACTS)
        self.assertEqual((r.errors, r.mismatches, r.skipped), ([], [], {"lines"}))


class Repository(unittest.TestCase):
    def test_every_registered_fact_reads_its_source(self):
        vals, missing = gen_facts.values()
        for name, fact in gen_facts.FACTS.items():
            self.assertTrue(name in vals or (fact.needs_db and name in missing), name)
        self.assertGreater(vals["routes"], 0)
        self.assertRegex(vals["app_version"], r"^\d+\.\d+\.\d+$")

    def test_check_mode_exits_zero_when_current(self):
        r = subprocess.run([sys.executable, str(ROOT / "tools" / "gen_facts.py"), "--check"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)


if __name__ == "__main__":
    unittest.main()
