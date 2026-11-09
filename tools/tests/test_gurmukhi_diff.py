"""tools/gurmukhi_diff.py — an automated diff that adds or removes a Gurmukhi code point fails.

Every guarded character in these fixtures is built from its code point with chr(), so this file
itself carries none (the guard would otherwise flag its own tests).
"""
import io
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import gurmukhi_diff as gd  # noqa: E402

SA, TA, SIHARI = chr(0x0A38), chr(0x0A24), chr(0x0A3F)     # three letters of the Gurmukhi block
DANDA, DOUBLE_DANDA = chr(0x0964), chr(0x0965)
ZWNJ, ZWJ = chr(0x200C), chr(0x200D)
DEVANAGARI_A = chr(0x0905)                                 # outside every guarded range
WORD = SA + TA + SIHARI


def diff(path: str, *body: str, old_start: int = 1, new_start: int = 1) -> str:
    minus = sum(1 for b in body if b.startswith("-"))
    plus = sum(1 for b in body if b.startswith("+"))
    return "\n".join([f"diff --git a/{path} b/{path}", "index 1111111..2222222 100644", f"--- a/{path}",
                      f"+++ b/{path}", f"@@ -{old_start},{minus} +{new_start},{plus} @@", *body]) + "\n"


class Guarded(unittest.TestCase):
    def test_ranges(self):
        for cp in (0x0A00, 0x0A38, 0x0A7F, 0x0964, 0x0965, 0x200C, 0x200D):
            self.assertTrue(gd.guarded(chr(cp)), hex(cp))
        for cp in (0x09FF, 0x0A80, 0x0963, 0x0966, 0x200B, 0x200E, 0x0905, ord("a"), ord("|")):
            self.assertFalse(gd.guarded(chr(cp)), hex(cp))

    def test_code_points_once_in_order(self):
        self.assertEqual(gd.code_points(WORD + " " + SA + DANDA + ZWJ), ["U+0A38", "U+0A24", "U+0A3F", "U+0964", "U+200D"])
        self.assertEqual(gd.code_points("ascii only, and " + DEVANAGARI_A), [])

    def test_report_never_prints_the_characters(self):
        f = gd.Finding("docs/" + SA + ".md", 3, "+", ("U+0A38",))
        self.assertNotIn(SA, str(f))
        self.assertIn("<U+0A38>", str(f))
        self.assertNotIn(SA, gd.markdown([f], "a...b", True))


class Scan(unittest.TestCase):
    def test_clean_diff(self):
        self.assertEqual(gd.scan(diff("docs/a.md", "-old line", "+new line")), [])

    def test_added_line_with_line_number(self):
        found = gd.scan(diff("docs/a.md", "+plain", "+quote " + WORD + DOUBLE_DANDA, new_start=10))
        self.assertEqual(len(found), 1)
        self.assertEqual((found[0].path, found[0].line, found[0].sign), ("docs/a.md", 11, "+"))
        self.assertEqual(found[0].points, ("U+0A38", "U+0A24", "U+0A3F", "U+0965"))

    def test_removed_line_uses_old_number(self):
        found = gd.scan(diff("docs/a.md", "-gone " + WORD, "+kept", old_start=7, new_start=7))
        self.assertEqual([(f.line, f.sign) for f in found], [(7, "-")])

    def test_joiners_and_dandas_alone(self):
        found = gd.scan(diff("x.txt", "+a" + ZWNJ + "b", "+end" + DANDA))
        self.assertEqual([f.points for f in found], [("U+200C",), ("U+0964",)])

    def test_context_lines_are_ignored(self):
        body = diff("x.txt", " context " + WORD, "+new", new_start=4).replace("@@ -1,0 +4,1 @@", "@@ -4,1 +4,2 @@")
        found = gd.scan(body)
        self.assertEqual(found, [])

    def test_new_and_deleted_files(self):
        new = ("diff --git a/n.md b/n.md\nnew file mode 100644\nindex 0000000..1111111\n--- /dev/null\n+++ b/n.md\n"
               "@@ -0,0 +1 @@\n+" + WORD + "\n")
        gone = ("diff --git a/g.md b/g.md\ndeleted file mode 100644\nindex 1111111..0000000\n--- a/g.md\n+++ /dev/null\n"
                "@@ -1 +0,0 @@\n-" + WORD + "\n")
        self.assertEqual([(f.path, f.line, f.sign) for f in gd.scan(new + gone)], [("n.md", 1, "+"), ("g.md", 1, "-")])

    def test_multiple_files_hunks_and_marker_lines(self):
        text = (diff("a.md", "+" + SA, new_start=2) + "\\ No newline at end of file\n"
                + "@@ -9 +9 @@\n-x\n+" + TA + "\n"
                + "diff --git a/img.png b/img.png\nindex 1..2 100644\nBinary files a/img.png and b/img.png differ\n"
                + diff("b.md", "+--- a heading rule then " + DANDA, new_start=5))
        self.assertEqual([(f.path, f.line) for f in gd.scan(text)], [("a.md", 2), ("a.md", 9), ("b.md", 5)])


class AgainstGit(unittest.TestCase):
    """End to end in a throwaway repository: the exit code is the gate."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self.tmp.name)
        env = {**os.environ, "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_NOSYSTEM": "1"}
        self.git = lambda *a: subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@example.invalid",
                                              "-c", "commit.gpgsign=false", *a], cwd=self.repo, env=env,
                                             check=True, capture_output=True)
        self.git("init", "-q", "-b", "base")
        (self.repo / "page.md").write_text("title\nbody\n", encoding="utf-8")
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "base")
        self.git("switch", "-q", "-c", "bot/x")

    def tearDown(self):
        self.tmp.cleanup()

    def run_main(self, *args):
        out, err = io.StringIO(), io.StringIO()
        with mock.patch.object(gd, "ROOT", self.repo), redirect_stdout(out), redirect_stderr(err):
            code = gd.main(list(args))
        return code, out.getvalue() + err.getvalue()

    def commit(self, text: str):
        (self.repo / "page.md").write_text(text, encoding="utf-8")
        self.git("commit", "-q", "-am", "change")

    def test_clean_change_passes(self):
        self.commit("title\nbody, refreshed\n")
        code, out = self.run_main("base...HEAD")
        self.assertEqual(code, 0, out)

    def test_added_code_point_fails_and_report_only_passes(self):
        self.commit("title\nbody " + SA + "\n")
        code, out = self.run_main("base...HEAD")
        self.assertEqual(code, 1)
        self.assertIn("page.md:2: adds U+0A38", out)
        self.assertNotIn(SA, out)
        code, _ = self.run_main("--report-only", "base...HEAD")
        self.assertEqual(code, 0)

    def test_summary_file(self):
        self.commit("title\n" + DANDA + "\n")
        summary = self.repo / "summary.md"
        self.run_main("--summary", str(summary), "base...HEAD")
        text = summary.read_text(encoding="utf-8")
        self.assertIn("`page.md:2`", text)
        self.assertIn("U+0964", text)
        self.assertNotIn(DANDA, text)


if __name__ == "__main__":
    unittest.main()
