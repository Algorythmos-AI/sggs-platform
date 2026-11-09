import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import gen_env_vars  # noqa: E402


def tree(files: dict[str, str]) -> tempfile.TemporaryDirectory:
    d = tempfile.TemporaryDirectory()
    for rel, text in files.items():
        p = Path(d.name) / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
    return d


FIXTURE = {
    "webapp/serve.py": "import os\nPORT = os.environ.get('SGGS_PORT')\nos.environ['SGGS_DB'] = 'x'\nDEBUG = os.getenv(\"SGGS_DEBUG\")\n",
    "frontend/src/site.ts": "export const LIVE = import.meta.env.PUBLIC_LIVE === '1';\n",
    "docs-site/plugins/x.mjs": "const c = process.env.PUBLIC_DOCS_COMMIT; if (process.env.CI) {}\n",
    "docs-site/node_modules/dep/index.js": "process.env.NOT_OURS\n",
    "webapp/tests/test_serve.py": "import os\nos.environ.get('TEST_ONLY')\n",
    "docs-site/playwright.config.ts": "process.env.PW_ONLY\n",
}


class Scan(unittest.TestCase):
    def test_reads_are_found_and_writes_tests_deps_and_ci_names_are_not(self):
        with tree(FIXTURE) as d:
            found = gen_env_vars.scan(Path(d), indirect={})
        self.assertEqual(sorted(found), ["PUBLIC_DOCS_COMMIT", "PUBLIC_LIVE", "SGGS_DEBUG", "SGGS_PORT"])
        self.assertEqual(found["SGGS_PORT"], {"webapp/serve.py"})

    def test_a_described_variable_renders_and_an_undescribed_one_is_a_problem(self):
        found = {"SGGS_PORT": {"webapp/serve.py"}, "SGGS_DEBUG": {"webapp/serve.py"}}
        page, problems = gen_env_vars.render(found, {"SGGS_PORT": "The local port."})
        self.assertIn("| `SGGS_PORT` | `webapp/serve.py` | The local port. |", page)
        self.assertIn(gen_env_vars.HEADER, page)
        self.assertEqual(len(problems), 1)
        self.assertIn("SGGS_DEBUG", problems[0])

    def test_a_description_nothing_reads_is_a_problem(self):
        _page, problems = gen_env_vars.render({}, {"GONE": "Was read once."})
        self.assertEqual(len(problems), 1)
        self.assertIn("no code reads it", problems[0])

    def test_an_indirect_read_must_still_name_the_variable(self):
        with tree({"docs-site/plugins/features.mjs": "const off = (n) => process.env[n] === '0';\n"}) as d:
            with self.assertRaises(SystemExit):
                gen_env_vars.scan(Path(d), indirect={"DOCS_PAGE_ACTIONS": ["docs-site/plugins/features.mjs"]})


class Repository(unittest.TestCase):
    def test_every_variable_is_described_and_the_page_is_current(self):
        r = subprocess.run([sys.executable, str(ROOT / "tools" / "gen_env_vars.py"), "--check"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)


if __name__ == "__main__":
    unittest.main()
