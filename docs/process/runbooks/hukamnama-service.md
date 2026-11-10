---
title: "Runbook: Hukamnama service"
description: "The Hukamnama service on Render: the staging soak with sending off, its one-time setup, the morning dead-man check, the fetch archive, and what to do when a morning goes wrong."
sidebar:
  order: 6
verified:
  commit: 4d156a17
  date: "2026-11-09"
---
# Runbook: Hukamnama service

The Hukamnama service (`services/hukamnama/`) locates the daily Hukamnama from Sri Harmandir
Sahib inside the pinned corpus. Before any notification is sent it runs a **14-day soak on
staging with sending off**: it polls SGPC every morning, decides, and keeps every page it saw. The
soak measures the real publish minute and the hs.sgpc.net ↔ sgpc.net lag, and checks that at
least 13 of 14 mornings resolve automatically and correctly against a manual check.

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

## Every morning (automatic)

- The poller runs every minute 05:00–09:00 IST, then every 10 minutes until 14:00 IST.
- `hukamnama-deadman.yml` checks `/health` at 06:00, 07:00 and 14:15 IST. On a problem it opens
  one issue per Amritsar date (later runs comment on it). It never restarts anything.
- Each distinct page fetched is kept at `/var/data/archive/<amritsar date>/` (gzip) with an
  `index.ndjson` of every fetch. Day folders older than 60 days are pruned.

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
| Service refuses to start: corpus fingerprint changed | A dataset bump changed the corpus. Re-resolve published days before serving; never delete the state file to get past it. |

## Not yet (see the approved plan)

The R2 copy of the fetch archive, the device API and the APNs sender. Sending stays off until the soak passes and the G3/G4 gates are signed.
