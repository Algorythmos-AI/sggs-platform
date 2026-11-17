#!/usr/bin/env python3
"""
npm_audit_gate.py [--exceptions FILE] [--today YYYY-MM-DD] PROJECT... — the `security · deps` gate.

Runs `npm audit --json` in each PROJECT directory (frontend, docs-site) and fails on any high or
critical advisory, exactly like `npm audit --audit-level=high`, except for an advisory listed in
scripts/ci/npm-audit-exceptions.json for that package and project, whose exception has not expired.

An exception exists only for an advisory with **no patched release**; anything with a fix is
upgraded instead. Each one names one GHSA id and one package, the projects it applies to, why it
is not exploitable here, and an expiry date at most MAX_DAYS after it was added: on that date the
gate fails again and somebody looks upstream for a fix. Advisories are read straight from each
`via` object npm reports, so a package that is only "high" because it depends on an excepted one
(vite -> picomatch) inherits the exception; a second, unexcepted advisory anywhere still fails.

Fails closed: an audit that is not JSON, reports an `error`, or lacks `vulnerabilities`/`metadata`
(a registry outage, a missing lockfile) is a failure, never a pass.
Exit 0 pass, 1 blocking advisories or an expired/invalid exception, 2 the audit could not be read.
"""
import argparse, datetime as dt, json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXCEPTIONS = Path(__file__).with_name("npm-audit-exceptions.json")
BLOCKING = {"high", "critical"}
MAX_DAYS = 45       # the longest an exception may run before it must be re-checked


class AuditUnreadable(Exception):
    pass


def run_audit(project):
    """The parsed `npm audit --json` report of a project directory (npm exits 1 when it finds any)."""
    proc = subprocess.run(["npm", "audit", "--json"], cwd=ROOT / project,
                          capture_output=True, text=True)
    return parse_report(proc.stdout, project)


def parse_report(text, project):
    try:
        report = json.loads(text)
    except ValueError:
        raise AuditUnreadable(f"{project}: npm audit did not return JSON: {text[:200]!r}")
    if not isinstance(report, dict) or "error" in report:
        raise AuditUnreadable(f"{project}: npm audit failed: {json.dumps(report)[:300]}")
    if not isinstance(report.get("vulnerabilities"), dict) or "metadata" not in report:
        raise AuditUnreadable(f"{project}: npm audit report has no vulnerabilities/metadata")
    return report


def advisories(report):
    """{(ghsa id, package): {severity, title, url, range}} for every advisory npm reports directly."""
    found = {}
    for node in report["vulnerabilities"].values():
        for via in node.get("via", []):
            if not isinstance(via, dict):
                continue            # a package name: severity inherited from that package's advisories
            url = via.get("url", "")
            ghsa = url.rstrip("/").rsplit("/", 1)[-1] if "/advisories/" in url else str(via.get("source"))
            found[(ghsa, via.get("name") or node.get("name"))] = {
                "severity": via.get("severity", "unknown"), "title": via.get("title", ""),
                "url": url, "range": via.get("range", "")}
    return found


def load_exceptions(path):
    """The exception list, each checked for the fields a reviewer needs and a bounded lifetime."""
    data = json.loads(Path(path).read_text())
    out, problems = [], []
    for i, e in enumerate(data.get("exceptions", [])):
        missing = [k for k in ("id", "package", "projects", "added", "expires", "reason") if not e.get(k)]
        if missing:
            problems.append(f"exception #{i + 1}: missing {', '.join(missing)}")
            continue
        try:
            added, expires = dt.date.fromisoformat(e["added"]), dt.date.fromisoformat(e["expires"])
        except ValueError:
            problems.append(f"{e['id']}: added/expires must be YYYY-MM-DD")
            continue
        if not 0 <= (expires - added).days <= MAX_DAYS:
            problems.append(f"{e['id']}: an exception may run at most {MAX_DAYS} days "
                            f"(added {added}, expires {expires})")
            continue
        out.append({**e, "added": added, "expires": expires})
    return out, problems


def evaluate(project, report, exceptions, today):
    """(failures, notes) for one project's report."""
    failures, notes, seen = [], [], set()
    for (ghsa, pkg), adv in sorted(advisories(report).items()):
        if adv["severity"] not in BLOCKING:
            continue
        exc = next((e for e in exceptions if e["id"] == ghsa and e["package"] == pkg
                    and project in e["projects"]), None)
        label = f"{project}: {adv['severity']} {ghsa} in {pkg} {adv['range']} — {adv['title']} {adv['url']}"
        if exc is None:
            failures.append(label)
        elif today > exc["expires"]:
            failures.append(f"{label}\n    exception expired on {exc['expires']}: check upstream for a "
                            f"fixed release and upgrade, or renew it in {EXCEPTIONS.name} with a new reason")
        else:
            seen.add((ghsa, pkg))
            notes.append(f"{project}: excepted until {exc['expires']}: {adv['severity']} {ghsa} in {pkg} "
                         f"{adv['range']} (no patched release)")
    for e in exceptions:
        if project in e["projects"] and (e["id"], e["package"]) not in seen \
                and (e["id"], e["package"]) not in {k for k in advisories(report)}:
            notes.append(f"{project}: exception {e['id']} ({e['package']}) no longer matches any "
                         f"advisory — remove it from {EXCEPTIONS.name}")
    return failures, notes


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("projects", nargs="+")
    ap.add_argument("--exceptions", default=str(EXCEPTIONS))
    ap.add_argument("--today", type=dt.date.fromisoformat, default=dt.date.today())
    args = ap.parse_args(argv)

    exceptions, problems = load_exceptions(args.exceptions)
    failures = list(problems)
    for project in args.projects:
        try:
            report = run_audit(project)
        except AuditUnreadable as err:
            print(f"::error::{err}")
            return 2
        meta = report["metadata"].get("vulnerabilities", {})
        print(f"{project}: " + ", ".join(f"{meta.get(s, 0)} {s}" for s in
                                        ("critical", "high", "moderate", "low", "info")))
        f, notes = evaluate(project, report, exceptions, args.today)
        failures += f
        for n in notes:
            print(f"::notice::{n}")
    if failures:
        for f in failures:
            print(f"::error::{f}")
        print(f"\nnpm audit gate: {len(failures)} blocking problem(s). Upgrade to a patched release; "
              f"only an advisory with no fix may be excepted ({EXCEPTIONS.relative_to(ROOT)}).")
        return 1
    print("npm audit gate: no unexcepted high or critical advisory")
    return 0


if __name__ == "__main__":
    sys.exit(main())
