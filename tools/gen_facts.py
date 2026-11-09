#!/usr/bin/env python3
"""Fill the numbers a page quotes from the code that defines them.

    python3 tools/gen_facts.py            # rewrite every marked value in docs/ from its source
    python3 tools/gen_facts.py --write    # the same
    python3 tools/gen_facts.py --check    # exit 1 if a marked value differs from its source (CI)
    python3 tools/gen_facts.py --list     # every registered fact, its source and today's value

A page marks a value inline, on one line:

    The API serves <!--fact:routes-->29<!--/fact--> read-only routes.

The comments are invisible on GitHub; on the wiki docs-site/plugins/remark-facts.mjs drops them
from the HTML and portable-md.mjs from the Markdown export, so a reader sees only the number.
`--write` replaces only the text between the two markers; every other character of the page is
left as it is. `--check` fails on a value that differs from its source and on an unknown fact name.

A fact may take a format after a colon: `<!--fact:contexts:words-->five<!--/fact-->` (a number as
a word, up to twenty) or `<!--fact:angs:plain-->1430<!--/fact-->` (no thousands separator; the
default writes 60,658). Facts read from the pinned database are skipped, with a notice, when the
database is not installed (`make dataset`), so `--check` never fails for want of it.

To add a fact, add an entry to FACTS: a name, what it is, where it is read from and an extractor
that reads it there. Stdlib only.
"""
from __future__ import annotations

import json
import re
import sqlite3
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
DB = ROOT / "db" / "sggs.sqlite"
SKIP_DIRS = ("docs/reports/archive/",)
MARKER = re.compile(r"<!--fact:([a-z][a-z0-9_]*)(?::([a-z]+))?-->([^\n<]*?)<!--/fact-->")
OPEN_MARKER = re.compile(r"<!--\s*/?fact\b")
# code is an example, never a marker: fenced blocks and inline code spans are left alone
CODE = re.compile(r"^(`{3,}|~{3,})[^\n]*\n.*?^\1[^\n]*$|(`+)[^`\n].*?\2", re.M | re.S)
WORDS = ("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen "
         "fifteen sixteen seventeen eighteen nineteen twenty").split()


class DatabaseMissing(Exception):
    """A fact read from the pinned database, asked for without it."""


@dataclass(frozen=True)
class Fact:
    what: str
    source: str
    read: Callable[[Path], object]
    needs_db: bool = False


def _openapi_routes(root: Path) -> int:
    return len(json.loads((root / "contract" / "openapi.json").read_text(encoding="utf-8"))["paths"])


def _contexts(root: Path) -> int:
    """The bounded contexts: the keys of CONTEXT_TABLES in webapp/serve.py, read as text (importing
    serve would pull in the whole API)."""
    src = (root / "webapp" / "serve.py").read_text(encoding="utf-8")
    m = re.search(r"^CONTEXT_TABLES\s*=\s*\{(.*?)\}\s*$", src, re.M | re.S)
    if not m:
        raise SystemExit("gen_facts: CONTEXT_TABLES not found in webapp/serve.py")
    return len(re.findall(r"'([a-z_]+)'\s*:", m.group(1)))


def _serve_constant(name: str) -> Callable[[Path], str]:
    def read(root: Path) -> str:
        m = re.search(rf"^{name}\s*=\s*'([^']+)'", (root / "webapp" / "serve.py").read_text(encoding="utf-8"), re.M)
        if not m:
            raise SystemExit(f"gen_facts: {name} not found in webapp/serve.py")
        return m.group(1)
    return read


def _dataset_version(root: Path) -> str:
    return json.loads((root / "dataset.lock.json").read_text(encoding="utf-8"))["dataset_version"]


def _contract_records(root: Path) -> int:
    sys.path.insert(0, str(root / "tools"))
    import docs_check  # noqa: E402
    n = docs_check.contract_http_records()
    if n is None:
        raise SystemExit("gen_facts: tools/contract_http.py or contract/_meta.json is missing")
    return n


def _workflows(root: Path) -> int:
    wf = root / ".github" / "workflows"
    return len(list(wf.glob("*.yml")) + list(wf.glob("*.yaml")))


def _db(root: Path) -> sqlite3.Connection:
    db = root / "db" / "sggs.sqlite"
    if not db.exists():
        raise DatabaseMissing(str(db))
    return sqlite3.connect(f"file:{db}?mode=ro&immutable=1", uri=True)


def _meta(key: str, cast=str) -> Callable[[Path], object]:
    def read(root: Path):
        con = _db(root)
        try:
            row = con.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
        finally:
            con.close()
        if row is None:
            raise SystemExit(f"gen_facts: the database has no meta.{key}")
        return cast(row[0])
    return read


def _tables(root: Path) -> int:
    """Tables in the pinned database, counted as the data dictionary counts them (FTS5 shadow
    tables and sqlite_* excluded)."""
    sys.path.insert(0, str(root / "tools"))
    import gen_data_dictionary  # noqa: E402
    _db(root).close()       # raises DatabaseMissing first
    return len(gen_data_dictionary.read(root / "db" / "sggs.sqlite", {})["tables"])


FACTS: dict[str, Fact] = {
    "routes": Fact("API routes the platform serves", "contract/openapi.json (paths)", _openapi_routes),
    "contexts": Fact("bounded contexts of the API", "webapp/serve.py CONTEXT_TABLES", _contexts),
    "app_version": Fact("the platform release (web, API, app)", "webapp/serve.py APP_VERSION", _serve_constant("APP_VERSION")),
    "app_built": Fact("the date of the platform release", "webapp/serve.py APP_BUILT", _serve_constant("APP_BUILT")),
    "dataset_version": Fact("the sggs-data release the pin points at", "dataset.lock.json dataset_version", _dataset_version),
    "contract_records": Fact("golden records replayed over HTTP", "tools/contract_http.py HTTP_SUITES + contract/_meta.json", _contract_records),
    "workflows": Fact("GitHub Actions workflows", ".github/workflows/*.yml", _workflows),
    "tables": Fact("tables in the pinned database", "db/sggs.sqlite (as tools/gen_data_dictionary.py counts them)", _tables, needs_db=True),
    "lines": Fact("printed lines in the pinned database", "db/sggs.sqlite meta.total_lines", _meta("total_lines", int), needs_db=True),
    "angs": Fact("Angs in the pinned database", "db/sggs.sqlite meta.total_angs", _meta("total_angs", int), needs_db=True),
    "db_version": Fact("the build version stamped in the database", "db/sggs.sqlite meta.version", _meta("version"), needs_db=True),
}


def render(value: object, fmt: str | None) -> str:
    if fmt is None:
        return f"{value:,}" if isinstance(value, int) else str(value)
    if not isinstance(value, int):
        raise ValueError(f"format :{fmt} applies to a number, not {value!r}")
    if fmt == "plain":
        return str(value)
    if fmt == "words":
        if not 0 <= value < len(WORDS):
            raise ValueError(f"format :words reaches {len(WORDS) - 1}; {value} is out of range")
        return WORDS[value]
    raise ValueError(f"unknown format :{fmt} (known: plain, words)")


def pages(docs: Path = DOCS) -> list[Path]:
    root = docs.parent
    return [p for p in sorted(docs.rglob("*.md"))
            if not str(p.relative_to(root)).replace("\\", "/").startswith(SKIP_DIRS)]


@dataclass
class Result:
    text: str
    errors: list[str]
    mismatches: list[str]
    skipped: set[str]
    used: int


def process(text: str, where: str, values: dict[str, object], facts: dict[str, Fact] = FACTS) -> Result:
    """Every marker in `text` filled from `values` (name -> value; a needs_db fact absent from it is
    skipped). Returns the rewritten text and what differed."""
    errors, mismatches, skipped, used = [], [], set(), 0
    code = [(c.start(), c.end()) for c in CODE.finditer(text)]
    in_code = lambda at: any(a <= at < b for a, b in code)  # noqa: E731

    def repl(m: re.Match) -> str:
        nonlocal used
        if in_code(m.start()):
            return m.group(0)
        name, fmt, shown = m.group(1), m.group(2), m.group(3)
        line = text.count("\n", 0, m.start()) + 1
        if name not in facts:
            errors.append(f"{where}:{line}: unknown fact {name!r} (known: {', '.join(sorted(facts))})")
            return m.group(0)
        if name not in values:
            skipped.add(name)
            return m.group(0)
        try:
            want = render(values[name], fmt)
        except ValueError as e:
            errors.append(f"{where}:{line}: fact {name!r}: {e}")
            return m.group(0)
        used += 1
        if shown != want:
            mismatches.append(f"{where}:{line}: fact {name!r} says {shown!r}; {facts[name].source} gives {want!r}")
        return m.group(0)[: m.start(3) - m.start()] + want + "<!--/fact-->"

    new = MARKER.sub(repl, text)
    # a marker the pattern did not take (a typo, a value broken over a line, a missing close) is an error
    opened = sum(1 for o in OPEN_MARKER.finditer(text) if not in_code(o.start()))
    if opened != 2 * sum(1 for m in MARKER.finditer(text) if not in_code(m.start())):
        errors.append(f"{where}: a fact marker is malformed — write <!--fact:name-->value<!--/fact--> on one line")
    return Result(new, errors, mismatches, skipped, used)


def values(root: Path = ROOT, facts: dict[str, Fact] = FACTS) -> tuple[dict[str, object], set[str]]:
    out, missing = {}, set()
    for name, f in facts.items():
        try:
            out[name] = f.read(root)
        except DatabaseMissing:
            missing.add(name)
    return out, missing


def main(argv=None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    vals, no_db = values()
    if "--list" in argv:
        for name, f in FACTS.items():
            v = render(vals[name], None) if name in vals else "(needs the database: make dataset)"
            print(f"{name:18} {v:>10}  {f.what} — {f.source}")
        return 0
    check = "--check" in argv
    errors, mismatches, skipped, used, changed = [], [], set(), 0, []
    for p in pages():
        rel = str(p.relative_to(ROOT))
        text = p.read_text(encoding="utf-8")
        if "fact" not in text:
            continue
        r = process(text, rel, vals)
        errors += r.errors
        mismatches += r.mismatches
        skipped |= r.skipped
        used += r.used
        if not check and not r.errors and r.text != text:
            p.write_text(r.text, encoding="utf-8")
            changed.append(rel)
    for e in errors:
        print(f"::error::{e}")
    if skipped:
        print(f"::notice::gen_facts: skipped {', '.join(sorted(skipped))} — {DB.relative_to(ROOT)} is not installed (make dataset)")
    if check:
        for m in mismatches:
            print(f"::error::{m} — run: python3 tools/gen_facts.py --write")
        print(f"gen_facts: {used} marked value(s), {len(mismatches)} stale, {len(errors)} error(s)")
        return 1 if errors or mismatches else 0
    for c in changed:
        print(f"  updated {c}")
    print(f"gen_facts: {used} marked value(s), {len(changed)} page(s) rewritten, {len(errors)} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
