"""Push: send the published Hukamnama to opted-in devices through APNs.

What a device receives is built ONLY from the published decision, whose text is copied from the
corpus (``Resolution.opening_gurmukhi``). Nothing from SGPC's page is ever sent. The payload is the
shape gurbani-soul-ios tests against (``ios/tools/hukamnama_fixture.py`` → ``hukamnama.apns``).

Delivery is durable and at-least-once: every send is a row in ``sends`` (queued → inflight → sent /
failed / suspect / gone). A restart re-sends rows left inflight, and the device collapses repeats
by ``apns-collapse-id``. Two modes, as the app registers them:

* ``asap``: queued the moment the day is published, or at the next tick when the device switches
  to asap later that day. A device first registered after the publish is not sent that day's.
* ``scheduled``: the device's own UTC slot on the Amritsar day (from its 12-month DST schedule;
  the first entry is in force from the beginning of time, so a schedule the app rebuilt "from
  now" keeps today's slot). If the slot came before the day was published, it gets it at publish
  time when that is within ``LATE_WINDOW`` of the slot.

Only the CURRENT Amritsar day is ever pushed (a late approval of yesterday is not sent on today's
date), and a device gets at most one push per Amritsar day (one ``sends`` row). ``plan_for_device``
is the single statement of these rules: the sender queues from it and ``PUT /v1/devices`` reports
it back to the app.

Safety: a circuit breaker stops a run when more than 5% of its first 200 results are 4xx (429 is
throttling, not a bad request, and does not count), and deletions (410, repeated BadDeviceToken)
are applied only after a day's run finishes untripped. A 403 or 413 pauses the day for
``STOP_FOR``; the paused rows stay queued and resume. Sending is off unless ``HUKAMNAMA_SEND=on``;
the APNs key lives only in the environment.
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
LATE_WINDOW = timedelta(hours=6)
SLOT_WINDOW = timedelta(hours=24)
STALE_INFLIGHT = timedelta(minutes=2)
STOP_FOR = timedelta(minutes=20)  # a 403/413 pauses the day this long (Apple: 1 new token per 20 min)
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

    def provider_token(self, *, rejected: str | None = None) -> str:
        """The cached provider token. ``rejected`` is a token APNs answered ExpiredProviderToken
        to: it is rebuilt only if it is still the cached one, so eight workers rejected at once
        mint ONE new token (Apple allows one per 20 minutes; more is 429
        TooManyProviderTokenUpdates)."""
        with self._lock:
            t = self.now()
            stale = rejected is not None and self._jwt is not None and self._jwt[0] == rejected
            if stale or self._jwt is None or t - self._jwt[1] >= JWT_REFRESH:
                import jwt
                tok = jwt.encode({"iss": self.team_id, "iat": int(t)}, self.key_pem, algorithm="ES256",
                                 headers={"kid": self.key_id})
                self._jwt = (tok, t)
                self.minted += 1
            return self._jwt[0]

    def send(self, device_token: str, env: str, body: dict, *, collapse_id: str, expires: int) -> Result:
        import httpx
        rejected = None
        for attempt in (1, 2):
            jwt_tok = self.provider_token(rejected=rejected)
            headers = {"authorization": f"bearer {jwt_tok}",
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
                rejected = jwt_tok                         # rebuild the provider token once
                continue
            return Result(r.status_code, reason, info.get("timestamp"))
        return Result(403, "ExpiredProviderToken")

    def close(self) -> None:
        self.client.close()


# -- scheduling --------------------------------------------------------------------------------
def _in_force(schedule: list[dict], ts: float) -> dict:
    """The schedule entry in force at ``ts``: the last one that started at or before it. The first
    entry counts as in force from the beginning of time: the app rebuilds a schedule "from now"
    whenever the reader changes the time, and that must not void today's earlier slot (a new
    device is kept from an old push by ``created_at``, not by the schedule)."""
    cur = schedule[0]
    for x in schedule:
        if x["from_utc"] <= ts:
            cur = x
    return cur


def _slots(schedule: list[dict], days) -> list[datetime]:
    """Every slot instant on the given UTC dates, each from the entry in force at that instant
    (so a DST change moves the slot on the right day)."""
    out = []
    for d in days:
        for e in schedule:
            inst = datetime(d.year, d.month, d.day, tzinfo=timezone.utc) + timedelta(minutes=e["slot_utc_min"])
            if _in_force(schedule, inst.timestamp()) is e:
                out.append(inst)
    return sorted(set(out))


def last_slot(schedule: list[dict], now: datetime) -> datetime | None:
    """The most recent slot instant at or before ``now``."""
    if not schedule:
        return None
    today = now.astimezone(timezone.utc).date()
    past = [i for i in _slots(schedule, (today - timedelta(days=1), today)) if i <= now]
    return past[-1] if past else None


def next_slot(schedule: list[dict], now: datetime) -> datetime | None:
    """The first slot instant strictly after ``now``."""
    if not schedule:
        return None
    today = now.astimezone(timezone.utc).date()
    nxt = [i for i in _slots(schedule, (today, today + timedelta(days=1), today + timedelta(days=2))) if i > now]
    return nxt[0] if nxt else None


def _z(t: datetime | None) -> str | None:
    """UTC ISO-8601 with Z, to the second: the form the app parses."""
    return t.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if t else None


@dataclass(frozen=True)
class Plan:
    """What today means for one device. ``push_now`` is the sender's: queue it at this tick."""
    amritsar_date: date
    status: str                  # published | pending | held
    delivery: str                # sent | due | not_today
    sent_at: datetime | None
    reason: str | None           # registered_after_publish | slot_passed (not_today only)
    next_slot_at: datetime | None
    push_now: bool = False

    def as_json(self) -> dict:
        return {"today": {"amritsar_date": self.amritsar_date.isoformat(), "status": self.status,
                          "delivery": self.delivery, "sent_at": _z(self.sent_at), "reason": self.reason},
                "next_slot_at": _z(self.next_slot_at)}


def plan_for_device(store: Store, dev: dict, now: datetime, decision: dict | None | bool = False) -> Plan:
    """The one statement of who gets today's Hukamnama, and when. ``decision`` is today's row when
    the caller already read it (``due_tokens`` does, once per tick)."""
    day = clock.amritsar_date(now)
    if decision is False:
        decision = store.decision(day)
    status = decision["status"] if decision else "pending"
    published = datetime.fromisoformat(decision["decided_at"]) if status == "published" else None
    if published is not None and published > now:
        published = None                                # never act on a decision stamped in the future
    sched = (dev["schedule"] or []) if dev["mode"] == "scheduled" else []
    nxt = next_slot(sched, now) if sched else None

    def plan(delivery, reason=None, sent_at=None, push=False):
        return Plan(day, status, delivery, sent_at, reason, nxt, push)

    row = store.send(dev["token"], day)
    if row is not None:                                 # at most one push per device per day
        if row["state"] == "sent":
            return plan("sent", sent_at=row["updated_at"])
        if row["state"] in ("queued", "inflight"):
            return plan("due")
        return plan("not_today")                        # failed / suspect / gone: not retried today
    if status == "held":
        return plan("not_today")                        # nothing is sent unless the owner approves
    if dev["mode"] == "asap":
        if published is None:
            return plan("due")                          # it is queued the moment the day is published
        if dev["created_at"] <= published:
            return plan("due", push=True)
        return plan("not_today", "registered_after_publish")
    # scheduled: the slots that fall on today's Amritsar date, not before the device existed
    start = clock.at_ist(day, datetime.min.time())
    end = start + timedelta(days=1)
    utc_days = {start.astimezone(timezone.utc).date(), (end - timedelta(seconds=1)).astimezone(timezone.utc).date()}
    slots = [i for i in _slots(sched, sorted(utc_days)) if start <= i < end and i >= dev["created_at"]] \
        if sched else []
    past = [i for i in slots if i <= now]
    if past:
        slot = past[-1]
        if published is not None and published - LATE_WINDOW <= slot < published + SLOT_WINDOW:
            return plan("due", push=True)               # its slot (or publish, for a slot just before it)
        if published is None and now - slot <= LATE_WINDOW:
            return plan("due")                          # still inside the late window: sent at publish
    if any(i > now for i in slots):
        return plan("due")                              # today's slot is still ahead
    return plan("not_today", "slot_passed")


def due_tokens(store: Store, now: datetime) -> tuple[date, list[str]] | None:
    """Which devices to queue today's Hukamnama for at ``now``. Only the current Amritsar day is
    ever pushed: a day approved late (or a late SGPC page for yesterday) is not sent on today's
    date, and a future-dated row never is."""
    day = clock.amritsar_date(now)
    decision = store.decision(day)
    if decision is None or decision["status"] != "published" or datetime.fromisoformat(decision["decided_at"]) > now:
        return None
    return day, [dev["token"] for dev in store.devices() if plan_for_device(store, dev, now, decision).push_now]


# -- the sender ------------------------------------------------------------------------------
class Sender:
    def __init__(self, store: Store, apns: APNs, *, alert=None, rng=random.random) -> None:
        self.store, self.apns, self.alert, self.rng = store, apns, alert, rng
        # A 403 (provider token) or 413 pauses one day until an instant; it expires by itself,
        # so a transient auth failure or the owner's ``resend`` (another process) is not lost.
        self._stop: tuple[str, datetime] | None = None

    def _stopped(self, day: str, now: datetime) -> datetime | None:
        stop = self._stop
        return stop[1] if stop is not None and stop[0] == day and now < stop[1] else None

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
        until = self._stopped(day, now)
        if until is not None:                            # paused: back in the queue, untried
            self.store.defer_send(tok, day, "stopped", now, until)
            return False
        dev = self.store.device(tok)
        if dev is None or decision is None or decision["status"] != "published" or self._tripped(day):
            self.store.finish_send(tok, day, "failed", "skipped", now)
            return False
        body = payload(decision)
        kw = {"collapse_id": f"hukamnama-{day}", "expires": expiration(now)}
        res = self.apns.send(tok, dev["env"], body, **kw)
        if res.status == 400 and res.reason in ("BadDeviceToken", "DeviceTokenNotForTopic"):
            other = "development" if dev["env"] == "production" else "production"
            res2 = self.apns.send(tok, other, body, **kw)
            if res2.status == 200:                       # the app reported the wrong environment
                self.store.set_env(tok, other, dev["env"])
                self._sent(tok, day, "200 (other env)", now)
                return True
            n = self.store.mark_suspect_day(tok, date.fromisoformat(day))
            self.store.finish_send(tok, day, "gone" if n >= SUSPECT_DAYS_TO_DELETE else "suspect",
                                   f"400 {res.reason}", now)
            return False
        if res.status == 200:
            self._sent(tok, day, "200", now)
            return True
        if res.status == 410:
            gone = res.timestamp_ms is not None and res.timestamp_ms / 1000 > dev["registered_at"].timestamp()
            self.store.finish_send(tok, day, "gone" if gone else "failed", f"410 {res.reason}", now)
            return False
        if res.status in (403, 413):
            # Not this device's fault: pause the whole day, keep this row and the rest queued.
            self._stop = (day, now + STOP_FOR)
            self._retry(row, res, now, now + STOP_FOR)
            kind, what = (("push_payload_too_large", "APNs refused the payload size") if res.status == 413
                          else ("push_auth_failed", f"APNs 403 {res.reason}"))
            self._alert(date.fromisoformat(day), kind, what, now)
            return False
        if res.status in (0, 429) or res.status >= 500:
            self._retry(row, res, now)                   # network, throttling, Apple's side: back off
            return False
        self.store.finish_send(tok, day, "failed", f"{res.status} {res.reason}".strip(), now)
        return False

    def _sent(self, tok: str, day: str, status: str, now: datetime) -> None:
        self.store.finish_send(tok, day, "sent", status, now)
        self.store.mark_seen(tok, now)                   # a delivered push keeps the device from pruning

    def _retry(self, row: dict, res: Result, now: datetime, at: datetime | None = None) -> None:
        """Back off and queue again (``at`` or exponential with jitter), or fail after MAX_ATTEMPTS."""
        tok, day, status = row["token"], row["amritsar_date"], f"{res.status} {res.reason}".strip()
        if row["attempts"] < MAX_ATTEMPTS:
            back = timedelta(seconds=min(600, 30 * 2 ** (row["attempts"] - 1)) * (0.5 + self.rng()))
            self.store.finish_send(tok, day, "queued", status, now, at or now + back)
        else:
            self.store.finish_send(tok, day, "failed", status, now)

    def _tripped(self, day: str) -> bool:
        return self.store.get_meta(f"push_breaker:{day}") is not None

    def _settle(self, day: date, now: datetime) -> None:
        states = self.store.send_states(day)
        done = [(t, s, st) for t, s, st in states if s not in ("queued", "inflight")]
        first = done[:BREAKER_SAMPLE]
        bad = sum(1 for _, _, st in first if st and st[:1] == "4" and st[:3] != "429")   # throttling is not bad
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
