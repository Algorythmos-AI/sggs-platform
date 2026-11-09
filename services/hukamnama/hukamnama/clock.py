"""The one place dates are computed. Every date in this service is the **Amritsar date**.

India has no daylight saving time, so IST is a fixed UTC+05:30 offset; using it directly keeps
the service free of the tz database (and of a container image that may lack it). Naive datetimes
are refused: a naive "now" is exactly how a UTC date sneaks in around 18:30 UTC (IST midnight).
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30), "IST")

#: SGPC stamps the Hukamnama 05:30 AM IST (hs.sgpc.net). Polling starts a little before.
EXPECTED_BY = time(5, 30)
FAST_WINDOW = (time(5, 0), time(9, 0))     # poll every minute
SLOW_WINDOW = (time(9, 0), time(14, 0))    # then every ten minutes
LATE_ALERT = time(7, 0)                    # nothing resolved by now → alert the owner
CORRECTION_WATCH = timedelta(hours=2)      # re-check the source this long after publishing


def _aware(now: datetime) -> datetime:
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("naive datetime: pass an aware datetime (UTC or IST)")
    return now


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def amritsar_now(now: datetime) -> datetime:
    return _aware(now).astimezone(IST)


def amritsar_date(now: datetime) -> date:
    return amritsar_now(now).date()


def at_ist(day: date, t: time) -> datetime:
    """The aware instant of wall-clock ``t`` in Amritsar on ``day``."""
    return datetime.combine(day, t, tzinfo=IST)


def poll_interval(now: datetime) -> timedelta | None:
    """How often to poll at ``now``; None outside the publish windows (idle)."""
    t = amritsar_now(now).time()
    if FAST_WINDOW[0] <= t < FAST_WINDOW[1]:
        return timedelta(minutes=1)
    if SLOW_WINDOW[0] <= t < SLOW_WINDOW[1]:
        return timedelta(minutes=10)
    return None


def parse_day(s: str) -> date:
    """Strict ``YYYY-MM-DD`` (no other forms), for URLs and CLI arguments."""
    if len(s) != 10 or s[4] != "-" or s[7] != "-" or not (s[:4] + s[5:7] + s[8:]).isdigit():
        raise ValueError(f"not a YYYY-MM-DD date: {s!r}")
    return date.fromisoformat(s)
