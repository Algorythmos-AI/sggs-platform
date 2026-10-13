"""tools/gen_api_errors.py: the page reports what the server answers, and refuses to hide a change."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import gen_api_errors as g  # noqa: E402

GURMUKHI = chr(0x0A1C) + chr(0x0A2A)   # two letters, built at run time; never a line of scripture


def fake(overrides=None):
    """A stand-in server: every ERRORS case fails, every NOT_ERRORS case succeeds, unless overridden."""
    overrides = overrides or {}
    errors = {sent for _, sent, _ in g.ERRORS}

    def get(path):
        if path in overrides:
            return overrides[path]
        legacy = path.replace("/api/v1/", "/api/", 1)
        if legacy in errors:
            if path.startswith("/api/v1/"):
                return 400, {"error": {"code": "invalid_request", "message": "bad", "request_id": g.RID}}
            return 400, {"error": "invalid request: bad"}
        return 200, {"ang": 1, "lines": [1, 2, 3], "section": GURMUKHI, "note": "x" * 60}
    return get


class GenApiErrors(unittest.TestCase):
    def test_renders_both_surfaces_and_summarises_bodies(self):
        page = g.render(fake())
        self.assertIn('| `/api/ang/abc` | an id that is not an integer | 400 | `{"error": "invalid request: bad"}` | `invalid_request` · bad |', page)
        self.assertIn('"lines": [3 items]', page)
        self.assertIn('"section": ‹Gurmukhi›', page)
        self.assertIn('"note": "' + "x" * 45 + '…"', page)
        self.assertFalse(any("਀" <= ch <= "੿" for ch in page))

    def test_an_error_that_starts_succeeding_fails_the_generation(self):
        with self.assertRaises(SystemExit) as e:
            g.render(fake({"/api/ang/abc": (200, {})}))
        self.assertIn("/api/ang/abc", str(e.exception))

    def test_a_clamped_request_that_starts_failing_fails_the_generation(self):
        with self.assertRaises(SystemExit):
            g.render(fake({"/api/ang/0": (400, {"error": "x"})}))

    def test_the_v1_envelope_must_echo_the_request_id(self):
        with self.assertRaises(SystemExit):
            g.render(fake({"/api/v1/ang/abc": (400, {"error": {"code": "invalid_request", "message": "m", "request_id": "other"}})}))

    def test_pipes_in_a_message_do_not_break_the_table(self):
        self.assertEqual(g._cell("a|b"), "a\\|b")


if __name__ == "__main__":
    unittest.main()
