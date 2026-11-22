"""One-tap approve from the phone alert, for a day the sgpc.net veto held.

When the veto holds a day, hs.sgpc.net's page has already resolved to an exact run of corpus lines;
only the second source disagreed (on 13, 20 and 21 Nov 2026 because of how sgpc.net wrote the
weekday). The engine stores that run with the hold (``Store.set_held_range``) and the alert carries
a signed approve request for exactly that run. Nothing else can be approved this way: never a
``held_no_match`` day (its nearest run is a diagnosis, not a match), never a range the owner did not
see in the alert, never a day already decided by anyone else.

The request is signed with ``HUKAMNAMA_APPROVE_SECRET`` (HMAC-SHA256 over the day, the range, its
``range_sha256`` and the corpus fingerprint). The secret never leaves the service; the alert carries
only the signature. Unset, the route answers 404 and the alert has no approve button.

Approving re-proves everything at the moment of the tap:

* the signature, against the corpus fingerprint the service runs now (a dataset bump voids it);
* the day is within ``WINDOW_DAYS`` of today and still ``held`` by ``auto``;
* the stored range equals the signed one;
* ``resolution_for_range`` rebuilt from today's corpus has the signed ``range_sha256``.

Only then is the day published, with the same record the ``approve`` command writes; the audit row
says it came from the alert. ``GET`` shows a confirmation page and never changes anything.
"""
from __future__ import annotations

import hashlib
import hmac
import html
import re
from datetime import datetime, timedelta

from . import clock
from .corpus import resolution_for_range
from .store import Store

PATH = "/owner/approve"
WINDOW_DAYS = 2             # a hold older than this is approved from the shell, not from an alert
BY = "owner (phone alert)"
_HEX64 = re.compile(r"^[0-9a-f]{64}$")


def sign(secret: str, day: str, first: int, last: int, range_sha256: str, fingerprint: str) -> str:
    msg = f"hukamnama-approve-v1|{day}|{first}|{last}|{range_sha256}|{fingerprint}".encode()
    return hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()


def fields_for(secret: str, day: str, first: int, last: int, range_sha256: str, fingerprint: str) -> dict:
    """The request body the alert's button sends (and the confirmation page's form posts)."""
    return {"day": day, "first_line": str(first), "last_line": str(last), "range_sha256": range_sha256,
            "sig": sign(secret, day, first, last, range_sha256, fingerprint)}


class Refused(Exception):
    def __init__(self, code: int, message: str) -> None:
        super().__init__(message)
        self.code = code


def check(store: Store, con, fingerprint: str, secret: str, fields: dict, now: datetime):
    """Every proof except the write. Returns (day, resolution) or raises ``Refused``."""
    if not secret:
        raise Refused(404, "not found")
    try:
        day = clock.parse_day(str(fields.get("day", "")))
        first, last = int(str(fields.get("first_line", ""))), int(str(fields.get("last_line", "")))
    except ValueError:
        raise Refused(400, "bad request") from None
    sha, sig = str(fields.get("range_sha256", "")), str(fields.get("sig", ""))
    if not _HEX64.match(sha) or not _HEX64.match(sig):
        raise Refused(400, "bad request")
    if not hmac.compare_digest(sign(secret, day.isoformat(), first, last, sha, fingerprint), sig):
        raise Refused(403, "signature does not match (or the corpus changed since the alert)")
    today = clock.amritsar_date(now)
    if not timedelta(0) <= today - day <= timedelta(days=WINDOW_DAYS):
        raise Refused(409, f"{day} is outside the {WINDOW_DAYS}-day approve window; use the shell")
    decided = store.decision(day)
    if decided is None or decided["status"] != "held" or decided["decided_by"] != "auto":
        raise Refused(409, f"{day} is no longer an automatic hold (already approved or decided by hand)")
    if store.held_range(day) != {"first_line_id": first, "last_line_id": last, "range_sha256": sha}:
        raise Refused(409, "the held range is not the one in the alert")
    try:
        res = resolution_for_range(con, first, last)
    except ValueError as e:
        raise Refused(409, f"range does not prove: {e}") from None
    if res.range_sha256 != sha:
        raise Refused(409, "range does not prove: corpus text differs from the alert's")
    return day, res


def approve(store: Store, con, fingerprint: str, secret: str, fields: dict, now: datetime) -> dict:
    day, res = check(store, con, fingerprint, secret, fields, now)
    reason = f"approved from the held_veto alert: lines {res.first_line_id}-{res.last_line_id}, " \
             f"range {res.range_sha256[:8]}"
    if not store.publish_if_held(day, res, fingerprint, now, BY, reason):
        raise Refused(409, f"{day} was decided concurrently")
    return {"published": day.isoformat(), "ang": res.ang, "first_line_id": res.first_line_id,
            "last_line_id": res.last_line_id, "range_sha256": res.range_sha256}


def confirm_page(store: Store, con, fingerprint: str, secret: str, fields: dict, now: datetime) -> tuple[int, str]:
    """The page the alert's "Review" button opens: what will be published, and one button that
    POSTs the same signed fields. Shows corpus text only."""
    try:
        day, res = check(store, con, fingerprint, secret, fields, now)
    except Refused as e:
        return e.code, _page("Cannot approve", f"<p>{html.escape(str(e))}</p>")
    hidden = "".join(f'<input type="hidden" name="{k}" value="{html.escape(str(fields[k]))}">'
                     for k in ("day", "first_line", "last_line", "range_sha256", "sig"))
    body = (f"<p>Publish the Hukamnama of <b>{day.isoformat()}</b>: corpus lines "
            f"{res.first_line_id}–{res.last_line_id} ({res.line_count} lines), Ang {res.ang}.</p>"
            f'<p lang="pa" style="font-size:1.3em">{html.escape(res.opening_gurmukhi)}</p>'
            f"<p>Range sha256 <code>{res.range_sha256[:16]}…</code>, re-checked against the corpus just now.</p>"
            f'<form method="post" action="{PATH}">{hidden}'
            f'<button type="submit" style="font-size:1.2em;padding:.6em 1.2em">Approve and publish</button></form>')
    return 200, _page("Approve held Hukamnama", body)


def result_page(code: int, result: dict | None, error: str | None) -> str:
    if result:
        return _page("Published", f"<p>{result['published']} is published: Ang {result['ang']}, lines "
                                  f"{result['first_line_id']}–{result['last_line_id']}.</p>")
    return _page("Not approved", f"<p>{html.escape(error or 'refused')} ({code})</p>")


def _page(title: str, body: str) -> str:
    return ("<!doctype html><html lang=en><meta charset=utf-8>"
            '<meta name=viewport content="width=device-width,initial-scale=1">'
            '<meta name=robots content="noindex">'
            f"<title>{html.escape(title)}</title>"
            "<body style=\"font-family:system-ui;max-width:36em;margin:2em auto;padding:0 16px\">"
            f"<h1 style=\"font-size:1.3em\">{html.escape(title)}</h1>{body}</body></html>")
