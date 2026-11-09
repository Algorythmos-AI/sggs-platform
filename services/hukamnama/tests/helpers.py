import os
import pathlib
import unittest
from datetime import datetime, timezone

from hukamnama.sources import Fetched

HERE = pathlib.Path(__file__).parent
FIX = HERE / "fixtures"
REPO = HERE.parents[2]
DB = os.environ.get("HUKAMNAMA_TEST_DB") or str(REPO / "db" / "sggs.sqlite")
HAS_DB = pathlib.Path(DB).is_file()
needs_db = unittest.skipUnless(HAS_DB, f"scripture DB not installed ({DB}); run `make dataset`")


def fixture(name: str) -> str:
    return (FIX / name).read_text(encoding="utf-8")


def utc(*a) -> datetime:
    return datetime(*a, tzinfo=timezone.utc)


class FakeFetcher:
    """Serves scripted page bodies per URL; ``pages[url]`` may be swapped mid-test."""
    def __init__(self, pages: dict):
        self.pages = dict(pages)
        self.calls: list[str] = []

    def __call__(self, url, etag=None):
        self.calls.append(url)
        body = self.pages.get(url)
        if isinstance(body, Exception):
            raise body
        if body is None:
            return Fetched(503, None, None, utc(2026, 1, 1))
        return Fetched(200, body, None, utc(2026, 1, 1))
