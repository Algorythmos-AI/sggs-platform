"""The wiki's page generators are one list (the Makefile's DOCS_GENERATORS): checked by make docs-check
and the deploy-docs docs job, rewritten by the weekly docs-freshness run. Until 2026-11-12 that run
picked generators by grepping their source for a quoted "--write", matched none, and skipped them all."""
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def makefile_generators() -> list[str]:
    m = re.search(r"^DOCS_GENERATORS\s*:=\s*(.+)$", (ROOT / "Makefile").read_text(encoding="utf-8"), re.M)
    return m.group(1).split() if m else []


def checked_in(text: str) -> set[str]:
    return set(re.findall(r"python3 tools/(gen_[a-z_]+)\.py --check", text))


class Generators(unittest.TestCase):
    def test_the_list_exists_and_every_generator_is_a_file(self):
        gens = makefile_generators()
        self.assertTrue(gens, "Makefile: DOCS_GENERATORS is missing")
        for g in gens:
            self.assertTrue((ROOT / "tools" / f"{g}.py").is_file(), g)

    def test_docs_check_and_the_docs_job_check_the_same_generators(self):
        gens = set(makefile_generators())
        make = (ROOT / "Makefile").read_text(encoding="utf-8")
        target = make.split("\ndocs-check:", 1)[1].split("\n\n", 1)[0].split("\ndocs:", 1)[0]
        job = (ROOT / ".github/workflows/deploy-docs.yml").read_text(encoding="utf-8")
        # gen_repo_map only checks a hand-curated map: it is checked, never rewritten
        self.assertEqual(checked_in(target) - {"gen_repo_map"}, gens, "make docs-check vs DOCS_GENERATORS")
        self.assertEqual(checked_in(job) - {"gen_repo_map"}, gens, "deploy-docs docs job vs DOCS_GENERATORS")

    def test_make_prints_the_list_the_weekly_run_reads(self):
        out = subprocess.run(["make", "-s", "docs-generators"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
        self.assertEqual(out.split(), [f"tools/{g}.py" for g in makefile_generators()])
        wf = (ROOT / ".github/workflows/docs-freshness.yml").read_text(encoding="utf-8")
        self.assertIn("make -s docs-generators", wf)
        self.assertNotIn("grep -qE", wf, "the weekly run must not pick generators by grepping their source")

    def test_every_generator_accepts_write(self):
        # each writes unless given --check; --write must be accepted, not rejected as unknown
        for g in makefile_generators():
            src = (ROOT / "tools" / f"{g}.py").read_text(encoding="utf-8")
            self.assertNotIn("add_argument(", src, f"{g}: argparse would need --write declared")


if __name__ == "__main__":
    unittest.main()
