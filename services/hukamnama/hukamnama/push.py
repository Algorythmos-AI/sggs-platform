"""Push: send the published Hukamnama to opted-in devices through APNs.

What a device receives is built ONLY from the published decision, whose text is copied from the
corpus (``Resolution.opening_gurmukhi``). Nothing from SGPC's page is ever sent. The payload is the
shape gurbani-soul-ios tests against (``ios/tools/hukamnama_fixture.py`` → ``hukamnama.apns``).

Delivery is durable and at-least-once: every send is a row in ``sends`` (queued → inflight → sent /
failed / suspect / gone). A restart re-sends rows left inflight, and the device collapses repeats
by ``apns-collapse-id``. Two modes, as the app registers them:

* ``asap``: queued the moment a day is published (up to ``ASAP_WINDOW`` later; a device first
  registered after the publish is not sent that day's).
* ``scheduled``: the device's own UTC slot (from its 12-month DST schedule). At each slot it gets
  the latest Hukamnama it has not had; if the slot came before the day was published, it gets it
  at publish time when that is within ``LATE_WINDOW`` of the slot.

Safety: a circuit breaker stops a run when more than 5% of its first 200 results are 4xx, and
deletions (410, repeated BadDeviceToken) are applied only after a day's run finishes untripped.
Sending is off unless ``HUKAMNAMA_SEND=on``; the APNs key lives only in the environment.
"""
from __future__ import annotations

import logging
import random
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from . import clock
from .store import Store

log = logging.getLogger("hukamnama")

TOPIC = "org.sggs.app"
HOSTS = {"production": "https://api.push.apple.com", "development": "https://api.sandbox.push.apple.com"}
TITLE = "Hukamnama · Sri Harmandir Sahib"
ASAP_WINDOW = timedelta(hours=6)
LATE_WINDOW = timedelta(hours=6)
SLOT_WINDOW = timedelta(hours=24)
STALE_INFLIGHT = timedelta(minutes=2)
MAX_ATTEMPTS = 5
BATCH = 200
WORKERS = 8
BREAKER_SAMPLE = 200
BREAKER_MIN = 20                 # never trip on a handful of results (a staging run of 3 devices)
BREAKER_RATE = 0.05
SUSPECT_DAYS_TO_DELETE = 3
JWT_REFRESH = 40 * 60            # Apple: not more than once per 20 min, expired after 60 min
PRUNE_AFTER = timedelta(days=180)

_WEEKDAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
_MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


def date_label(day: date) -> str:
    """'Mon 9 Nov · Amritsar' — the same label the app draws (``AmritsarDate`` in the app)."""
    return f"{_WEEKDAYS[day.weekday()]} {day.day} {_MONTHS[day.month - 1]} · Amritsar"


def payload(decision: dict) -> dict:
    """The APNs payload for a published day. Every Gurmukhi character is the corpus's."""
    r, day = decision["resolution"], decision["amritsar_date"]
    return {
        "aps": {
            "alert": {"title": TITLE, "subtitle": date_label(date.fromisoformat(day)),
                      "body": f"{r['opening_gurmukhi']}\nSri Guru Granth Sahib Ji · Ang {r['ang']}"},
            "sound": "default", "interruption-level": "active", "thread-id": "hukamnama", "mutable-content": 1,
        },
        "url": f"sggs://hukamnama/{day}",
        "amritsar_date": day, "ang": r["ang"], "first_line_id": r["first_line_id"],
        "last_line_id": r["last_line_id"], "comp_id": r["comp_id"], "range_sha256": r["range_sha256"],
        "scripture_sha256": decision["scripture_sha256"], "opening_translit": r["opening_translit"],
    }


def expiration(now: datetime) -> int:
    """APNs gives up at the next 05:00 IST: after that a newer Hukamnama is on its way."""
    ist = clock.amritsar_now(now)
    nxt = datetime.combine(ist.date(), datetime.min.time().replace(hour=5), tzinfo=clock.IST)
    if nxt <= ist:
        nxt += timedelta(days=1)
    return int(nxt.timestamp())


# -- APNs ------------------------------------------------------------------------------------
@dataclass(frozen=True)
class Result:
    status: int                  # HTTP status; 0 = network error
    reason: str = ""
    timestamp_ms: int | None = None   # APNs's "token no longer valid since" (410 only)


class APNs:
    """One HTTP/2 connection per APNs host, one cached provider token (ES256 JWT)."""

    def __init__(self, key_pem: str, key_id: str, team_id: str, topic: str = TOPIC, *, transport=None,
                 now=time.time) -> None:
        import httpx                                    # only when sending is on
        self.key_pem, self.key_id, self.team_id, self.topic, self.now = key_pem, key_id, team_id, topic, now
        self._jwt: tuple[str, float] | None = None
        self._lock = threading.Lock()
        self.minted = 0
        self.client = httpx.Client(http2=True, transport=transport, timeout=httpx.Timeout(10.0, connect=5.0))

    def provider_token(self, *, rebuild: bool = False) -> str:
        with self._lock:
            t = self.now()
            if rebuild or self._jwt is None or t - self._jwt[1] >= JWT_REFRESH:
                import jwt
                tok = jwt.encode({"iss": self.team_id, "iat": int(t)}, self.key_pem, algorithm="ES256",
                                 headers={"kid": self.key_id})
                self._jwt = (tok, t)
                self.minted += 1
            return self._jwt[0]

    def send(self, device_token: str, env: str, body: dict, *, collapse_id: str, expires: int) -> Result:
        import httpx
        for attempt in (1, 2):
            headers = {"authorization": f"bearer {self.provider_token(rebuild=attempt == 2)}",
                       "apns-push-type": "alert", "apns-priority": "10", "apns-topic": self.topic,
                       "apns-collapse-id": collapse_id, "apns-expiration": str(expires)}
            try:
                r = self.client.post(f"{HOSTS[env]}/3/device/{device_token}", json=body, headers=headers)
            except httpx.HTTPError as e:
                return Result(0, type(e).__name__)
            if r.status_code == 200:
                return Result(200)
            try:
                info = r.json()
            except ValueError:
                info = {}
            reason = str(info.get("reason", ""))
            if r.status_code == 403 and reason == "ExpiredProviderToken" and attempt == 1:
                continue                                   # rebuild the provider token once
            return Result(r.status_code, reason, info.get("timestamp"))
        return Result(403, "ExpiredProviderToken")

    def close(self) -> None:
        self.client.close()


# -- scheduling --------------------------------------------------------------------------------
def last_slot(schedule: list[dict], now: datetime) -> datetime | None:
    """The most recent slot instant at or before ``now``, honouring which schedule entry was in
    force at that instant (so a DST change moves the slot on the right day)."""
    best = None
    today = now.astimezone(timezone.utc).date()
    for d in (today, today - timedelta(days=1)):
        for e in schedule:
            inst = datetime(d.year, d.month, d.day, tzinfo=timezone.utc) + timedelta(minutes=e["slot_utc_min"])
            if inst > now:
                continue
            in_force = [x for x in schedule if x["from_utc"] <= inst.timestamp()]
            if not in_force or in_force[-1] is not e:
                continue
            if best is None or inst > best:
                best = inst
    return best


def due_tokens(store: Store, now: datetime) -> tuple[date, list[str]] | None:
    """Which devices are due the latest published Hukamnama at ``now`` (and have not had it)."""
    latest = store.latest_published()
    if latest is None:
        return None
    day = date.fromisoformat(latest["amritsar_date"])
    if (clock.amritsar_date(now) - day).days > 1:
        return None                                     # never push an old Hukamnama
    published = datetime.fromisoformat(latest["decided_at"])
    if published > now:
        return None
    due = []
    for dev in store.devices():
        if store.has_send(dev["token"], day):
            continue
        if dev["mode"] == "asap":
            if now - published <= ASAP_WINDOW and dev["created_at"] <= published:
                due.append(dev["token"])
            continue
        slot = last_slot(dev["schedule"] or [], now)
        if slot is None or slot < dev["created_at"]:
            continue
        if published - LATE_WINDOW <= slot < published + SLOT_WINDOW:
            due.append(dev["token"])
    return day, due


# -- the sender ------------------------------------------------------------------------------
class Sender:
    def __init__(self, store: Store, apns: APNs, *, alert=None, rng=random.random) -> None:
        self.store, self.apns, self.alert, self.rng = store, apns, alert, rng
        self._stop_day: str | None = None               # 413 / provider-token failure stops a run

    def _alert(self, day: date, kind: str, detail: str, now: datetime) -> None:
        if self.store.alert(day, kind, detail, now):
            log.warning("ALERT %s %s: %s", day, kind, detail)
            if self.alert:
                try:
                    self.alert(day.isoformat(), kind, detail)
                except Exception:
                    log.exception("alert hook failed")

    def tick(self, now: datetime) -> dict:
        """Queue whatever is due, send one batch, then settle the breaker and deletions."""
        queued = 0
        d = due_tokens(self.store, now)
        if d and d[1]:
            queued = self.store.enqueue(d[0], d[1], now)
        rows = self.store.claim_due(now, BATCH, now - STALE_INFLIGHT)
        sent = 0
        if rows:
            decisions = {r["amritsar_date"]: self.store.decision(date.fromisoformat(r["amritsar_date"])) for r in rows}
            with ThreadPoolExecutor(WORKERS) as pool:
                for ok in pool.map(lambda r: self._send_one(r, decisions[r["amritsar_date"]], now), rows):
                    sent += ok
        for day in {r["amritsar_date"] for r in rows}:
            self._settle(date.fromisoformat(day), now)
        return {"queued": queued, "claimed": len(rows), "sent": sent}

    def _send_one(self, row: dict, decision: dict | None, now: datetime) -> bool:
        tok, day = row["token"], row["amritsar_date"]
        dev = self.store.device(tok)
        if dev is None or decision is None or decision["status"] != "published" or self._tripped(day) \
                or self._stop_day == day:
            self.store.finish_send(tok, day, "failed", "skipped", now)
            return False
        body = payload(decision)
        kw = {"collapse_id": f"hukamnama-{day}", "expires": expiration(now)}
        res = self.apns.send(tok, dev["env"], body, **kw)
        if res.status == 400 and res.reason in ("BadDeviceToken", "DeviceTokenNotForTopic"):
            other = "development" if dev["env"] == "production" else "production"
            res2 = self.apns.send(tok, other, body, **kw)
            if res2.status == 200:                       # the app reported the wrong environment
                self.store.put_device(tok, other, dev["mode"], dev["schedule"], dev["scripture_sha256"], now)
                self.store.finish_send(tok, day, "sent", "200 (other env)", now)
                return True
            n = self.store.mark_suspect_day(tok, date.fromisoformat(day))
            self.store.finish_send(tok, day, "gone" if n >= SUSPECT_DAYS_TO_DELETE else "suspect",
                                   f"400 {res.reason}", now)
            return False
        if res.status == 200:
            self.store.finish_send(tok, day, "sent", "200", now)
            return True
        if res.status == 410:
            gone = res.timestamp_ms is not None and res.timestamp_ms / 1000 > dev["registered_at"].timestamp()
            self.store.finish_send(tok, day, "gone" if gone else "failed", f"410 {res.reason}", now)
            return False
        if res.status == 413:
            self._stop_day = day
            self.store.finish_send(tok, day, "failed", "413", now)
            self._alert(date.fromisoformat(day), "push_payload_too_large", "APNs refused the payload size", now)
            return False
        if res.status == 403:
            self._stop_day = day
            self.store.finish_send(tok, day, "failed", f"403 {res.reason}", now)
            self._alert(date.fromisoformat(day), "push_auth_failed", f"APNs 403 {res.reason}", now)
            return False
        if res.status == 429:
            self.store.finish_send(tok, day, "failed", "429", now)
            return False
        if res.status == 0 or res.status >= 500:
            if row["attempts"] < MAX_ATTEMPTS:
                back = timedelta(seconds=min(600, 30 * 2 ** (row["attempts"] - 1)) * (0.5 + self.rng()))
                self.store.finish_send(tok, day, "queued", f"{res.status} {res.reason}".strip(), now, now + back)
            else:
                self.store.finish_send(tok, day, "failed", f"{res.status} {res.reason}".strip(), now)
            return False
        self.store.finish_send(tok, day, "failed", f"{res.status} {res.reason}".strip(), now)
        return False

    def _tripped(self, day: str) -> bool:
        return self.store.get_meta(f"push_breaker:{day}") is not None

    def _settle(self, day: date, now: datetime) -> None:
        states = self.store.send_states(day)
        done = [(t, s, st) for t, s, st in states if s not in ("queued", "inflight")]
        first = done[:BREAKER_SAMPLE]
        bad = sum(1 for _, _, st in first if st and st[:1] == "4")
        if not self._tripped(day.isoformat()) and len(first) >= BREAKER_MIN and bad / len(first) > BREAKER_RATE:
            self.store.set_meta(f"push_breaker:{day.isoformat()}", now.isoformat())
            self._alert(day, "push_breaker", f"{bad}/{len(first)} of the first results were 4xx; run stopped, "
                                             "nothing deleted", now)
            for t, s, _ in states:
                if s in ("queued", "inflight"):
                    self.store.finish_send(t, day.isoformat(), "failed", "breaker", now)
            return
        if self._tripped(day.isoformat()) or any(s in ("queued", "inflight") for _, s, _ in states):
            return                                       # deletions wait for an untripped, finished run
        for t, s, _ in states:
            if s == "gone":
                self.store.delete_device(t)

    def prune(self, now: datetime) -> int:
        return self.store.prune_devices(now - PRUNE_AFTER)


def send_loop(sender: Sender, stop: threading.Event, now=clock.utcnow, every: float = 15.0) -> None:
    last_prune = None
    while not stop.is_set():
        t = now()
        try:
            sender.tick(t)
            if last_prune != t.date():
                last_prune = t.date()
                sender.prune(t)
        except Exception:
            log.exception("send tick failed")
        stop.wait(every)
