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

    def test_the_blanket_line_excuses_only_cited_pages(self):
        self.write("app/core.py", SRC.replace("return 1", "return 10"))
        self.write("app/other.py", "Y = 3\n")
        self.commit("alpha and other")
        pages, r = self.run_range("Summary.\n\nDocs-impact: none — a refactor with no behaviour change\n")
        self.assertEqual(pages["docs/cited.md"], "docs-impact")
        self.assertIsNone(pages["docs/explicit.md"])                  # covers: needs its own line
        self.assertIn("docs/explicit.md", r["flagged_explicit"])
        self.assertIn("docs/explicit.md", r["blanket_refused"])
        for body in ("Docs-impact: none — short", "<!-- Docs-impact: none — inside a comment, ignored -->",
                     "Write `Docs-impact: none — <reason>` when nothing changes",
                     "Docs-impact: none — <reason>"):                    # the template's placeholder
            pages, _ = self.run_range(body)
            self.assertIsNone(pages["docs/cited.md"], body)

    def test_a_per_page_line_excuses_that_page_only(self):
        self.write("app/core.py", SRC.replace("return 1", "return 10"))
        self.commit("alpha")
        body = "Docs-impact: docs/explicit.md — the return value is internal; the page names none\n"
        pages, r = self.run_range(body)
        self.assertEqual(pages["docs/explicit.md"], "docs-impact-page")
        self.assertIsNone(pages["docs/globbed.md"])                   # not named, still flagged
        self.assertEqual(r["flagged_explicit"], ["docs/globbed.md"])
        pages, r = self.run_range(body + "Docs-impact: `docs/globbed.md` – no file-level claim changed here\n")
        self.assertEqual(r["flagged_explicit"], [])
        for bad in ("Docs-impact: docs/explicit.md — short",
                    "Docs-impact: docs/explicit.md — <why this change alters nothing the page says>",
                    "<!-- Docs-impact: docs/explicit.md — inside a comment is ignored -->",
                    "Docs-impact: docs/explicit.md— no space before the dash is not a separator"):
            pages, _ = self.run_range(bad)
            self.assertIsNone(pages["docs/explicit.md"], bad)

    def test_a_hyphenated_path_is_one_page(self):
        self.assertEqual(cpl.docs_impact_pages(
            "Docs-impact: docs/process/ci-gates.md — the job name and its trigger are unchanged\n"
            "Docs-impact: docs/process/runbooks/docs-site.md - nothing the runbook says moved\n"),
            {"docs/process/ci-gates.md": "the job name and its trigger are unchanged",
             "docs/process/runbooks/docs-site.md": "nothing the runbook says moved"})

    def test_a_line_for_an_unflagged_page_excuses_nothing(self):
        self.write("app/core.py", SRC.replace("return 1", "return 10"))
        self.commit("alpha")
        _, r = self.run_range("Docs-impact: docs/cited.md — this page is not flagged by the change\n"
                              "Docs-impact: docs/missing.md — no such page exists in the repository\n")
        self.assertEqual(r["unused_impacts"], ["docs/cited.md", "docs/missing.md"])
        self.assertIn("docs/explicit.md", r["flagged_explicit"])
        self.assertIn("`docs/missing.md`", cpl.markdown(r))

    def test_the_comment_prints_the_lines_to_add(self):
        self.write("app/core.py", SRC.replace("return 1", "return 10"))
        self.commit("alpha")
        _, r = self.run_range()
        md = cpl.markdown(r, enforced=True)
        self.assertIn("Docs-impact: docs/explicit.md — <why this change alters nothing the page says>", md)
        self.assertIn("Docs-impact: docs/globbed.md — <", md)
        self.assertIn("**enforced**", md)
        # a pasted line with its placeholder left in excuses nothing
        pages, _ = self.run_range("\n".join(cpl.impact_lines(r)))
        self.assertIsNone(pages["docs/explicit.md"])

    def test_a_skip_reason_never_fails(self):
        self.write("app/core.py", SRC.replace("return 1", "return 10"))
        self.commit("alpha")
        env = os.environ.get("COUPLING_ENFORCE")
        try:
            os.environ["COUPLING_ENFORCE"] = "1"
            out = io.StringIO()
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(cpl.main([f"{self.base}..HEAD", "--skip-reason", "a release pull request"]), 0)
            self.assertIn("Not enforced on this pull request: a release pull request", out.getvalue())
            self.assertIn("report only", out.getvalue())
        finally:
            if env is None:
                os.environ.pop("COUPLING_ENFORCE", None)
            else:
                os.environ["COUPLING_ENFORCE"] = env

    def stale(self, page):
        dc._TRACKED = None
        path = self.root / page
        return dc.code_changed_since(self.base, path, path.read_text(encoding="utf-8"))

    def test_freshness_honours_a_symbol_like_the_coupling_check(self):
        # a change outside alpha (a version bump elsewhere in the file) does not age the symbol page
        self.write("app/core.py", SRC.replace("X = 1", "X = 2"))
        self.commit("bump")
        self.assertEqual(self.stale("docs/explicit.md"), [])                   # symbol miss
        self.assertEqual(self.stale("docs/globbed.md"), ["app/core.py"])        # whole file: today's behaviour
        self.write("app/core.py", SRC.replace("X = 1", "X = 2").replace("return 1", "return 10"))
        self.commit("alpha")
        self.assertEqual(self.stale("docs/explicit.md"), ["app/core.py#alpha"])  # symbol hit
        self.assertEqual(self.stale("docs/cited.md"), [])                        # cited file untouched
        self.write("app/other.py", "Y = 9\n")
        self.commit("other")
        self.assertEqual(self.stale("docs/cited.md"), ["app/other.py"])

    def test_the_freshness_row_and_the_stamp_notice_use_the_symbol_rule(self):
        self.write("app/core.py", SRC.replace("X = 1", "X = 2"))
        self.commit("bump")
        text = (self.root / "docs/explicit.md").read_text().replace("abcdef0", self.base[:8])
        self.write("docs/explicit.md", text)
        self.commit("stamp at base")
        dc._TRACKED = None
        rows = {r["page"]: r for r in dc.freshness()}
        self.assertEqual(rows["docs/explicit.md"]["changed"], [])
        self.assertEqual(dc.check_verified_commit(self.root / "docs/explicit.md", self.base, text), [])

    def merge_pr(self, number, branch, path, text):
        """A pull request merged with GitHub's merge-commit message, on main's first-parent line."""
        self.git("switch", "-q", "-c", branch)
        self.write(path, text)
        self.commit(f"change {path}")
        self.git("switch", "-q", "main")
        self.git("merge", "-q", "--no-ff", branch, "-m", f"Merge pull request #{number} from org/{branch}")

    def test_coupling_debt_reads_each_pull_requests_description(self):
        self.merge_pr(7, "feat/a", "app/core.py", SRC.replace("return 1", "return 10"))   # explicit + globbed
        self.merge_pr(8, "feat/b", "app/other.py", "Y = 3\n")                             # cited + globbed
        self.git("switch", "-q", "-c", "side")
        self.write("app/other.py", "Y = 4\n")
        self.commit("side")
        self.git("switch", "-q", "main")
        self.git("merge", "-q", "--no-ff", "side", "-m", "Merge branch 'side'")          # no pull request
        dc._TRACKED = None
        bodies = {7: "Docs-impact: docs/explicit.md — internal value only\n"
                     "Docs-impact: docs/globbed.md — no claim about core changed\n",
                  8: "Docs-impact: none — a constant nobody documents\n"}
        asked = []

        def fetch(numbers):
            asked.append(numbers)
            return bodies
        d = dc.coupling_debt(fetch=fetch, ref="main", branch="integration")
        self.assertEqual(asked, [[7, 8]])                       # one batched lookup
        self.assertEqual((d["merges"], d["attributed"], d["bodies_read"]), (3, 2, 2))
        # #7 fully excused; #8's blanket line excuses cited.md but not globbed.md (covers:); the
        # side merge has no description at all
        self.assertEqual((d["merges_with_debt"], d["page_flags"]), (2, 3))
        self.assertFalse(d["upper_bound"])
        self.assertEqual(d["branch"], "integration")
        d = dc.coupling_debt(fetch=lambda n: None, ref="main", branch="integration")
        self.assertTrue(d["upper_bound"])                       # no token: every flag counts
        self.assertEqual((d["merges_with_debt"], d["page_flags"]), (3, 6))

    def test_the_health_ref_prefers_integration(self):
        self.assertEqual(dc.health_ref(), ("HEAD", "main"))     # no integration here: the branch itself
        self.git("branch", "integration")
        self.assertEqual(dc.health_ref(), ("integration", "integration"))

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
