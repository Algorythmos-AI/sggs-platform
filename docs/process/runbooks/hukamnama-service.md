---
title: "Runbook: Hukamnama service"
description: "The Hukamnama service on Render: the staging soak with sending off, its one-time setup, the morning dead-man check, the fetch archive, and what to do when a morning goes wrong."
sidebar:
  order: 6
verified:
  commit: 14c89ad9
  date: "2026-11-12"
---
# Runbook: Hukamnama service

The Hukamnama service (`services/hukamnama/`) locates the daily Hukamnama from Sri Harmandir
Sahib inside the pinned corpus. Before any notification is sent it runs a **14-day soak on
staging with sending off**: it polls SGPC every morning, decides, and keeps every page it saw. The
soak measures the real publish minute and the hs.sgpc.net ↔ sgpc.net lag, and checks that at
least 13 of 14 mornings resolve automatically and correctly against a manual check. Sending is
now on for staging: its `/health` reported `push.sending: true` on 2026-11-12, and a push reached a
TestFlight device on 2026-11-11. Staging reaches TestFlight builds only ([Push](#push-apns)).

The owner's daily decisions (a held day, approve, hold, resend, corrections) are in
[the Hukamnama each morning](hukamnama.md); how the service works is
[the Hukamnama service](../../architecture/hukamnama.md).

## The service on Render

| Setting | Value |
|---|---|
| Name | `sggs-hukamnama-staging` |
| Type, runtime | Web service, Docker |
| Repository, branch | `Algorythmos-AI/sggs-platform`, `integration` |
| Dockerfile, context | `services/hukamnama/Dockerfile`, repository root (`.`) |
| Region | Singapore (closest to Amritsar and to the owner) |
| Plan | **Starter** (always on; a free instance sleeps and would miss the morning) |
| Disk | 1 GB mounted at `/var/data` (state SQLite + fetch archive) |
| Health check path | `/health` |
| Auto-deploy | **Off**. Deploys come only from `hukamnama-deploy.yml`. |
| Environment | The image sets `HUKAMNAMA_DB`, `HUKAMNAMA_STATE`, `HUKAMNAMA_ARCHIVE`. For the R2 backup, set the four values in [State backup](#state-backup-litestream-to-r2); without them the service runs unbacked. |

A service with a disk runs **one instance** and restarts on deploy (a few seconds of downtime).
The freeze in `hukamnama-deploy.yml` keeps deploys out of 23:00–04:30 UTC (04:30–10:00 IST).

Cost: Starter plus the 1 GB disk, about US$7–8 a month.

## One-time setup (owner)

1. `render login` (browser), then `render workspace set` to the Algorythmos workspace.
2. Create the service with the settings above (dashboard, or the CLI command in the PR that
   added this runbook).
3. Copy the service's **Deploy Hook** (Settings → Deploy Hook) into the GitHub environment
   `staging` as `RENDER_DEPLOY_HOOK_HUKAMNAMA_STAGING`. Never paste it into chat or a file.
4. Set the repository variable to the service URL:
   `gh variable set HUKAMNAMA_STAGING_URL --repo Algorythmos-AI/sggs-platform --body https://sggs-hukamnama-staging.onrender.com`
5. Dispatch `hukamnama-deploy` (Actions → hukamnama-deploy → Run) outside the freeze. It
   finishes when `/health.commit` equals the deployed SHA.
6. `api-staging.gurbanisoul.com` is a custom domain on the service (Render → Custom Domains) with a
   Cloudflare CNAME to `sggs-hukamnama-staging.onrender.com`, **DNS only** (grey cloud) so Render
   issues and renews the certificate. TestFlight builds read the Hukamnama from that name. Done
   2026-11-10.
7. Turn on the state backup (next section).

## State backup: Litestream to R2

The decision and audit state (`/var/data/hukamnama-state.sqlite`) is replicated continuously to
the R2 bucket `sggs-hukamnama-staging` (account *Company-Domains*, Asia-Pacific) by
[Litestream](https://litestream.io), pinned in the Dockerfile by version and sha256. The
scripture DB is not backed up (it comes from the dataset pin), and neither is the fetch archive.

`entrypoint.sh` runs the service under `litestream replicate` (`litestream.yml`) when R2
credentials are present, and plainly when they are not. Credentials without the other two values
stop the service at start, so a typo cannot leave it running unbacked.

Render → service → Environment (values typed there only; never in chat, a file or a PR):

| Variable | Value |
|---|---|
| `LITESTREAM_ACCESS_KEY_ID` | Access Key ID of the R2 Account API token `hukamnama-staging-litestream` (Object Read & Write, this bucket only) |
| `LITESTREAM_SECRET_ACCESS_KEY` | its Secret Access Key |
| `HUKAMNAMA_R2_ENDPOINT` | the token page's S3 endpoint, `https://<account id>.r2.cloudflarestorage.com` |
| `HUKAMNAMA_R2_BUCKET` | `sggs-hukamnama-staging` |

Use **Save only**, then deploy with `hukamnama-deploy` outside the freeze. After the deploy, the
service log shows Litestream's `replicating to` line, and objects appear under
`hukamnama-state/` in the bucket within a minute.

**Restore.** A missing state file is restored from R2 before the service starts
(`restore-if-db-not-exists`); an existing file is never overwritten. To restore by hand into a
scratch path and compare: `render ssh <service-id>` →
`litestream restore -config /etc/litestream.yml -integrity-check quick -o /tmp/restored.sqlite /var/data/hukamnama-state.sqlite`.
A rotated or revoked token stops replication but not the service; the log shows the error.

## Public snapshot: the bucket the edge Worker reads

Not set up yet (staging or production). The service can write each published day as a file to an
R2 bucket, which the edge Worker (`services/hukamnama-edge`) serves as the public API. To turn it on
for one service, the owner:

1. Creates the bucket (`hukamnama-public-staging` for staging, `hukamnama-public` for production;
   the names in the Worker's `wrangler.toml`).
2. Creates an R2 API token scoped to **that bucket only**, Object Read & Write. It is a different
   token from the backup's.
3. Adds three values to the service's environment on Render: `HUKAMNAMA_PUBLIC_BUCKET`,
   `HUKAMNAMA_PUBLIC_ACCESS_KEY_ID`, `HUKAMNAMA_PUBLIC_SECRET_ACCESS_KEY`
   (`HUKAMNAMA_R2_ENDPOINT` is already there for the backup). Use the token's S3 Access Key ID and
   Secret, as for Litestream.

With the bucket name set and a key missing, the service refuses to start and names what is
missing. After the next deploy the first poll writes every published day; `public snapshot: wrote N`
in the log confirms it. A failed write is logged (`public snapshot sync failed`) and tried again
after the next poll; it never stops polling or sending. `HUKAMNAMA_MEANING=on` adds the English
translation layer to the files, and removing it takes the layer out on the next poll.

## Behind the edge: whose address a request is limited by

The device routes and every read are rate-limited per client address (writes 20 a minute, reads
120 a minute, each with its own budget; a connection idle for 15 seconds is dropped). Which address
that is depends on two settings:

| Setting | Effect |
|---|---|
| neither (staging today) | the first `X-Forwarded-For` entry, as Render's proxy sets it |
| `HUKAMNAMA_ORIGIN_SECRET` | only a request carrying the same value in `X-Origin-Auth` may name its address (`X-Client-IP`, set by the edge Worker from what Cloudflare saw); any other request is limited by its socket's own address, so a caller cannot pick a bucket by sending a header |
| `HUKAMNAMA_ORIGIN_REQUIRED=on` as well | `/v1/*` answers `403` to anything that did not come through the edge; `/health` stays open for Render and the dead-man check |

Set the same secret on the Worker (`npx wrangler secret put ORIGIN_SECRET`) and on Render, the
Worker first. Turn `HUKAMNAMA_ORIGIN_REQUIRED` on only when every caller goes through the edge:
the iOS app and the website's page function call this host directly on staging today. Required
without a secret refuses everyone.

## Every morning (automatic)

- The poller runs every minute 05:00–09:00 IST, then every 10 minutes until 14:00 IST.
- `hukamnama-deadman.yml` checks `/health` at 06:00, 07:00 and 14:15 IST. On a problem it opens
  one issue per Amritsar date (later runs comment on it). It never restarts anything.
- Each distinct page fetched is kept at `/var/data/archive/<amritsar date>/` (gzip) with an
  `index.ndjson` of every fetch. Day folders older than 60 days are pruned.

## The morning check (automatic)

`hukamnama-morning.yml` runs at 07:15 and 10:00 IST. From outside it reads what a visitor reads
(the page in English, Punjabi and French, the JSON feed's newest entry, the embed), hashes the
Gurmukhi lines each one shows and compares that with the `range_sha256` the API published for the
date shown. Once the API has published today's Hukamnama, every surface must show today's. A
mismatch opens one issue per Amritsar date, and later runs comment on it.

It is silent until its variables are set (repository variables):

| Environment | Variables |
|---|---|
| staging | `HUKAMNAMA_STAGING_SITE_URL` (the staging site's origin); the API is `HUKAMNAMA_STAGING_URL` |
| production | `HUKAMNAMA_PROD_SITE_URL` and `HUKAMNAMA_PROD_API_URL` |

Run it by hand: `python3 scripts/ci/hukamnama_morning.py <site origin> <api origin>`.

## Production deploys (owner, by hand)

Production never deploys on a push. After a release, dispatch `hukamnama-deploy-production` with
the release tag:

```bash
gh workflow run hukamnama-deploy-production.yml --repo Algorythmos-AI/sggs-platform -f tag=vX.Y.Z
```

It refuses a tag that is not `vX.Y.Z` on `main`, runs the service's tests on the tag, and then,
before asking Render for anything, proves every day the running service has published against the
database the tag pins. If a dataset bump moved or changed a published day's lines the run stops
with the day named: correct or re-approve that day on the running service first. For the very
first deploy, when there is no service to read, add `-f first_deploy=true`.

Setup, once: the Render service with auto-deploy off, its deploy hook as the secret
`RENDER_DEPLOY_HOOK_HUKAMNAMA_PROD` in the `production` environment, and the repository variable
`HUKAMNAMA_PROD_URL`. If the service refuses direct calls (`HUKAMNAMA_ORIGIN_REQUIRED=on`), also
set `HUKAMNAMA_PROD_READ_URL` to the public API origin, where its published days can be read.

The staging deploy runs the same proof on every push.

## Looking at the soak

```bash
curl -s https://sggs-hukamnama-staging.onrender.com/health | python3 -m json.tool
curl -s https://sggs-hukamnama-staging.onrender.com/v1/hukamnama?limit=14 | python3 -m json.tool
render ssh <service-id>              # then: ls /var/data/archive; python -m hukamnama show 2026-11-10
```

Copy a day's archive off the box for the replay tests with
`render ssh <service-id> -- tar -C /var/data/archive -czf - 2026-11-10 > hk-2026-11-10.tgz`.

## When a morning goes wrong

| Symptom | Action |
|---|---|
| Issue: the poller is stale / unreachable | Render dashboard → service → Logs and Events. Restart the service; state is on the disk. |
| Issue: nothing by 07:00 IST | Open hs.sgpc.net. If SGPC is late, nothing to do. If it is up, look at `/health` alerts. |
| `held_no_match` / `held_veto` | Check the day by hand against the corpus, then `python -m hukamnama approve …` or `hold …` over `render ssh` (both are audited). A `held_no_match` alert names the nearest corpus run and the differing words when one run is that close (≤3 words). Confirm the difference is the source's, not ours (the corpus is PDF-proven; compare ShabadOS too), then approve that range, adding the heading line before it if the page printed one: `approve <date> --first-line <first> --last-line <last> --by <you> --reason "SGPC page variant: <word>"`. Example: 2026-11-10, Ang 678, SGPC wrote ਨਾਨਕੁ for the corpus's ਨਾਨਕ (lines 29433-29442). |
| `hs_layout_changed` / `hs_parse_failing` | SGPC changed its page. Save the archive for that day, fix the parser in a PR, add the page as a fixture. |
| A published day is the wrong shabad | `python -m hukamnama correct <date> --first-line <first> --last-line <last> --by <you> --reason "…"`. The day keeps its first publication time and gains `corrected_at`; the public files, the feeds (as an updated entry) and the pages follow within one poll interval (up to ten minutes when idle). It sends no push: run `resend` as well if the phones should be told. Only a published day can be corrected; use `approve` for a held one. |
| Something is badly wrong and nothing should be shown | `python -m hukamnama pause --by <you> --reason "…"`. Within one poll interval every day reads as pending, the public files are removed and nothing is sent; `/health` and `/v1/status` say `paused`. The poller keeps deciding days, so `python -m hukamnama resume --by <you> --reason "…"` restores everything. Both are audited. |
| Service refuses to start: corpus fingerprint changed | A dataset bump changed the corpus. Re-resolve published days before serving; never delete the state file to get past it. |

## Push (APNs)

Sending is off unless the service has `HUKAMNAMA_SEND=on`. To turn it on (owner, once per service):

1. **APNs Auth Key:** Apple Developer → Certificates, Identifiers & Profiles → Keys → **+**,
   name it `Gurbani Soul push`, tick **Apple Push Notifications service (APNs)**, choose
   **Sandbox & Production**, and download the `.p8` once. It is not the App Store Connect API key.
2. **Render → service → Environment → Secret Files:** add `apns.p8` with the file's contents
   (paste it into the dashboard; never into chat, a ticket or the repository).
3. **Environment variables:** `HUKAMNAMA_APNS_KEY_FILE=/etc/secrets/apns.p8`,
   `HUKAMNAMA_APNS_KEY_ID=<the key's 10-character ID>`, `HUKAMNAMA_APNS_TEAM_ID=<team id>`, then
   `HUKAMNAMA_SEND=on`. **Save only**, then dispatch `hukamnama-deploy` outside the freeze.
4. Check `/health`: `push.sending` is `true`. If the key is missing or unusable the service
   refuses to start (Render keeps the previous instance running and shows the error in Logs).

Which phones a service reaches is decided by the app build: TestFlight builds register with
**staging** (`api-staging.gurbanisoul.com`), App Store builds with **production**
(`api.gurbanisoul.com`). So staging only ever pushes to TestFlight testers.

Every morning after publishing, `/health.push.today` shows the send states. Alerts:
`push_breaker` (more than 5% of the first results were 4xx; the run stopped and nothing was
deleted: check the key, topic and environment, then `resend`, which clears the breaker and is
audited), `push_auth_failed` (403: the key was revoked or the IDs are wrong; the day pauses for
20 minutes and resumes by itself, the queued devices are not lost), `push_payload_too_large`
(also a 20-minute pause), `device_flood` (the new-device cap was
hit). To push a corrected day again: `python -m hukamnama resend <date> --by <you> --reason "…"`.

## Not yet

The R2 copy of the fetch archive.
