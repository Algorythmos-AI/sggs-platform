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
-- Push: one row per opted-in device. Only what sending needs: no account, zone name or IP.
CREATE TABLE IF NOT EXISTS devices (
  token TEXT PRIMARY KEY,          -- APNs device token (lowercase hex)
  env TEXT NOT NULL CHECK (env IN ('production','development')),
  mode TEXT NOT NULL CHECK (mode IN ('asap','scheduled')),
  schedule TEXT,                   -- JSON [{from_utc, slot_utc_min}] (scheduled only)
  scripture_sha256 TEXT,
  created_at TEXT NOT NULL,        -- first registration (a new device never gets an old push)
  registered_at TEXT NOT NULL,     -- last PUT (a 410 older than this does not delete)
  suspect_days TEXT                -- JSON list of distinct Amritsar dates with BadDeviceToken
);
CREATE TABLE IF NOT EXISTS sends (
  token TEXT NOT NULL,
  amritsar_date TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('queued','inflight','sent','failed','suspect','gone')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_status TEXT,
  next_at TEXT NOT NULL,           -- not before (backoff)
  updated_at TEXT NOT NULL,
  PRIMARY KEY (token, amritsar_date)
);
CREATE INDEX IF NOT EXISTS sends_due ON sends(state, next_at);
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

    def audit(self, now: datetime, actor: str, action: str, day: date | None, detail: str) -> None:
        self._x("INSERT INTO audit (at, actor, action, amritsar_date, detail) VALUES (?,?,?,?,?)",
                (_iso(now), actor, action, day.isoformat() if day else None, detail))

    def set_meta(self, key: str, value: str) -> None:
        self._x("INSERT OR REPLACE INTO meta VALUES (?, ?)", (key, value))

    def get_meta(self, key: str) -> str | None:
        rows = self._x("SELECT value FROM meta WHERE key = ?", (key,))
        return rows[0][0] if rows else None

    # -- devices (push) ------------------------------------------------------------------------
    def put_device(self, token: str, env: str, mode: str, schedule: list | None, scripture: str | None,
                   now: datetime, replaces: str | None = None) -> bool:
        """Insert or update one device; ``replaces`` (the token the OS rotated away) is deleted in
        the same transaction. Returns True when the row is new."""
        t = _iso(now)
        sched = json.dumps(schedule, separators=(",", ":")) if schedule is not None else None
        with self._lock:
            con = self._con
            con.execute("BEGIN IMMEDIATE")
            try:
                if replaces and replaces != token:
                    con.execute("DELETE FROM devices WHERE token = ?", (replaces,))
                    con.execute("DELETE FROM sends WHERE token = ? AND state IN ('queued','inflight')", (replaces,))
                new = con.execute("SELECT 1 FROM devices WHERE token = ?", (token,)).fetchone() is None
                con.execute(
                    "INSERT INTO devices (token, env, mode, schedule, scripture_sha256, created_at, registered_at) "
                    "VALUES (?,?,?,?,?,?,?) ON CONFLICT(token) DO UPDATE SET env=excluded.env, mode=excluded.mode, "
                    "schedule=excluded.schedule, scripture_sha256=excluded.scripture_sha256, "
                    "registered_at=excluded.registered_at", (token, env, mode, sched, scripture, t, t))
                con.execute("COMMIT")
            except Exception:
                con.execute("ROLLBACK")
                raise
        return new

    def delete_device(self, token: str) -> bool:
        with self._lock:
            n = self._con.execute("DELETE FROM devices WHERE token = ?", (token,)).rowcount
            self._con.execute("DELETE FROM sends WHERE token = ? AND state IN ('queued','inflight')", (token,))
        return n > 0

    def device(self, token: str) -> dict | None:
        rows = self._x("SELECT token, env, mode, schedule, scripture_sha256, created_at, registered_at, suspect_days "
                       "FROM devices WHERE token = ?", (token,))
        return _device(rows[0]) if rows else None

    def devices(self, mode: str | None = None) -> list[dict]:
        sql = "SELECT token, env, mode, schedule, scripture_sha256, created_at, registered_at, suspect_days FROM devices"
        rows = self._x(sql + (" WHERE mode = ?" if mode else "") + " ORDER BY token", (mode,) if mode else ())
        return [_device(r) for r in rows]

    def device_count(self) -> dict:
        return {m: n for m, n in self._x("SELECT mode, count(*) FROM devices GROUP BY mode")}

    def mark_suspect_day(self, token: str, day: date) -> int:
        """Record a BadDeviceToken day; returns how many distinct days the token has failed on."""
        with self._lock:
            row = self._con.execute("SELECT suspect_days FROM devices WHERE token = ?", (token,)).fetchone()
            if row is None:
                return 0
            days = sorted(set(json.loads(row[0] or "[]")) | {day.isoformat()})
            self._con.execute("UPDATE devices SET suspect_days = ? WHERE token = ?", (json.dumps(days), token))
        return len(days)

    def prune_devices(self, older_than: datetime) -> int:
        """Drop devices that have not re-registered since ``older_than`` (the app re-PUTs daily)."""
        with self._lock:
            return self._con.execute("DELETE FROM devices WHERE registered_at < ?", (_iso(older_than),)).rowcount

    # -- sends (push) --------------------------------------------------------------------------
    def enqueue(self, day: date, tokens: list[str], now: datetime) -> int:
        """Queue ``day`` for each token in ONE transaction; a token already queued or sent for the
        day is left alone (at-least-once, never twice by design)."""
        t = _iso(now)
        with self._lock:
            con = self._con
            con.execute("BEGIN IMMEDIATE")
            try:
                n = 0
                for tok in tokens:
                    n += con.execute("INSERT OR IGNORE INTO sends (token, amritsar_date, state, next_at, updated_at) "
                                     "VALUES (?,?, 'queued', ?, ?)", (tok, day.isoformat(), t, t)).rowcount
                con.execute("COMMIT")
            except Exception:
                con.execute("ROLLBACK")
                raise
        return n

    def requeue_day(self, day: date, now: datetime) -> int:
        """Owner ``resend``: queue the day again for every device that already had it."""
        t = _iso(now)
        with self._lock:
            return self._con.execute("UPDATE sends SET state='queued', attempts=0, next_at=?, updated_at=? "
                                     "WHERE amritsar_date=? AND state IN ('sent','failed')",
                                     (t, t, day.isoformat())).rowcount

    def claim_due(self, now: datetime, limit: int, stale: datetime) -> list[dict]:
        """Mark up to ``limit`` due rows inflight and return them. A row left inflight before
        ``stale`` (the process died mid-request) is due again."""
        t = _iso(now)
        with self._lock:
            con = self._con
            con.execute("BEGIN IMMEDIATE")
            try:
                rows = con.execute(
                    "SELECT token, amritsar_date, attempts FROM sends WHERE (state='queued' AND next_at <= ?) "
                    "OR (state='inflight' AND updated_at < ?) ORDER BY next_at, token LIMIT ?",
                    (t, _iso(stale), limit)).fetchall()
                for tok, d, _ in rows:
                    con.execute("UPDATE sends SET state='inflight', attempts=attempts+1, updated_at=? "
                                "WHERE token=? AND amritsar_date=?", (t, tok, d))
                con.execute("COMMIT")
            except Exception:
                con.execute("ROLLBACK")
                raise
        return [{"token": tok, "amritsar_date": d, "attempts": a + 1} for tok, d, a in rows]

    def finish_send(self, token: str, day: str, state: str, status: str, now: datetime,
                    next_at: datetime | None = None) -> None:
        t = _iso(now)
        self._x("UPDATE sends SET state=?, last_status=?, next_at=?, updated_at=? WHERE token=? AND amritsar_date=?",
                (state, status, _iso(next_at) if next_at else t, t, token, day))

    def has_send(self, token: str, day: date) -> bool:
        return bool(self._x("SELECT 1 FROM sends WHERE token=? AND amritsar_date=?", (token, day.isoformat())))

    def send_stats(self, day: date) -> dict:
        return {s: n for s, n in self._x("SELECT state, count(*) FROM sends WHERE amritsar_date=? GROUP BY state",
                                         (day.isoformat(),))}

    def send_states(self, day: date) -> list[tuple[str, str, str | None]]:
        return self._x("SELECT token, state, last_status FROM sends WHERE amritsar_date=? ORDER BY updated_at",
                       (day.isoformat(),))

    def latest_published(self) -> dict | None:
        rows = self._x("SELECT amritsar_date FROM hukamnamas WHERE status='published' ORDER BY amritsar_date DESC LIMIT 1")
        return self.decision(date.fromisoformat(rows[0][0])) if rows else None


def _device(r: tuple) -> dict:
    tok, env, mode, sched, fp, created, registered, suspect = r
    return {"token": tok, "env": env, "mode": mode, "schedule": json.loads(sched) if sched else None,
            "scripture_sha256": fp, "created_at": datetime.fromisoformat(created),
            "registered_at": datetime.fromisoformat(registered), "suspect_days": json.loads(suspect or "[]")}
