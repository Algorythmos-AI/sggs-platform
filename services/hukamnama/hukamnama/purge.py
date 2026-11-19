"""Clear the website's CDN copy of the Hukamnama after a published day changes.

The pages, feeds, embed and sitemap on gurbanisoul.com are cached by Vercel's CDN (a past day for
up to a day). When the owner corrects a day (``correct``), or a published day is withdrawn (``hold``,
``pause``), the snapshot is rewritten here, and the cached copies would otherwise keep showing the
old range until they expire. So the publisher calls this hook once the new files are written, and
it deletes every Hukamnama response from the CDN by its cache tag (``Vercel-Cache-Tag: hukamnama``,
set by ``webapp/hukamnama_page.py``). The next request renders from the corrected API answer.

The API host itself needs nothing: the Worker answers every request from R2 and Cloudflare does not
cache its responses at the edge (no ``cf-cache-status``, checked 2026-11-19). Browsers may keep a
past day for its ``max-age`` (one hour); nobody can clear that.

Configuration (all three, or none: half a configuration refuses to start)::

    HUKAMNAMA_VERCEL_PURGE_TOKEN   a Vercel access token scoped to the team (a secret)
    HUKAMNAMA_VERCEL_PROJECT       the web project's id or name
    HUKAMNAMA_VERCEL_TEAM          the team id
    HUKAMNAMA_VERCEL_TARGET        optional: production | preview (Vercel's default when unset)

A purge never stops polling, sending or publishing: a failure is logged and raised as an alert.
"""
from __future__ import annotations

import json
import logging
import urllib.parse
import urllib.request
from typing import Callable

from . import USER_AGENT

log = logging.getLogger("hukamnama")

API = "https://api.vercel.com/v1/edge-cache/dangerously-delete-by-tags"
TAG = "hukamnama"          # = webapp/hukamnama_page.py CACHE_TAG
ENV = ("HUKAMNAMA_VERCEL_PURGE_TOKEN", "HUKAMNAMA_VERCEL_PROJECT", "HUKAMNAMA_VERCEL_TEAM")


class VercelPurge:
    """Deletes the Hukamnama cache tag from the web project's CDN. Delete, not invalidate: an
    invalidated entry is served stale once more, and after a correction that would be the wrong
    shabad."""
    def __init__(self, token: str, project: str, team: str, target: str | None = None, *,
                 opener: Callable = urllib.request.urlopen, timeout: float = 15.0) -> None:
        self.token, self.project, self.team, self.target = token, project, team, target
        self.opener, self.timeout = opener, timeout

    def request(self) -> urllib.request.Request:
        q = urllib.parse.urlencode({"projectIdOrName": self.project, "teamId": self.team})
        body = {"tags": [TAG], **({"target": self.target} if self.target else {})}
        return urllib.request.Request(f"{API}?{q}", data=json.dumps(body).encode(), method="POST",
                                      headers={"Authorization": f"Bearer {self.token}",
                                               "Content-Type": "application/json", "User-Agent": USER_AGENT})

    def __call__(self) -> None:
        with self.opener(self.request(), timeout=self.timeout) as r:   # noqa: S310 - fixed https URL
            if not 200 <= r.status < 300:
                raise OSError(f"Vercel purge answered HTTP {r.status}")


def from_env(env) -> VercelPurge | None:
    vals = [env.get("HUKAMNAMA_VERCEL_PURGE_TOKEN", ""), env.get("HUKAMNAMA_VERCEL_PROJECT", ""),
            env.get("HUKAMNAMA_VERCEL_TEAM", "")]        # = ENV, spelled out for tools/gen_env_vars.py
    if not any(vals):
        return None
    if not all(vals):
        missing = [k for k, v in zip(ENV, vals) if not v]
        raise ValueError(f"CDN purge half configured: set {', '.join(missing)} too (or none of them)")
    target = env.get("HUKAMNAMA_VERCEL_TARGET") or None
    if target not in (None, "production", "preview"):
        raise ValueError("HUKAMNAMA_VERCEL_TARGET must be production or preview")
    return VercelPurge(*vals, target)
