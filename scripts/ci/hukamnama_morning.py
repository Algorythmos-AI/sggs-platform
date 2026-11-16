#!/usr/bin/env python3
"""The morning check: does the website show the Hukamnama the API published?

    python3 scripts/ci/hukamnama_morning.py SITE_URL API_URL [--langs en,pa,fr]

Run from outside, after the morning's publication. For every surface a reader meets (the page in
each language, the JSON feed's newest entry, the embed) it reads the date shown and the Gurmukhi
lines shown, and holds them to the API:

  * the lines, hashed as the API hashes them, must equal the ``range_sha256`` the API published
    for the date the surface shows. A page that shows other words fails here, whatever the cause;
  * once the API has published today's (Amritsar) Hukamnama, every surface must show today's.
    Before that, a surface may show an earlier day, under that day's own date.

Exit 0 when everything agrees, 1 with a report when anything does not, 2 when a surface could not
be read. Sends x-vercel-protection-bypass when VERCEL_AUTOMATION_BYPASS_SECRET is set (staging).
Standard library only; a dozen requests, one at a time.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))
UA = "GurbaniSoul-Hukamnama-morning/1.0"
DATE = re.compile(r"\d{4}-\d{2}-\d{2}")


def range_sha256(lines: list[str]) -> str:
    """The API's own definition: every line joined by a newline, UTF-8."""
    return hashlib.sha256("\n".join(lines).encode("utf-8")).hexdigest()


# -- what each surface shows: (date, lines) or None when it shows no Hukamnama ---------------------
def page_shows(text: str):
    # the element that wraps the shabad carries its date (hk-shell.astro: <section class="hk-shabad" data-date=…>)
    m = re.search(r'<(?:section|article)\b[^>]*\bdata-date="(\d{4}-\d{2}-\d{2})"', text)
    if not m:
        return None
    return m.group(1), [html.unescape(x) for x in re.findall(r'<p class="hk-gm gm" lang="pa" data-gm="([^"]*)"', text)]


def feed_shows(doc: dict):
    items = doc.get("items") or []
    if not items:
        return None
    m = DATE.search(str(items[0].get("url", "")).rsplit("/", 1)[-1])
    block = re.search(r'<div lang="pa">(.*?)</div>', items[0].get("content_html", ""), re.S)
    if not m or not block:
        return None
    return m.group(0), [html.unescape(x) for x in re.findall(r"<p>(.*?)</p>", block.group(1), re.S)]


def embed_shows(text: str):
    block = re.search(r'<div class="g" lang="pa">(.*?)</div>', text, re.S)
    m = re.search(r'/hukamnama/(\d{4}-\d{2}-\d{2})"', text)
    if not block or not m:
        return None
    return m.group(1), [html.unescape(x) for x in re.findall(r"<p>(.*?)</p>", block.group(1), re.S)]


def judge(surfaces: dict, today: str, api_today: dict, api_day) -> list[str]:
    """Pure. ``surfaces`` maps a name to (date, lines) or None; ``api_day(date)`` returns the API's
    record for a date. Returns what is wrong, in words."""
    out: list[str] = []
    published_today = api_today.get("status") == "published" and api_today.get("amritsar_date") == today
    for name, shown in surfaces.items():
        if shown is None:
            if published_today:
                out.append(f"{name}: shows no Hukamnama, but the API has published {today}")
            continue
        date, lines = shown
        if date > today:
            out.append(f"{name}: shows {date}, a day ahead of the date in Amritsar ({today})")
            continue
        if published_today and date != today:
            out.append(f"{name}: shows {date}, but the API has published {today}")
            continue
        rec = api_today if date == today else api_day(date)
        if not rec or rec.get("status") != "published" or rec.get("amritsar_date") != date:
            out.append(f"{name}: shows {date}, which the API has not published")
            continue
        if not lines:
            out.append(f"{name}: shows {date} with no Gurmukhi line")
        elif range_sha256(lines) != rec.get("range_sha256"):
            out.append(f"{name}: the {len(lines)} lines shown for {date} do not hash to the API's range_sha256 "
                       f"({str(rec.get('range_sha256'))[:12]})")
    return out


# -- reading --------------------------------------------------------------------------------------
def fetch(url: str, timeout: float = 30) -> str:
    headers = {"User-Agent": UA, "Cache-Control": "no-cache"}
    if os.environ.get("VERCEL_AUTOMATION_BYPASS_SECRET"):
        headers["x-vercel-protection-bypass"] = os.environ["VERCEL_AUTOMATION_BYPASS_SECRET"]
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:   # noqa: S310 - our own https URLs
        return r.read().decode("utf-8")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("site_url")
    p.add_argument("api_url")
    p.add_argument("--langs", default="en,pa,fr")
    args = p.parse_args(argv)
    site, api = args.site_url.rstrip("/"), args.api_url.rstrip("/")
    today = datetime.now(timezone.utc).astimezone(IST).date().isoformat()
    try:
        api_today = json.loads(fetch(f"{api}/v1/hukamnama/today"))
        surfaces = {f"/{lang}/hukamnama": page_shows(fetch(f"{site}/{lang}/hukamnama")) for lang in args.langs.split(",")}
        surfaces["/feeds/hukamnama.json"] = feed_shows(json.loads(fetch(f"{site}/feeds/hukamnama.json")))
        surfaces["/embed/hukamnama"] = embed_shows(fetch(f"{site}/embed/hukamnama"))
        cache: dict = {}

        def api_day(date: str):
            if date not in cache:
                cache[date] = json.loads(fetch(f"{api}/v1/hukamnama/{date}"))
            return cache[date]

        wrong = judge(surfaces, today, api_today, api_day)
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        print(f"could not read a surface: {type(e).__name__}: {e}")
        return 2
    state = api_today.get("status")
    print(f"Amritsar date {today}; the API says today is {state}"
          + (f" (latest {api_today.get('latest')})" if state != "published" else f", Ang {api_today.get('ang')}"))
    for name, shown in surfaces.items():
        print(f"  {name}: " + (f"{shown[0]}, {len(shown[1])} lines" if shown else "no Hukamnama shown"))
    if wrong:
        print("\nMISMATCH")
        for w in wrong:
            print(f"  - {w}")
        return 1
    print("\nevery surface agrees with the API")
    if state == "published" and api_today.get("amritsar_date") == today and os.environ.get("GITHUB_OUTPUT"):
        # for the step that tells search engines: today's pages are confirmed right
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write(f"confirmed={today}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
