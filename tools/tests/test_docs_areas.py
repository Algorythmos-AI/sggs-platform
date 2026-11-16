"""tools/docs_check.py code areas (tools/docs_areas.json) — a temporary git repository, then the real one."""
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
if "docs_check" not in sys.modules:
    spec = importlib.util.spec_from_file_location("docs_check", ROOT / "tools" / "docs_check.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["docs_check"] = mod
    spec.loader.exec_module(mod)
dc = sys.modules["docs_check"]

PAGE = ('---\ntitle: "{title}"\ndescription: "A description that is comfortably longer than forty characters."\n'
        '{extra}---\n# {title}\n\n{body}\n')
CFG = {"areas": ["services/*", "webapp/*", ".github/workflows/*.yml"],
       "exempt": {"webapp/static": "built output of the frontend, generated"},
       "backlog": {"services/old": "known gap when the gate was added"}}


class Areas(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        self.saved = (dc.ROOT, dc.DOCS, dc.SOURCES_DIR, dc._TRACKED)
        dc.ROOT, dc.DOCS, dc.SOURCES_DIR, dc._TRACKED = self.root, self.root / "docs", self.root / "docs-site" / ".sources", None
        subprocess.run(["git", "init", "-q", "-b", "main"], cwd=self.root, check=True)
        for rel, text in {
            "services/alpha/app.py": "X = 1\n", "services/alpha/README.md": "a\n", "services/old/run.py": "Y = 1\n",
            "webapp/serve.py": "Z = 1\n", "webapp/static/index.html": "<p></p>\n",
            ".github/workflows/ci.yml": "on: push\n", ".github/workflows/notes.txt": "not a workflow\n",
            "docs/covers.md": PAGE.format(title="Covers page", extra='covers: "services/alpha/*.py"\n', body="Body."),
            "docs/cites.md": PAGE.format(title="Cites page", extra="", body="See [it](../webapp/serve.py)."),
        }.items():
            self.write(rel, text)
        self.track()

    def tearDown(self):
        dc.ROOT, dc.DOCS, dc.SOURCES_DIR, dc._TRACKED = self.saved
        self.tmp.cleanup()

    def write(self, rel, text):
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")

    def track(self):
        subprocess.run(["git", "add", "-A"], cwd=self.root, check=True)
        dc._TRACKED = None

    def problems(self, cfg=CFG):
        return [(p.level, p.msg) for p in dc.check_areas(cfg)]

    def test_areas_are_the_children_of_each_pattern(self):
        areas = dc.code_areas(CFG["areas"])
        self.assertEqual(sorted(areas), [".github/workflows/ci.yml", "services/alpha", "services/old",
                                         "webapp/serve.py", "webapp/static"])
        self.assertEqual(sorted(areas["services/alpha"]), ["services/alpha/README.md", "services/alpha/app.py"])

    def test_covers_and_cited_files_both_count(self):
        r = dc.area_coverage(CFG)
        self.assertEqual(r["covered"]["services/alpha"], ["docs/covers.md"])
        self.assertEqual(r["covered"]["webapp/serve.py"], ["docs/cites.md"])
        self.assertEqual(r["exempt"], ["webapp/static"])
        self.assertEqual(r["backlog"], ["services/old"])

    def test_today_only_the_new_workflow_fails(self):
        errors = [m for lvl, m in self.problems() if lvl == "error"]
        self.assertEqual(len(errors), 1)
        self.assertIn(".github/workflows/ci.yml", errors[0])

    def test_a_new_service_with_no_page_is_an_error(self):
        self.write("services/beta/main.py", "B = 1\n")
        self.track()
        errors = [m for lvl, m in self.problems() if lvl == "error"]
        self.assertTrue(any("`services/beta`" in m for m in errors))

    def test_a_covered_backlog_entry_asks_to_be_removed(self):
        self.write("docs/old.md", PAGE.format(title="Old service", extra='covers: "services/old/run.py"\n', body="Body."))
        self.track()
        notes = [m for lvl, m in self.problems() if lvl == "notice"]
        self.assertTrue(any("backlog area `services/old` is covered now" in m for m in notes))

    def test_a_gone_entry_warns_and_a_short_reason_fails(self):
        cfg = {**CFG, "exempt": {**CFG["exempt"], "webapp/gone.py": "removed long ago, really"},
               "backlog": {"services/old": "short"}}
        got = self.problems(cfg)
        self.assertIn("warning", [lvl for lvl, m in got if "webapp/gone.py" in m])
        self.assertTrue(any(lvl == "error" and "services/old" in m and "reason" in m for lvl, m in got))

    def test_the_report_lists_new_and_backlog(self):
        md = dc.areas_markdown(dc.area_coverage(CFG))
        self.assertIn("`.github/workflows/ci.yml`", md)
        self.assertIn("`services/old`", md)


class Repository(unittest.TestCase):
    def test_the_real_config_is_well_formed_and_nothing_is_new(self):
        cfg = json.loads((ROOT / dc.AREAS_FILE).read_text(encoding="utf-8"))
        self.assertTrue(cfg["areas"])
        r = dc.area_coverage(cfg)
        self.assertEqual(r["missing"], [], "a code area is on no wiki page: python3 tools/docs_check.py --areas")
        self.assertEqual(r["short_reasons"], [])
        self.assertEqual(set(cfg["exempt"]) & set(cfg["backlog"]), set(), "an area is both exempt and in the backlog")


if __name__ == "__main__":
    unittest.main()
