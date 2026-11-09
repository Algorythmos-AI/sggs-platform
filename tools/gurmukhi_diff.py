#!/usr/bin/env python3
"""Scripture guard for automated changes: fail when a diff adds or removes a Gurmukhi character.

    python3 tools/gurmukhi_diff.py                          # origin/integration...HEAD
    python3 tools/gurmukhi_diff.py BASE...HEAD              # any git range git diff accepts
    python3 tools/gurmukhi_diff.py --report-only BASE...HEAD  # list, never fail
    python3 tools/gurmukhi_diff.py --summary OUT.md         # also write the findings as Markdown

A bot (the weekly wiki refresh, the pin bumps) may regenerate pages, counts and pins; it may never
touch scripture. Every changed line of the diff — added or removed — is searched for a character in
the guarded set: the Gurmukhi block U+0A00–U+0A7F, the dandas U+0964–U+0965 and the joiners
U+200C–U+200D. Any hit is listed as `file:line` with its code points written as `U+XXXX` (never the
characters themselves, so a log cannot be mistaken for the text), and the run exits 1.

`.github/workflows/scripture-diff-guard.yml` runs this on every pull request: it fails for a bot
branch (`bot/…`, `docs/auto-…`) or a pull request labelled `automated`, and only reports otherwise.
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RANGE = "origin/integration...HEAD"
GUARDED = ((0x0A00, 0x0A7F), (0x0964, 0x0965), (0x200C, 0x200D))
HUNK_RE = re.compile(r"^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@")


def guarded(ch: str) -> bool:
    cp = ord(ch)
    return any(lo <= cp <= hi for lo, hi in GUARDED)


def code_points(text: str) -> list[str]:
    """The guarded code points in `text`, each once, in order of first appearance, as `U+XXXX`."""
    seen: dict[str, None] = {}
    for ch in text:
        if guarded(ch):
            seen.setdefault(f"U+{ord(ch):04X}", None)
    return list(seen)


def safe(text: str) -> str:
    """`text` with every guarded character replaced by its `U+XXXX` name (for paths in a report)."""
    return "".join(f"<U+{ord(ch):04X}>" if guarded(ch) else ch for ch in text)


@dataclass(frozen=True)
class Finding:
    path: str
    line: int          # the line number in the new file (added) or the old file (removed)
    sign: str          # "+" added, "-" removed
    points: tuple[str, ...]

    def __str__(self) -> str:
        what = "adds" if self.sign == "+" else "removes (old line)"
        shown = " ".join(self.points[:12]) + (f" … (+{len(self.points) - 12})" if len(self.points) > 12 else "")
        return f"{safe(self.path)}:{self.line}: {what} {shown}"


def scan(diff: str) -> list[Finding]:
    """Every changed line of a unified diff (`git diff -U0`) that carries a guarded character."""
    findings: list[Finding] = []
    old_path = new_path = ""
    old_no = new_no = 0
    in_hunk = False
    for raw in diff.splitlines():
        if raw.startswith("diff --git "):
            in_hunk = False
            old_path = new_path = ""
            continue
        if raw.startswith("--- ") and not in_hunk:
            old_path = _path(raw[4:])
            continue
        if raw.startswith("+++ ") and not in_hunk:
            new_path = _path(raw[4:])
            continue
        m = HUNK_RE.match(raw)
        if m:
            in_hunk = True
            old_no, new_no = int(m.group(1)), int(m.group(2))
            continue
        if not in_hunk:
            continue
        if raw.startswith("+"):
            pts = code_points(raw[1:])
            if pts:
                findings.append(Finding(new_path or old_path, new_no, "+", tuple(pts)))
            new_no += 1
        elif raw.startswith("-"):
            pts = code_points(raw[1:])
            if pts:
                findings.append(Finding(old_path or new_path, old_no, "-", tuple(pts)))
            old_no += 1
        elif raw.startswith(" "):
            old_no += 1
            new_no += 1
        elif raw.startswith("\\"):
            continue        # "\ No newline at end of file"
        else:
            in_hunk = False  # a header line of the next file part (index, mode, rename, Binary files …)
    return findings


def _path(spec: str) -> str:
    spec = spec.rstrip("\t")
    if spec == "/dev/null":
        return ""
    return spec[2:] if spec[:2] in ("a/", "b/") else spec


def git_diff(rng: str, cwd: Path | None = None) -> str:
    out = subprocess.run(
        ["git", "-c", "core.quotePath=false", "diff", "--no-color", "--no-ext-diff", "--unified=0",
         "--find-renames", rng, "--"],
        cwd=cwd or ROOT, capture_output=True)
    if out.returncode != 0:
        sys.stderr.write(out.stderr.decode("utf-8", "replace"))
        raise SystemExit(f"gurmukhi_diff: git diff {rng} failed")
    return out.stdout.decode("utf-8", "replace")


def markdown(findings: list[Finding], rng: str, enforced: bool) -> str:
    if not findings:
        return f"Scripture diff guard: no Gurmukhi added or removed in `{rng}`.\n"
    head = ("**Scripture diff guard: failed.**" if enforced else "Scripture diff guard (report only):")
    lines = [f"{head} {len(findings)} changed line(s) in `{rng}` add or remove a guarded character "
             "(U+0A00–U+0A7F, U+0964–U+0965, U+200C–U+200D). An automated change may never touch "
             "scripture: a person must review every such line.", "", "| File:line | Change | Code points |",
             "|---|---|---|"]
    for f in findings:
        lines.append(f"| `{safe(f.path)}:{f.line}` | {'added' if f.sign == '+' else 'removed'} | "
                     f"{' '.join(f.points[:12])}{' …' if len(f.points) > 12 else ''} |")
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("range", nargs="?", default=DEFAULT_RANGE, help=f"git diff range (default {DEFAULT_RANGE})")
    ap.add_argument("--report-only", action="store_true", help="list the findings but exit 0")
    ap.add_argument("--summary", type=Path, metavar="OUT", help="append the findings as Markdown to OUT")
    a = ap.parse_args(argv)
    findings = scan(git_diff(a.range))
    for f in findings:
        print(f)
    if a.summary:
        with a.summary.open("a", encoding="utf-8") as fh:
            fh.write(markdown(findings, a.range, not a.report_only))
    if not findings:
        print(f"gurmukhi_diff: no guarded character added or removed in {a.range}")
        return 0
    verdict = "reported" if a.report_only else "FAIL"
    print(f"gurmukhi_diff: {verdict}: {len(findings)} changed line(s) in {a.range} add or remove "
          "a Gurmukhi, danda or joiner code point", file=sys.stderr)
    return 0 if a.report_only else 1


if __name__ == "__main__":
    sys.exit(main())
