"""Durable state (SQLite, WAL, synchronous=FULL). The scripture DB is never written; this is a
separate file holding only decisions, observations, alerts and the audit trail."""
from __future__ import annotations

import json
import sqlite3
import threading
from dataclasses import asdict
from datetime import date, datetime, timezone

from .corpus import Resolution

SCHEMA = """
CREATE TABLE IF NOT EXISTS hukamnamas (
  amritsar_date TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('published','held')),
  resolution TEXT,                 -- JSON of corpus.Resolution (published only)
  scripture_sha256 TEXT,
  decided_at TEXT NOT NULL,
  decided_by TEXT NOT NULL,        -- 'auto' or the owner's name
  reason TEXT
);
CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY,
  amritsar_date TEXT NOT NULL,
  source TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  status TEXT NOT NULL,            -- candidate | parse_error | not_today | no_match | fetch_error
  cand_key TEXT, res_key TEXT, structure TEXT, detail TEXT
);
CREATE INDEX IF NOT EXISTS obs_day ON observations(amritsar_date, source, id);
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY, at TEXT NOT NULL, amritsar_date TEXT NOT NULL, kind TEXT NOT NULL,
  detail TEXT, UNIQUE (amritsar_date, kind)
);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY, at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL,
  amritsar_date TEXT, detail TEXT
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
"""


def _iso(t: datetime) -> str:
    return t.astimezone(timezone.utc).isoformat(timespec="seconds")


class Store:
    def __init__(self, path: str) -> None:
        self._con = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        self._lock = threading.Lock()
        with self._lock:
            self._con.execute("PRAGMA journal_mode=WAL")
            self._con.execute("PRAGMA synchronous=FULL")
            self._con.executescript(SCHEMA)

    def _x(self, sql: str, args: tuple = ()) -> list[tuple]:
        with self._lock:
            return self._con.execute(sql, args).fetchall()

    # -- decisions ---------------------------------------------------------------------------
    def decision(self, day: date) -> dict | None:
        rows = self._x("SELECT status, resolution, scripture_sha256, decided_at, decided_by, reason "
                       "FROM hukamnamas WHERE amritsar_date = ?", (day.isoformat(),))
        if not rows:
            return None
        s, res, fp, at, by, reason = rows[0]
        return {"amritsar_date": day.isoformat(), "status": s, "resolution": json.loads(res) if res else None,
                "scripture_sha256": fp, "decided_at": at, "decided_by": by, "reason": reason}

    def recent(self, limit: int) -> list[dict]:
        days = [r[0] for r in self._x("SELECT amritsar_date FROM hukamnamas WHERE status='published' "
                                      "ORDER BY amritsar_date DESC LIMIT ?", (limit,))]
        return [d for d in (self.decision(date.fromisoformat(x)) for x in days) if d]

    def publish(self, day: date, res: Resolution, fingerprint: str, now: datetime, by: str, *,
                reason: str | None = None, overwrite: bool = False) -> bool:
        """Record a published Hukamnama. Returns False when the day is already decided and
        ``overwrite`` is not set (an automatic publish never replaces an owner decision)."""
        verb = "INSERT OR REPLACE" if overwrite else "INSERT OR IGNORE"
        with self._lock:
            cur = self._con.execute(
                f"{verb} INTO hukamnamas VALUES (?, 'published', ?, ?, ?, ?, ?)",
                (day.isoformat(), json.dumps(asdict(res), ensure_ascii=False), fingerprint, _iso(now), by, reason))
            changed = cur.rowcount > 0
            if changed:
                self._con.execute("INSERT INTO audit (at, actor, action, amritsar_date, detail) VALUES (?,?,?,?,?)",
                                  (_iso(now), by, "publish", day.isoformat(), res.key()))
        return changed

    def hold(self, day: date, now: datetime, by: str, reason: str, *, overwrite: bool = False) -> bool:
        verb = "INSERT OR REPLACE" if overwrite else "INSERT OR IGNORE"
        with self._lock:
            cur = self._con.execute(f"{verb} INTO hukamnamas VALUES (?, 'held', NULL, NULL, ?, ?, ?)",
                                    (day.isoformat(), _iso(now), by, reason))
            changed = cur.rowcount > 0
            if changed:
                self._con.execute("INSERT INTO audit (at, actor, action, amritsar_date, detail) VALUES (?,?,?,?,?)",
                                  (_iso(now), by, "hold", day.isoformat(), reason))
        return changed

    # -- observations --------------------------------------------------------------------------
    def observe(self, day: date, source: str, now: datetime, status: str, *, cand_key: str | None = None,
                res_key: str | None = None, structure: str | None = None, detail: str | None = None) -> None:
        self._x("INSERT INTO observations (amritsar_date, source, observed_at, status, cand_key, res_key, structure, "
                "detail) VALUES (?,?,?,?,?,?,?,?)",
                (day.isoformat(), source, _iso(now), status, cand_key, res_key, structure, detail))

    def observations(self, day: date, source: str) -> list[dict]:
        rows = self._x("SELECT observed_at, status, cand_key, res_key, structure, detail FROM observations "
                       "WHERE amritsar_date = ? AND source = ? ORDER BY id", (day.isoformat(), source))
        return [{"at": datetime.fromisoformat(a), "status": s, "cand_key": c, "res_key": r, "structure": st,
                 "detail": d} for a, s, c, r, st, d in rows]

    def last_structure(self, source: str) -> str | None:
        rows = self._x("SELECT structure FROM observations WHERE source = ? AND structure IS NOT NULL "
                       "ORDER BY id DESC LIMIT 1", (source,))
        return rows[0][0] if rows else None

    # -- alerts / meta -------------------------------------------------------------------------
    def alert(self, day: date, kind: str, detail: str, now: datetime) -> bool:
        """One alert per (day, kind); returns True when it is new."""
        with self._lock:
            cur = self._con.execute("INSERT OR IGNORE INTO alerts (at, amritsar_date, kind, detail) VALUES (?,?,?,?)",
                                    (_iso(now), day.isoformat(), kind, detail))
            return cur.rowcount > 0

    def alerts(self, day: date) -> list[dict]:
        return [{"at": a, "kind": k, "detail": d} for a, k, d in
                self._x("SELECT at, kind, detail FROM alerts WHERE amritsar_date = ? ORDER BY id", (day.isoformat(),))]

    def set_meta(self, key: str, value: str) -> None:
        self._x("INSERT OR REPLACE INTO meta VALUES (?, ?)", (key, value))

    def get_meta(self, key: str) -> str | None:
        rows = self._x("SELECT value FROM meta WHERE key = ?", (key,))
        return rows[0][0] if rows else None
