#!/usr/bin/env python3
"""Docs impact: the wiki pages whose code changed in a range while the page did not.

    python3 tools/docs_coupling.py origin/integration..HEAD                 # Markdown report
    python3 tools/docs_coupling.py BASE..HEAD --json                        # the same as JSON
    python3 tools/docs_coupling.py BASE..HEAD --pr-body body.md --summary OUT.md

A page covers code in one of two ways:
  - explicitly, with `covers:` in its frontmatter: one quoted, comma-separated string of globs over
    tracked files (`*` within a directory, `**` across directories) and `file#symbol` entries, e.g.
    `covers: "webapp/serve.py#api, .github/workflows/*.yml"`. A symbol is a top-level definition
    (docs_check.SYMBOL_RE); it counts as changed when a changed hunk touches its line range at the
    base or at the head of the range;
  - by default, through the files it cites (docs_check.cited_files: code excerpts, relative links to
    non-Markdown files, the source-of-truth files of its posters).

The range is diffed from the merge base of BASE and HEAD. A page whose covered code changed is
satisfied when the page itself changed, when its `verified` stamp moved, or when the pull request
body has a line `Docs-impact: none — <reason>` (a reason of 10 characters or more). Noise is not
counted: tests, lockfiles, webapp/static/, docs-site/dist/, CHANGELOG.md, and the generators of
the generated pages (their own --check gates cover those).

Report only: the exit code is 0, unless COUPLING_ENFORCE is on (1/true/on), when an unsatisfied
page that declares `covers:` fails the run. Default coverage never fails. Stdlib only.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import docs_check as dc  # noqa: E402

MARKER = "<!-- docs-coupling-report -->"
IMPACT_RE = re.compile(r"^\s*Docs-impact:\s*none\s*[—–-]+\s*(.+?)\s*$", re.M | re.I)
MIN_REASON = 10
NOISE_RE = re.compile(r"(^|/)(tests?|__tests__|e2e)/|(^|/)test_[^/]*\.py$|_test\.py$|\.(test|spec)\.[cm]?[jt]sx?$"
                      r"|(^|/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|uv\.lock|poetry\.lock|Cargo\.lock)$"
                      r"|\.lock(\.json)?$|^webapp/static/|^docs-site/dist/|(^|/)CHANGELOG\.md$")


def git(*args: str, ok: bool = False) -> str:
    out = subprocess.run(["git", "-c", "core.quotePath=false", *args], cwd=dc.ROOT, capture_output=True, text=True)
    if out.returncode != 0:
        if ok:
            return ""
        sys.stderr.write(out.stderr)
        raise SystemExit(f"docs_coupling: git {' '.join(args)} failed")
    return out.stdout


def is_noise(path: str) -> bool:
    return bool(NOISE_RE.search(path)) or path in set(dc.GENERATED.values()) or path.startswith("docs/")


@dataclass
class Change:
    """One changed file: its old/new paths and the changed line ranges on each side."""
    old: str
    new: str
    old_ranges: list[tuple[int, int]] = field(default_factory=list)
    new_ranges: list[tuple[int, int]] = field(default_factory=list)


def changes(base: str, head: str) -> dict[str, Change]:
    """Files changed from base to head, keyed by both old and new path."""
    diff = git("diff", "--no-color", "--no-ext-diff", "--unified=0", "--find-renames", base, head, "--")
    out: dict[str, Change] = {}
    cur: Change | None = None
    for line in diff.splitlines():
        if line.startswith("diff --git "):
            cur = None
        elif line.startswith("--- "):
            cur = Change(_path(line[4:]), "")
        elif line.startswith("+++ ") and cur is not None:
            cur.new = _path(line[4:])
            for p in {cur.old, cur.new} - {""}:
                out[p] = cur
        elif line.startswith("@@") and cur is not None:
            m = re.match(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", line)
            if m:
                a, b = int(m.group(1)), int(m.group(2) if m.group(2) is not None else 1)
                c, d = int(m.group(3)), int(m.group(4) if m.group(4) is not None else 1)
                # a pure insertion (b == 0) sits between lines a and a+1: count it as touching both
                cur.old_ranges.append((a, a + max(b, 1) - 1) if b else (a, a + 1))
                cur.new_ranges.append((c, c + max(d, 1) - 1) if d else (c, c + 1))
    # renames and mode-only changes have no ---/+++ lines; pick them up by name
    for row in git("diff", "--name-status", "--find-renames", base, head, "--").splitlines():
        parts = row.split("\t")
        for p in parts[1:]:
            out.setdefault(p, Change(parts[1], parts[-1]))
    return out


def _path(spec: str) -> str:
    spec = spec.rstrip("\t")
    return "" if spec == "/dev/null" else (spec[2:] if spec[:2] in ("a/", "b/") else spec)


def show(rev: str, path: str) -> str | None:
    out = subprocess.run(["git", "show", f"{rev}:{path}"], cwd=dc.ROOT, capture_output=True)
    return out.stdout.decode("utf-8", "replace") if out.returncode == 0 else None


def _hits(rng: tuple[int, int] | None, hunks: list[tuple[int, int]]) -> bool:
    return rng is not None and any(a <= rng[1] and b >= rng[0] for a, b in hunks)


def symbol_changed(ch: Change, base: str, head: str, symbol: str) -> bool:
    suffix = Path(ch.new or ch.old).suffix
    old_src = show(base, ch.old) if ch.old else None
    new_src = show(head, ch.new) if ch.new else None
    old_rng = dc.symbol_range(old_src, suffix, symbol) if old_src is not None else None
    new_rng = dc.symbol_range(new_src, suffix, symbol) if new_src is not None else None
    if not ch.old_ranges and not ch.new_ranges:          # a pure rename: the symbol moved with its file
        return False
    return _hits(old_rng, ch.old_ranges) or _hits(new_rng, ch.new_ranges)


@dataclass
class PageSpec:
    page: str
    explicit: bool
    entries: list[str]


def page_specs() -> list[PageSpec]:
    """Every published page of this repository (not the sibling copies, not generated pages)."""
    specs = []
    for page in dc.published_pages():
        if dc.is_sibling(page):
            continue
        rel = dc._rel(page)
        if rel in dc.GENERATED:
            continue
        text = page.read_text(encoding="utf-8")
        fm, _ = dc.parse_frontmatter(text)
        if isinstance(fm, dict) and isinstance(fm.get("covers"), str):
            specs.append(PageSpec(rel, True, dc.covers_entries(fm["covers"])))
        else:
            specs.append(PageSpec(rel, False, dc.cited_files(page, text)))
    return specs


def stamp(rev: str, page: str) -> str:
    text = show(rev, page)
    if text is None:
        return ""
    fm, _ = dc.parse_frontmatter(text)
    v = (fm or {}).get("verified") if isinstance(fm, dict) else None
    return str(v.get("commit", "")) if isinstance(v, dict) else ""


def docs_impact(body: str) -> str | None:
    """The reason of a `Docs-impact: none — <reason>` line (HTML comments ignored), if long enough."""
    body = re.sub(r"<!--.*?-->", "", body or "", flags=re.S)
    for m in IMPACT_RE.finditer(body):
        reason = m.group(1).strip()
        if len(reason) >= MIN_REASON and not reason.startswith("<"):
            return reason
    return None


def couple(base: str, head: str, body: str = "", specs: list[PageSpec] | None = None) -> dict:
    """The coupling result for base..head (diffed from their merge base)."""
    mb = git("merge-base", base, head).strip() or base
    ch = changes(mb, head)
    code = {p: c for p, c in ch.items() if not is_noise(p)}
    reason = docs_impact(body)
    pages = []
    for spec in specs if specs is not None else page_specs():
        hit: list[str] = []
        for e in spec.entries:
            path, _, sym = e.partition("#")
            if sym:
                c = code.get(path)
                if c is not None and symbol_changed(c, mb, head, sym):
                    hit.append(e)
            elif spec.explicit:
                hit += [p for p in dc.glob_files(path, sorted(code))]
            elif path in code:
                hit.append(path)
        if not hit:
            continue
        hit = sorted(set(hit))
        if spec.page in ch:      # the stamp lives in the page: name the stronger signal when it moved
            by = "stamp-moved" if stamp(mb, spec.page) != stamp(head, spec.page) else "page-changed"
        elif reason:
            by = "docs-impact"
        else:
            by = None
        pages.append({"page": spec.page, "explicit": spec.explicit, "changed": hit, "satisfied_by": by})
    flagged = [p for p in pages if p["satisfied_by"] is None]
    return {"range": f"{base}..{head}", "merge_base": mb[:12], "docs_impact": reason,
            "code_files": sorted({c.new or c.old for c in code.values()}), "pages": pages,
            "flagged": [p["page"] for p in flagged],
            "flagged_explicit": [p["page"] for p in flagged if p["explicit"]]}


def markdown(r: dict, enforced: bool = False) -> str:
    out = [MARKER, "### Docs impact", ""]
    flagged = [p for p in r["pages"] if p["satisfied_by"] is None]
    done = [p for p in r["pages"] if p["satisfied_by"]]
    if not r["pages"]:
        out.append(f"No page covers the code changed in `{r['range']}`.")
    elif not flagged:
        out.append(f"Every page whose code changed in `{r['range']}` is accounted for.")
    else:
        mode = "**enforced** for pages that declare `covers:`" if enforced else "report only"
        out += [f"{len(flagged)} page(s) describe code this change touches, and neither the page nor its "
                f"`verified` stamp changed ({mode}). Re-read each against the code and update it, or add a line "
                "`Docs-impact: none — <reason>` to the pull request description.", "",
                "| Page | Coverage | Changed code |", "|---|---|---|"]
        for p in flagged:
            shown = ", ".join(f"`{c}`" for c in p["changed"][:5]) + (" …" if len(p["changed"]) > 5 else "")
            out.append(f"| `{p['page']}` | {'covers:' if p['explicit'] else 'cited files'} | {shown} |")
    if done:
        why = {"page-changed": "page changed", "stamp-moved": "stamp moved", "docs-impact": "Docs-impact line"}
        out += ["", "<details><summary>Accounted for (" + str(len(done)) + ")</summary>", ""]
        out += [f"- `{p['page']}`: {why[p['satisfied_by']]}" for p in done]
        out += ["", "</details>"]
    if r["docs_impact"]:
        out += ["", f"Docs-impact recorded: {r['docs_impact']}"]
    out += ["", "_`python3 tools/docs_coupling.py " + r["range"] + "` · see docs/contributing/writing-docs.md_"]
    return "\n".join(out) + "\n"


def enforce_on() -> bool:
    return os.environ.get("COUPLING_ENFORCE", "").strip().lower() in ("1", "true", "on", "yes")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("range", help="BASE..HEAD (diffed from the merge base)")
    ap.add_argument("--json", action="store_true", help="print the result as JSON")
    ap.add_argument("--pr-body", type=Path, metavar="FILE", help="the pull request description (for the Docs-impact line)")
    ap.add_argument("--summary", type=Path, metavar="OUT", help="also write the Markdown report to OUT")
    a = ap.parse_args(argv)
    base, sep, head = a.range.partition("..")
    if not sep or not base:
        ap.error("range must be BASE..HEAD")
    head = head.lstrip(".") or "HEAD"
    body = a.pr_body.read_text(encoding="utf-8") if a.pr_body and a.pr_body.exists() else ""
    r = couple(base, head, body)
    enforced = enforce_on()
    md = markdown(r, enforced)
    if a.summary:
        a.summary.write_text(md, encoding="utf-8")
    print(json.dumps(r, indent=2, ensure_ascii=False) if a.json else md, end="" if not a.json else "\n")
    if enforced and r["flagged_explicit"]:
        print(f"::error::docs impact: {len(r['flagged_explicit'])} page(s) with covers: need an update or a Docs-impact line",
              file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
