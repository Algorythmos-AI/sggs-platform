"""Web / platform repository gates — source-level invariants that used to live only in prose.

Each test here encodes a rule the project already relies on (CHANGELOG/engineering handbook/readiness
reports) so that it is enforced on every PR by the required `python` check instead of by memory.
Stdlib only, no build, no simulator: these read tracked files and nothing else.

A gate marked `expectedFailure` documents a KNOWN open finding from the 2026-09-20 App Store
audit. When the finding is fixed the test starts passing, unittest reports an "unexpected
success" (a failure), and the decorator must be removed in the same PR — so a gate can only ever
move from "known-open" to "enforcing", never silently back.
"""
import json
import sys
import re
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

STATIC = ROOT / "webapp" / "static"
LANDING_ASSETS = ROOT / "frontend" / "src" / "assets" / "landing"
SITE_TS = ROOT / "frontend" / "src" / "site.ts"
# Built marketing pages (route -> built file) that carry the v2 budgets/eager/alt discipline.
# /privacy and /support render in the marketing shell (LegalPage) since v1.3.5.
MARKETING_BUILT = {
    "/": STATIC / "index.html",
    "/features": STATIC / "features" / "index.html",
    "/watch": STATIC / "watch" / "index.html",
    "/privacy": STATIC / "privacy" / "index.html",
    "/support": STATIC / "support" / "index.html",
}
LANDING_IMAGE_SUFFIXES = (".jpg", ".jpeg", ".png", ".webp")


def _image_credits():
    """Parse the IMAGE_CREDITS entries from site.ts -> [{"who", "url", "file"}] (url may be None).

    Each entry is a `{ … }` object literal whose fields are plain double-quoted strings."""
    site = SITE_TS.read_text(encoding="utf-8")
    m = re.search(r"IMAGE_CREDITS\b[^=]*=\s*\[(.*?)\];", site, re.S)
    if not m:
        return []
    out = []
    for body in re.findall(r"\{([^{}]*)\}", m.group(1)):
        field = lambda k: (re.search(rf'\b{k}:\s*"([^"]*)"', body) or [None, None])[1]
        out.append({"who": field("who"), "url": field("url"), "file": field("file")})
    return out


def _learn_built_pages():
    learn = STATIC / "learn"
    return sorted(learn.rglob("index.html")) if learn.exists() else []


class LandingPage(unittest.TestCase):
    """The gurbanisoul.com landing page (built into webapp/static/index.html) must stay verbatim,
    honest, credited and light. Skips cleanly if the site has not been built yet."""

    @classmethod
    def setUpClass(cls):
        cls.index = STATIC / "index.html"
        cls.html = cls.index.read_text(encoding="utf-8") if cls.index.exists() else None

    def _skip_if_unbuilt(self):
        if self.html is None:
            self.skipTest("webapp/static/index.html not built (run: cd frontend && npm run build && npm run sync)")

    def test_landing_verse_is_verbatim(self):
        # The Gurmukhi on the landing must byte-match the corpus (Ang 1, first line).
        self._skip_if_unbuilt()
        db = ROOT / "db" / "sggs.sqlite"
        if not (db.exists() and db.read_bytes()[:15] == b"SQLite format 3"):
            self.skipTest("db/sggs.sqlite not present (git lfs pull)")
        m = re.search(r'<p class="verse gm" lang="pa"[^>]*>([^<]+)</p>', self.html)
        self.assertIsNotNone(m, "landing verse <p class=\"verse gm\" lang=\"pa\"> not found")
        shown = m.group(1).strip()
        want = sqlite3.connect(f"file:{db}?mode=ro", uri=True).execute(
            "SELECT gurmukhi FROM lines WHERE ang=1 ORDER BY id LIMIT 1").fetchone()[0].strip()
        self.assertEqual(shown, want, "landing verse is not verbatim from db/sggs.sqlite (Ang 1)")

    def test_landing_copy_is_honest(self):
        self._skip_if_unbuilt()
        # No "AI" except "AI-generated" (the negative claim), no "beta". Same spirit as the listing lint.
        stripped = re.sub(r"(?i)\bAI-generated\b", "", self.html)
        self.assertNotRegex(stripped, r"\bAI\b", "landing mentions AI other than 'AI-generated'")
        # visible-text "beta" (not the CSS/hash noise): check the body text only, roughly.
        self.assertNotRegex(self.html, r"(?i)>[^<]*\bbeta\b", "landing says 'beta'")

    def test_every_img_has_an_alt_attribute(self):
        # Every <img> on every built marketing page (Home, Features, The watch, Privacy, Support
        # and the Learn section) carries an alt attribute; Home must have at least one image.
        self._skip_if_unbuilt()
        self.assertTrue(re.findall(r"<img\b[^>]*>", self.html), "no <img> on the landing")
        pages = [(r, f) for r, f in MARKETING_BUILT.items() if f.exists()]
        pages += [("/" + f.parent.relative_to(STATIC).as_posix(), f) for f in _learn_built_pages()]
        for route, f in pages:
            html = f.read_text(encoding="utf-8")
            missing = [t for t in re.findall(r"<img\b[^>]*>", html) if not re.search(r"\balt=", t)]
            self.assertEqual(missing, [], f"{route}: an <img> has no alt attribute")

    def test_imagery_is_credited(self):
        # Every image file shipped under src/assets/landing/ has EXACTLY ONE IMAGE_CREDITS entry
        # (site.ts) whose `file` names it; every maker (`who`) is credited on the built landing AND
        # in NOTICE.md. Original artwork (no url) → an "Artwork" credit. Unsplash photographs (url)
        # → the page names "Unsplash" and each url is the photographer's bare-host profile
        # https://unsplash.com/@<handle> (never images.unsplash.com — photos are self-hosted).
        self._skip_if_unbuilt()
        credits = _image_credits()
        self.assertTrue(credits, "IMAGE_CREDITS not found / empty in frontend/src/site.ts")
        for c in credits:
            self.assertTrue(c["who"], f"an IMAGE_CREDITS entry has no `who`: {c}")
            self.assertTrue(c["file"], f"IMAGE_CREDITS entry for {c['who']!r} has no `file`")
        files = sorted(p.name for p in LANDING_ASSETS.glob("*")
                       if p.suffix.lower() in LANDING_IMAGE_SUFFIXES) if LANDING_ASSETS.exists() else []
        for name in files:
            n = sum(1 for c in credits if c["file"] == name)
            self.assertEqual(n, 1, f"src/assets/landing/{name}: expected exactly one IMAGE_CREDITS entry, got {n}")
        notice = (ROOT / "NOTICE.md").read_text(encoding="utf-8")
        for c in credits:
            self.assertIn(c["who"], self.html, f"image maker {c['who']!r} not credited on the landing")
            self.assertIn(c["who"], notice, f"image maker {c['who']!r} not credited in NOTICE.md")
        self.assertIn("Artwork", self.html, "landing does not carry an Artwork credit")
        photos = [c for c in credits if c["url"]]
        if photos:
            self.assertIn("Unsplash", self.html, "Unsplash photographs are used but 'Unsplash' is not credited")
            for c in photos:
                self.assertRegex(c["url"], r"^https://unsplash\.com/@[A-Za-z0-9_.-]+$",
                                 f"{c['who']!r}: credit url must be https://unsplash.com/@<handle>")

    def test_seo_head_present(self):
        self._skip_if_unbuilt()
        self.assertIn('rel="canonical" href="https://gurbanisoul.com/"', self.html)
        self.assertRegex(self.html, r'property="og:image" content="https://gurbanisoul\.com/')
        self.assertRegex(self.html, r'name="description" content="[^"]{40,}"')

    def test_marketing_page_weight_budgets(self):
        # Per-page HTML budgets: Home/Features/The watch/Privacy/Support ≤ 60 KB each; every Learn
        # page ≤ 48 KB; and no served AVIF/WebP variant over 340 KB.
        self._skip_if_unbuilt()
        for route, f in MARKETING_BUILT.items():
            if f.exists():
                self.assertLessEqual(len(f.read_bytes()), 60 * 1024, f"{route}: HTML over 60 KB")
        for f in _learn_built_pages():
            self.assertLessEqual(len(f.read_bytes()), 48 * 1024,
                                 f"/{f.parent.relative_to(STATIC).as_posix()}: HTML over 48 KB")
        astro = STATIC / "_astro"
        heavy = [f.name for f in astro.glob("*") if f.suffix in (".avif", ".webp") and f.stat().st_size > 340 * 1024]
        self.assertEqual(heavy, [], f"served image variant(s) over 340 KB: {heavy}")

    def test_marketing_pages_eager_discipline(self):
        # Home: at most 2 eager images (hero artwork + hero phone) and exactly ONE
        # fetchpriority="high" (the artwork — the LCP). Every other page: nothing eager, nothing
        # high-priority. Every other <img> is lazy. If Home preloads an image, the preload's
        # imagesrcset must be a subset of the hero's AVIF srcset (or the browser fetches twice).
        self._skip_if_unbuilt()
        for route, f in MARKETING_BUILT.items():
            if not f.exists():
                continue
            html = f.read_text(encoding="utf-8")
            imgs = re.findall(r"<img\b[^>]*>", html)
            eager = [t for t in imgs if 'loading="eager"' in t]
            high = re.findall(r'fetchpriority="high"', html)
            if route == "/":
                self.assertLessEqual(len(eager), 2, f"/: {len(eager)} eager images (max 2)")
                self.assertEqual(len(high), 1, f"/: expected exactly one fetchpriority=high, got {len(high)}")
            else:
                self.assertEqual(eager, [], f"{route}: eager image(s) off the home page")
                self.assertEqual(high, [], f"{route}: fetchpriority=high off the home page")
            lazy_missing = [t for t in imgs if 'loading="eager"' not in t and 'loading="lazy"' not in t]
            self.assertEqual(lazy_missing, [], f"{route}: <img> neither eager nor lazy")
        preload = re.search(r'<link\b[^>]*rel="preload"[^>]*as="image"[^>]*>', self.html)
        if preload:
            ss = re.search(r'imagesrcset="([^"]+)"', preload.group(0))
            self.assertIsNotNone(ss, "/: image preload has no imagesrcset")
            hero = re.search(r'<source\b[^>]*type="image/avif"[^>]*srcset="([^"]+)"', self.html) or \
                re.search(r'<source\b[^>]*srcset="([^"]+)"[^>]*type="image/avif"', self.html)
            self.assertIsNotNone(hero, "/: no AVIF <source> for the hero")
            urls = lambda v: {part.strip().split(" ")[0] for part in v.split(",") if part.strip()}
            self.assertLessEqual(urls(ss.group(1)), urls(hero.group(1)),
                                 "/: preload imagesrcset is not a subset of the hero's AVIF srcset")

    def test_home_has_rhythm(self):
        # Home v2 rhythm: ≥3 warm-ink (data-theme="dark") sections, ≥1 photo band, and no two dark
        # sections adjacent (the rhythm is enforced, not remembered).
        self._skip_if_unbuilt()
        dark = re.findall(r'<section\b[^>]*data-theme="dark"', self.html)
        self.assertGreaterEqual(len(dark), 3, f"/: only {len(dark)} data-theme=dark sections")
        self.assertRegex(self.html, r'class="[^"]*\bphoto-band\b', "/: no .photo-band")
        from html.parser import HTMLParser

        class Top(HTMLParser):
            """Collect the direct element children of <main> (a tag stack, tolerant of unclosed tags)."""
            VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
                    "source", "track", "wbr"}

            def __init__(self):
                super().__init__()
                self.stack, self.kids, self.done = [], [], False

            def _in_main_top(self):
                return not self.done and self.stack and self.stack[-1] == "main"

            def handle_starttag(self, tag, attrs):
                if self._in_main_top():
                    self.kids.append((tag, dict(attrs)))
                if tag not in self.VOID:
                    self.stack.append(tag)

            def handle_endtag(self, tag):
                if tag in self.VOID or tag not in self.stack:
                    return
                while self.stack:
                    top_tag = self.stack.pop()
                    if top_tag == tag:
                        break
                if tag == "main":
                    self.done = True

        top = Top()
        top.feed(self.html)
        kids = [(t, a) for t, a in top.kids if t not in ("script", "style", "template")]
        flags = [a.get("data-theme") == "dark" for _, a in kids]
        pairs = [i for i in range(len(flags) - 1) if flags[i] and flags[i + 1]]
        self.assertEqual(pairs, [], "/: two data-theme=dark sections are adjacent")

    def test_marketing_pages_have_no_kb_shell(self):
        # The marketing pages render in the Gurbani Soul shell, never the Knowledge Base's
        # (Base.astro) header/toolbar — including the App Store's /privacy and /support.
        self._skip_if_unbuilt()
        for route in ("/", "/features", "/watch", "/privacy", "/support"):
            f = MARKETING_BUILT[route]
            if not f.exists():
                continue
            html = f.read_text(encoding="utf-8")
            self.assertNotIn("data-topbar", html, f"{route}: KB top bar present")
            self.assertNotIn('class="kb-tabs"', html, f"{route}: KB tab bar present")
            self.assertNotIn('id="saroopBtn"', html, f"{route}: KB saroop toggle present")
            self.assertNotIn('id="displaySheet"', html, f"{route}: KB display sheet present")
            self.assertNotIn('id="randomBtn"', html, f"{route}: KB random button present")
            self.assertIn('id="mnav"', html, f"{route}: marketing nav #mnav missing")

    def test_cta_state_is_consistent(self):
        # The App Store CTAs are in exactly one of two states (site.ts APP_STORE_LIVE, a build-time
        # switch): before launch, one canonical "coming soon" element (the hero) plus the download
        # band's own marker, and no store link, Smart App Banner or JSON-LD installUrl; once live,
        # no coming-soon marker at all and store links in the hero, the download band and the nav.
        self._skip_if_unbuilt()
        live = 'name="apple-itunes-app"' in self.html
        soon = re.findall(r'data-app-store="coming-soon(?:-foot|-nav)?"', self.html)
        store_links = re.findall(r'<a\b[^>]*href="https://apps\.apple\.com/app/id\d+"', self.html)
        if live:
            self.assertEqual(soon, [], "live App Store build still shows a coming-soon marker")
            self.assertGreaterEqual(len(store_links), 3, "live build: expected store links in hero, band and nav")
            self.assertIn("installUrl", self.html, "live build: JSON-LD SoftwareApplication lacks installUrl")
        else:
            self.assertEqual(soon.count('data-app-store="coming-soon"'), 1,
                             "expected exactly one canonical [data-app-store=coming-soon] (the hero)")
            self.assertEqual(soon.count('data-app-store="coming-soon-foot"'), 1,
                             "expected the download band's [data-app-store=coming-soon-foot]")
            self.assertEqual(store_links, [], "coming-soon build links to the App Store")
            self.assertNotIn("installUrl", self.html, "coming-soon build carries a JSON-LD installUrl")

    def test_landing_facts_match_the_data(self):
        # Every count the marketing pages quote comes from src/generated/landing-facts.json
        # (scripts/gen_landing_verse.py). It must agree with the pinned dataset and the roster, so a
        # dataset or roster change cannot leave a stale number on the site.
        facts = json.loads((ROOT / "frontend" / "src" / "generated" / "landing-facts.json").read_text(encoding="utf-8"))
        lock = json.loads((ROOT / "dataset.lock.json").read_text(encoding="utf-8"))
        self.assertEqual(facts["db_sha256"], lock["database"]["sha256"],
                         "landing-facts.json was generated from another dataset: run scripts/gen_landing_verse.py")
        roster = json.loads((ROOT / "frontend" / "public" / "contributors.json").read_text(encoding="utf-8"))["contributors"]
        self.assertEqual(facts["voices"], len(roster), "landing-facts.json voices != contributors.json")
        self.assertEqual(facts["voice_traditions"], len({v["kind"] for v in roster}))
        db = ROOT / "db" / "sggs.sqlite"
        if not (db.exists() and db.read_bytes()[:15] == b"SQLite format 3"):
            self.skipTest("db/sggs.sqlite not present (make dataset)")
        conn = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
        one = lambda sql: conn.execute(sql).fetchone()[0]
        want = {
            "angs": one("SELECT max(ang) FROM lines"),
            "lines": one("SELECT count(*) FROM lines"),
            "raags": one("SELECT count(*) FROM raags"),
            "vaars": one("SELECT count(*) FROM vaars"),
            "vaar_pauris": one("SELECT count(*) FROM vaar_units WHERE kind='pauri'"),
            "vaar_saloks": one("SELECT count(*) FROM vaar_units WHERE kind='salok'"),
            "themes": one("SELECT count(*) FROM concepts"),
            "themed_lines": one("SELECT count(DISTINCT line_id) FROM concept_lines"),
        }
        self.assertEqual({k: facts[k] for k in want}, want, "landing-facts.json != db/sggs.sqlite")

    def test_marketing_pages_quote_no_stale_counts(self):
        # Counts that were true of an older app or dataset must not come back on the built pages.
        self._skip_if_unbuilt()
        stale = [r"\b30 (voices|contributors)\b", r"\b53 (themes|concepts)\b"]
        for route, f in MARKETING_BUILT.items():
            if f.exists():
                html = f.read_text(encoding="utf-8")
                for pat in stale:
                    self.assertNotRegex(html, pat, f"{route}: stale count matching {pat!r}")

    def test_landing_raags_match_db(self):
        # The raags listed under each pahar must be exactly the DB's primary claims for that pahar,
        # and pahar 7 (the silent night) must list none. Since the multi-page redesign the raag
        # <li data-pahar> markup lives on the dedicated /watch page (webapp/static/watch/index.html).
        self._skip_if_unbuilt()
        watch = STATIC / "watch" / "index.html"
        if not watch.exists():
            self.skipTest("webapp/static/watch/index.html not built (cd frontend && npm run build:deploy)")
        html = watch.read_text(encoding="utf-8")
        db = ROOT / "db" / "sggs.sqlite"
        if not (db.exists() and db.read_bytes()[:15] == b"SQLite format 3"):
            self.skipTest("db/sggs.sqlite not present (git lfs pull)")
        conn = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
        for p in range(1, 9):
            m = re.search(rf'<li[^>]*\bdata-pahar="{p}"[^>]*>(.*?)</li>', html, re.S)
            self.assertIsNotNone(m, f"no <li data-pahar=\"{p}\"> on /watch")
            shown = set(re.findall(r'<span class="gm" lang="pa"[^>]*>([^<]+)</span>', m.group(1)))
            want = {r[0] for r in conn.execute(
                "SELECT raag_name FROM raag_timing_claims WHERE claim_type='primary' AND pahar=?", (p,))}
            self.assertEqual(shown, want, f"pahar {p}: /watch raags {shown} != DB primary claims {want}")
        # pahar 7 must have none
        m7 = re.search(r'<li[^>]*\bdata-pahar="7"[^>]*>(.*?)</li>', html, re.S)
        self.assertNotIn('class="gm"', m7.group(1), "pahar 7 must list no raags")


MARKETING_CSS = ROOT / "frontend" / "src" / "styles" / "marketing.css"
COMPONENTS = ROOT / "frontend" / "src" / "components"
PAGES = ROOT / "frontend" / "src" / "pages"
INDEX_ASTRO = PAGES / "index.astro"
# Marketing pages (Marketing.astro shell) whose scoped CSS the brand discipline also governs.
MARKETING_PAGES = ("index.astro", "features.astro", "watch.astro", "privacy.astro", "support.astro")


def _marketing_style_sources():
    """(name, text) for the marketing stylesheet, every component, and the marketing pages' CSS."""
    out = [("marketing.css", MARKETING_CSS.read_text(encoding="utf-8"))]
    for p in sorted(COMPONENTS.glob("*.astro")):
        out.append((p.name, p.read_text(encoding="utf-8")))
    for name in MARKETING_PAGES:
        p = PAGES / name
        if p.exists():
            out.append((name, p.read_text(encoding="utf-8")))
    return out


def _strip_dark_scope(css):
    """Remove balanced `[data-theme="dark"] { … }` blocks so what remains is 'light-mode' CSS."""
    out, i = [], 0
    while i < len(css):
        m = re.search(r'\[data-theme="dark"\][^{]*\{', css[i:])
        if not m:
            out.append(css[i:])
            break
        start = i + m.start()
        out.append(css[i:start])
        j = i + m.end()
        depth = 1
        while j < len(css) and depth:
            if css[j] == "{":
                depth += 1
            elif css[j] == "}":
                depth -= 1
            j += 1
        i = j
    return "".join(out)


def _load_script(rel):
    """Import a repo script by path (scripts/ is not a package)."""
    import importlib.util
    path = ROOT / rel
    spec = importlib.util.spec_from_file_location(path.stem, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class WebThemesAreGeneratedAndReadable(unittest.TestCase):
    """The Knowledge Base colour themes: generated files current, every text pair above its floor."""

    @classmethod
    def setUpClass(cls):
        cls.gen = _load_script("scripts/brand/gen_web_themes.py")
        cls.src = json.loads((ROOT / "docs/brand/web-themes.json").read_text(encoding="utf-8"))

    def test_generated_files_are_current_and_every_pair_passes(self):
        import contextlib, io
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = self.gen.main(["--check"])
        self.assertEqual(code, 0, out.getvalue())

    def test_a_pair_below_its_floor_is_caught(self):
        import copy
        bad = copy.deepcopy(self.src)
        bad["themes"][0]["light"]["accentText"] = "#E0C36A"          # a pale gold: unreadable on paper
        _, fails = self.gen.derive(bad)
        self.assertTrue(any("light accent text" in f for f in fails), fails)

    def test_the_default_theme_exists_and_ids_are_unique(self):
        ids = [t["id"] for t in self.src["themes"]]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertIn(self.src["default"], ids)
        for t in self.src["themes"]:
            self.assertIn(t["status"], ("approved", "review", "held"), t["id"])
            self.assertIn(t["collection"], self.src["collections"], t["id"])

    def test_an_ink_on_a_chip_is_part_of_the_proof(self):
        # a chip is a translucent wash: an ink that reads on a surface can fail on a chip over it
        import copy
        bad = copy.deepcopy(self.src)
        bad["surfaces"]["light"]["chip"] = "rgba(43,26,5,.30)"
        _, fails = self.gen.derive(bad)
        self.assertTrue(any("light faint ink on a chip on card" in f for f in fails), fails)

    def test_the_accent_edge_holds_on_every_tint_and_is_the_accent_where_it_can_be(self):
        # --accent-ui edges a filled control and marks the current page: 3:1 on every surface it meets,
        # the cloth's motif included. It is the theme's own accent unless a tint needs it deeper.
        themes, fails = self.gen.derive(self.src)
        self.assertEqual(fails, [])
        raw = {t["id"]: t for t in self.src["themes"]}
        deepened = []
        for t in themes:
            for mode in ("light", "dark"):
                ui = t[mode]["accent-ui"]
                for surface in ("canvas", "tile1", "tile2"):
                    self.assertGreaterEqual(self.gen.ratio(ui, t[mode][surface]), 3.0, f"{t['id']} {mode} edge on {surface}")
                if ui.upper() != raw[t["id"]][mode]["accent"].upper():
                    deepened.append(f"{t['id']} {mode}")
        self.assertNotIn("soul light", deepened)
        self.assertNotIn("soul dark", deepened)
        self.assertLessEqual(len(deepened), 4, f"an edge is the accent itself except where a tint forbids it: {deepened}")

    def test_the_motif_strength_is_the_generated_one(self):
        # the cloth's text is proved on the motif at the strength in web-themes.json: a stylesheet
        # that paints it stronger would outrun the proof
        kb = ROOT / "frontend" / "src" / "styles" / "kb"
        css = "".join(p.read_text(encoding="utf-8") for p in sorted(kb.glob("*.css")) if p.name != "themes.css")
        painted = re.findall(r"background:var\(--co\);\s*opacity:([^;]+);", css)
        self.assertTrue(painted, "the motif layer was not found")
        self.assertEqual(set(painted), {"var(--motif)"})

    def test_accent_text_is_never_set_on_a_chip(self):
        # not in the proof (see the generator): accent text sits on --accent-wash instead
        kb = ROOT / "frontend" / "src" / "styles" / "kb"
        bad = []
        for p in sorted(kb.glob("*.css")):
            for block in re.findall(r"\{([^{}]*)\}", p.read_text(encoding="utf-8")):
                if "background:var(--chip)" in block and re.search(r"(?<![-\w])color\s*:\s*var\(--(accent|gold|accent-text)\)", block):
                    bad.append(f"{p.name}: {block.strip()[:80]}")
        self.assertEqual(bad, [])

    def test_a_companion_colour_is_never_a_text_colour(self):
        # companions are decorative (hem, motif, tile wash): no rule may set text in --co
        kb = ROOT / "frontend" / "src" / "styles" / "kb"
        bad = [p.name for p in sorted(kb.glob("*.css")) if re.search(r"(?<![-\w])color\s*:\s*var\(--co\)", p.read_text(encoding="utf-8"))]
        self.assertEqual(bad, [], f"text set in the companion colour in: {bad}")


class StoredKeysAreDisclosed(unittest.TestCase):
    """Every key the site keeps in the browser is named on the privacy page.

    A new key must be added here with the words the policy uses for it; the test then requires
    those words in frontend/src/pages/privacy.astro. None marks a cached copy of public data.
    """

    DISCLOSED = {
        "theme": "theme", "sggs_accent": "colour theme", "sggs_reader_tone": "paper tone",
        "gsize": "text size", "show_t": "transliteration", "sggs_saroop": "traditional-rendering toggle",
        "show_timing": "raag-timing label", "sehaj": "focus mode",
        "sggs_last_ang": "Ang you last read",
        "sggs_bani_pos_": "Nitnem reading positions", "sggs_rehras_variant": "Rehras choice",
        "sggs_pins": "pin", "pahar_mode": "Raag Clock setting", "pahar_loc": "Location",
        "sggs_trail": "Semantic Trail",
        "sggs_meta": None, "sggs_timing_v": None,
    }
    PATTERNS = (
        r"(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*['\"]([^'\"]+)['\"]",
        r"\bstore\.(?:get|set)\(\s*['\"]([^'\"]+)['\"]",
        r"\b[A-Z_]*KEY[A-Z_]*\s*=\s*['\"]([^'\"]+)['\"]",
        r"['\"](sggs_[a-z_]+)['\"]",
    )

    def _keys(self):
        src = ROOT / "frontend" / "src"
        files = list((src / "scripts").glob("*.ts")) + list((src / "scripts").glob("*.js")) + list((src / "layouts").glob("*.astro"))
        found = set()
        for p in files:
            text = p.read_text(encoding="utf-8")
            for pat in self.PATTERNS:
                found.update(re.findall(pat, text))
        return found

    def test_every_stored_key_is_known_and_disclosed(self):
        found = self._keys()
        self.assertGreaterEqual(len(found), 10, "the scan found too few keys to be working")
        unknown = sorted(found - set(self.DISCLOSED))
        self.assertEqual(unknown, [], f"new browser-storage keys: {unknown} — disclose them on the privacy page and add them here")
        policy = (ROOT / "frontend" / "src" / "pages" / "privacy.astro").read_text(encoding="utf-8")
        missing = sorted(k for k in found if self.DISCLOSED[k] and self.DISCLOSED[k] not in policy)
        self.assertEqual(missing, [], f"keys the privacy page does not name: {missing}")


class KbStylesheetIsOrderedPartials(unittest.TestCase):
    """frontend/src/styles/global.css only lists the Knowledge Base partials (styles/kb/*.css).

    Their order is the cascade, so every partial is imported exactly once and the phone rule that
    must win over the per-component sizes stays last.
    """

    STYLES = ROOT / "frontend" / "src" / "styles"
    # The cascade, in full. Equal-specificity rules are settled by this order (a phone rule in
    # responsive.css over a component rule before it, phone-controls.css over everything), so a
    # partial moved or inserted is a visual change: it is made here too, deliberately.
    ORDER = ["theme", "tokens", "themes", "base", "shell", "search", "reader", "tiles", "panel", "display", "palette", "insights",
             "reader-related", "trail", "sehaj", "timeline", "study-trail", "responsive", "contributors", "raag-timing",
             "reader-chrome", "nitnem", "library", "motion", "print", "phone-controls"]

    def test_entry_lists_every_partial_once_in_order(self):
        text = re.sub(r"/\*.*?\*/", "", (self.STYLES / "global.css").read_text(encoding="utf-8"), flags=re.S)
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        self.assertEqual(lines[0], '@import "tailwindcss";')
        imported = []
        for ln in lines[1:]:
            m = re.fullmatch(r'@import "\./kb/([a-z0-9-]+)\.css";', ln)
            self.assertIsNotNone(m, f"global.css may hold only kb/ imports, found: {ln}")
            imported.append(m.group(1))
        on_disk = sorted(p.stem for p in (self.STYLES / "kb").glob("*.css"))
        self.assertEqual(sorted(imported), on_disk, "every styles/kb/*.css is imported exactly once")
        self.assertEqual(len(imported), len(set(imported)), "a partial is imported twice")
        self.assertEqual(imported, self.ORDER, "the import order is the cascade: change it on purpose, and here")


class KbPageTransitionsSurviveTheBuild(unittest.TestCase):
    """The Knowledge Base opts into cross-document view transitions in its stylesheet. A CSS minifier
    that does not know the at-rule drops it without a word, so the proof is in the BUILT file: the
    rule is there, only inside the reduced-motion guard, and only in the Knowledge Base's sheet."""

    ASTRO = ROOT / "webapp" / "static" / "_astro"

    def test_the_built_stylesheet_opts_in_under_the_motion_guard_only(self):
        sheets = sorted(self.ASTRO.glob("Base.*.css"))
        if not sheets:
            self.skipTest("webapp/static is not built")
        self.assertEqual(len(sheets), 1, [p.name for p in sheets])
        css = sheets[0].read_text(encoding="utf-8")
        self.assertEqual(css.count("@view-transition"), 1)
        self.assertRegex(css, r"@media \(prefers-reduced-motion:\s*no-preference\)\s*\{\s*@view-transition\s*\{\s*navigation:\s*auto;?\s*\}")
        for name in ("kb-chrome", "kb-tabs"):
            self.assertIn(f"view-transition-name:{name}", css)
        self.assertRegex(css, r"html\.overlay-open [^{]*\{view-transition-name:none")
        others = [p.name for p in sorted(self.ASTRO.glob("*.css")) if p != sheets[0] and "@view-transition" in p.read_text(encoding="utf-8")]
        self.assertEqual(others, [], "the marketing pages have their own router: no cross-document opt-in there")


class KbStylesheetStaysInBudget(unittest.TestCase):
    """The Knowledge Base's one stylesheet is render-blocking on every page, so its size is held to a
    budget. What a reader downloads is the compressed size (24.5 KB on 2026-10-15, release 1.4.x);
    the raw size is what the browser parses (129 KB). A change that needs more must raise the number
    here, in review, with the reason — the stylesheet never grows by accident.

    Why one sheet rather than one per page: the partials are ordered cascade layers whose classes are
    shared across pages (timing chips, trail stones, verse rows), so a split would move rules past
    each other and save about 3 KB compressed. The plan's 95 KB raw target was set before the
    thirteen themes and their colour-mix() fallbacks (about 14 KB of @supports blocks that Safari
    before 16.2 needs) existed; the compressed budget is the one that measures a reader's wait."""

    ASTRO = ROOT / "webapp" / "static" / "_astro"
    GZIP_MAX = 26_000
    RAW_MAX = 132_000

    def test_the_built_stylesheet_is_within_budget(self):
        import gzip
        sheets = sorted(self.ASTRO.glob("Base.*.css"))
        if not sheets:
            self.skipTest("webapp/static is not built")
        raw = sheets[0].read_bytes()
        packed = len(gzip.compress(raw, compresslevel=9))
        self.assertLessEqual(packed, self.GZIP_MAX, f"{sheets[0].name} is {packed:,} bytes gzipped (budget {self.GZIP_MAX:,})")
        self.assertLessEqual(len(raw), self.RAW_MAX, f"{sheets[0].name} is {len(raw):,} bytes raw (budget {self.RAW_MAX:,})")


class ScriptureDisplayInSource(unittest.TestCase):
    """Knowledge Base source never cuts a verse short and never colours Gurmukhi inline.

    The rendered result is proven by the e2e reverence walker (frontend/e2e/reverence.spec.ts);
    this catches the two source patterns it cannot reach, such as a hover tooltip.
    """

    SRC = ROOT / "frontend" / "src"

    def _sources(self):
        files = sorted((self.SRC / "scripts").glob("*.ts")) + sorted((self.SRC / "pages").glob("*.astro"))
        files.append(self.SRC / "layouts" / "Base.astro")
        return [(p.relative_to(ROOT).as_posix(), p.read_text(encoding="utf-8")) for p in files]

    def test_a_verse_is_never_truncated(self):
        cut = re.compile(r"gurmukhi[^;\n]{0,40}\.(?:slice|substring|substr)\(")
        bad = [name for name, text in self._sources() if cut.search(text)]
        self.assertEqual(bad, [], f"a Gurmukhi line is sliced in: {bad}")

    def test_gurmukhi_is_never_coloured_inline(self):
        inline = re.compile(r'class="[^"]*\bgm\b[^"]*"[^>]*style="[^"]*\bcolor\s*:')
        bad = [name for name, text in self._sources() if inline.search(text)]
        self.assertEqual(bad, [], f"inline colour on a Gurmukhi element in: {bad}")


class BrandDisciplineInSource(unittest.TestCase):
    """The Soul-Gold brand rules, enforced on the marketing CSS + components + landing scoped CSS."""

    def test_mark_is_flat(self):
        # The ੴ mark (and everything else on the marketing surface) is flat — no text-shadow.
        bad = [name for name, text in _marketing_style_sources() if re.search(r"text-shadow", text, re.I)]
        self.assertEqual(bad, [], f"text-shadow found in: {bad}")

    def test_no_red_and_gold_discipline(self):
        norm = lambda s: re.sub(r"\s+", "", s).lower()
        for name, text in _marketing_style_sources():
            # One owner-approved exception (brand book §3, 2026-10-18): the Contribute heart's fill, via
            # exactly one `--contribute-heart: #DA291C` declaration. Anything else red still fails.
            allowed = re.compile(r"--contribute-heart\s*:\s*#da291c\s*;", re.I)
            self.assertLessEqual(len(allowed.findall(text)), 1, f"{name}: --contribute-heart declared more than once")
            self.assertNotIn("#da291c", allowed.sub("", text).lower(), f"brand red #DA291C appears in {name}")
            # Literal gold as a text colour is only allowed inside a [data-theme=\"dark\"] scope.
            light = norm(_strip_dark_scope(text))
            self.assertNotIn("color:#ffbc0d", light,
                             f"{name}: gold #FFBC0D used as a text colour outside a dark scope")
        # The verse is ink-coloured.
        idx = INDEX_ASTRO.read_text(encoding="utf-8")
        m = re.search(r"\.verse\s*\{([^}]*)\}", idx)
        self.assertIsNotNone(m, "no .verse rule in index.astro scoped styles")
        self.assertRegex(m.group(1), r"color:\s*var\(--ink\)", ".verse colour is not var(--ink)")


class SubmissionUrlsAreLive(unittest.TestCase):
    def test_robots_and_sitemap_shipped(self):
        for f in ("robots.txt", "sitemap.xml"):
            self.assertTrue((STATIC / f).exists() or (ROOT / "frontend" / "public" / f).exists(), f"missing {f}")


class DocsHygiene(unittest.TestCase):
    """The canonical public host is gurbanisoul.com. The legacy production alias
    `sggs-knowledge-base.vercel.app` may still be *named* — but only in the two docs whose
    job is to record the domain topology, and only as a legacy alias. Anywhere else in the
    tracked Markdown it is a stale URL that will mislead a reader (or get baked into a link),
    so it is forbidden. (Staging's `sggs-staging.vercel.app` is a different host and is fine.)"""

    ALLOWED = {
        Path("docs/process/environments.md"),
        Path("docs/website/README.md"),
    }

    def _tracked_markdown(self):
        # Read-only, stdlib: walk the repo for *.md, skipping vendored/build trees (and the wiki's
        # installed copies of the sibling repositories' docs, which are theirs to keep clean).
        skip = {"node_modules", "dist", "static", "static.bak", ".git", "_astro", "build", ".sources"}
        for p in ROOT.rglob("*.md"):
            rel = p.relative_to(ROOT)
            if any(part in skip for part in rel.parts):
                continue
            yield rel, p

    def test_legacy_vercel_alias_only_in_domain_docs(self):
        offenders = []
        for rel, p in self._tracked_markdown():
            if "sggs-knowledge-base.vercel.app" in p.read_text(encoding="utf-8", errors="ignore"):
                if rel not in self.ALLOWED:
                    offenders.append(str(rel))
        self.assertEqual(
            sorted(offenders), [],
            "legacy vercel.app alias must appear only in the domain-topology docs "
            f"({sorted(str(a) for a in self.ALLOWED)}); found in: {sorted(offenders)}",
        )

    def test_website_readme_exists_and_names_canonical_host(self):
        readme = ROOT / "docs" / "website" / "README.md"
        self.assertTrue(readme.exists(), "docs/website/README.md is missing")
        text = readme.read_text(encoding="utf-8")
        self.assertIn("gurbanisoul.com", text)
        self.assertIn("sggs-knowledge-base.vercel.app", text)  # must document the legacy alias


class VersionPolicyDocumented(unittest.TestCase):
    """The one-number policy (web == API == iOS binary, re-archived every release) must stay
    written down where a future maintainer looks. If someone softens the rule they have to
    delete the sentence, which fails here — so the policy can't quietly rot."""

    SENTENCE = "re-archived at the same version"

    def test_documented_in_release_and_handbook(self):
        for rel in ("docs/process/release.md", "docs/engineering/delivery.md"):
            text = (ROOT / rel).read_text(encoding="utf-8")
            self.assertIn(self.SENTENCE, text, f"{rel} no longer states the one-number policy")

    def test_release_complete_checker_exists(self):
        self.assertTrue((ROOT / "scripts/release/check_release_complete.py").exists(),
                        "scripts/release/check_release_complete.py is missing")


# ------------------------------------------------------------------------------------------------
# PR1 — web foundations: SEO / sitemap / RSS / analytics / smart-banner / theme-token gates.
# These read the BUILT webapp/static (skip cleanly if unbuilt) and the tracked frontend source.
# ------------------------------------------------------------------------------------------------
import xml.etree.ElementTree as ET  # noqa: E402

SITE = "https://gurbanisoul.com"
FRONTEND = ROOT / "frontend"
SITEMAP_NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"


def _norm_url(u):
    """Compare URLs without caring about a single trailing slash."""
    return u.rstrip("/")


def _built_pages():
    """Yield (route, path) for every built *.html except 404.html.

    index.html -> "/"; <dir>/index.html -> "/<dir>"; any other x.html -> "/x".
    """
    for p in sorted(STATIC.rglob("*.html")):
        rel = p.relative_to(STATIC)
        if rel.name == "404.html":
            continue
        if rel.name == "index.html":
            d = rel.parent.as_posix()
            route = "/" if d == "." else "/" + d
        else:
            route = "/" + rel.with_suffix("").as_posix()
        yield route, p


def _unbuilt():
    return not (STATIC / "index.html").exists()


class SeoInvariants(unittest.TestCase):
    """Every built page carries an honest, self-consistent SEO/social head."""

    def setUp(self):
        if _unbuilt():
            self.skipTest("webapp/static not built (cd frontend && npm run build:deploy)")

    def test_every_page_has_correct_seo_head(self):
        pages = list(_built_pages())
        self.assertTrue(pages, "no built HTML pages found")
        marketing = {"/"}
        for route, path in pages:
            html = path.read_text(encoding="utf-8")
            canonical_want = _norm_url(SITE + route)

            cans = re.findall(r'<link rel="canonical" href="([^"]+)"', html)
            self.assertEqual(len(cans), 1, f"{route}: expected exactly one canonical, got {cans}")
            self.assertEqual(_norm_url(cans[0]), canonical_want, f"{route}: wrong canonical {cans[0]}")

            desc = re.search(r'<meta name="description" content="([^"]*)"', html)
            self.assertIsNotNone(desc, f"{route}: no description meta")
            self.assertGreaterEqual(len(desc.group(1)), 40, f"{route}: description under 40 chars")

            og = re.search(r'<meta property="og:image" content="([^"]+)"', html)
            self.assertIsNotNone(og, f"{route}: no og:image")
            og_path = og.group(1).split(SITE, 1)[-1].lstrip("/")
            self.assertTrue((STATIC / og_path).is_file(), f"{route}: og:image {og.group(1)} missing on disk")

            self.assertGreaterEqual(len(re.findall(r'name="theme-color"', html)), 1, f"{route}: no theme-color")

            if route in marketing:
                self.assertRegex(html, r'rel="manifest"', f"{route}: marketing page missing manifest link")

            # hreflang alternates (if any) must be en / x-default and self-referential — no /pa/ yet.
            for lang, href in re.findall(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"', html):
                self.assertIn(lang, ("en", "x-default"), f"{route}: unexpected hreflang {lang}")
                self.assertNotIn("/pa/", href, f"{route}: hreflang points at a /pa/ URL")
                self.assertEqual(_norm_url(href), canonical_want, f"{route}: hreflang not self-referential")


class SitemapInvariants(unittest.TestCase):
    def setUp(self):
        if _unbuilt() or not (STATIC / "sitemap.xml").exists():
            self.skipTest("sitemap.xml not built")

    def test_sitemap_matches_built_routes(self):
        root = ET.parse(STATIC / "sitemap.xml").getroot()
        locs = {_norm_url(el.text) for el in root.iter(f"{SITEMAP_NS}loc")}
        built = {_norm_url(SITE + route) for route, _ in _built_pages()}
        self.assertEqual(locs, built, f"sitemap <loc> set != built HTML routes\n  only in sitemap: "
                         f"{sorted(locs - built)}\n  only built: {sorted(built - locs)}")

    def test_every_lastmod_is_a_date(self):
        root = ET.parse(STATIC / "sitemap.xml").getroot()
        mods = [el.text for el in root.iter(f"{SITEMAP_NS}lastmod")]
        self.assertTrue(mods, "no <lastmod> in sitemap")
        for m in mods:
            self.assertRegex(m, r"^\d{4}-\d{2}-\d{2}", f"lastmod not an ISO date: {m!r}")

    def test_robots_names_sitemap(self):
        for cand in (STATIC / "robots.txt", FRONTEND / "public" / "robots.txt"):
            if cand.exists():
                self.assertIn("sitemap.xml", cand.read_text(encoding="utf-8"))
                return
        self.fail("robots.txt not found")

    def test_learn_routes_present(self):
        root = ET.parse(STATIC / "sitemap.xml").getroot()
        locs = {_norm_url(el.text) for el in root.iter(f"{SITEMAP_NS}loc")}
        self.assertIn(_norm_url(SITE + "/learn"), locs, "sitemap missing /learn")
        # every built Learn article route must be in the sitemap
        for route, _ in _learn_articles():
            self.assertIn(_norm_url(SITE + route), locs, f"sitemap missing {route}")


class RssInvariants(unittest.TestCase):
    def setUp(self):
        if _unbuilt() or not (STATIC / "rss.xml").exists():
            self.skipTest("rss.xml not built")

    def test_rss_parses_and_links_to_site(self):
        root = ET.parse(STATIC / "rss.xml").getroot()
        link = root.find("./channel/link")
        self.assertIsNotNone(link, "rss has no <channel><link>")
        self.assertEqual(_norm_url(link.text), _norm_url(SITE))

    def test_rss_item_count_matches_non_draft_articles(self):
        root = ET.parse(STATIC / "rss.xml").getroot()
        items = root.findall("./channel/item")
        self.assertEqual(len(items), _non_draft_article_count(),
                         "rss item count != number of non-draft Learn articles")
        for it in items:
            link = it.find("link")
            self.assertIsNotNone(link, "rss item has no <link>")
            self.assertTrue(link.text.startswith(SITE + "/learn/"),
                            f"rss item link not a /learn/ URL: {link.text}")


# ------------------------------------------------------------------------------------------------
# PR3 — the Learn content section. These read the BUILT webapp/static/learn/** and db/sggs.sqlite
# (skip cleanly if unbuilt / no DB) plus the tracked Learn source, and enforce that every quoted
# line is verbatim, declared, cited, labelled, and that the copy stays honest.
# ------------------------------------------------------------------------------------------------
LEARN_MDX_DIR = FRONTEND / "src" / "content" / "learn"
QUOTES_JSON = FRONTEND / "src" / "generated" / "quotes.json"
DB = ROOT / "db" / "sggs.sqlite"

_VERSE_P = re.compile(r'<p class="verse gm" lang="pa" data-line-id="(\d+)"[^>]*>([^<]*)</p>')
_FIGURE = re.compile(
    r'<figure class="verse-fig" data-line-id="(\d+)"[^>]*>.*?'
    r'<figcaption class="cite"[^>]*>([^<]*)</figcaption>', re.S)
_LD_JSON = re.compile(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', re.S)


def _learn_articles():
    """(route, html) for every built Learn ARTICLE page (excludes the /learn index)."""
    base = STATIC / "learn"
    if not base.exists():
        return
    for p in sorted(base.rglob("index.html")):
        if p.parent.name == "learn":          # the /learn index itself, not an article
            continue
        yield "/learn/" + p.parent.name, p.read_text(encoding="utf-8")


def _all_learn_html():
    """html of every built Learn page, index included."""
    base = STATIC / "learn"
    if not base.exists():
        return
    for p in sorted(base.rglob("index.html")):
        yield p.read_text(encoding="utf-8")


def _non_draft_article_count():
    n = 0
    for mdx in LEARN_MDX_DIR.glob("*.mdx"):
        m = re.search(r"(?ms)^---\s*\n(.*?)\n---", mdx.read_text(encoding="utf-8"))
        fm = m.group(1) if m else ""
        if not re.search(r"(?m)^draft:\s*true\s*$", fm):
            n += 1
    return n


def _iter_ld_objects(node):
    """Yield every dict in a parsed JSON-LD payload (handles @graph / arrays / nesting)."""
    if isinstance(node, dict):
        yield node
        for v in node.values():
            yield from _iter_ld_objects(v)
    elif isinstance(node, list):
        for v in node:
            yield from _iter_ld_objects(v)


class LearnSection(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.unbuilt = _unbuilt() or not (STATIC / "learn").exists()
        cls.no_db = not (DB.exists() and DB.read_bytes()[:15] == b"SQLite format 3")
        cls.conn = None if cls.no_db else sqlite3.connect(f"file:{DB}?mode=ro", uri=True)

    def _need_built(self):
        if self.unbuilt:
            self.skipTest("webapp/static/learn not built (cd frontend && npm run build:deploy)")

    def _need_db(self):
        if self.no_db:
            self.skipTest("db/sggs.sqlite not present (git lfs pull)")

    def _db_line(self, lid):
        return self.conn.execute(
            "SELECT ang, gurmukhi FROM lines WHERE id=?", (lid,)).fetchone()

    def test_quotes_verbatim(self):
        self._need_built(); self._need_db()
        quotes = json.loads(QUOTES_JSON.read_text(encoding="utf-8"))["quotes"]
        seen = 0
        for route, html in _learn_articles():
            for m in _VERSE_P.finditer(html):
                lid, shown = int(m.group(1)), m.group(2).strip()
                row = self._db_line(lid)
                self.assertIsNotNone(row, f"{route}: line id {lid} not in DB")
                self.assertEqual(shown, row[1].strip(),
                                 f"{route}: rendered verse id {lid} is not verbatim from db")
                self.assertIn(str(lid), quotes, f"{route}: id {lid} missing from quotes.json")
                self.assertEqual(quotes[str(lid)]["gurmukhi"].strip(), row[1].strip(),
                                 f"quotes.json id {lid} gurmukhi != db")
                seen += 1
        self.assertGreater(seen, 0, "no rendered verses found in any Learn article")

    def test_quotes_declared(self):
        self._need_built()
        quotes = json.loads(QUOTES_JSON.read_text(encoding="utf-8"))["quotes"]
        for route, html in _learn_articles():
            for lid in set(re.findall(r'data-line-id="(\d+)"', html)):
                self.assertIn(lid, quotes, f"{route}: body data-line-id {lid} not in quotes.json")

    def test_explanation_labelled(self):
        self._need_built()
        LABEL = "Explanation (interpretation, not scripture)"
        for route, html in _learn_articles():
            if 'class="verse gm"' in html:
                self.assertIn(LABEL, html,
                              f"{route}: quotes scripture but has no labelled Explanation")

    def test_citation_format(self):
        self._need_built(); self._need_db()
        pat = re.compile(r"^Sri Guru Granth Sahib Ji · Ang (\d{1,4})")
        seen = 0
        for route, html in _learn_articles():
            for m in _FIGURE.finditer(html):
                lid, cite = int(m.group(1)), m.group(2).strip()
                cm = pat.match(cite)
                self.assertIsNotNone(cm, f"{route}: bad citation format: {cite!r}")
                row = self._db_line(lid)
                self.assertIsNotNone(row, f"{route}: line id {lid} not in DB")
                self.assertEqual(int(cm.group(1)), row[0],
                                 f"{route}: citation Ang for id {lid} != db Ang {row[0]}")
                seen += 1
        self.assertGreater(seen, 0, "no citations found in any Learn article")

    def test_learn_honest_copy(self):
        self._need_built()
        for html in _all_learn_html():
            stripped = re.sub(r"(?i)\bAI-generated\b", "", html)
            self.assertNotRegex(stripped, r"\bAI\b", "Learn HTML mentions AI other than 'AI-generated'")
            self.assertNotRegex(html, r"(?i)>[^<]*\bbeta\b", "Learn HTML says 'beta'")
            self.assertNotRegex(html, r"(?i)\b(audio|kirtan|android)\b",
                                "Learn HTML claims audio/kirtan/android")

    def test_article_jsonld_valid(self):
        self._need_built()
        for route, html in _learn_articles():
            blocks = _LD_JSON.findall(html)
            self.assertTrue(blocks, f"{route}: no application/ld+json block")
            objs = []
            for b in blocks:
                try:
                    objs.extend(_iter_ld_objects(json.loads(b)))
                except json.JSONDecodeError as e:
                    self.fail(f"{route}: ld+json does not parse: {e}")
            types = {o.get("@type") for o in objs}
            self.assertIn("BreadcrumbList", types, f"{route}: no BreadcrumbList JSON-LD")
            article = next((o for o in objs if o.get("@type") == "Article"), None)
            self.assertIsNotNone(article, f"{route}: no Article JSON-LD")
            self.assertTrue(article.get("headline"), f"{route}: Article missing headline")
            self.assertTrue(article.get("datePublished"), f"{route}: Article missing datePublished")


class ExternalRequestAllowlist(unittest.TestCase):
    """The marketing page (and the JS it loads) may only reference an approved set of external
    hosts, and the Vercel analytics loader must always sit behind the gurbanisoul.com hostname
    guard — never an unconditional request."""

    ALLOWED = {
        "gurbanisoul.com", "unsplash.com", "apps.apple.com",
        "github.com", "buttondown.com", "sggs-knowledge-base.onrender.com",
        # JSON-LD vocabulary URI (@context / @type). It is a structured-data namespace, never a
        # network request, so it does not widen the CSP connect-src.
        "schema.org",
    }

    def setUp(self):
        if _unbuilt():
            self.skipTest("webapp/static not built")

    def _marketing_sources(self):
        index = STATIC / "index.html"
        html = index.read_text(encoding="utf-8")
        sources = [("index.html", html)]
        for ref in re.findall(r'(?:src|href)="(/_astro/[^"]+\.js)"', html):
            js = STATIC / ref.lstrip("/")
            if js.is_file():
                sources.append((ref, js.read_text(encoding="utf-8")))
        return sources

    def test_absolute_hosts_are_allowlisted(self):
        bad = []
        for name, text in self._marketing_sources():
            for host in re.findall(r'https?://([a-z0-9.-]+)', text, re.I):
                if host.lower() not in self.ALLOWED:
                    bad.append(f"{name}: {host}")
        self.assertEqual(bad, [], f"marketing references non-allowlisted host(s): {bad}")

    def test_vercel_insights_is_hostname_guarded(self):
        html = (STATIC / "index.html").read_text(encoding="utf-8").splitlines()
        for i, line in enumerate(html):
            if "_vercel/insights" in line:
                window = " ".join(html[max(0, i - 1): i + 2])
                self.assertIn("gurbanisoul.com", window,
                              f"line {i+1}: /_vercel/insights is not beside a gurbanisoul.com guard")


class SmartBannerConsistency(unittest.TestCase):
    """If the App Store id or URL is set in site.ts, both must be, and APP_STORE_URL must end with
    /id + APP_STORE_ID (so the Smart App Banner and the download link can never disagree)."""

    def test_app_store_id_and_url_agree(self):
        site = (FRONTEND / "src" / "site.ts").read_text(encoding="utf-8")
        app_id = re.search(r'APP_STORE_ID\s*=\s*"([^"]*)"', site).group(1)
        app_url = re.search(r'APP_STORE_URL\s*=\s*"([^"]*)"', site).group(1)
        if not app_id and not app_url:
            return
        self.assertTrue(app_id and app_url, "one of APP_STORE_ID / APP_STORE_URL is set but not the other")
        self.assertTrue(app_url.endswith("/id" + app_id),
                        f"APP_STORE_URL {app_url!r} must end with /id{app_id}")


class AppStoreSwitch(unittest.TestCase):
    """Whether the site presents the app as live on the App Store is a build-time switch
    (PUBLIC_APP_STORE_LIVE=1, set in the Vercel project env on launch day), never a source edit:
    APP_STORE_LIVE is defined once, from the env, and every App Store render site keys on it —
    never on APP_STORE_URL/APP_STORE_ID, which are committed Apple values and always truthy."""

    DEFINITION = 'export const APP_STORE_LIVE = import.meta.env.PUBLIC_APP_STORE_LIVE === "1";'

    def test_live_flag_comes_only_from_the_env(self):
        site = (FRONTEND / "src" / "site.ts").read_text(encoding="utf-8")
        assignments = re.findall(r"(?<![A-Z_])APP_STORE_LIVE\s*=(?!=)", site)
        self.assertEqual(len(assignments), 1, "APP_STORE_LIVE must be defined exactly once")
        self.assertIn(self.DEFINITION, site, "APP_STORE_LIVE must read PUBLIC_APP_STORE_LIVE and nothing else")
        for f in [FRONTEND / "vercel.json", *FRONTEND.glob(".env*"), ROOT / "vercel.json"]:
            if f.exists():
                self.assertNotIn("PUBLIC_APP_STORE_LIVE", f.read_text(encoding="utf-8"),
                                 f"{f.relative_to(ROOT)}: the switch belongs in the Vercel project env, not the repo")

    def test_render_sites_key_on_the_live_flag(self):
        truthy = re.compile(r"(\{\s*|\.\.\.\(\s*)APP_STORE_(URL|ID)\s*(\?|&&)")
        users = []
        for f in sorted((FRONTEND / "src").rglob("*")):
            if f.suffix not in (".astro", ".ts", ".tsx", ".mdx") or f.name == "site.ts":
                continue
            text = f.read_text(encoding="utf-8")
            rel = f.relative_to(ROOT)
            self.assertIsNone(truthy.search(text), f"{rel}: gate App Store output on APP_STORE_LIVE, not on the URL/ID")
            if re.search(r"\bAPP_STORE_(URL|ID)\b", text):
                users.append(rel)
                self.assertIn("APP_STORE_LIVE", text, f"{rel}: uses the App Store URL/ID without APP_STORE_LIVE")
        self.assertGreaterEqual(len(users), 3, f"expected Seo, MarketingNav and the landing to use the switch, got {users}")


class NoSecretsInFrontend(unittest.TestCase):
    """No obvious secrets in tracked frontend source. (The newsletter form URL is a build-time
    env var, `import.meta.env.PUBLIC_NEWSLETTER_FORM_URL`; that its VALUE — a buttondown.com URL —
    never lands in src is enforced separately by NewsletterPrivacy.)"""

    SECRET_PATTERNS = [
        r"AKIA[0-9A-Z]{16}",                       # AWS access key id
        r"AIza[0-9A-Za-z_\-]{35}",                 # Google API key
        r"sk_live_[0-9A-Za-z]{16,}",               # Stripe secret
        r"gh[pousr]_[0-9A-Za-z]{20,}",             # GitHub token
        r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    ]

    def test_no_secret_patterns(self):
        rx = re.compile("|".join(self.SECRET_PATTERNS))
        offenders = []
        src = FRONTEND / "src"
        for p in src.rglob("*"):
            if not p.is_file() or p.suffix in (".ttf", ".woff2", ".woff", ".png", ".jpg", ".jpeg", ".webp", ".avif"):
                continue
            if rx.search(p.read_text(encoding="utf-8", errors="ignore")):
                offenders.append(str(p.relative_to(ROOT)))
        self.assertEqual(offenders, [], f"possible secret/newsletter-URL literal in: {offenders}")


class WebThemeMatchesTokens(unittest.TestCase):
    """frontend/src/theme.ts hex values must equal the light/dark legs of docs/brand/tokens.json."""

    # theme.ts key -> (tokens.json group, key)
    MAP = {
        "paper": ("surfaces", "paper"),
        "paperWarm": ("surfaces", "paperWarm"),
        "card": ("surfaces", "card"),
        "accentFill": ("soul", "accentFill"),
        "accent": ("soul", "accent"),
        "accentText": ("soul", "accentText"),
        "onAccent": ("soul", "onAccent"),
    }

    @staticmethod
    def _leg(theme_ts, leg):
        m = re.search(rf"{leg}:\s*\{{(.*?)\}}", theme_ts, re.S)
        assert m, f"theme.ts has no {leg} block"
        return dict(re.findall(r'(\w+):\s*"(#[0-9A-Fa-f]{6})"', m.group(1)))

    def test_theme_ts_equals_tokens(self):
        tokens = json.loads((ROOT / "docs/brand/tokens.json").read_text(encoding="utf-8"))
        theme_ts = (FRONTEND / "src" / "theme.ts").read_text(encoding="utf-8")
        light, dark = self._leg(theme_ts, "light"), self._leg(theme_ts, "dark")
        for key, (grp, tkey) in self.MAP.items():
            legs = tokens[grp][tkey]
            self.assertEqual(light[key].upper(), legs[0].upper(), f"theme.ts light.{key} != tokens {grp}.{tkey}[0]")
            self.assertEqual(dark[key].upper(), legs[1].upper(), f"theme.ts dark.{key} != tokens {grp}.{tkey}[1]")


class WebThemeGroupColours(unittest.TestCase):
    """frontend/src/styles/kb/tokens.css --tg-* equal tokens.json themeGroup (light and dark legs), and
    each clears 4.5:1 on every surface the web's light and dark neutrals define (themes.css)."""

    def _blocks(self, css):
        out = {}
        for leg, sel in (("light", r':root, :root\[data-theme="light"\] \{'), ("dark", r':root\[data-theme="dark"\] \{')):
            tg, surf = {}, {}
            for m in re.finditer(sel + r"(.*?)\}", css, re.S):
                tg.update(re.findall(r"--tg-(\w+):\s*(#[0-9A-Fa-f]{6})", m.group(1)))
                surf.update(re.findall(r"--(surface-card|surface-raised|paper|canvas|surface-2|tile1|tile2|chrome):\s*(#[0-9A-Fa-f]{6})", m.group(1)))
            out[leg] = (tg, surf)
        return out

    def test_group_colours_equal_tokens_and_clear_aa(self):
        sys.path.insert(0, str(ROOT / "scripts" / "brand"))
        from contrast_report import ratio
        groups = json.loads((ROOT / "docs/brand/tokens.json").read_text(encoding="utf-8"))["themeGroup"]
        tokens_css = self._blocks((FRONTEND / "src/styles/kb/tokens.css").read_text(encoding="utf-8"))
        themes_css = self._blocks((FRONTEND / "src/styles/kb/themes.css").read_text(encoding="utf-8"))
        for i, leg in enumerate(("light", "dark")):
            tg, surfaces = tokens_css[leg][0], themes_css[leg][1]
            self.assertTrue(surfaces, f"no {leg} surfaces parsed from themes.css")
            self.assertEqual(set(tg), set(groups), f"tokens.css {leg} --tg-* roles != tokens.json themeGroup")
            for role, legs in groups.items():
                self.assertEqual(tg[role].upper(), legs[i].upper(), f"--tg-{role} {leg} != tokens themeGroup.{role}[{i}]")
                for name, bg in surfaces.items():
                    self.assertGreaterEqual(ratio(legs[i], bg), 4.5, f"--tg-{role} {leg} on --{name}")
        names = set(re.findall(r"key: '(\w+)'", (FRONTEND / "src/scripts/themegroups.ts").read_text(encoding="utf-8")))
        self.assertEqual(names, set(groups), "themegroups.ts group keys != tokens.json themeGroup roles")


class JsonLdInvariants(unittest.TestCase):
    """Every JSON-LD block in the built HTML parses, and the landing + /support carry the expected,
    self-consistent structured-data types (PR4)."""

    def setUp(self):
        if _unbuilt():
            self.skipTest("webapp/static not built (cd frontend && npm run build:deploy)")

    def _page_html(self, route):
        for r, path in _built_pages():
            if r == route:
                return path.read_text(encoding="utf-8")
        self.fail(f"built page for route {route!r} not found")

    def _ld_objects(self, html):
        objs = []
        for block in _LD_JSON.findall(html):
            try:
                objs.extend(_iter_ld_objects(json.loads(block)))
            except json.JSONDecodeError as e:
                self.fail(f"ld+json does not parse: {e}")
        return objs

    def test_all_ldjson_parses_everywhere(self):
        for route, path in _built_pages():
            html = path.read_text(encoding="utf-8")
            for block in _LD_JSON.findall(html):
                try:
                    json.loads(block)
                except json.JSONDecodeError as e:
                    self.fail(f"{route}: ld+json does not parse: {e}")

    def test_landing_has_org_website_and_software_application(self):
        objs = self._ld_objects(self._page_html("/"))
        types = [o.get("@type") for o in objs]
        self.assertIn("Organization", types, "landing missing Organization JSON-LD")

        website = next((o for o in objs if o.get("@type") == "WebSite"), None)
        self.assertIsNotNone(website, "landing missing WebSite JSON-LD")
        action = website.get("potentialAction") or {}
        self.assertEqual(action.get("@type"), "SearchAction", "WebSite has no SearchAction")
        target = action.get("target", "")
        host = re.match(r"https?://([^/]+)/", target)
        self.assertIsNotNone(host, f"SearchAction target is not an absolute URL: {target!r}")
        canonical_host = SITE.split("://", 1)[1]
        self.assertEqual(host.group(1), canonical_host,
                         f"SearchAction target host {host.group(1)!r} != canonical {canonical_host!r}")

        app = next((o for o in objs if o.get("@type") == "SoftwareApplication"), None)
        self.assertIsNotNone(app, "landing missing SoftwareApplication JSON-LD")
        self.assertEqual((app.get("offers") or {}).get("price"), "0",
                         "SoftwareApplication offers.price must be \"0\"")
        self.assertNotIn("aggregateRating", app,
                         "SoftwareApplication must not carry a fabricated aggregateRating")

    def test_support_faqpage_questions_are_visible_headings(self):
        html = self._page_html("/support")
        objs = self._ld_objects(html)
        faq = next((o for o in objs if o.get("@type") == "FAQPage"), None)
        self.assertIsNotNone(faq, "/support missing FAQPage JSON-LD")
        questions = [q.get("name", "") for q in faq.get("mainEntity", [])
                     if q.get("@type") == "Question"]
        self.assertTrue(questions, "FAQPage has no Question entries")
        # Visible question headings (<h3> under the "Frequently asked" <h2> since v1.3.5; <h4> kept
        # for compatibility) — tags stripped, entities normalised for the compare.
        h4s = [re.sub(r"<[^>]+>", "", body).strip()
               for _lvl, body in re.findall(r"<h([34])[^>]*>(.*?)</h\1>", html, re.S)]
        import html as _htmlmod
        h4_norm = {_htmlmod.unescape(t) for t in h4s}
        for q in questions:
            self.assertIn(_htmlmod.unescape(q), h4_norm,
                          f"FAQPage question not present as a visible <h3>/<h4>: {q!r}")


class NewsletterPrivacy(unittest.TestCase):
    """The newsletter is env-gated and privacy-safe: the Buttondown URL is never a literal in src,
    and with the env var unset (CI/local/this build) the built static carries no buttondown.com
    reference and no newsletter <form>."""

    def test_no_buttondown_value_in_src(self):
        src = FRONTEND / "src"
        offenders = []
        for p in src.rglob("*"):
            if not p.is_file() or p.suffix in (".ttf", ".woff2", ".woff", ".png", ".jpg", ".jpeg", ".webp", ".avif"):
                continue
            if "buttondown.com" in p.read_text(encoding="utf-8", errors="ignore"):
                offenders.append(str(p.relative_to(ROOT)))
        self.assertEqual(offenders, [], f"buttondown.com literal in tracked src: {offenders}")

    def test_built_static_has_no_newsletter_when_env_unset(self):
        if _unbuilt():
            self.skipTest("webapp/static not built")
        for _, path in _built_pages():
            html = path.read_text(encoding="utf-8")
            self.assertNotIn("buttondown.com", html,
                             f"{path.name}: buttondown.com in built HTML (env should be unset)")
            self.assertNotRegex(html, r'<form[^>]*class="[^"]*\bnewsletter\b',
                                f"{path.name}: a newsletter <form> is in the built HTML")


if __name__ == "__main__":
    unittest.main()


class DocsSite(unittest.TestCase):
    """The wiki (docs-site/ over docs/, ADR-0012) is gated at the source: every published page carries
    frontmatter, every relative link resolves, widgets have fallbacks, Mermaid stays on the brand
    palette, scripture appears only as cited verbatim quotes, and the site configuration keeps the
    same-origin /api rewrite pointed at the product host with git deployments off. The rules live
    in tools/docs_check.py (run by the `docs` check too); this test makes the required `python`
    check enforce them as well."""

    def test_docs_check_reports_no_errors(self):
        import importlib.util
        import sys
        spec = importlib.util.spec_from_file_location("docs_check", ROOT / "tools" / "docs_check.py")
        mod = importlib.util.module_from_spec(spec)
        sys.modules["docs_check"] = mod   # dataclasses resolve annotations through sys.modules
        spec.loader.exec_module(mod)
        problems = mod.run(ROOT / "db" / "sggs.sqlite")
        errors = [str(p) for p in problems if p.level == "error"]
        self.assertEqual(errors, [], "tools/docs_check.py reports errors:\n" + "\n".join(errors))

    def test_docs_site_is_not_a_versioned_package(self):
        pkg = json.loads((ROOT / "docs-site" / "package.json").read_text(encoding="utf-8"))
        self.assertTrue(pkg.get("private"))
        self.assertEqual(pkg.get("version"), "0.0.0", "docs-site is not part of the unified version (check_versions.py reads frontend only)")
