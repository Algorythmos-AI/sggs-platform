#!/usr/bin/env python3
"""Generate the OpenAPI 3.1 spec of the public Hukamnama API (contract/hukamnama.openapi.json).

    python3 tools/gen_hukamnama_openapi.py [--check]

The API is two programs: the Hukamnama service writes one file per published day
(services/hukamnama, ``public.py``) and an edge Worker serves them (services/hukamnama-edge,
``core.js``). This generator runs both. It publishes three days in a temporary store from the
pinned corpus, lets the service write its snapshot (once without and once with the English
layer), sends the sample requests below through the Worker's real handler (``node
scripts/sample.mjs``), and infers every response schema from what came back. So the spec cannot
describe a field that is not served, and ``--check`` (run by the Hukamnama tests) fails when
either program changes what it answers.

What is written by hand here: each route's one-sentence description and parameters, and one
sentence per field (``FIELDS``). A served field without a sentence fails the build.

Needs db/sggs.sqlite (``make dataset``) and ``node`` (the version in .nvmrc).
"""
import json
import shutil
import subprocess
import sys
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "hukamnama"))
sys.path.insert(0, str(ROOT / "tools"))

from hukamnama.corpus import open_ro, resolution_for_range, scripture_sha256   # noqa: E402
from hukamnama.public import DirSink, Publisher                                 # noqa: E402
from hukamnama.store import Store                                               # noqa: E402

OUT = ROOT / "contract" / "hukamnama.openapi.json"
DB = ROOT / "db" / "sggs.sqlite"
EDGE = ROOT / "services" / "hukamnama-edge"
SERVER = "https://api.gurbanisoul.com"
API_CONTRACT_VERSION = "1.0.0"     # bump only for an API change; version 1 only grows
TERMS = "https://gurbanisoul.com/en/developers#terms"

# The days published for the samples: (Amritsar date, first line id, last line id).
DAYS = [
    (date(2026, 11, 9), 29237, 29247),     # Ang 673: one author
    (date(2026, 11, 10), 29497, 29503),    # Ang 680: one author, with the Rahao line
    (date(2026, 11, 11), 20889, 20896),    # Ang 463: two saloks by two authors, so the day has no single author
]
PUBLISHED_AT = datetime(2026, 11, 9, 0, 25, 3, tzinfo=timezone.utc)
CORRECTED_AT = datetime(2026, 11, 9, 6, 0, 0, tzinfo=timezone.utc)
TODAY = "2026-11-11T02:00:00Z"             # 07:30 in Amritsar on the 11th: today is published
BEFORE = "2026-11-12T00:10:00Z"            # 05:40 in Amritsar on the 12th: today has no file yet


# ----------------------------------------------------------------------------- inference
# The same rules as tools/gen_openapi.py (kept here so this generator does not import the web API).
def _merge(a, b):
    if a == b:
        return a
    ta, tb = a.get("type"), b.get("type")
    if ta == tb == "object" and "properties" in a and "properties" in b:
        props = dict(a["properties"])
        for k, v in b["properties"].items():
            props[k] = _merge(props[k], v) if k in props else v
        req = sorted(set(a.get("required", [])) & set(b.get("required", [])))
        return {"type": "object", "properties": props, "required": req}
    if ta == tb == "array":
        return {"type": "array", "items": _merge(a.get("items", {}), b.get("items", {}))}
    variants = []
    for s in (a.get("anyOf") or [a]) + (b.get("anyOf") or [b]):
        if s and s not in variants:
            variants.append(s)
    return {"anyOf": sorted(variants, key=lambda s: json.dumps(s, sort_keys=True))} if len(variants) > 1 else variants[0]


def infer(v):
    if v is None:
        return {"type": "null"}
    if isinstance(v, bool):
        return {"type": "boolean"}
    if isinstance(v, int):
        return {"type": "integer"}
    if isinstance(v, str):
        return {"type": "string"}
    if isinstance(v, list):
        items = {}
        for x in v:
            s = infer(x)
            items = _merge(items, s) if items else s
        return {"type": "array", "items": items}
    if isinstance(v, dict):
        return {"type": "object", "properties": {k: infer(x) for k, x in v.items()}, "required": sorted(v)}
    raise TypeError(f"unexpected value in a response: {v!r}")


def merged(bodies):
    schema = {}
    for b in bodies:
        s = infer(b)
        schema = _merge(schema, s) if schema else s
    return schema


# ----------------------------------------------------------------------------- the two programs
def snapshots(tmp: Path) -> dict[str, Path]:
    """Publish DAYS and let the service write its public files: without and with the English layer."""
    con = open_ro(str(DB))
    try:
        fp = scripture_sha256(con)
        store = Store(str(tmp / "store.sqlite"))
        for day, first, last in DAYS:
            store.publish(day, resolution_for_range(con, first, last), fp, PUBLISHED_AT, "auto")
        # one day was corrected by the owner, so `corrected_at` is in the samples (and optional)
        day, first, last = DAYS[0]
        store.correct(day, resolution_for_range(con, first, last), fp, CORRECTED_AT, "owner", "sample")
        out = {}
        for name, meaning in (("plain", False), ("meaning", True)):
            out[name] = tmp / name
            report = Publisher(store, con, fp, DirSink(str(out[name])), meaning=meaning).sync(force=True)
            if report.get("skipped"):
                raise SystemExit(f"a sample day did not prove: {report['skipped']}")
        return out
    finally:
        con.close()


def ask(snapshot: Path, requests: list[dict]) -> list[dict]:
    node = shutil.which("node")
    if not node:
        raise SystemExit("node is not installed: the Worker's handler cannot be run (see .nvmrc)")
    res = subprocess.run([node, str(EDGE / "scripts" / "sample.mjs"), str(snapshot)], input=json.dumps(requests),
                         capture_output=True, text=True, check=False)
    if res.returncode != 0:
        raise SystemExit(f"the Worker sampler failed:\n{res.stderr}")
    return json.loads(res.stdout)


D = DAYS[1][0].isoformat()
REQUESTS = {
    # name: (path, now)
    "today": ("/v1/hukamnama/today", TODAY),
    "today_pending": ("/v1/hukamnama/today", BEFORE),
    "day": (f"/v1/hukamnama/{D}", TODAY),
    "day_first": (f"/v1/hukamnama/{DAYS[0][0].isoformat()}", TODAY),
    "day_pending": ("/v1/hukamnama/2026-11-05", TODAY),
    "list": ("/v1/hukamnama?limit=2", TODAY),
    "list_default": ("/v1/hukamnama", TODAY),
    "list_lines": ("/v1/hukamnama?limit=3&include=lines", TODAY),
    "index": ("/v1/hukamnama/index", TODAY),
    "status": ("/v1/status", TODAY),
    "status_pending": ("/v1/status", BEFORE),
    "bad_date": ("/v1/hukamnama/11-11-2026", TODAY),
    "future": ("/v1/hukamnama/2026-12-25", TODAY),
    "too_early": ("/v1/hukamnama/2026-10-01", TODAY),
    "bad_limit": ("/v1/hukamnama?limit=99", TODAY),
}
# The same API before anything is published (an empty bucket): what is `null` then.
EMPTY = {
    "empty_today": ("/v1/hukamnama/today", TODAY),
    "empty_list": ("/v1/hukamnama", TODAY),
    "empty_index": ("/v1/hukamnama/index", TODAY),
    "empty_status": ("/v1/status", TODAY),
}


def samples() -> dict[str, list[dict]]:
    """name -> the answers to that request, from each snapshot."""
    with tempfile.TemporaryDirectory() as t:
        dirs = snapshots(Path(t))
        reqs = [{"path": p, "now": now} for p, now in REQUESTS.values()]
        out: dict[str, list[dict]] = {k: [] for k in (*REQUESTS, *EMPTY)}
        for d in dirs.values():
            for name, ans in zip(REQUESTS, ask(d, reqs)):
                out[name].append(ans)
        empty = Path(t) / "empty"
        empty.mkdir()
        for name, ans in zip(EMPTY, ask(empty, [{"path": p, "now": now} for p, now in EMPTY.values()])):
            out[name].append(ans)
        return out


# ----------------------------------------------------------------------------- the words
DATE = {"type": "string", "format": "date", "description": "A date in Amritsar, YYYY-MM-DD."}
FIELDS = {
    "Hukamnama": {
        "amritsar_date": "The day this Hukamnama belongs to, in Amritsar (UTC+05:30). Show this date, never the reader's.",
        "status": "Always `published` here.",
        "ang": "The Ang the shabad opens on.",
        "ang_end": "The Ang the shabad ends on.",
        "first_line_id": "The corpus id of the first line of the range.",
        "last_line_id": "The corpus id of the last line of the range.",
        "comp_id": "The corpus id of the composition the opening verse belongs to.",
        "opening_line_id": "The corpus id of the first verse (the line after any heading).",
        "opening_gurmukhi": "The first verse, verbatim.",
        "opening_translit": "The first verse in the corpus's rule-based transliteration.",
        "line_count": "How many lines the range holds, headings included.",
        "range_sha256": "SHA-256 of every line's `gurmukhi` joined by a newline (UTF-8). Check it before showing the text.",
        "scripture_sha256": "The fingerprint of the edition of the text the lines were read from.",
        "citation": "The citation to show with the text: “Sri Guru Granth Sahib Ji · Ang N”.",
        "published_at": "When the day was published here, in UTC, without fractional seconds.",
        "credit": "How the day was located and where its text is from.",
        "corrected_at": "Present only when the day's range was corrected after it was published: when, in UTC. "
                        "`published_at` stays the first publication.",
        "raag": "The raag of the opening verse, as the corpus names it.",
        "author": "The author, when every verse of the day has the same one; `null` when they differ, as in a Vaar.",
        "url": "The day's page on gurbanisoul.com.",
        "attribution": "The credit to show wherever the Hukamnama appears, with its link.",
        "terms_url": "The terms of use.",
        "lines": "Every line of the range, in order.",
        "translation": "Present only when the lines carry `en`: whose translation it is.",
    },
    "Line": {
        "id": "The corpus id of the line.",
        "ang": "The Ang the line is on.",
        "gurmukhi": "The line, verbatim. Never alter, shorten or re-space it.",
        "translit": "A rule-based transliteration: a reading aid, not the text.",
        "is_heading": "True for a heading line (a raag or author heading), false for a verse.",
        "is_rahao": "True for the Rahao line.",
        "author": "The author of this line.",
        "en": "Dr. Sant Singh Khalsa's English translation of the line, when the English layer is included. "
              "A separate, labelled layer: never present it as the Gurbani.",
    },
    "Attribution": {"text": "The words of the credit.", "url": "The link the credit carries."},
    "Translation": {"lang": "The translation's language.", "translator": "The translator.", "source": "The edition it comes from."},
    "Pending": {
        "amritsar_date": "The day asked for, in Amritsar.",
        "status": "Always `pending` here: no Hukamnama is published for this day (not yet, or it was held back).",
        "scripture_sha256": "The fingerprint of the edition of the text the published days were read from; `null` before any day is published.",
        "expected_by": "05:30 in Amritsar on that day, in UTC: about when a day's Hukamnama first appears.",
        "latest": "The most recent published date, or `null` when there is none.",
    },
    "IndexDay": {
        "amritsar_date": "The published day, in Amritsar.",
        "ang": "The Ang the shabad opens on.",
        "raag": "The raag of the opening verse.",
        "author": "The day's single author, or `null` when its verses have more than one.",
        "line_count": "How many lines the day holds.",
        "range_sha256": "The hash that proves the day's lines.",
        "published_at": "When the day was published here, in UTC.",
        "corrected_at": "Present only when the day was corrected after it was published: when, in UTC.",
    },
    "Index": {
        "scripture_sha256": "The fingerprint of the edition of the text; `null` before any day is published.",
        "latest": "The most recent published date, or `null` when there is none.",
        "days": "Every published day up to today in Amritsar, newest first.",
    },
    "List": {"items": "The latest published days, newest first. Each is a Hukamnama; `lines` and `translation` "
                      "are present only with `include=lines`."},
    "Status": {
        "ok": "True when the API could read its files.",
        "amritsar_date": "Today's date in Amritsar.",
        "status_today": "`published` once today's Hukamnama is here, else `pending`.",
        "published_at": "When today's was published, or `null`.",
        "latest": "The most recent published date, or `null` when there is none.",
        "scripture_sha256": "The fingerprint of the edition of the text; `null` before any day is published.",
        "paused": "True while the service is paused by its owner: every day then reads as `pending`.",
    },
    "Error": {
        "error": "What went wrong, in a few words.",
        "code": "A stable code: `invalid_request`, `not_found`, `method_not_allowed`, `rate_limited` or `unavailable`.",
        "request_id": "An id to quote when reporting a problem.",
    },
}
ENUMS = {("Hukamnama", "status"): ["published"], ("Pending", "status"): ["pending"],
         ("Status", "status_today"): ["published", "pending"]}
FORMATS = {"amritsar_date": "date", "latest": "date", "published_at": "date-time", "expected_by": "date-time",
           "corrected_at": "date-time",
           "url": "uri", "terms_url": "uri"}


def describe(name: str, schema: dict) -> dict:
    """Add the sentence for each served field; fail when a field has none, or a sentence has no field."""
    props = schema.get("properties", {})
    words = FIELDS[name]
    if set(props) != set(words):
        raise SystemExit(f"{name}: fields served and fields described differ: "
                         f"undescribed {sorted(set(props) - set(words))}, not served {sorted(set(words) - set(props))}")
    for k, s in props.items():
        target = s
        if (name, k) in ENUMS and s.get("type") == "string":
            s["enum"] = ENUMS[(name, k)]
        if k in FORMATS:
            for part in (s.get("anyOf") or [s]):
                if part.get("type") == "string":
                    part["format"] = FORMATS[k]
        target["description"] = words[k]
    return schema


def ref(name):
    return {"$ref": f"#/components/schemas/{name}"}


def components(got: dict) -> dict:
    def bodies(*names, status=200):
        out = []
        for n in names:
            for ans in got[n]:
                if ans["status"] != status:
                    raise SystemExit(f"sample {n} answered {ans['status']}, expected {status}")
                out.append(ans["body"])
        return out

    day = merged(bodies("today", "day", "day_first") + [i for b in bodies("list_lines") for i in b["items"]])
    line = day["properties"]["lines"]["items"]
    attribution = day["properties"]["attribution"]
    translation = day["properties"]["translation"]
    day["properties"]["lines"] = {"type": "array", "items": ref("Line")}
    day["properties"]["attribution"] = ref("Attribution")
    day["properties"]["translation"] = ref("Translation")
    # The list without include=lines is the same record less its lines: prove it rather than say it.
    if any(b["items"] for b in bodies("empty_list")):
        raise SystemExit("an empty bucket listed a day")
    summary = merged([i for b in bodies("list", "list_default") for i in b["items"]])
    extra = set(summary["properties"]) - set(day["properties"])
    if extra or {"lines", "translation"} & set(summary["properties"]):
        raise SystemExit(f"a listed day is not a Hukamnama without its lines: {sorted(extra)}")

    index = merged(bodies("index", "empty_index"))
    index_day = index["properties"]["days"]["items"]
    index["properties"]["days"] = {"type": "array", "items": ref("IndexDay")}
    listing = {"type": "object", "required": ["items"],
               "properties": {"items": {"type": "array", "items": ref("Hukamnama")}}}
    errors = [a["body"] for n in ("bad_date", "future", "too_early", "bad_limit") for a in got[n]]
    for n, want in (("bad_date", 400), ("future", 404), ("too_early", 404), ("bad_limit", 400)):
        if {a["status"] for a in got[n]} != {want}:
            raise SystemExit(f"sample {n} did not answer {want}")
    out = {
        "Hukamnama": describe("Hukamnama", day),
        "Line": describe("Line", line),
        "Attribution": describe("Attribution", attribution),
        "Translation": describe("Translation", translation),
        "Pending": describe("Pending", merged(bodies("today_pending", "day_pending", "empty_today"))),
        "Index": describe("Index", index),
        "IndexDay": describe("IndexDay", index_day),
        "List": describe("List", listing),
        "Status": describe("Status", merged(bodies("status", "status_pending", "empty_status"))),
        "Error": describe("Error", merged(errors)),
    }
    # In a listing without include=lines a Hukamnama has no lines: only then is `lines` absent.
    out["Hukamnama"]["required"] = sorted(set(out["Hukamnama"]["required"]) - {"lines"})
    return out


def cache_of(got, name):
    values = {a["cache"] for a in got[name]}
    if len(values) != 1:
        raise SystemExit(f"sample {name}: cache policy differs between runs: {values}")
    return values.pop()


def build() -> dict:
    got = samples()
    for name, answers in got.items():
        for a in answers:
            if a["cors"] != "*":
                raise SystemExit(f"sample {name}: the answer is not open to every origin")
            if (a["status"] == 200) != a["etag"]:
                raise SystemExit(f"sample {name}: an ETag must be on every 200 and only there")

    def js(schema):
        return {"application/json": {"schema": schema}}

    def err(desc):
        return {"description": desc, "content": js(ref("Error"))}

    common = {
        "429": {**err("Too many requests from one address. Wait for the seconds in `Retry-After`."),
                "headers": {"Retry-After": {"schema": {"type": "integer"}, "description": "Seconds to wait."}}},
        "503": {**err("The API cannot read its files right now. Nothing is served rather than something unproved."),
                "headers": {"Retry-After": {"schema": {"type": "integer"}, "description": "Seconds to wait."}}},
    }
    etag = {"ETag": {"schema": {"type": "string"}, "description": "A strong validator. Send it back in `If-None-Match`; "
                                                                  "an unchanged answer is `304` with no body."}}

    def ok(schema, desc, cache):
        return {"description": desc, "content": js(schema),
                "headers": {**etag, "Cache-Control": {"schema": {"type": "string"}, "description": cache}}}

    one_day = {"oneOf": [ref("Hukamnama"), ref("Pending")], "discriminator": {"propertyName": "status",
               "mapping": {"published": "#/components/schemas/Hukamnama", "pending": "#/components/schemas/Pending"}}}
    limit = {"name": "limit", "in": "query", "required": False,
             "schema": {"type": "integer", "minimum": 1, "maximum": 30, "default": 7},
             "description": "How many days to return."}
    include = {"name": "include", "in": "query", "required": False, "schema": {"type": "string", "enum": ["lines"]},
               "description": "`lines` adds every line of each day (and the English layer where it is included)."}
    when = {"name": "date", "in": "path", "required": True, "schema": {"type": "string", "format": "date"},
            "description": "The day in Amritsar, YYYY-MM-DD: from 2026-11-01 up to today there."}

    def op(op_id, summary, description, responses, params=()):
        return {"get": {"operationId": op_id, "tags": ["Hukamnama"], "summary": summary, "description": description,
                        "parameters": list(params), "responses": dict(sorted({**responses, **common}.items()))}}

    paths = {
        "/v1/hukamnama/today": op(
            "today", "Today's Hukamnama",
            "The Hukamnama for the current date in Amritsar (UTC+05:30), wherever the request comes from. "
            "Before it is published, usually until about 05:30 in the morning there, the answer is `pending` "
            "and names the latest published date. A day is never served under another day's date.",
            {"200": ok(one_day, "Today's Hukamnama, or a pending answer.",
                       f"`{cache_of(got, 'today')}` when published; `{cache_of(got, 'today_pending')}` when pending.")}),
        "/v1/hukamnama/{date}": op(
            "day", "One day's Hukamnama",
            "One day, by its date in Amritsar. A day with no published Hukamnama answers `pending`. "
            "A date after today in Amritsar, or before the archive begins, is `404`.",
            {"200": ok(one_day, "That day's Hukamnama, or a pending answer.",
                       f"`{cache_of(got, 'day')}` for a past day; a pending answer is `{cache_of(got, 'day_pending')}`."),
             "400": err("The date is not a real date in YYYY-MM-DD form."),
             "404": err("The date is after today in Amritsar, or before 2026-11-01.")}, [when]),
        "/v1/hukamnama": op(
            "list", "The latest days",
            "The latest published days, newest first, never a day ahead of the date in Amritsar. "
            "Without `include=lines` each day comes without its lines.",
            {"200": ok(ref("List"), "The latest published days.", "`" + cache_of(got, "list") + "`."),
             "400": err("`limit` is not a whole number from 1 to 30.")}, [limit, include]),
        "/v1/hukamnama/index": op(
            "index", "Every published day",
            "Every published day, newest first, with its date, Ang, raag, author and hash, without the text. "
            "What an archive page or a sitemap lists.",
            {"200": ok(ref("Index"), "The published days.", "`" + cache_of(got, "index") + "`.")}),
        "/v1/status": {"get": {**op(
            "status", "Is today's published?",
            "Whether today's Hukamnama is published yet, and the latest published date.",
            {"200": ok(ref("Status"), "The API's status.", "`" + cache_of(got, "status") + "`.")})["get"], "tags": ["Status"]}},
    }
    return {
        "openapi": "3.1.0",
        "info": {
            "title": "Hukamnama · Sri Harmandir Sahib — public API",
            "version": API_CONTRACT_VERSION,
            "description": (
                "The daily Hukamnama from Sri Harmandir Sahib, Amritsar, as JSON. Each day is located by Ang from "
                "the Hukamnama SGPC publishes; every line is then read from the verbatim Sri Guru Granth Sahib Ji "
                "corpus and proved against `range_sha256` before it is served. Gurbani Soul is not affiliated with "
                "SGPC. Free, with no key and no account; open to any origin (CORS); every `200` carries an `ETag`. "
                "Dates are dates in Amritsar (UTC+05:30). Version 1 only grows: fields may be added, and none is "
                "renamed or removed without twelve months' notice. Best effort, with no guarantee of availability: "
                "late rather than wrong. Generated by tools/gen_hukamnama_openapi.py; every response schema is "
                "inferred from what the service and the Worker really answer."),
            "termsOfService": TERMS,
        },
        "servers": [{"url": SERVER, "description": "The public API."}],
        "security": [],
        "tags": [{"name": "Hukamnama", "description": "The day's Hukamnama, past days, and the list of published days."},
                 {"name": "Status", "description": "Whether today's Hukamnama is published."}],
        "paths": paths,
        "components": {"schemas": components(got)},
    }


def render() -> str:
    return json.dumps(build(), ensure_ascii=False, indent=1) + "\n"


def main(argv) -> int:
    text = render()
    if "--check" in argv:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
            print("contract/hukamnama.openapi.json is stale — run: python3 tools/gen_hukamnama_openapi.py")
            return 1
        print("contract/hukamnama.openapi.json is current")
        return 0
    OUT.write_text(text, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({len(json.loads(text)['paths'])} routes)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
