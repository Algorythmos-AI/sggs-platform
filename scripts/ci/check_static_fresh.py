#!/usr/bin/env python3
"""
check_static_fresh.py [--dist DIR] [--static DIR] [--annotate error|warning] — is the committed
webapp/static the build of this commit?

webapp/static is tracked: serve.py serves it and the repo gates in webapp/tests read it, but
nothing rebuilds it on the way to a merge, so it can lag frontend/src without any check noticing.
Run after `npm run build`: this compares the build's text assets (HTML, CSS, JS, XML, JSON, the
web manifest) with the committed copy, byte for byte, and lists what is missing, stale or
different. Images and fonts are left out — an encoder may produce different bytes per platform.

Exit 0 when identical; 1 with a GitHub annotation when not (`--annotate warning` while the check
is report-only in CI); 2 when a directory is missing or the build is empty. The committed copy is
built with no PUBLIC_* variable set (the App Store and newsletter switches are Vercel-only), so a
set one is named in the report. Refresh the copy with `cd frontend && npm run build:deploy`.
"""
import argparse, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEXT = {".html", ".css", ".js", ".xml", ".json", ".webmanifest"}
SHOWN = 20          # paths listed per group before "… and N more"

def text_assets(root):
    """{relative posix path: bytes} for every text asset under root."""
    return {p.relative_to(root).as_posix(): p.read_bytes()
            for p in sorted(Path(root).rglob("*")) if p.is_file() and p.suffix in TEXT}

def compare(built, committed):
    """(missing, stale, changed): only in the build, only in the committed copy, different bytes."""
    return (sorted(built.keys() - committed.keys()), sorted(committed.keys() - built.keys()),
            sorted(k for k in built.keys() & committed.keys() if built[k] != committed[k]))

def first_difference(a, b, width=72):
    """(offset, excerpt of a, excerpt of b) where two files part — minified HTML is one long line,
    so a line diff says nothing; a few bytes either side of the first difference do."""
    n = len(os.path.commonprefix([a, b]))
    lo = max(0, n - width // 3)
    return n, a[lo:lo + width].decode("utf-8", "replace"), b[lo:lo + width].decode("utf-8", "replace")

def report(built, committed, out=print):
    """Print the comparison; return the number of text assets that are not identical."""
    missing, stale, changed = compare(built, committed)
    def group(title, mark, paths, detail=None):
        if not paths:
            return
        out(f"  {title}: {len(paths)}")
        for p in paths[:SHOWN]:
            out(f"    {mark} {p}")
            if detail:
                detail(p)
        if len(paths) > SHOWN:
            out(f"    … and {len(paths) - SHOWN} more")
    def where(p):
        n, a, b = first_difference(built[p], committed[p])
        out(f"        build {len(built[p]):,} B, committed {len(committed[p]):,} B; first difference at byte {n:,}")
        out(f"        build:     {a!r}")
        out(f"        committed: {b!r}")
    out(f"static freshness: {len(built)} text assets in the build, {len(committed)} in the committed copy")
    group("missing from the committed copy (in the build only)", "+", missing)
    group("stale in the committed copy (not in the build)", "-", stale)
    group("different", "~", changed, where)
    return len(missing) + len(stale) + len(changed)

def main(argv=None, env=None):
    ap = argparse.ArgumentParser(description="Is the committed webapp/static the build of this commit?")
    ap.add_argument("--dist", type=Path, default=ROOT / "frontend" / "dist", help="the fresh build")
    ap.add_argument("--static", type=Path, default=ROOT / "webapp" / "static", help="the committed copy")
    ap.add_argument("--annotate", choices=["error", "warning"], default="error",
                    help="GitHub annotation level when the copy is not fresh (warning = report-only)")
    a = ap.parse_args(argv)
    for d in (a.dist, a.static):
        if not d.is_dir():
            print(f"::error::{d} does not exist — build first (cd frontend && npm run build)"); return 2
    built, committed = text_assets(a.dist), text_assets(a.static)
    if not built:
        print(f"::error::no text assets under {a.dist} — the build is empty"); return 2
    drift = report(built, committed)
    if not drift:
        print("static freshness: OK — the committed copy is this commit's build"); return 0
    public = sorted(k for k, v in (os.environ if env is None else env).items() if k.startswith("PUBLIC_") and v)
    if public:
        print(f"  note: {', '.join(public)} set in this environment — the committed copy is built with none")
    print(f"::{a.annotate}::webapp/static is not the build of this commit ({drift} text assets differ) — "
          "run `cd frontend && npm run build:deploy` and commit webapp/static")
    return 1

if __name__ == "__main__":
    sys.exit(main())
