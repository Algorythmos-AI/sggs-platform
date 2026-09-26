#!/usr/bin/env python3
"""docs_smoke.py BASE_URL --commit SHA — prove a deployed wiki is this commit and whole.

Identity, not just liveness: the page must carry <meta name="sggs-docs-commit" content=SHA>,
search must be indexed (Pagefind), the poster the architecture page links as "open full size"
must be served as SVG, and the same-origin /api rewrite must reach the API (/api/health ok,
/api/meta with a version). Nothing may redirect: every check fetches without following
redirects, because a redirect on /api is exactly how the widgets broke before (a trailing-slash
redirect looping with the product host). Retries while a deployment warms up. Sends the Vercel
protection-bypass header when VERCEL_DOCS_BYPASS_SECRET is set.

A build announces what it can be held to in <meta name="sggs-docs-features">; "nav2" (every
published page in the sidebar) adds a check that the sidebar links every page in the sitemap.
Older builds are not held to it, so docs-watch can keep proving an older production.
"""
import argparse, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request

class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None   # surface the 3xx as an HTTPError instead of following it

_OPENER = urllib.request.build_opener(_NoRedirect)

def fetch(base, path, bypass, timeout=30):
    """(status, content-type, body); a 3xx/4xx/5xx comes back as its status, never followed."""
    req = urllib.request.Request(base.rstrip("/") + path, headers={"User-Agent": "sggs-docs-smoke",
                                 **({"x-vercel-protection-bypass": bypass} if bypass else {})})
    try:
        with _OPENER.open(req, timeout=timeout) as r:
            return r.status, r.headers.get("content-type", ""), r.read()
    except urllib.error.HTTPError as e:
        where = e.headers.get("location", "") if e.headers else ""
        return e.code, (f"redirect -> {where}" if 300 <= e.code < 400 else e.headers.get("content-type", "") if e.headers else ""), b""

POSTER_RE = re.compile(rb'href="(/posters/[0-9]{2}-[a-z0-9-]+\.svg)"')

def poster_path(base, bypass):
    """The poster the architecture overview links as 'open full size' (no hard-coded path)."""
    status, _, body = fetch(base, "/architecture/overview/", bypass)
    m = POSTER_RE.search(body) if status == 200 else None
    return m.group(1).decode() if m else None

NAV_PAGE = "/glossary/"   # any docs page carries the full sidebar (the home page may not)


def features(html):
    """The capabilities a build announces (<meta name="sggs-docs-features">). Checks for a newer
    capability run only on builds that have it, so this script can watch an older production."""
    m = re.search(r'<meta name="sggs-docs-features" content="([^"]*)"', html)
    return set(m.group(1).split()) if m else set()


def nav_gaps(base, bypass):
    """Sitemap pages the sidebar does not link to (nav2 builds: every page is in the sidebar)."""
    status, _, body = fetch(base, "/sitemap-0.xml", bypass)
    if status != 200:
        return [f"/sitemap-0.xml -> {status}"]
    want = {urllib.parse.urlsplit(u).path for u in re.findall(r"<loc>([^<]+)</loc>", body.decode())} - {"/", "/404/"}
    status, _, body = fetch(base, NAV_PAGE, bypass)
    html = body.decode("utf-8", "replace")
    start = html.find('aria-label="Main"')
    nav = html[start:html.find("</nav>", start)] if start >= 0 else ""
    have = set(re.findall(r'<a href="(/[^"]*)"', nav))
    return sorted(want - have)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base_url")
    ap.add_argument("--commit", required=True)
    ap.add_argument("--timeout", type=int, default=300)
    ap.add_argument("--interval", type=int, default=10)
    ap.add_argument("--poster", default="", help="override the poster path (default: found on /architecture/overview/)")
    a = ap.parse_args()
    bypass = os.environ.get("VERCEL_DOCS_BYPASS_SECRET") or None
    start, last = time.time(), None
    while True:
        try:
            status, ctype, body = fetch(a.base_url, "/", bypass)
            html = body.decode("utf-8", "replace")
            m = re.search(r'<meta name="sggs-docs-commit" content="([^"]+)"', html)
            got = m.group(1) if m else "none"
            if status == 200 and got == a.commit:
                break
            state = f"HTTP {status}, commit {got[:12]} (want {a.commit[:12]})"
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            state = f"unreachable ({type(e).__name__})"
        if state != last:
            print(f"  [{int(time.time() - start):>4}s] {state}"); last = state
        if time.time() - start > a.timeout:
            print(f"::error::docs smoke: timed out; last: {state}"); return 1
        time.sleep(a.interval)
    print(f"home page serves commit {a.commit[:12]}")
    built = features(html)
    checks = [("/", "text/html", lambda b: b"Sri Guru Granth Sahib" in b),
              ("/architecture/overview/", "text/html", lambda b: b'data-diagram="mermaid"' in b),
              ("/pagefind/pagefind-entry.json", "application/json", lambda b: json.loads(b).get("version")),
              ("/api/health", "application/json", lambda b: json.loads(b).get("ok") is True),
              ("/api/meta", "application/json", lambda b: bool(json.loads(b).get("version"))),
              ("/og/index.png", "image/png", lambda b: b[:8] == b"\x89PNG\r\n\x1a\n")]
    try:
        poster = a.poster or poster_path(a.base_url, bypass)
    except (urllib.error.URLError, TimeoutError, OSError):
        poster = None
    bad = 0
    if poster:
        checks.append((poster, "image/svg+xml", lambda b: b.startswith(b"<svg") or b"<svg" in b[:500]))
    else:
        print("  BAD no poster linked as 'open full size' on /architecture/overview/"); bad += 1
    if "nav2" in built:
        try:
            gaps = nav_gaps(a.base_url, bypass)
        except Exception as e:  # noqa: BLE001 — a smoke check reports, never raises
            gaps = [f"unreadable ({type(e).__name__})"]
        print(f"  {'ok ' if not gaps else 'BAD'} sidebar links every page" + (f" — missing {', '.join(gaps[:8])}" if gaps else ""))
        bad += bool(gaps)
    for path, want_type, ok in checks:
        try:
            status, ctype, body = fetch(a.base_url, path, bypass)
            good = status == 200 and want_type in ctype and bool(ok(body))
        except Exception as e:  # noqa: BLE001 — a smoke check reports, never raises
            status, ctype, good = "ERR", type(e).__name__, False
        print(f"  {'ok ' if good else 'BAD'} {path} -> {status} {ctype}")
        bad += not good
    if bad:
        print(f"::error::docs smoke: {bad} check(s) failed"); return 1
    print("docs smoke: all checks passed"); return 0

if __name__ == "__main__":
    sys.exit(main())
