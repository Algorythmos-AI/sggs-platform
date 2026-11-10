"""Device registration: the strict shape of ``PUT /v1/devices/<token>`` and its abuse limits.

The app (gurbani-soul-ios ``HukamnamaAPI.swift``) sends, only while the reader has the feature on::

  PUT    /v1/devices/<token>   {"env", "mode", "schedule"?, "scripture_sha256"?, "replaces"?}
  DELETE /v1/devices/<token>

Nothing else about the reader is accepted or stored: no account, no time-zone name, no locale and
no IP address (the rate limiter keeps per-address counters in memory only, for one minute).
"""
from __future__ import annotations

import json
import re
import threading
import time
from dataclasses import dataclass

MAX_BODY = 1024                 # the largest real body is ~600 B (a 12-month schedule + replaces)
MAX_SLOTS = 12                  # a year of DST changes is 2-3 entries; 12 is generous
_TOKEN = re.compile(r"^[0-9a-f]{64,200}$")
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
ENVS = ("production", "development")
MODES = ("asap", "scheduled")


class BadRequest(ValueError):
    """The request is not one the app sends. The message is safe to return to the client."""


@dataclass(frozen=True)
class Registration:
    env: str
    mode: str
    schedule: list[dict] | None
    scripture_sha256: str | None
    replaces: str | None


def valid_token(token: str) -> bool:
    return bool(_TOKEN.match(token))


def parse_registration(token: str, raw: bytes) -> Registration:
    if not valid_token(token):
        raise BadRequest("token must be 64-200 lowercase hex characters")
    if len(raw) > MAX_BODY:
        raise BadRequest("body too large")
    try:
        body = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise BadRequest("body must be JSON") from None
    if not isinstance(body, dict):
        raise BadRequest("body must be a JSON object")
    unknown = set(body) - {"env", "mode", "schedule", "scripture_sha256", "replaces"}
    if unknown:
        raise BadRequest(f"unknown field(s): {', '.join(sorted(unknown))}")
    env, mode = body.get("env"), body.get("mode")
    if env not in ENVS:
        raise BadRequest("env must be production or development")
    if mode not in MODES:
        raise BadRequest("mode must be asap or scheduled")
    schedule = _schedule(body.get("schedule"), mode)
    fp = body.get("scripture_sha256")
    if fp is not None and not (isinstance(fp, str) and _HEX64.match(fp)):
        raise BadRequest("scripture_sha256 must be 64 lowercase hex characters")
    rep = body.get("replaces")
    if rep is not None and not (isinstance(rep, str) and valid_token(rep) and rep != token):
        raise BadRequest("replaces must be a different valid token")
    return Registration(env, mode, schedule, fp, rep)


def _schedule(s, mode: str) -> list[dict] | None:
    if mode == "asap":
        if s not in (None, []):
            raise BadRequest("schedule is only for mode=scheduled")
        return None
    if not isinstance(s, list) or not 1 <= len(s) <= MAX_SLOTS:
        raise BadRequest(f"mode=scheduled needs a schedule of 1-{MAX_SLOTS} slots")
    out, last = [], None
    for slot in s:
        if not isinstance(slot, dict) or set(slot) != {"from_utc", "slot_utc_min"}:
            raise BadRequest("each slot is {from_utc, slot_utc_min}")
        f, m = slot["from_utc"], slot["slot_utc_min"]
        if not all(isinstance(x, int) and not isinstance(x, bool) for x in (f, m)):
            raise BadRequest("slot values must be integers")
        if not 0 <= m < 1440 or f < 0:
            raise BadRequest("slot_utc_min must be 0-1439 and from_utc a Unix time")
        if last is not None and f <= last:
            raise BadRequest("slots must be in increasing from_utc order")
        out.append({"from_utc": f, "slot_utc_min": m})
        last = f
    return out


class RateLimiter:
    """Per-address and global write limits, in memory only (nothing is logged or stored).

    * ``per_minute`` writes per client address per rolling minute (the app writes about once a day);
    * ``new_per_hour`` brand-new devices across all clients; past it, new rows are refused and the
      owner is alerted (a flood of fake tokens would otherwise cost APNs requests every morning).
    """
    def __init__(self, per_minute: int = 20, new_per_hour: int = 2000, clock=time.monotonic) -> None:
        self.per_minute, self.new_per_hour, self.clock = per_minute, new_per_hour, clock
        self._hits: dict[str, list[float]] = {}
        self._new: list[float] = []
        self._lock = threading.Lock()

    def allow(self, addr: str) -> bool:
        now = self.clock()
        with self._lock:
            if len(self._hits) > 50_000:                   # bounded memory under a spray of addresses
                self._hits.clear()
            hits = [t for t in self._hits.get(addr, ()) if now - t < 60]
            if len(hits) >= self.per_minute:
                self._hits[addr] = hits
                return False
            hits.append(now)
            self._hits[addr] = hits
            return True

    def allow_new(self) -> bool:
        now = self.clock()
        with self._lock:
            self._new = [t for t in self._new if now - t < 3600]
            if len(self._new) >= self.new_per_hour:
                return False
            self._new.append(now)
            return True
