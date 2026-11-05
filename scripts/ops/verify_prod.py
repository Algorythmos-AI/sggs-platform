#!/usr/bin/env python3
"""Verify SGGS production: API identity + health + heading regression + web domain."""
import argparse, json, subprocess, sys, urllib.error, urllib.parse, urllib.request

class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None

API = "https://sggs-knowledge-base.onrender.com"
WEB = "https://gurbanisoul.com"
TODI = "ਟੋਡੀ ਮਹਲਾ ੫ ਘਰੁ ੨ ਚਉਪਦੇ"

def get(url, timeout=60):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "sggs-verify"}), timeout=timeout) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception as e:  # network / cold start
        return None, str(e)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--commit"); ap.add_argument("--version")
    ap.add_argument("--api", default=API); ap.add_argument("--web", default=WEB)
    ap.add_argument("--ios", action="store_true",
                    help="also require the iOS binary to match: runs check_release_complete.py --version")
    a = ap.parse_args()
    fails = []
    def check(name, ok, detail=""):
        print(f"  {'ok  ' if ok else 'FAIL'} {name}{(' — ' + detail) if detail else ''}")
        if not ok: fails.append(name)

    for label, base in (("api", a.api), ("web", a.web)):
        print(f"[{label}] {base}")
        s, h = get(base + "/api/health", 90)
        ok = isinstance(h, dict) and h.get("ok") is True and all(h.get("checks", {}).values())
        check(f"{label} health", ok, f"HTTP {s} version={h.get('version') if isinstance(h, dict) else h} commit={str(h.get('commit'))[:12] if isinstance(h, dict) else '-'}")
        if isinstance(h, dict):
            if a.commit: check(f"{label} commit == {a.commit[:12]}", str(h.get("commit")) == a.commit)
            if a.version: check(f"{label} version == {a.version}", h.get("version") == a.version)
        s, d = get(base + "/api/shabad/2845")
        first = d["lines"][0]["gurmukhi"] if isinstance(d, dict) and d.get("lines") else ""
        check(f"{label} Ang 712 heading", first.startswith(TODI), first[:40])
        s, _ = get(base + "/api/shabad/2844")
        check(f"{label} gap comp 2844 → 404", s == 404, f"HTTP {s}")

    # Directional guard (since 1.6.0 the marketing pages live under /<lang>): the App Store
    # URLs /privacy and /support must reach their /en page in exactly ONE permanent hop, and
    # the bare / in one temporary (negotiated) hop; each target must be 200 with no further
    # hop. Catches a flipped, missing or looping Vercel redirect.
    if a.web.rstrip("/").endswith("gurbanisoul.com"):
        print(f"[canonical] {a.web}")
        opener = urllib.request.build_opener(_NoRedirect)
        def hop(path):
            try:
                r = opener.open(urllib.request.Request(a.web + path, headers={"User-Agent": "sggs-verify"}), timeout=60)
                return r.status, None
            except urllib.error.HTTPError as e:
                loc = e.headers.get("Location") or ""
                return e.code, urllib.parse.urlsplit(loc).path or None
            except Exception as e:
                return str(e), None
        for path, want_code, want_to in (("/privacy", 308, "/en/privacy"), ("/support", 308, "/en/support"), ("/", 302, "/en")):
            code, to = hop(path)
            check(f"canonical {path} → {want_code} {want_to}", code == want_code and to == want_to, f"HTTP {code} → {to}")
            code, to = hop(want_to)
            check(f"canonical {want_to} is 200 (no further redirect)", code == 200, f"HTTP {code}" + (f" → {to}" if to else ""))

    try:
        out = subprocess.run(["vercel", "inspect", a.web.replace("https://", ""), "--scope", "skalaliyas-projects"],
                             capture_output=True, text=True, timeout=60)
        ids = [l.split()[-1] for l in (out.stdout + out.stderr).splitlines() if l.strip().startswith("id")]
        print(f"[vercel] public domain served by: {ids[0] if ids else 'unknown (vercel CLI not logged in?)'}")
    except (FileNotFoundError, subprocess.TimeoutExpired):
        print("[vercel] CLI unavailable — deployment id not checked")

    # One-number policy: optionally require the shipped iOS binary to match this release too.
    if a.ios:
        if not a.version:
            check("ios: --version required for --ios", False)
        else:
            import pathlib
            # scripts/ops/verify_prod.py → repo root
            checker = pathlib.Path(__file__).resolve().parents[2] / "scripts/release/check_release_complete.py"
            rc = subprocess.run([sys.executable, str(checker), a.version, "--api", a.api, "--web", a.web])
            check(f"iOS {a.version} release-complete (web==API==binary)", rc.returncode == 0)

    print("RESULT:", "PASS" if not fails else f"FAIL ({', '.join(fails)})")
    return 1 if fails else 0

if __name__ == "__main__":
    sys.exit(main())
