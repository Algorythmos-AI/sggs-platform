---
title: "Runbook: the Hukamnama each morning"
description: "The owner's decisions for Hukamnama · Sri Harmandir Sahib: reading /health, what to do on a held day, approve, hold and resend, correcting a day after it is published, and the deploy freeze."
covers: "services/hukamnama/hukamnama/__main__.py, services/hukamnama/hukamnama/engine.py, services/hukamnama/hukamnama/store.py, services/hukamnama/hukamnama/api.py, services/hukamnama/hukamnama/push.py, scripts/ci/hukamnama_watch.py, .github/workflows/hukamnama-deploy.yml, .github/workflows/hukamnama-deadman.yml"
sidebar:
  order: 7
  label: "Hukamnama: each morning"
verified:
  commit: 14c89ad9
  date: "2026-11-12"
---
# Runbook: the Hukamnama each morning

What the owner does, and when, for the daily Hukamnama · Sri Harmandir Sahib. How the service
works is [the Hukamnama service](../../architecture/hukamnama.md); the Render service, its secrets,
backup and push key are [the service runbook](hukamnama-service.md). Today this is the **staging**
service, `sggs-hukamnama-staging` (`api-staging.gurbanisoul.com`); there is no production service
yet.

The rule behind every step: **late is acceptable, wrong is not.** A held day is shown to readers as
`pending`; nothing unproved is ever served, pushed or written.

## How you hear about a problem

- **The dead-man issue.** `hukamnama-deadman.yml` reads `/health` at 06:00, 07:00 and 14:15 IST.
  When the service is unreachable, the poller is stale (no poll for 15 minutes inside 05:00–14:00
  IST), nothing is published by 07:00 IST, or the service raised any other alert today, it opens
  one issue titled "Hukamnama service: problem on <date> (Amritsar)", and later runs comment on it.
  It never restarts or redeploys anything.
- **`/health`.** The service's own alerts are listed there and nowhere else: no mail or chat
  channel is connected to them.

```bash
curl -s https://api-staging.gurbanisoul.com/health | python3 -m json.tool
```

| Field | Read it as |
|---|---|
| `commit` | the running build; equals the deployed SHA after `hukamnama-deploy` |
| `amritsar_date`, `status_today`, `decision_today` | today in Amritsar, `published` or `pending`, and the stored decision (`null` until one is made) |
| `last_tick`, `last_tick_action` | the last poll and what it did (`waiting`, `published`, `held`, `watching`, `idle`, …) |
| `alerts_today` | today's alerts, one per kind (the list is in `services/hukamnama/README.md`, "Polling and alerts") |
| `scripture_sha256` | the fingerprint of the corpus the service reads |
| `push` | `sending`, device counts by mode, and today's send states |

## The owner's tools

Run on the service: `render ssh <service-id>`, then from the service's working directory:

```bash
python -m hukamnama show    <date>                                  # the decision and what is served
python -m hukamnama approve <date> --first-line <id> --last-line <id> --by <you> --reason "<why>"
python -m hukamnama hold    <date> --by <you> --reason "<why>"
python -m hukamnama resend  <date> --by <you> --reason "<why>"
```

`<date>` is the **Amritsar** date, `YYYY-MM-DD`. Every one of these writes the `audit` table with
your name and reason. `approve` and `hold` overwrite the day's decision; an automatic publish never
replaces an owner decision afterwards. A change made this way reaches the snapshot files within one
poll interval.

| Tool | Effect for readers | Effect on push |
|---|---|---|
| `approve` | the range is published at that moment, with its `range_sha256`; the snapshot file is written (or rewritten) | `asap` devices get it then, **only while it is still that Amritsar day**; a day approved after its Amritsar midnight is never pushed |
| `hold` | the day reads as `pending`; its snapshot file is deleted | nothing new is queued; a notification already delivered stays on the phone |
| `resend` | none | re-queues every device that already had (or failed) that day's push, and clears a tripped circuit breaker (audited); the same collapse id replaces the first notification on the phone |

`resend` does not check the date itself: use it on the same Amritsar day, or a reader's lock screen
gets an old day's notification.

## A held day

`held_no_match` (the page does not equal any corpus run) or `held_veto` (sgpc.net shows a different
Ang).

1. Open hs.sgpc.net and the sgpc.net marquee and note the Ang and the opening words.
2. Find the shabad in the corpus by that Ang (the Knowledge Base reader, or `/api/ang/<N>`, which
   lists each line with its `id`). A `held_no_match` alert often already names the nearest run of
   line ids and the words that differ.
3. Decide whether the difference is the source's or ours. The corpus is proven against the printed
   Bir character for character, so a one-word difference is normally SGPC's spelling; compare
   ShabadOS as well. **Never change the corpus to match SGPC**: a real fault in the corpus is
   flagged for review in sggs-data, never fixed here.
4. If the shabad is certain, `approve` its range: the first line is the first verse, or the heading
   line before it when the page printed one, and the last line is where the composition ends. Put
   the reason in words someone can audit later (for example "SGPC page variant in one word").
5. If you are not certain, leave it held. Readers see `pending`, the website and the app show the
   most recent day under its own date, and nothing is wrong.

For a `held_veto`, check which page is right first; approve that range, or leave the day held.

## After a day is published

`changed_after_publish` or `veto_after_publish` means a source changed within 2 hours of an
automatic publish. The service never applies the change.

- **SGPC corrected its page** and the new range is right: `approve` the new range (the snapshot is
  rewritten), then, the same Amritsar day, `resend` so phones get the corrected day in place of the
  first notification.
- **The published day is wrong and the right one is not yet clear:** `hold` it. Readers see
  `pending` until you approve the right range.
- **The source flickered and the published range is right:** do nothing; the alert stays on that
  day's `/health` and the dead-man issue.

Close the day's dead-man issue with a line saying what you decided.

## Other alerts

| Alert | Action |
|---|---|
| `late`, `not_published` | Open hs.sgpc.net. If SGPC has not published, there is nothing to do. If it has, look at `last_tick_action` and the other alerts. |
| `hs_layout_changed`, `hs_parse_failing` | SGPC changed its page. Keep the day's fetch archive (`/var/data/archive/<date>/`), fix the parser in a pull request with that page as a fixture. Approve the day by hand meanwhile. |
| `push_breaker`, `push_auth_failed`, `push_payload_too_large`, `device_flood` | [The service runbook, Push](hukamnama-service.md#push-apns). |
| The poller is stale or the service unreachable | Render → service → Logs and Events; restart it. Its state is on the disk. |

## Deploys and the freeze

- The service changes only through `hukamnama-deploy.yml`: on a push to `integration` that touches
  `services/hukamnama/**`, `dataset.lock.json` or the workflow, or by dispatch. Render auto-deploy
  is off.
- **Freeze: 23:00–04:30 UTC (04:30–10:00 IST)**, the hours SGPC publishes and the poller decides.
  A push in that window fails the workflow's freeze step; dispatch it again after 10:00 IST. The
  `override_freeze` input exists for an emergency fix only. The service runs one instance with a
  disk, so a deploy restarts it for a few seconds.
- **A dataset bump** (`dataset.lock.json`) also deploys the service. If the corpus fingerprint
  changed, the service refuses to start until published days are re-resolved against the new
  corpus. Never delete the state file to get past it: it holds every decision and the audit trail.
