"""Alerts that reach the owner's phone: every new service alert is posted to a private ntfy topic.

A held day needs the owner to act, and until 2026-11-15 the only signal was a GitHub issue from
the dead-man check, which runs hours late on GitHub's cron; 13 and 14 Nov 2026 were held and no
one saw them. Now the service posts the moment it raises an alert (``Engine._alert``,
``Sender._alert``, the device-flood cap), at a priority the phone respects: a hold or a lost
morning is *urgent* (sounds through the lock screen), a late or changed page is *high*.

Configuration: ``HUKAMNAMA_ALERT_NTFY_URL`` = ``https://ntfy.sh/<topic>`` (or a self-hosted ntfy
server). The topic name is the secret: anyone who knows it can read the alerts, so it is a long
random string kept in Render's environment and the GitHub ``staging``/``production`` environments,
never in a tracked file. Unset, the service runs without phone alerts, as before.

What is sent: the environment, the Amritsar date, the alert kind and its detail (an Ang, a reason,
at most the differing words of a source page), and what to do. Never a device token, never any
reader data. Delivery is best effort: a failure is logged and never stops polling or sending.
"""
from __future__ import annotations

import json
import logging
import re
import urllib.request
from datetime import date
from typing import Callable
from urllib.parse import urlsplit

log = logging.getLogger("hukamnama")

RUNBOOK = ("https://github.com/Algorythmos-AI/sggs-platform/blob/integration/"
           "docs/process/runbooks/hukamnama-service.md#when-a-morning-goes-wrong")

# ntfy priorities: 5 urgent (long vibration, through the lock screen), 4 high, 3 default.
URGENT = {"held_no_match", "held_veto", "not_published", "push_breaker", "push_auth_failed", "deadman", "peer_down"}
HIGH = {"late", "changed_after_publish", "veto_after_publish", "push_payload_too_large", "device_flood",
        "hs_parse_failing", "hs_layout_changed", "mukhwak_parse_failing", "mukhwak_layout_changed"}

HEADLINES = {
    "held_no_match": "held: SGPC's page does not match the corpus",
    "held_veto": "held: sgpc.net disagrees with hs.sgpc.net",
    "not_published": "nothing published today",
    "late": "not published yet",
    "push_breaker": "push stopped (circuit breaker)",
    "push_auth_failed": "push stopped: APNs refused the key",
    "push_payload_too_large": "push stopped: payload too large",
    "changed_after_publish": "SGPC's page changed after publishing",
    "veto_after_publish": "sgpc.net disagrees after publishing",
    "device_flood": "new-device cap reached",
    "deadman": "dead-man check failed",
    "peer_down": "the other Hukamnama service is down",
}

TODO = {
    "held_no_match": "Readers see 'Delayed today' and get no push until you act. Check the day against "
                     "the corpus; if certain: render ssh → python -m hukamnama approve {day} --first-line … "
                     "--last-line … --by <you> --reason \"…\" (then it pushes).",
    "held_veto": "Readers see 'Delayed today' and get no push until you act. Compare hs.sgpc.net and "
                 "sgpc.net by hand; if hs is right: render ssh → python -m hukamnama approve {day} …",
    "not_published": "The window has closed with nothing published. Read /health and the runbook.",
    "late": "Not resolved by 07:00 IST. Usually SGPC is late; if a hold follows, act on that.",
    "push_breaker": "No device was deleted. Read the run in /health, then python -m hukamnama resend {day}.",
    "push_auth_failed": "Check the APNs key in Render (Secret Files) and HUKAMNAMA_APNS_KEY_ID.",
    "changed_after_publish": "Compare the page with the published range; correct only if certain.",
    "veto_after_publish": "Compare sgpc.net with the published range; correct only if certain.",
    "deadman": "The service may be down or asleep. Open /health and the Render dashboard.",
    "peer_down": "Sent by the sibling service (staging watches production and the reverse). Open the named "
                 "service's /health and its Render dashboard (Events, Logs); it never restarts anything.",
}

_TOPIC = re.compile(r"^[A-Za-z0-9_-]{16,64}$")


def parse_url(url: str) -> tuple[str, str]:
    """``https://host[:port]/<topic>`` → (server, topic). The topic must look like a secret (16–64
    letters, digits, - or _): a short guessable name would let anyone read the alerts."""
    parts = urlsplit(url.strip())
    topic = parts.path.strip("/")
    if parts.scheme != "https" or not parts.netloc or parts.query or parts.fragment:
        raise ValueError("HUKAMNAMA_ALERT_NTFY_URL must be https://<server>/<topic>")
    if not _TOPIC.match(topic):
        raise ValueError("the ntfy topic must be 16-64 letters, digits, - or _ (it is the secret)")
    return f"https://{parts.netloc}", topic


def message(where: str, day: str, kind: str, detail: str) -> dict:
    """The ntfy JSON publish body for one alert."""
    try:
        label = date.fromisoformat(day).strftime("%a %-d %b")
    except ValueError:
        label = day
    head = HEADLINES.get(kind, kind.replace("_", " "))
    todo = TODO.get(kind, "See the runbook.").format(day=day)
    priority = 5 if kind in URGENT else 4 if kind in HIGH else 3
    return {
        "title": f"Hukamnama ({where}) {label}: {head}",
        "message": f"{detail}\n\n{todo}",
        "priority": priority,
        "tags": ["rotating_light" if priority == 5 else "warning"],
        "click": RUNBOOK,
        "actions": [{"action": "view", "label": "Runbook", "url": RUNBOOK}],
    }


class NtfyAlerts:
    """``alert_hook(day, kind, detail)`` for the engine and the sender."""

    def __init__(self, url: str, where: str, opener: Callable = urllib.request.urlopen, timeout: float = 10) -> None:
        self.server, self.topic = parse_url(url)
        self.where, self.opener, self.timeout = where, opener, timeout

    def __call__(self, day: str, kind: str, detail: str) -> None:
        body = {"topic": self.topic, **message(self.where, day, kind, detail)}
        req = urllib.request.Request(self.server, data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
                                     headers={"Content-Type": "application/json",
                                              "User-Agent": "GurbaniSoul-Hukamnama/1.0"}, method="POST")
        with self.opener(req, timeout=self.timeout) as r:
            if r.status >= 300:
                raise OSError(f"ntfy answered {r.status}")


def from_env(env) -> NtfyAlerts | None:
    """The hook from ``HUKAMNAMA_ALERT_NTFY_URL`` (+ ``HUKAMNAMA_ENV`` for the label), or None when
    unset. A malformed value raises ValueError: the caller refuses to start, as for backups."""
    url = (env.get("HUKAMNAMA_ALERT_NTFY_URL") or "").strip()
    if not url:
        return None
    return NtfyAlerts(url, (env.get("HUKAMNAMA_ENV") or "staging").strip() or "staging")


def main(argv: list[str]) -> int:
    """``python -m hukamnama.alerts <amritsar-date> <kind> < detail``: one post, for the dead-man
    check (GitHub Actions), which notices when the service itself is down and so cannot post."""
    import os
    import sys
    if len(argv) != 2:
        print("usage: python -m hukamnama.alerts <amritsar-date> <kind> < detail", file=sys.stderr)
        return 2
    hook = from_env(os.environ)
    if hook is None:
        print("HUKAMNAMA_ALERT_NTFY_URL is not set; nothing sent")
        return 0
    hook(argv[0], argv[1], sys.stdin.read().strip()[:3000])
    print("sent")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main(sys.argv[1:]))
