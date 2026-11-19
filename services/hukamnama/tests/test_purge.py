import json
import unittest

from hukamnama.purge import API, TAG, VercelPurge, from_env


class _Resp:
    def __init__(self, status): self.status = status
    def __enter__(self): return self
    def __exit__(self, *a): return False


class PurgeTests(unittest.TestCase):
    def test_it_deletes_the_one_cache_tag_of_the_web_project(self):
        sent = []
        p = VercelPurge("t", "sggs-web", "team_1", "production",
                        opener=lambda req, timeout: sent.append(req) or _Resp(200))
        p()
        req = sent[0]
        self.assertEqual(req.get_method(), "POST")
        self.assertTrue(req.full_url.startswith(API + "?"))
        self.assertIn("projectIdOrName=sggs-web", req.full_url)
        self.assertIn("teamId=team_1", req.full_url)
        self.assertEqual(json.loads(req.data), {"tags": [TAG], "target": "production"})
        self.assertEqual(req.get_header("Authorization"), "Bearer t")
        self.assertEqual(TAG, "hukamnama")

    def test_a_refusal_raises(self):
        p = VercelPurge("t", "p", "team", opener=lambda req, timeout: _Resp(403))
        with self.assertRaises(OSError):
            p()

    def test_configuration_is_all_or_nothing(self):
        self.assertIsNone(from_env({}))
        with self.assertRaises(ValueError):
            from_env({"HUKAMNAMA_VERCEL_PURGE_TOKEN": "t"})
        with self.assertRaises(ValueError):
            from_env({"HUKAMNAMA_VERCEL_PURGE_TOKEN": "t", "HUKAMNAMA_VERCEL_PROJECT": "p",
                      "HUKAMNAMA_VERCEL_TEAM": "x", "HUKAMNAMA_VERCEL_TARGET": "staging"})
        p = from_env({"HUKAMNAMA_VERCEL_PURGE_TOKEN": "t", "HUKAMNAMA_VERCEL_PROJECT": "p", "HUKAMNAMA_VERCEL_TEAM": "x"})
        self.assertEqual((p.project, p.team, p.target), ("p", "x", None))

    def test_the_web_tags_its_responses_with_the_same_tag(self):
        import pathlib
        page = (pathlib.Path(__file__).parents[3] / "webapp" / "hukamnama_page.py").read_text(encoding="utf-8")
        self.assertIn(f"CACHE_TAG = '{TAG}'", page)


if __name__ == "__main__":
    unittest.main()
