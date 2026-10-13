"""Unit tests for the CI deploy helpers (run with the webapp suite)."""
import contextlib, io, re, sys, tempfile, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "ci"))
import check_static_fresh as fresh  # noqa: E402
import vercel_deploy_url as v  # noqa: E402
import wait_for_checks as w  # noqa: E402

WORKFLOWS = Path(__file__).resolve().parents[2] / ".github" / "workflows"

U = "https://sggs-knowledge-base-f6hr0j9p9-skalaliyas-projects.vercel.app"
ALIAS = "https://sggs-knowledge-base-skalaliyas-projects.vercel.app"
STDERR = (f"Uploading [====]\n  Inspect  https://vercel.com/x/y/z\n"
          f"\x1b[2K\x1b[1A\x1b[2K\x1b[G▲ Production      {U}\nCompleting…\n▲ Aliased         {ALIAS}\n")

class VercelDeployUrl(unittest.TestCase):
    def test_wrapped_json(self):
        self.assertEqual(v.resolve('{"status":"ok","deployment":{"url":"%s"}}' % U, ""), U)
    def test_flat_json_without_scheme(self):
        self.assertEqual(v.resolve('{"id":"dpl_1","url":"%s"}' % U[8:], ""), U)
    def test_json_without_url_falls_back_to_stderr(self):   # the shape that broke CI
        self.assertEqual(v.resolve('{"status":"ok","message":"done"}', STDERR), U)
    def test_empty_stdout_uses_stderr_not_alias(self):
        self.assertEqual(v.resolve("", STDERR), U)
    def test_nothing_found(self):
        self.assertIsNone(v.resolve("not json", "no urls here"))
    def test_rejects_non_vercel_urls(self):
        self.assertIsNone(v.resolve('{"url":"https://evil.example.com"}', ""))

class WaitForChecks(unittest.TestCase):
    def test_main_requires_docs_to_merge(self):
        self.assertIn("docs", w.required_contexts())

    def test_the_product_deploy_never_waits_on_the_wiki(self):
        want = w.wanted(w.required_contexts(), ["playwright"], ["docs"])
        self.assertNotIn("docs", want)
        self.assertEqual(want[-1], "playwright")
        self.assertIn("python", want)

    def test_the_deploy_workflow_passes_the_exclusion(self):
        wf = (Path(__file__).resolve().parents[2] / ".github/workflows/deploy-production.yml").read_text()
        self.assertIn("wait_for_checks.py \"$GITHUB_SHA\" --extra playwright --exclude docs", wf)

    def test_the_check_both_deploys_wait_for_keeps_its_name(self):
        # the deploys wait for a check run called exactly "playwright": a job `name:` or a matrix
        # ("playwright (mobile)") renames it, and the gate then waits for a check that never appears
        wf = (WORKFLOWS / "e2e.yml").read_text()
        job = re.search(r"^  playwright:\n((?:    .*\n|\n)+)", wf, re.M)
        self.assertIsNotNone(job, "e2e.yml has no job with the id `playwright`")
        self.assertIsNone(re.search(r"^    name:", job.group(1), re.M), "the playwright job must not be renamed")
        self.assertNotIn("matrix:", job.group(1), "the playwright job must not become a matrix")
        for project in ("desktop", "mobile"):
            self.assertIn(f"npx playwright test --project={project}", job.group(1))


class StaticFreshness(unittest.TestCase):
    """scripts/ci/check_static_fresh.py: the committed webapp/static against a fresh build."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dist, self.static = Path(self.tmp.name, "dist"), Path(self.tmp.name, "static")
        for root in (self.dist, self.static):
            self.write(root, "index.html", "<!DOCTYPE html><title>Home</title>")
            self.write(root, "_astro/core.AAAA.js", "export const a=1;")
            self.write(root, "site.webmanifest", '{"name":"x"}')

    @staticmethod
    def write(root, rel, data):
        path = Path(root, rel)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data if isinstance(data, bytes) else data.encode("utf-8"))

    def run_check(self, *argv, env=None):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = fresh.main(["--dist", str(self.dist), "--static", str(self.static), *argv], env=env or {})
        return code, out.getvalue()

    def test_identical_text_assets_pass(self):
        code, out = self.run_check()
        self.assertEqual(code, 0, out)
        self.assertIn("3 text assets in the build, 3 in the committed copy", out)
        self.assertNotIn("::", out)

    def test_images_and_fonts_are_not_compared(self):
        self.write(self.dist, "_astro/hero.BBBB.webp", b"\x00linux-encoder")
        self.write(self.static, "_astro/hero.BBBB.webp", b"\x00macos-encoder")
        self.write(self.dist, "fonts/SantLipi-VF.woff2", b"\x01")
        self.assertEqual(self.run_check()[0], 0)

    def test_missing_stale_and_different_are_each_listed(self):
        (self.static / "_astro/core.AAAA.js").unlink()
        self.write(self.static, "_astro/core.ZZZZ.js", "export const a=0;")      # the old hashed chunk
        self.write(self.static, "index.html", "<!DOCTYPE html><title>Old home</title>")
        code, out = self.run_check()
        self.assertEqual(code, 1, out)
        self.assertIn("+ _astro/core.AAAA.js", out)
        self.assertIn("- _astro/core.ZZZZ.js", out)
        self.assertIn("~ index.html", out)
        self.assertIn("first difference at byte 22", out)
        self.assertIn("::error::webapp/static is not the build of this commit (3 text assets differ)", out)

    def test_report_only_mode_annotates_a_warning_and_still_exits_1(self):
        self.write(self.dist, "learn/new.html", "<p>new</p>")
        code, out = self.run_check("--annotate", "warning")
        self.assertEqual(code, 1, out)
        self.assertIn("::warning::", out)
        self.assertNotIn("::error::", out)

    def test_a_set_public_variable_is_named_only_when_the_copy_is_stale(self):
        env = {"PUBLIC_APP_STORE_LIVE": "1", "PUBLIC_NEWSLETTER_FORM_URL": "", "HOME": "/x"}
        self.assertNotIn("PUBLIC_", self.run_check(env=env)[1])
        self.write(self.dist, "index.html", "<!DOCTYPE html><title>Home</title><a>App Store</a>")
        out = self.run_check(env=env)[1]
        self.assertIn("note: PUBLIC_APP_STORE_LIVE set in this environment", out)
        self.assertNotIn("PUBLIC_NEWSLETTER_FORM_URL", out)

    def test_a_missing_directory_or_an_empty_build_is_an_error_not_a_pass(self):
        code, out = self.run_check("--dist", str(Path(self.tmp.name, "nope")))
        self.assertEqual(code, 2, out)
        empty = Path(self.tmp.name, "empty")
        empty.mkdir()
        code, out = self.run_check("--dist", str(empty))
        self.assertEqual(code, 2, out)
        self.assertIn("the build is empty", out)

    def test_first_difference_shows_both_sides(self):
        n, a, b = fresh.first_difference(b"<script src=/_astro/a.1111.js>", b"<script src=/_astro/a.2222.js>")
        self.assertEqual(n, 22)
        self.assertIn("a.1111.js", a)
        self.assertIn("a.2222.js", b)

    def test_the_frontend_job_runs_it_after_the_build(self):
        wf = (WORKFLOWS / "web-ci.yml").read_text()
        job = wf[wf.index("\n  frontend:\n"):]
        self.assertLess(job.index("npm run build"), job.index("scripts/ci/check_static_fresh.py"))


if __name__ == "__main__":
    unittest.main()
