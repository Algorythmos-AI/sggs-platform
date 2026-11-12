#!/usr/bin/env python3
"""Tell search engines that today's Hukamnama pages changed (IndexNow).

    python3 scripts/ci/indexnow.py SITE_URL DATE --key KEY [--langs en,pa,fr] [--dry-run]

Run by the morning check, only after it has confirmed that every surface shows the day the API
published: a page is never announced before it is right. It names the page in each language and
the day's own permanent page. IndexNow needs the key to be readable at SITE_URL/<KEY>.txt; the key
is public by design (it only proves the sender controls the site).

Exit 0 when the ping was accepted (HTTP 200 or 202) or on a dry run, 1 otherwise. Standard library only.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from urllib.parse import urlsplit

ENDPOINT = "https://api.indexnow.org/indexnow"
KEY = re.compile(r"^[A-Za-z0-9-]{8,128}$")           # IndexNow's own rule for a key
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def payload(site: str, date: str, key: str, langs: list[str]) -> dict:
    """The request body. Raises ValueError on anything that is not a plain https site, a date and a key."""
    u = urlsplit(site)
    if u.scheme != "https" or not u.hostname or u.path.strip("/") or u.query:
        raise ValueError("site must be an https origin")
    if not DATE.match(date):
        raise ValueError("date must be YYYY-MM-DD")
    if not KEY.match(key):
        raise ValueError("key must be 8 to 128 letters, digits or dashes")
    if not langs or any(not re.fullmatch(r"[a-z]{2}", x) for x in langs):
        raise ValueError("languages must be two-letter codes")
    base = f"https://{u.hostname}"
    urls = [f"{base}/{lang}/hukamnama" for lang in langs] + [f"{base}/{lang}/hukamnama/{date}" for lang in langs]
    return {"host": u.hostname, "key": key, "keyLocation": f"{base}/{key}.txt", "urlList": urls}


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("site_url")
    p.add_argument("date")
    p.add_argument("--key", required=True)
    p.add_argument("--langs", default="en,pa,fr")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args(argv)
    try:
        body = payload(args.site_url.rstrip("/"), args.date, args.key, args.langs.split(","))
    except ValueError as e:
        print(f"not sent: {e}")
        return 1
    print(f"{len(body['urlList'])} URLs for {args.date}")
    if args.dry_run:
        for u in body["urlList"]:
            print(f"  {u}")
        return 0
    req = urllib.request.Request(ENDPOINT, data=json.dumps(body).encode("utf-8"), method="POST",
                                 headers={"Content-Type": "application/json; charset=utf-8",
                                          "User-Agent": "GurbaniSoul-IndexNow/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:   # noqa: S310 - the fixed IndexNow endpoint
            status = r.status
    except urllib.error.HTTPError as e:
        status = e.code
    except (urllib.error.URLError, TimeoutError) as e:
        print(f"not accepted: {type(e).__name__}")
        return 1
    print(f"IndexNow answered {status}")
    return 0 if status in (200, 202) else 1


if __name__ == "__main__":
    sys.exit(main())
