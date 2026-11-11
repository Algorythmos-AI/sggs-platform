#!/usr/bin/env python3
"""Prove every API function of a deployment is live at this commit and holds exactly its context.

    python3 scripts/ci/verify_functions.py https://sggs-staging.vercel.app --commit SHA --env staging

For each context routed to its own function in that environment (gateway/routes.json) and for
`all`: /readyz?svc=<context> (or /readyz) answers 200, ready, with that function's contexts, the
expected commit and the matching X-Service header. And the API's databases and source are not
downloadable from the site. Where the environment serves the Hukamnama pages ("hukamnama_api"),
each language's /{lang}/hukamnama is a filled page from the `all` function: no template token
left, the page's own language, never a 404 (a 503 passes with a warning: it means the Hukamnama
API could not be reached or the day did not prove, which is not this deployment's fault). The
feeds are checked the same way: an Atom document and a JSON Feed, from `all`; and the Hukamnama
sitemap must be a whole sitemap that lists each language's page. Sends x-vercel-protection-bypass when VERCEL_AUTOMATION_BYPASS_SECRET
is set. Retries while functions cold-start. Stdlib only.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from gen_gateway import (DATA_DIR, FEEDS, ROUTES_FILE, SITEMAP, environments, languages,  # noqa: E402
                         prefixes_by_context)

NOT_PUBLISHED = (f"/{DATA_DIR}/db/all.sqlite", f"/{DATA_DIR}/db/search.sqlite", f"/{DATA_DIR}/webapp/serve.py")


def get(url: str, timeout: int = 60):
    headers = {"User-Agent": "sggs-deploy-verify"}
    if os.environ.get("VERCEL_AUTOMATION_BYPASS_SECRET"):
        headers["x-vercel-protection-bypass"] = os.environ["VERCEL_AUTOMATION_BYPASS_SECRET"]
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.headers.get("X-Service"), r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("X-Service"), e.read()


def check_ready(base: str, name: str, contexts: list[str], commit: str) -> str | None:
    """None when the function is right, else what is wrong."""
    url = f"{base}/readyz" + ("" if name == "all" else f"?svc={name}")
    status, svc, raw = get(url)
    try:
        body = json.loads(raw)
    except ValueError:
        return f"{url}: HTTP {status}, not JSON"
    want_svc = "all" if name == "all" else name
    if status != 200 or body.get("ready") is not True:
        return f"{url}: HTTP {status} ready={body.get('ready')} missing={body.get('missing_tables')}"
    if body.get("commit") != commit:
        return f"{url}: commit {body.get('commit')} (want {commit[:12]})"
    if body.get("contexts") != contexts or svc != want_svc:
        return f"{url}: contexts {body.get('contexts')} X-Service {svc} (want {contexts} / {want_svc})"
    return None


def check_page(base: str, lang: str) -> tuple[str | None, str | None]:
    """(problem, warning) for one language's Hukamnama page."""
    url = f"{base}/{lang}/hukamnama"
    status, svc, raw = get(url)
    if status == 503 and svc == "all":
        return None, f"{url}: HTTP 503 from the function (the Hukamnama API is unreachable, or the day did not prove)"
    if status != 200 or svc != "all":
        return f"{url}: HTTP {status} X-Service {svc} (want 200 from `all`)", None
    text = raw.decode("utf-8", "replace")
    if "__HK_" in text or 'id="hk-strings"' in text:
        return f"{url}: the page still holds template tokens", None
    if f'<html lang="{lang}"' not in text:
        return f"{url}: not the '{lang}' page", None
    return None, None


def check_feed(base: str, path: str) -> tuple[str | None, str | None]:
    """(problem, warning) for one Hukamnama feed."""
    url = base + path
    status, svc, raw = get(url)
    if status == 503 and svc == "all":
        return None, f"{url}: HTTP 503 from the function (the Hukamnama API is unreachable)"
    if status != 200 or svc != "all":
        return f"{url}: HTTP {status} X-Service {svc} (want 200 from `all`)", None
    text = raw.decode("utf-8", "replace")
    if path.endswith(".json"):
        try:
            ok = json.loads(text).get("version", "").startswith("https://jsonfeed.org/version/")
        except (ValueError, AttributeError):
            ok = False
    else:
        ok = text.startswith("<?xml") and '<feed xmlns="http://www.w3.org/2005/Atom"' in text and text.rstrip().endswith("</feed>")
    return (None, None) if ok else (f"{url}: not a whole feed document", None)


def check_sitemap(base: str) -> tuple[str | None, str | None]:
    """(problem, warning) for the Hukamnama sitemap."""
    url = base + SITEMAP
    status, svc, raw = get(url)
    if status == 503 and svc == "all":
        return None, f"{url}: HTTP 503 from the function (the Hukamnama API is unreachable)"
    if status != 200 or svc != "all":
        return f"{url}: HTTP {status} X-Service {svc} (want 200 from `all`)", None
    text = raw.decode("utf-8", "replace")
    if not (text.startswith("<?xml") and "<urlset " in text and text.rstrip().endswith("</urlset>")):
        return f"{url}: not a whole sitemap", None
    missing = [lang for lang in languages() if f"/{lang}/hukamnama</loc>" not in text]
    return (f"{url}: does not list the page of {missing}", None) if missing else (None, None)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("base")
    ap.add_argument("--commit", required=True)
    ap.add_argument("--env", required=True)
    ap.add_argument("--attempts", type=int, default=6)
    ap.add_argument("--interval", type=int, default=15)
    a = ap.parse_args(argv)
    base = a.base.rstrip("/")
    env = environments(json.loads(ROUTES_FILE.read_text(encoding="utf-8")))[a.env]
    if env["api_platform"] != "vercel":
        print(f"{a.env}: the API is on {env['api_platform']}, not the Vercel functions — nothing to verify")
        return 0
    everything = sorted(prefixes_by_context())
    targets = [(c, [c]) for c in sorted(env["services"])] + [("all", everything)]
    failures = []
    for name, contexts in targets:
        for attempt in range(1, a.attempts + 1):
            problem = check_ready(base, name, contexts, a.commit)
            if problem is None:
                print(f"ok  {name:<9} ready at {a.commit[:12]} serving {','.join(contexts)}")
                break
            print(f"    {name}: {problem} (attempt {attempt}/{a.attempts})")
            if attempt < a.attempts:
                time.sleep(a.interval)
        else:
            failures.append(name)
    if env.get("hukamnama_api"):
        checks = [(f"/{lang}/hukamnama", "a filled page", lambda lang=lang: check_page(base, lang)) for lang in languages()]
        checks += [(path, "a whole feed", lambda path=path: check_feed(base, path)) for path in FEEDS]
        checks += [(SITEMAP, "a whole sitemap", lambda: check_sitemap(base))]
        for path, what, check in checks:
            for attempt in range(1, a.attempts + 1):
                problem, warning = check()
                if problem is None:
                    print(f"::warning::{warning}" if warning else f"ok  {path} is {what} from `all`")
                    break
                print(f"    {problem} (attempt {attempt}/{a.attempts})")
                if attempt < a.attempts:
                    time.sleep(a.interval)
            else:
                failures.append(path)
    for path in NOT_PUBLISHED:
        status, _, _ = get(base + path)
        if status == 200:
            failures.append(path)
            print(f"::error::{base}{path} is downloadable — the API's files must never be published")
        else:
            print(f"ok  {path} not published (HTTP {status})")
    if failures:
        print(f"::error::API functions not right on {base}: {failures}")
        return 1
    print(f"all {len(targets)} API functions verified on {base}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
