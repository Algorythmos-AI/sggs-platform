"""The public API's OpenAPI spec is what the service and the Worker really answer.

``tools/gen_hukamnama_openapi.py`` publishes sample days from the corpus, lets the service write its
public files and sends requests through the Worker's handler. These tests fail when the committed
spec is not a fresh run of it, and hold the spec to the promises made elsewhere: the keys the
shipped iOS app decodes, the Developers page, and a sentence for every field.
"""
import importlib.util
import json
import os
import re
import shutil
import unittest

from tests.helpers import FIX, REPO, needs_db

SPEC = REPO / "contract" / "hukamnama.openapi.json"
NODE = shutil.which("node")
TYPES = {"string": "string", "integer": "integer"}


def generator():
    spec = importlib.util.spec_from_file_location("gen_hukamnama_openapi", REPO / "tools" / "gen_hukamnama_openapi.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class SpecTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = json.loads(SPEC.read_text(encoding="utf-8"))
        cls.schemas = cls.doc["components"]["schemas"]

    @needs_db
    def test_the_committed_spec_is_a_fresh_run_of_the_generator(self):
        if not NODE:
            if os.environ.get("HUKAMNAMA_REQUIRE_NODE") == "1":
                self.fail("node is not installed, so the spec cannot be checked against the Worker")
            self.skipTest("node not installed")
        self.assertEqual(SPEC.read_text(encoding="utf-8"), generator().render(),
                         "contract/hukamnama.openapi.json is stale — run: python3 tools/gen_hukamnama_openapi.py")

    def test_every_field_has_a_sentence(self):
        for name, schema in self.schemas.items():
            for field, s in schema["properties"].items():
                self.assertTrue(s.get("description"), f"{name}.{field} has no description")

    def test_the_keys_the_ios_app_decodes_are_required_with_their_types(self):
        with open(FIX / "ios-read-keys.json", encoding="utf-8") as f:
            frozen = json.load(f)
        day = self.schemas["Hukamnama"]
        for key, kind in frozen["published"].items():
            self.assertIn(key, day["required"], f"{key} is decoded by the shipped app and must always be present")
            self.assertEqual(day["properties"][key]["type"], TYPES[kind], key)
        served = set(day["properties"]["status"]["enum"]) | set(self.schemas["Pending"]["properties"]["status"]["enum"])
        self.assertLessEqual(served, set(frozen["status_values"]), "a status the shipped app does not know")
        self.assertEqual(day["properties"]["published_at"]["format"], "date-time")

    def test_layers_stay_separate_and_optional(self):
        line = self.schemas["Line"]
        self.assertNotIn("en", line["required"], "the English layer must be optional on a line")
        self.assertNotIn("translation", self.schemas["Hukamnama"]["required"])
        self.assertIn("gurmukhi", line["required"])
        self.assertIn("never present it as the Gurbani", line["properties"]["en"]["description"])

    def test_the_spec_holds_no_scripture_and_claims_nothing_it_should_not(self):
        text = SPEC.read_text(encoding="utf-8")
        self.assertIsNone(re.search(r"[਀-੿]", text), "the spec is a shape: it must hold no Gurmukhi")
        for word in ("official", "the only", "the first API"):
            self.assertNotIn(word, text.lower())
        self.assertIn("not affiliated with SGPC", self.doc["info"]["description"])

    def test_it_is_keyless_and_names_the_public_host(self):
        self.assertEqual(self.doc["security"], [])
        self.assertEqual([s["url"] for s in self.doc["servers"]], ["https://api.gurbanisoul.com"])
        self.assertEqual(self.doc["info"]["termsOfService"], "https://gurbanisoul.com/en/developers#terms")

    def test_the_routes_are_the_workers(self):
        core = (REPO / "services" / "hukamnama-edge" / "src" / "core.js").read_text(encoding="utf-8")
        self.assertEqual(sorted(self.doc["paths"]),
                         ["/v1/hukamnama", "/v1/hukamnama/index", "/v1/hukamnama/today", "/v1/hukamnama/{date}", "/v1/status"])
        for path in self.doc["paths"]:
            self.assertIn(path.replace("{date}", "YYYY-MM-DD"), core, f"{path} is not a route the Worker documents")
        limit = next(p for p in self.doc["paths"]["/v1/hukamnama"]["get"]["parameters"] if p["name"] == "limit")["schema"]
        self.assertEqual(limit["default"], int(re.search(r"DEFAULT_LIMIT = (\d+)", core).group(1)))
        self.assertEqual(limit["maximum"], int(re.search(r"MAX_LIMIT = (\d+)", core).group(1)))
        earliest = re.search(r'EARLIEST = "([^"]+)"', core).group(1)
        self.assertIn(earliest, self.doc["paths"]["/v1/hukamnama/{date}"]["get"]["parameters"][0]["description"])

    def test_the_developers_page_describes_fields_that_exist(self):
        page = (REPO / "frontend" / "src" / "pages" / "[lang]" / "developers.astro").read_text(encoding="utf-8")
        block = page[page.index("const fields:"):page.index("\n];", page.index("const fields:"))]
        named = re.findall(r'"([a-z_0-9\[\].]+)"', re.sub(r'key: "[^"]+"', "", block))
        self.assertGreater(len(named), 8)
        day, line = self.schemas["Hukamnama"]["properties"], self.schemas["Line"]["properties"]
        for name in named:
            where, field = (line, name.split(".")[1]) if name.startswith("lines[].") else (day, name)
            self.assertIn(field, where, f"the Developers page describes `{name}`, which the API does not serve")
        # and the example on the page carries no key the API does not serve
        sample = page[page.index("const sample = {"):page.index("const sampleJson")]
        for key in set(re.findall(r"^\s{2}([a-z_0-9]+):", sample, re.M)):
            self.assertIn(key, day, f"the Developers page's example has `{key}`, which the API does not serve")


if __name__ == "__main__":
    unittest.main()
