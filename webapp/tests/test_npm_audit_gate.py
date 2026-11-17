"""The security · deps gate: npm audit with dated, per-package exceptions (scripts/ci/npm_audit_gate.py)."""
import datetime as dt, json, sys, tempfile, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "ci"))
import npm_audit_gate as g  # noqa: E402

PICO = "GHSA-fc5q-39xc-vjpf"
TODAY = dt.date(2026, 11, 18)


def via(ghsa, name, severity="high", rng="<=4.0.7"):
    return {"source": 1, "name": name, "title": "t", "url": f"https://github.com/advisories/{ghsa}",
            "severity": severity, "range": rng}


def report(*nodes):
    return {"auditReportVersion": 2, "metadata": {"vulnerabilities": {}},
            "vulnerabilities": {n["name"]: n for n in nodes}}


PICO_NODE = {"name": "picomatch", "severity": "high", "via": [via(PICO, "picomatch")]}
VITE_NODE = {"name": "vite", "severity": "high", "via": ["picomatch", "tinyglobby"]}
EXC = [{"id": PICO, "package": "picomatch", "projects": ["frontend"], "reason": "r",
        "added": dt.date(2026, 11, 18), "expires": dt.date(2026, 12, 18)}]


class Evaluate(unittest.TestCase):
    def test_unexcepted_high_fails(self):
        f, _ = g.evaluate("frontend", report(PICO_NODE), [], TODAY)
        self.assertEqual(len(f), 1)
        self.assertIn(PICO, f[0])

    def test_excepted_advisory_and_its_dependents_pass(self):
        f, notes = g.evaluate("frontend", report(PICO_NODE, VITE_NODE), EXC, TODAY)
        self.assertEqual(f, [])
        self.assertTrue(any("excepted until 2026-12-18" in n for n in notes))

    def test_a_second_advisory_in_a_dependent_still_fails(self):
        vite = {**VITE_NODE, "via": ["picomatch", via("GHSA-xxxx-yyyy-zzzz", "vite")]}
        f, _ = g.evaluate("frontend", report(PICO_NODE, vite), EXC, TODAY)
        self.assertEqual(len(f), 1)
        self.assertIn("GHSA-xxxx-yyyy-zzzz", f[0])

    def test_the_same_id_in_another_package_is_not_excepted(self):
        other = {"name": "nanomatch", "severity": "high", "via": [via(PICO, "nanomatch")]}
        f, _ = g.evaluate("frontend", report(PICO_NODE, other), EXC, TODAY)
        self.assertEqual(len(f), 1)
        self.assertIn("nanomatch", f[0])

    def test_exception_applies_only_to_its_projects(self):
        f, _ = g.evaluate("docs-site", report(PICO_NODE), EXC, TODAY)
        self.assertEqual(len(f), 1)

    def test_expired_exception_fails(self):
        f, _ = g.evaluate("frontend", report(PICO_NODE), EXC, dt.date(2026, 12, 19))
        self.assertEqual(len(f), 1)
        self.assertIn("expired on 2026-12-18", f[0])

    def test_expiry_day_itself_still_passes(self):
        f, _ = g.evaluate("frontend", report(PICO_NODE), EXC, dt.date(2026, 12, 18))
        self.assertEqual(f, [])

    def test_moderate_and_low_do_not_block(self):
        low = {"name": "katex", "severity": "low", "via": [via("GHSA-238p-pmpm-9mq7", "katex", "low")]}
        mod = {"name": "satori", "severity": "moderate", "via": [via("GHSA-wx4j-mvgx-mqwp", "satori", "moderate")]}
        f, _ = g.evaluate("frontend", report(low, mod), [], TODAY)
        self.assertEqual(f, [])

    def test_critical_blocks(self):
        crit = {"name": "x", "severity": "critical", "via": [via("GHSA-cccc-cccc-cccc", "x", "critical")]}
        f, _ = g.evaluate("frontend", report(crit), EXC, TODAY)
        self.assertEqual(len(f), 1)

    def test_stale_exception_is_reported(self):
        _, notes = g.evaluate("frontend", report(), EXC, TODAY)
        self.assertTrue(any("no longer matches" in n for n in notes))


class FailClosed(unittest.TestCase):
    def test_not_json(self):
        with self.assertRaises(g.AuditUnreadable):
            g.parse_report("npm ERR! network", "frontend")

    def test_error_object(self):
        with self.assertRaises(g.AuditUnreadable):
            g.parse_report(json.dumps({"error": {"code": "ENOLOCK"}}), "frontend")

    def test_missing_vulnerabilities(self):
        with self.assertRaises(g.AuditUnreadable):
            g.parse_report(json.dumps({"metadata": {}}), "frontend")

    def test_clean_report_parses(self):
        self.assertEqual(g.parse_report(json.dumps(report()), "frontend")["vulnerabilities"], {})


class Exceptions(unittest.TestCase):
    def load(self, entries):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
            json.dump({"exceptions": entries}, fh)
        return g.load_exceptions(fh.name)

    def test_committed_file_is_valid(self):
        exc, problems = g.load_exceptions(g.EXCEPTIONS)
        self.assertEqual(problems, [])
        for e in exc:
            self.assertLessEqual((e["expires"] - e["added"]).days, g.MAX_DAYS)

    def test_too_long_an_exception_is_refused(self):
        _, problems = self.load([{"id": PICO, "package": "picomatch", "projects": ["frontend"],
                                  "reason": "r", "added": "2026-11-18", "expires": "2027-06-01"}])
        self.assertTrue(any("at most" in p for p in problems))

    def test_missing_reason_is_refused(self):
        _, problems = self.load([{"id": PICO, "package": "picomatch", "projects": ["frontend"],
                                  "added": "2026-11-18", "expires": "2026-12-01"}])
        self.assertTrue(any("reason" in p for p in problems))


class Workflow(unittest.TestCase):
    def test_deps_job_runs_the_gate_on_both_projects(self):
        wf = (Path(__file__).resolve().parents[2] / ".github" / "workflows" / "security.yml").read_text()
        self.assertIn("python3 scripts/ci/npm_audit_gate.py frontend docs-site", wf)
        self.assertNotIn("|| true", wf.split("  deps:")[1])


if __name__ == "__main__":
    unittest.main()
