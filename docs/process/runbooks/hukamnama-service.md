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
| Environment | none needed. The image sets `HUKAMNAMA_DB`, `HUKAMNAMA_STATE`, `HUKAMNAMA_ARCHIVE`. |

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
6. Later: point `api-staging.gurbanisoul.com` (Cloudflare CNAME → the onrender host, then add it
   as a custom domain in Render). TestFlight builds read the Hukamnama from that name.

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
| `held_no_match` / `held_veto` | Check the day by hand against the corpus, then `python -m hukamnama approve …` or `hold …` over `render ssh` (both are audited). |
| `hs_layout_changed` / `hs_parse_failing` | SGPC changed its page. Save the archive for that day, fix the parser in a PR, add the page as a fixture. |
| Service refuses to start: corpus fingerprint changed | A dataset bump changed the corpus. Re-resolve published days before serving; never delete the state file to get past it. |

## Not yet (see the approved plan)

Litestream backup of the state to R2, the R2 copy of the fetch archive, the device API and the
APNs sender. Sending stays off until the soak passes and the G3/G4 gates are signed.
