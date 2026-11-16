#!/usr/bin/env python3
"""Before a Hukamnama service deploy: will every published day still prove in the new corpus?

    python3 scripts/ci/hukamnama_preflight.py API_URL --db db/sggs.sqlite

A published day is a range of line ids and the hash of its lines. A dataset bump that moved or
changed any of those lines would leave the service unable to serve that day (it refuses text that
does not prove). This reads every published day from the running service and proves its range
against the database this commit pins, before anything is deployed.

Exit 0 when every day proves (or none is published yet), 1 when any does not, 2 when the service
could not be read. Standard library only.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import sys
import urllib.error
import urllib.request

UA = "GurbaniSoul-Hukamnama-preflight/1.0"
MAX_LINES = 400


def proves(con: sqlite3.Connection, rec: dict) -> str | None:
    """None when the record's range hashes to its range_sha256 in this database, else why not."""
    first, last, want = rec.get("first_line_id"), rec.get("last_line_id"), rec.get("range_sha256")
    if type(first) is not int or type(last) is not int or not isinstance(want, str) or not 0 <= last - first < MAX_LINES:
        return "malformed record"
    rows = con.execute("SELECT id, gurmukhi FROM lines WHERE id BETWEEN ? AND ? ORDER BY id", (first, last)).fetchall()
    if [r[0] for r in rows] != list(range(first, last + 1)):
        return f"lines {first}-{last} are not all in this database"
    got = hashlib.sha256("\n".join(r[1] or "" for r in rows).encode("utf-8")).hexdigest()
    return None if got == want else f"lines {first}-{last} hash to {got[:12]}, published as {want[:12]}"


def check(con: sqlite3.Connection, records: list[dict]) -> list[str]:
    out = []
    for rec in records:
        why = proves(con, rec)
        if why:
            out.append(f"{rec.get('amritsar_date')}: {why}")
    return out


def get(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=30) as r:   # noqa: S310 - our own https URL
        return json.load(r)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("api_url")
    p.add_argument("--db", required=True)
    args = p.parse_args(argv)
    base = args.api_url.rstrip("/")
    try:
        days = [d["amritsar_date"] for d in get(f"{base}/v1/hukamnama/index").get("days", [])]
        records = [get(f"{base}/v1/hukamnama/{d}") for d in days]
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError) as e:
        print(f"could not read the published days: {type(e).__name__}: {e}")
        return 2
    missing = [r.get("amritsar_date") for r in records if r.get("status") != "published"]
    if missing:
        print(f"the index lists days the service does not serve as published: {missing}")
        return 1
    con = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
    try:
        wrong = check(con, records)
    finally:
        con.close()
    if wrong:
        print(f"{len(wrong)} of {len(records)} published day(s) would not prove after this deploy:")
        for w in wrong:
            print(f"  - {w}")
        return 1
    print(f"all {len(records)} published day(s) prove in this commit's database")
    return 0


if __name__ == "__main__":
    sys.exit(main())
