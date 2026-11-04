#!/usr/bin/env python3
"""Find interface English that does not come from the message files.

    cd frontend && PUBLIC_I18N_PSEUDO=1 npx astro build --outDir dist-pseudo
    python3 scripts/ci/check_i18n_coverage.py frontend/dist-pseudo

A pseudo-locale build renders every message as "⟦Ŝéé …⟧" (frontend/src/i18n/pseudo.js), so any
visible text or accessible name left plain in a covered region was typed into a component instead
of frontend/src/i18n/messages/en.json, and would stay English on a French or Punjabi page. The
covered regions grow as pages move their copy into messages (COVERED); when every marketing page is
covered the region becomes the whole page.

Exempt: Gurmukhi (anything inside lang="pa" or class="gm" — scripture and the ੴ mark are never
translated here) and its transliteration (class="rom"), text without letters (numbers, symbols, punctuation), the product name, email
addresses, web addresses, dates and clock ranges formatted per language, and Learn article titles and descriptions (content, translated with the
articles themselves). Stdlib only.
"""
from __future__ import annotations

import fnmatch
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LEARN = ROOT / "frontend" / "src" / "content" / "learn"
COVERS = ROOT / "frontend" / "src" / "covers.ts"         # Learn cover photos (alt text is content)
MARK = "⟦"

# (tag, attribute, value): an element that matches starts a covered region. "class" matches one
# class among several.
COVERED = [
    ("a", "class", "lp-skip"),              # Marketing.astro skip link
    ("header", "id", "mnav"),               # MarketingNav
    ("dialog", "id", "mobileMenu"),         # MarketingNav sheet
    ("footer", "class", "mfoot"),           # MarketingFooter
    ("section", "id", "contribute-band"),   # ContributeBand
    ("nav", "class", "crumbs"),             # Breadcrumbs
    ("p", "class", "legal-toc-h"),          # LegalPage (its entries come from each page)
    ("p", "class", "legal-updated"),        # LegalPage
]
# Whole pages whose copy has moved into messages: (page, matchers), the page given as its path under
# the build ("en/index.html"). A matcher with no attribute matches every element with that tag.
PAGES = {
    "en/index.html": [("main", "id", "main"), ("title", None, None)],
    "en/features/index.html": [("main", "id", "main"), ("title", None, None)],
    "en/watch/index.html": [("main", "id", "main"), ("title", None, None)],
    "en/support/index.html": [("main", "id", "main"), ("title", None, None)],
    "en/privacy/index.html": [("main", "id", "main"), ("title", None, None)],
    "en/contribute/index.html": [("main", "id", "main"), ("title", None, None)],
    "en/learn/index.html": [("main", "id", "main"), ("title", None, None)],
    # Learn articles: the page chrome only; the article body is content, translated per article.
    "en/learn/*/index.html": [("nav", "class", "art-nav"), ("p", "class", "explain-label"),
                              ("figcaption", "class", "cite"), ("p", "class", "art-meta"), ("title", None, None)],
}
ATTRS = ("aria-label", "alt", "title", "placeholder")
ALLOWED = {"Gurbani Soul"}
EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")
# A date formatted per language by i18n/format.ts (fmtDate): "22 September 2026".
DATE = re.compile(r"\d{1,2} \w+ \d{4}")
# A clock range formatted per language by i18n/format.ts (fmtPaharRange): "6–9 AM", "9 AM–12 PM".
CLOCK = re.compile(r"\d{1,2}(:\d\d)?( ?[AP]M)?\s*[–-]\s*\d{1,2}(:\d\d)?( ?[AP]M)?")
ADDRESS = re.compile(r"[\w-]+(\.[\w-]+)+(/[\w./-]*)?")   # gurbanisoul.com/search
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


def learn_titles() -> set[str]:
    """Learn article titles, descriptions, tags and cover alt text: content, translated with the articles."""
    out = set()
    for p in LEARN.rglob("*.mdx"):
        text = p.read_text(encoding="utf-8")
        for field in ("title", "description"):
            m = re.search(rf'(?m)^{field}:\s*["\']?(.*?)["\']?\s*$', text)
            if m:
                out.add(" ".join(m.group(1).split()))
        tags = re.search(r"(?m)^tags:\s*\[(.*?)\]", text)
        if tags:
            out.update(t.strip().strip("\"'") for t in tags.group(1).split(","))
    out.update(re.findall(r"alt: '([^']*)'", COVERS.read_text(encoding="utf-8")))
    return out


class Scan(HTMLParser):
    def __init__(self, exempt: set[str], regions=None):
        super().__init__(convert_charrefs=True)
        self.exempt = exempt
        self.regions = COVERED + list(regions or [])
        self.stack: list[tuple[str, bool, bool]] = []   # (tag, covered, gurmukhi)
        self.bad: list[str] = []

    def _flags(self):
        return (self.stack[-1][1], self.stack[-1][2]) if self.stack else (False, False)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        covered, gm = self._flags()
        classes = (a.get("class") or "").split()
        if not covered:
            covered = any(tag == t and (k is None or (v in classes if k == "class" else a.get(k) == v))
                          for t, k, v in self.regions)
        gm = gm or a.get("lang") == "pa" or "gm" in classes or "rom" in classes   # rom: transliteration
        if covered and not gm:
            for name in ATTRS:
                if a.get(name):
                    self._check(a[name], f"[{name}]")
        if tag in ("script", "style"):
            gm = True                                      # never text
        if tag not in VOID:
            self.stack.append((tag, covered, gm))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID and self.stack and self.stack[-1][0] == tag:
            self.stack.pop()

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        covered, gm = self._flags()
        if covered and not gm:
            self._check(data, "")

    def _check(self, s: str, where: str):
        s = " ".join(s.split())
        if (not s or MARK in s or not re.search(r"[A-Za-z]", s) or s in ALLOWED or s in self.exempt
                or EMAIL.fullmatch(s) or ADDRESS.fullmatch(s) or CLOCK.fullmatch(s) or DATE.fullmatch(s)
                or s.strip("←→ ") in self.exempt):                   # "← Article title" (prev/next)
            return
        self.bad.append(f"{where} {s!r}".strip())


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__.strip().splitlines()[2].strip())
        return 2
    out = Path(argv[1])
    pages = [p for p in sorted(out.rglob("index.html")) if not p.relative_to(out).parts[0] in ("ang", "og")]
    if not pages:
        print(f"no pages under {out}")
        return 2
    exempt = learn_titles()
    problems, marked = 0, 0
    for p in pages:
        html = p.read_text(encoding="utf-8")
        marked += html.count(MARK)
        rel = p.relative_to(out).as_posix()
        s = Scan(exempt, [m for pat, ms in PAGES.items() if fnmatch.fnmatch(rel, pat) for m in ms])
        s.feed(html)
        for b in s.bad:
            print(f"{p.relative_to(out).as_posix()}: {b}")
        problems += len(s.bad)
    if marked == 0:
        print("no pseudo-locale text at all: build with PUBLIC_I18N_PSEUDO=1")
        return 1
    print(f"i18n coverage: {len(pages)} pages, {problems} untranslatable string(s) in covered regions")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
