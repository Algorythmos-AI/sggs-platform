#!/usr/bin/env python3
"""Check the contributors roster (frontend/public/contributors.json, schema v2) against the corpus.

    python3 tools/check_contributors.py                    # CI gate (testflight / web channel)
    python3 tools/check_contributors.py --channel appstore # also refuses any entry not yet approved (gate G3)

The roster is presentation data over the verbatim corpus. This gate proves it never claims more than the
corpus and its cited sources support:

- every `name` joins to the DB `authors` table, and every DB author has an entry. The voices the attribution
  repair in sggs-data adds (PENDING_ATTRIBUTION) only warn while the pinned DB does not yet carry them;
- every `notable[].comp_id` resolves, and its `anchor` text is in that composition verbatim;
- every `chhap` form occurs verbatim, as whole words, in that voice's own verses (corpus-wide while the voice
  is pending), and `chhap_example` is a verse that carries one;
- every life fact (born, died, birthplace, place, range_note, fl_century, context, disputed) is supported by a
  tier-2 source (EoS, Darpan, SGPC) whose `supports` names it. The corpus (SGGS) proves only corpus facts;
- an `attribution_note` (where the pinned corpus files a voice's lines today) cites the corpus (SGGS);
- the old app's fields keep their types, map pins agree with the declared projection, and review states are
  well formed. Stdlib only; exit 1 on any error.
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROSTER = ROOT / "frontend" / "public" / "contributors.json"
DB = ROOT / "db" / "sggs.sqlite"

EXPECTED = 36
# Voices the sggs-data attribution repair adds to `authors`; until the pinned DB carries them, a missing join warns.
PENDING_ATTRIBUTION = {
    "Bhagat Dhanna Ji", "Bhagat Sain Ji", "Bhagat Pipa Ji", "Bhagat Sadhna Ji",
    "Bhagat Parmanand Ji", "Bhagat Surdas Ji", "Baba Sundar Ji",
}
KINDS = {"guru", "bhagat", "bhatt", "gursikh"}
TIER2 = {"EoS", "Darpan", "SGPC"}
LIFE_FACTS = ("born", "died", "birthplace", "place", "range_note", "fl_century", "context", "disputed")
REVIEW = {"draft", "pending", "approved"}
GURMUKHI = re.compile(r"^[਀-੿ ]+$")
SPLIT = re.compile(r"[\s॥]+")


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.joined: tuple[int, int] | None = None

    def error(self, who: str, msg: str) -> None:
        self.errors.append(f"{who}: {msg}")

    def warn(self, who: str, msg: str) -> None:
        self.warnings.append(f"{who}: {msg}")


def words(text: str) -> str:
    """A line as space-separated words, padded, so a form matches only as whole words."""
    return " " + " ".join(w for w in SPLIT.split(text or "") if w) + " "


def has_form(text: str, form: str) -> bool:
    return words(form) in words(text)


def check_shape(c: dict, rep: Report) -> None:
    who = c.get("name") or "?"
    for key in ("name", "roman", "era", "region", "tradition", "blurb"):          # the shipped app decodes these as String
        if not isinstance(c.get(key), str) or not c[key].strip():
            rep.error(who, f"`{key}` must be a non-empty string")
    if c.get("kind") not in KINDS:
        rep.error(who, f"`kind` must be one of {sorted(KINDS)}")
    if not isinstance(c.get("circa"), bool):
        rep.error(who, "`circa` must be a boolean")
    for key in ("seq", "born", "died", "fl_century"):
        if c.get(key) is not None and (not isinstance(c[key], int) or isinstance(c[key], bool)):
            rep.error(who, f"`{key}` must be an integer or null")
    if c.get("kind") == "guru" and not c.get("seq"):
        rep.error(who, "a Guru needs `seq`")
    born, died = c.get("born"), c.get("died")
    if born and died and born >= died:
        rep.error(who, f"born {born} is not before died {died}")
    if born is None and died is None and not c.get("range_note"):
        rep.error(who, "no dates: say why in `range_note`")
    for key in ("display", "gurmukhi"):
        if not isinstance(c.get(key), str) or not c[key].strip():
            rep.error(who, f"`{key}` must be a non-empty string")
    if isinstance(c.get("gurmukhi"), str) and not GURMUKHI.match(c["gurmukhi"]):
        rep.error(who, "`gurmukhi` must be Gurmukhi letters and spaces only")
    if not isinstance(c.get("chhap"), list) or not all(isinstance(f, str) and GURMUKHI.match(f) for f in c["chhap"]):
        rep.error(who, "`chhap` must be a list of Gurmukhi strings")
    if not isinstance(c.get("context"), str) or not c["context"].strip():
        rep.error(who, "`context` is required")


def check_sources(c: dict, index: dict, rep: Report) -> None:
    who = c["name"]
    sources = c.get("sources") or []
    if not sources:
        rep.error(who, "no `sources`")
    supported: set[str] = set()
    for s in sources:
        if s.get("ref") not in index:
            rep.error(who, f"source ref {s.get('ref')!r} is not in source_index")
        if not str(s.get("entry") or "").strip():
            rep.error(who, f"source {s.get('ref')} names no entry")
        if s.get("ref") in TIER2:
            supported.update(s.get("supports") or [])
    for fact in LIFE_FACTS:
        if c.get(fact) not in (None, "", []) and fact not in supported:
            rep.error(who, f"`{fact}` has no tier-2 source (EoS, Darpan, SGPC) that supports it")
    if c.get("attribution_note") and not any(s.get("ref") == "SGGS" for s in sources):
        rep.error(who, "`attribution_note` must cite the corpus (an SGGS source)")
    r = c.get("review") or {}
    if r.get("status") not in REVIEW:
        rep.error(who, f"review.status must be one of {sorted(REVIEW)}")
    if r.get("status") == "approved" and not (r.get("reviewer") and r.get("date")):
        rep.error(who, "an approved entry names its reviewer and date")


def check_place(c: dict, proj: dict, rep: Report) -> None:
    p = c.get("place")
    if p is None:
        return
    who = c["name"]
    if not (p.get("label") and p.get("approx") is True):
        rep.error(who, "a place needs a label and approx: true")
    x, y = p.get("x"), p.get("y")
    if not all(isinstance(v, (int, float)) and 0 <= v <= 1 for v in (x, y)):
        rep.error(who, "place x/y must lie in 0..1")
        return
    if "lat" in p and "lon" in p:
        (lon0, lon1), (lat0, lat1) = proj["lon"], proj["lat"]
        ex, ey = (p["lon"] - lon0) / (lon1 - lon0), (lat1 - p["lat"]) / (lat1 - lat0)
        if abs(ex - x) > 1e-3 or abs(ey - y) > 1e-3:
            rep.error(who, f"place x/y ({x}, {y}) disagree with lat/lon ({ex:.4f}, {ey:.4f})")


def check_corpus(c: dict, db: sqlite3.Connection, authors: set[str], rep: Report) -> None:
    who = c["name"]
    in_db = who in authors
    if not in_db:
        if who in PENDING_ATTRIBUTION:
            rep.warn(who, "not yet an author in the pinned DB (awaits the sggs-data attribution repair)")
        else:
            rep.error(who, "`name` does not join to the DB authors table")
    own = [r[0] for r in db.execute("SELECT gurmukhi FROM lines WHERE is_header=0 AND author=?", (who,))] if in_db else []
    for form in c.get("chhap") or []:
        if in_db:
            if not any(has_form(t, form) for t in own):
                rep.error(who, f"chhap {form} is not found in this voice's verses")
        elif not any(has_form(t, form) for (t,) in db.execute(
                "SELECT gurmukhi FROM lines WHERE is_header=0 AND gurmukhi LIKE ?", (f"%{form}%",))):
            rep.error(who, f"chhap {form} is not found anywhere in the corpus")
    ex = c.get("chhap_example")
    if c.get("chhap") and not ex:
        rep.error(who, "a chhap needs a `chhap_example` verse")
    if ex:
        row = db.execute("SELECT ang, author, gurmukhi, is_header FROM lines WHERE id=?", (ex.get("line_id"),)).fetchone()
        if not row:
            rep.error(who, f"chhap_example line {ex.get('line_id')} does not exist")
        else:
            ang, author, text, is_header = row
            if ang != ex.get("ang"):
                rep.error(who, f"chhap_example line {ex['line_id']} is on Ang {ang}, not {ex.get('ang')}")
            if is_header or not any(has_form(text, f) for f in c.get("chhap") or []):
                rep.error(who, f"chhap_example line {ex['line_id']} carries none of the chhap forms")
            if author != who:
                (rep.warn if not in_db else rep.error)(who, f"chhap_example line {ex['line_id']} is credited to {author!r}")
    for n in c.get("notable") or []:
        cid = n.get("comp_id")
        rows = db.execute("SELECT ang, author, gurmukhi FROM lines WHERE comp_id=?", (cid,)).fetchall()
        if not rows:
            rep.error(who, f"notable {n.get('title')!r}: comp_id {cid} does not resolve")
            continue
        if not n.get("anchor") or not any(n["anchor"] in t for _, _, t in rows):
            rep.error(who, f"notable {n.get('title')!r}: anchor {n.get('anchor')!r} is not in comp {cid}")
        angs = [a for a, _, _ in rows]
        if n.get("ang") is not None and not min(angs) <= n["ang"] <= max(angs):
            rep.error(who, f"notable {n.get('title')!r}: Ang {n['ang']} is outside comp {cid} (Angs {min(angs)}–{max(angs)})")
        if who not in {a for _, a, _ in rows}:
            rep.warn(who, f"notable {n.get('title')!r}: comp {cid} has no lines credited to this voice yet")


def run(roster_path: Path, db_path: Path | None, channel: str) -> Report:
    rep = Report()
    doc = json.loads(roster_path.read_text(encoding="utf-8"))
    rows = doc.get("contributors") or []
    index = doc.get("source_index") or {}
    proj = doc.get("map") or {"lon": [0, 1], "lat": [0, 1]}
    names = [c.get("name") for c in rows]
    if len(rows) != EXPECTED:
        rep.error("roster", f"{len(rows)} entries, expected {EXPECTED}")
    for dup in sorted({n for n in names if names.count(n) > 1}):
        rep.error(dup, "duplicate name")
    for c in rows:
        check_shape(c, rep)
        if c.get("name"):
            check_sources(c, index, rep)
            check_place(c, proj, rep)
        if channel == "appstore" and (c.get("review") or {}).get("status") != "approved":
            rep.error(c.get("name") or "?", "the appstore channel ships only approved entries (gate G3)")
    if db_path is not None:
        db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        authors = {r[0] for r in db.execute("SELECT name FROM authors WHERE name IS NOT NULL")}
        for missing in sorted(authors - set(names)):
            rep.error(missing, "DB author has no roster entry")
        for c in rows:
            if c.get("name"):
                check_corpus(c, db, authors, rep)
        rep.joined = (len(set(names) & authors), len(rows))
    return rep


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--roster", type=Path, default=ROSTER)
    ap.add_argument("--db", type=Path, default=DB)
    ap.add_argument("--no-db", action="store_true", help="skip the corpus joins (shape and sources only)")
    ap.add_argument("--channel", choices=("testflight", "appstore"), default="testflight")
    args = ap.parse_args(argv)
    if not args.no_db and not args.db.exists():
        print(f"::error::{args.db} is missing; run `make dataset` (or pass --no-db)")
        return 1
    rep = run(args.roster, None if args.no_db else args.db, args.channel)
    if rep.joined:
        print(f"check_contributors: {rep.joined[0]}/{rep.joined[1]} names join to the DB authors table")
    rel = args.roster.relative_to(ROOT) if args.roster.is_relative_to(ROOT) else args.roster
    for w in rep.warnings:
        print(f"::warning file={rel}::{w}")
    for e in rep.errors:
        print(f"::error file={rel}::{e}")
    print(f"check_contributors ({args.channel}): {len(rep.errors)} error(s), {len(rep.warnings)} warning(s)")
    return 1 if rep.errors else 0


if __name__ == "__main__":
    sys.exit(main())
