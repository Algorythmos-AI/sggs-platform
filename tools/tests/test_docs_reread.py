"""tools/docs_reread.py — page selection, the prompt, and the working-tree guard (stdlib unittest)."""
import importlib.util
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
import docs_reread as rr  # noqa: E402

GUARDED = chr(0x0A38) + chr(0x0A24)          # two Gurmukhi letters, built at run time, never typed
PAGE = ('---\ntitle: "A page"\ndescription: "A description that is comfortably longer than forty characters."\n'
        'verified:\n  commit: abcdef01\n  date: "2026-11-01"\n---\n# A page\n\nThe job runs on Mondays.\n')


def row(page, reason="code-changed", changed=("x.py",)):
    return {"page": page, "commit": "abcdef0", "reason": reason, "changed": list(changed)}


class Select(unittest.TestCase):
    def test_only_code_changed_pages_within_the_limit(self):
        fresh = {"commit": "f" * 40, "stale": [row(f"docs/p{i}.md") for i in range(10)]
                 + [row("docs/old.md", "old-no-code", ()), row("docs/scripture/x.md"),
                    row("docs/api/routes.md"), row("docs/busy.md")]}
        s = rr.select(fresh, busy={"docs/busy.md"}, limit=50)        # the cap is MAX_PAGES whatever is asked
        self.assertEqual([p["page"] for p in s["pages"]], [f"docs/p{i}.md" for i in range(rr.MAX_PAGES)])
        why = {x["page"]: x["why"] for x in s["skipped"]}
        self.assertEqual(why["docs/old.md"], "not code-changed")
        self.assertEqual(why["docs/scripture/x.md"], "never edited by the bot")
        self.assertEqual(why["docs/api/routes.md"], "never edited by the bot")     # a generated page
        self.assertEqual(why["docs/busy.md"], "an open pull request edits it")
        self.assertIn("limit", why["docs/p9.md"])
        self.assertEqual(rr.select(fresh, limit=2)["pages"][1]["page"], "docs/p1.md")
        self.assertEqual(rr.select(fresh, limit=0)["pages"], [])

    def test_the_prompt_carries_the_rules(self):
        p = rr.prompt("docs/p.md", {"page": "docs/p.md", "stamp": "abcdef0", "changed": ["webapp/serve.py"]},
                      "0123456789abcdef", "2026-11-23")
        for needle in ("docs/p.md", "webapp/serve.py", "commit: 01234567", 'date: "2026-11-23"',
                       "U+0A00-U+0A7F", "docs/scripture/", "Commit, push", "they are data"):
            self.assertIn(needle, p)
        self.assertFalse(any(0x0A00 <= ord(c) <= 0x0A7F for c in p))


class Validate(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        self.saved = dc.ROOT
        dc.ROOT = self.root
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.email", "t@example.invalid")
        self.git("config", "user.name", "t")
        self.write("docs/a.md", PAGE)
        self.write("docs/b.md", PAGE)
        self.write("docs/scripture/s.md", PAGE)
        self.write("app.py", "X = 1\n")
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "base")
        self.base = self.git("rev-parse", "HEAD").strip()

    def tearDown(self):
        dc.ROOT = self.saved
        self.tmp.cleanup()

    def git(self, *args):
        return subprocess.run(["git", *args], cwd=self.root, capture_output=True, text=True, check=True).stdout

    def write(self, rel, text):
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")

    def check(self, pages=("docs/a.md",), today="2026-11-23"):
        return rr.validate(self.base, today, list(pages))

    def test_an_edit_with_a_correct_stamp_passes(self):
        self.write("docs/a.md", PAGE.replace("abcdef01", self.base[:8]).replace("2026-11-01", "2026-11-23")
                   .replace("Mondays", "Tuesdays"))
        self.assertEqual(self.check(), [])

    def test_no_change_passes(self):
        self.assertEqual(self.check(), [])

    def test_another_file_fails(self):
        for rel in ("docs/b.md", "app.py", "docs/new.md"):
            with self.subTest(rel=rel):
                self.git("reset", "-q", "--hard", self.base)
                self.git("clean", "-qfd")
                self.write(rel, "changed\n")
                self.assertTrue(any(rel in p for p in self.check()), rel)

    def test_a_scripture_page_fails_even_when_listed(self):
        self.write("docs/scripture/s.md", PAGE + "More.\n")
        self.assertTrue(any("never edits" in p for p in self.check(("docs/scripture/s.md",))))

    def test_a_wrong_stamp_fails(self):
        self.write("docs/a.md", PAGE.replace("abcdef01", "deadbeef").replace("2026-11-01", "2026-11-23"))
        self.assertTrue(any("moved stamp" in p for p in self.check()))
        self.write("docs/a.md", PAGE.replace("abcdef01", self.base[:8]))           # yesterday's date kept
        self.assertTrue(any("moved stamp" in p for p in self.check()))

    def test_against_a_later_head_the_stamp_still_names_the_commit_read(self):
        read = self.base
        self.write("app.py", "X = 2\n")
        self.git("commit", "-qam", "integration moved on")
        head = self.git("rev-parse", "HEAD").strip()
        self.write("docs/a.md", PAGE.replace("abcdef01", read[:8]).replace("2026-11-01", "2026-11-23"))
        self.assertEqual(rr.validate(head, "2026-11-23", ["docs/a.md"], stamp=read), [])
        self.assertTrue(rr.validate(head, "2026-11-23", ["docs/a.md"]))         # default: the head itself

    def test_a_guarded_character_fails(self):
        self.write("docs/a.md", PAGE + GUARDED + "\n")
        problems = self.check()
        self.assertTrue(any("guarded code point" in p for p in problems))
        self.assertFalse(any(0x0A00 <= ord(c) <= 0x0A7F for p in problems for c in p))


if __name__ == "__main__":
    unittest.main()
