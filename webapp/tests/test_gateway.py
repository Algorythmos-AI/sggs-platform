"""frontend/vercel.json's routing and API functions are generated from the code (tools/gen_gateway.py)."""
import copy
import importlib.util
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("gen_gateway", ROOT / "tools/gen_gateway.py")
gg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gg)
CFG = json.loads((ROOT / "gateway/routes.json").read_text(encoding="utf-8"))
VERCEL = json.loads((ROOT / "frontend/vercel.json").read_text(encoding="utf-8"))


class Gateway(unittest.TestCase):
    def test_vercel_json_is_generated(self):
        self.assertEqual(gg.main(["--check"]), 0, "run: python3 tools/gen_gateway.py")

    def test_every_prefix_has_exactly_one_context(self):
        seen = [p for ps in gg.prefixes_by_context().values() for p in ps]
        self.assertEqual(len(seen), len(set(seen)))

    def test_staging_rules_come_first_and_production_catches_every_other_host(self):
        rw = VERCEL["rewrites"]
        staging_host = [{"type": "host", "value": CFG["staging"]["host"]}]
        first_prod = next(i for i, r in enumerate(rw) if not any(h.get("type") == "host" for h in r.get("has", [])))
        for r in rw[:first_prod]:
            self.assertEqual([h for h in r["has"] if h["type"] == "host"], staging_host)
        for r in rw[first_prod:]:
            self.assertFalse(any(h.get("type") == "host" for h in r.get("has", [])))
        self.assertIn(rw[-1]["source"], ("/api/:path*", "/healthz"))

    def test_each_routed_context_prefix_reaches_its_own_function(self):
        by_ctx = gg.prefixes_by_context()
        for ctx in CFG["staging"]["services"]:
            for p in by_ctx[ctx]:
                for base in ("/api", "/api/v1"):
                    rule = next(r for r in VERCEL["rewrites"] if r["source"] == f"{base}/{p}(/.*)?")
                    self.assertEqual(rule["destination"], f"/api/svc/{ctx}")

    def test_function_rewrites_never_use_named_segments(self):
        # a named segment the destination does not use is appended to the query the handler sees
        for r in VERCEL["rewrites"]:
            if r["destination"].startswith("/api/svc/"):
                self.assertNotIn(":", r["source"], r)

    def test_the_committed_file_names_no_functions(self):
        # A build without the generated function files (a Vercel Git preview) must still succeed:
        # a `functions` pattern that matches no file fails the build. The deploy adds them.
        self.assertNotIn("functions", VERCEL)
        self.assertNotIn("regions", VERCEL)

    def test_every_function_excludes_the_web_and_the_other_databases(self):
        names = gg.function_names()
        fns = gg.functions()
        self.assertEqual(sorted(fns), sorted(f"api/svc/{n}.py" for n in names))
        for name in names:
            excl = fns[f"api/svc/{name}.py"]["excludeFiles"]
            for n in names:
                self.assertEqual(f"_sggs/db/{n}.sqlite" in excl, n != name, (name, n))
            for w in gg.WEB_ONLY:
                self.assertIn(w, excl)

    def test_services_exist_only_on_the_vercel_functions(self):
        bad = copy.deepcopy(CFG)
        bad["production"] = {"api_platform": "render", "api": "https://example.onrender.com", "services": ["search"]}
        with self.assertRaises(SystemExit):
            gg.environments(bad)
        bad = copy.deepcopy(CFG)
        bad["staging"]["api_platform"] = "fly"
        with self.assertRaises(SystemExit):
            gg.environments(bad)

    def test_production_can_roll_back_to_render(self):
        back = copy.deepcopy(CFG)
        back["production"] = {"api_platform": "render", "api": "https://sggs-knowledge-base.onrender.com", "services": []}
        prod = [r for r in gg.rewrites(back) if not r.get("has")]
        self.assertEqual(prod, [{"source": "/api/:path*",
                                 "destination": "https://sggs-knowledge-base.onrender.com/api/:path*"}])

    # -- the Hukamnama pages: the only page routes a function answers --------------------------
    def _page_rules(self, rw):
        return [r for r in rw if "/hukamnama" in r["source"] and not r["source"].startswith("/feeds")]

    def test_hukamnama_feeds_go_to_all_with_the_pages(self):
        import sys
        sys.path.insert(0, str(ROOT / "webapp"))
        import hukamnama_feed
        self.assertEqual(sorted(gg.FEEDS), sorted(hukamnama_feed.PATHS))        # the routes are the paths it serves
        rules = [r for r in VERCEL["rewrites"] if r["source"].startswith("/feeds")]
        self.assertEqual(len(rules), len(gg.FEEDS))
        for r in rules:
            self.assertEqual(r["destination"], "/api/svc/all")
            self.assertEqual(r["has"], [{"type": "host", "value": CFG["staging"]["host"]}])
        sources = [re.compile("^" + r["source"] + "$") for r in rules]
        for path in gg.FEEDS:
            self.assertTrue(any(s.match(path) for s in sources), path)
        for path in ("/feeds/hukamnamaXxml", "/feeds/hukamnama.xml/x", "/feeds/other.xml", "/en/feeds/hukamnama.xml"):
            self.assertFalse(any(s.match(path) for s in sources), path)
        off = copy.deepcopy(CFG)
        del off["staging"]["hukamnama_api"]
        self.assertFalse(any(r["source"].startswith("/feeds") for r in gg.rewrites(off)))

    def test_hukamnama_pages_go_to_all_only_where_the_environment_names_the_api(self):
        self.assertTrue(CFG["staging"].get("hukamnama_api"), "staging serves the pages")
        rules = self._page_rules(VERCEL["rewrites"])
        self.assertEqual(len(rules), 2)
        for r in rules:
            self.assertEqual(r["destination"], "/api/svc/all")
            self.assertEqual(r["has"], [{"type": "host", "value": CFG["staging"]["host"]}])
        if not CFG["production"].get("hukamnama_api"):        # until launch: production keeps the static site
            self.assertFalse(any(not r.get("has") for r in rules))
        off = copy.deepcopy(CFG)
        del off["staging"]["hukamnama_api"]
        self.assertEqual(self._page_rules(gg.rewrites(off)), [])
        live = copy.deepcopy(CFG)
        live["production"]["hukamnama_api"] = "https://api.gurbanisoul.com"
        self.assertEqual(len([r for r in self._page_rules(gg.rewrites(live)) if not r.get("has")]), 2)
        self.assertEqual(gg.hukamnama_apis(live), {"preview": CFG["staging"]["hukamnama_api"],
                                                  "production": "https://api.gurbanisoul.com"})

    def test_hukamnama_page_rules_match_exactly_the_paths_the_renderer_serves(self):
        import sys
        sys.path.insert(0, str(ROOT / "webapp"))
        import hukamnama_page
        sources = [re.compile("^" + r["source"] + "$") for r in self._page_rules(VERCEL["rewrites"])]
        langs = gg.languages()
        yes = [f"/{l}/hukamnama" for l in langs] + [f"/{l}/hukamnama/2026-11-11" for l in langs]
        no = ["/de/hukamnama", "/hukamnama", "/en/hukamnama/hk-shell", "/en/hukamnama/2026-11", "/en/hukamnama/2026-11-11/x",
              "/en/hukamnamas", "/en/learn/what-is-a-hukamnama", "/api/en/hukamnama", "/en/hukamnama/20261111"]
        for path in yes:
            self.assertTrue(any(s.match(path) for s in sources), path)
            self.assertTrue(hukamnama_page.PATH_RE.match(path), path)     # the function will recognise it
        for path in no:
            self.assertFalse(any(s.match(path) for s in sources), path)

    def test_hukamnama_api_must_be_an_https_origin_on_the_vercel_functions(self):
        for value in ("http://api.gurbanisoul.com", "https://api.gurbanisoul.com/v1", "https://u@api.gurbanisoul.com",
                      "https://api.gurbanisoul.com?x=1", "", 7):
            bad = copy.deepcopy(CFG)
            bad["staging"]["hukamnama_api"] = value
            with self.assertRaises(SystemExit, msg=repr(value)):
                gg.environments(bad)
        bad = copy.deepcopy(CFG)
        bad["production"] = {"api_platform": "render", "api": "https://example.onrender.com", "services": [],
                             "hukamnama_api": "https://api.gurbanisoul.com"}
        with self.assertRaises(SystemExit):
            gg.environments(bad)

    def test_one_shell_per_enabled_language(self):
        self.assertEqual(gg.shell_files(), [f"_sggs/webapp/hukamnama_shells/{l}.html" for l in gg.languages()])
        self.assertIn("en", gg.languages())

    def test_routed_contexts_have_probes(self):
        for env in ("staging", "production"):
            for ctx in CFG[env]["services"]:
                self.assertIn(ctx, gg.PROBES)


if __name__ == "__main__":
    unittest.main()
