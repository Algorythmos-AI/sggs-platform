"""tools/docs_coupling.py — exercised on a small temporary git repository (stdlib unittest)."""
import contextlib
import importlib.util
import io
import os
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
import docs_coupling as cpl  # noqa: E402

PAGE = ('---\ntitle: "{title}"\ndescription: "A description that is comfortably longer than forty characters."\n'
        '{extra}---\n# {title}\n\n{body}\n')
SRC = "X = 1\n\n\ndef alpha():\n    return 1\n\n\ndef beta():\n    return 2\n"


class Repo(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()      # macOS: /var is a symlink to /private/var
        self.saved = (dc.ROOT, dc.DOCS, dc.SOURCES_DIR, dc._TRACKED)
        dc.ROOT, dc.DOCS, dc.SOURCES_DIR, dc._TRACKED = self.root, self.root / "docs", self.root / "docs-site" / ".sources", None
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.email", "t@example.invalid")
        self.git("config", "user.name", "t")
        self.write("app/core.py", SRC)
        self.write("app/other.py", "Y = 2\n")
        self.write("app/tests/test_core.py", "pass\n")
        self.write("docs/explicit.md", PAGE.format(title="Explicit page", extra='covers: "app/core.py#alpha"\n'
                                                   'verified:\n  commit: abcdef0\n  date: "2026-11-01"\n', body="Body."))
        self.write("docs/globbed.md", PAGE.format(title="Globbed page", extra='covers: "app/*.py"\n', body="Body."))
        self.write("docs/cited.md", PAGE.format(title="Cited page", extra="", body="See [the code](../app/other.py)."))
        self.commit("base")
        self.base = self.rev()
        dc._TRACKED = None

    def tearDown(self):
        dc.ROOT, dc.DOCS, dc.SOURCES_DIR, dc._TRACKED = self.saved
        self.tmp.cleanup()

    def git(self, *args):
        return subprocess.run(["git", *args], cwd=self.root, capture_output=True, text=True, check=True).stdout

    def write(self, rel, text):
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")

    def commit(self, msg):
        self.git("add", "-A")
        self.git("commit", "-q", "-m", msg)

    def rev(self):
        return self.git("rev-parse", "HEAD").strip()

    def run_range(self, body=""):
        dc._TRACKED = None
        r = cpl.couple(self.base, "HEAD", body)
        return {p["page"]: p["satisfied_by"] for p in r["pages"]}, r

    def test_a_symbol_hit_flags_the_page(self):
        self.write("app/core.py", SRC.replace("return 1", "return 10"))
        self.commit("alpha")
        pages, r = self.run_range()
        self.assertIsNone(pages["docs/explicit.md"])
        self.assertIsNone(pages["docs/globbed.md"])
        self.assertNotIn("docs/cited.md", pages)
        self.assertIn("docs/explicit.md", r["flagged_explicit"])

    def test_a_symbol_miss_does_not(self):
        self.write("app/core.py", SRC.replace("return 2", "return 20"))
        self.commit("beta")
        pages, _ = self.run_range()
        self.assertNotIn("docs/explicit.md", pages)
        self.assertIn("docs/globbed.md", pages)            # the glob covers the whole file

    def test_a_deleted_symbol_counts_as_changed(self):
        self.write("app/core.py", "X = 1\n\n\ndef beta():\n    return 2\n")
        self.commit("drop alpha")
        pages, _ = self.run_range()
        self.assertIn("docs/explicit.md", pages)

    def test_the_page_changing_satisfies_it(self):
        self.write("app/core.py", SRC.replace("return 1", "return 10"))
        self.write("docs/explicit.md", (self.root / "docs/explicit.md").read_text() + "More.\n")
        self.commit("both")
        pages, _ = self.run_range()
        self.assertEqual(pages["docs/explicit.md"], "page-changed")

    def test_a_moved_stamp_satisfies_it(self):
        self.write("app/core.py", SRC.replace("return 1", "return 10"))
        text = (self.root / "docs/explicit.md").read_text().replace("abcdef0", "1234567")
        self.write("docs/explicit.md", text)
        self.commit("code and a re-read stamp")
        pages, _ = self.run_range()
        self.assertEqual(pages["docs/explicit.md"], "stamp-moved")

    def test_cited_files_are_the_default(self):
        self.write("app/other.py", "Y = 3\n")
        self.commit("other")
        pages, r = self.run_range()
        self.assertIsNone(pages["docs/cited.md"])
        self.assertNotIn("docs/cited.md", r["flagged_explicit"])     # default coverage never enforces

    def test_the_docs_impact_line(self):
        self.write("app/core.py", SRC.replace("return 1", "return 10"))
        self.commit("alpha")
        pages, _ = self.run_range("Summary.\n\nDocs-impact: none — a refactor with no behaviour change\n")
        self.assertEqual(pages["docs/explicit.md"], "docs-impact")
        for body in ("Docs-impact: none — short", "<!-- Docs-impact: none — inside a comment, ignored -->",
                     "Write `Docs-impact: none — <reason>` when nothing changes",
                     "Docs-impact: none — <reason>"):                    # the template's placeholder
            pages, _ = self.run_range(body)
            self.assertIsNone(pages["docs/explicit.md"], body)

    def test_noise_is_ignored(self):
        self.write("app/tests/test_core.py", "pass  # changed\n")
        self.commit("test only")
        pages, r = self.run_range()
        self.assertEqual(pages, {})
        self.assertEqual(r["code_files"], [])
        for f in ("package-lock.json", "webapp/static/x.js", "docs-site/dist/a.html", "CHANGELOG.md",
                  "frontend/src/a.test.ts", "tools/gen_route_table.py", "uv.lock"):
            self.assertTrue(cpl.is_noise(f), f)
        self.assertFalse(cpl.is_noise("webapp/serve.py"))

    def test_enforcement_follows_the_environment(self):
        self.write("app/core.py", SRC.replace("return 1", "return 10"))
        self.commit("alpha")
        env = os.environ.get("COUPLING_ENFORCE")
        try:
            os.environ.pop("COUPLING_ENFORCE", None)
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(cpl.main([f"{self.base}..HEAD", "--json"]), 0)
                os.environ["COUPLING_ENFORCE"] = "1"
                self.assertEqual(cpl.main([f"{self.base}..HEAD", "--json"]), 1)
        finally:
            if env is None:
                os.environ.pop("COUPLING_ENFORCE", None)
            else:
                os.environ["COUPLING_ENFORCE"] = env

    def test_the_markdown_carries_the_marker(self):
        self.write("app/core.py", SRC.replace("return 1", "return 10"))
        self.commit("alpha")
        _, r = self.run_range()
        md = cpl.markdown(r)
        self.assertTrue(md.startswith(cpl.MARKER))
        self.assertIn("`docs/explicit.md`", md)


if __name__ == "__main__":
    unittest.main()
