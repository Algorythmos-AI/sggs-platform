---
title: "Runbook: launching the Hukamnama"
description: "The ordered steps to take the daily Hukamnama public on gurbanisoul.com: the production service and edge, the one launch switch, the release, the checks after it, and how to pull it back."
sidebar:
  order: 7
verified:
  commit: 9529fdf2
  date: "2026-11-12"
---
# Runbook: launching the Hukamnama

Everything for the public Hukamnama is merged and runs on staging. In production it is switched
off: the pages, feeds, sitemap and embed are not routed, the Developers page is hidden from
search, and nothing links to any of it. This is the order to switch it on. Each step says who does
it; "owner" steps need accounts or secrets that are never in this repository.

Do not start before the soak has run its 14 mornings (day 1 was 2026-11-11) with no wrong day.

## Before launch day

| # | Step | Who |
|---|---|---|
| 1 | Read the soak: every morning published or correctly held; no `held_*` alert left unexplained ([service runbook](hukamnama-service.md#looking-at-the-soak)). | owner |
| 2 | Decide the meaning layer: leave `HUKAMNAMA_MEANING` off, or turn it on ([ADR-0015](../../adr/0015-hukamnama-meaning-layer.md), `NOTICE.md`). It can be changed any day. | owner |
| 3 | Cloudflare: create the R2 bucket `hukamnama-public`, and a token scoped to that bucket for the service. | owner |
| 4 | Render: create the production Hukamnama service (Docker, 1 GB disk, auto-deploy off, sending off), with the bucket settings and a new `HUKAMNAMA_ORIGIN_SECRET`. Add its deploy hook as the secret `RENDER_DEPLOY_HOOK_HUKAMNAMA_PROD` (environment `production`) and its origin as the variable `HUKAMNAMA_PROD_URL`. | owner |
| 5 | Deploy the service from the current release tag: `gh workflow run hukamnama-deploy-production.yml -f tag=vX.Y.Z -f first_deploy=true`. Wait for a morning: it must publish a day and write it to the bucket. | owner |
| 6 | Cloudflare: deploy the Worker (`cd services/hukamnama-edge && npx wrangler deploy`), set its secret (`npx wrangler secret put ORIGIN_SECRET`, the same value as step 4), add a proxied DNS record for `api.gurbanisoul.com` that points at the Render service (the Worker passes device registration and `/health` on to it), and route `api.gurbanisoul.com/*` to the Worker. | owner |
| 7 | Check the edge: `curl https://api.gurbanisoul.com/v1/status` and `/v1/hukamnama/today`; then run an example from the examples repository against it. | either |
| 8 | Once the iOS app and the website reach the service only through the edge, set `HUKAMNAMA_ORIGIN_REQUIRED=on` on Render and the variable `HUKAMNAMA_PROD_READ_URL` to `https://api.gurbanisoul.com`. | owner |

## Launch day

| # | Step | Who |
|---|---|---|
| 9 | One pull request: add `"hukamnama_api": "https://api.gurbanisoul.com"` to `production` in `gateway/routes.json`, run `python3 tools/gen_gateway.py`, rebuild the site (`cd frontend && npm run build:deploy`). This one key routes the pages, feeds, sitemap and embed in production, makes the Developers page indexable and listed, links it from the footer, names the Hukamnama sitemap in `robots.txt` and adds the Hukamnama section to `llms.txt`. | either |
| 10 | Release as usual (the `sggs-release` flow). The production deploy's own checks prove the pages, feeds, sitemap and the embed's framing headers on the live site. | owner merges |
| 11 | Set the morning check's variables: `HUKAMNAMA_PROD_SITE_URL` = `https://gurbanisoul.com`, `HUKAMNAMA_PROD_API_URL` = `https://api.gurbanisoul.com`. Dispatch `hukamnama-morning` once and read its report. | owner |
| 12 | Search engines: add `https://gurbanisoul.com/sitemap-hukamnama.xml` in Google Search Console and Bing Webmaster Tools. For IndexNow, generate a key, commit it as `frontend/public/<key>.txt` (its whole content is the key) and set the repository variable `INDEXNOW_KEY`; from then on a passing morning check announces the day's pages. | owner |
| 13 | Make the examples repository public (`Algorythmos-AI/hukamnama-api-examples`). | owner |

## The first two mornings

Watch, around 05:30 to 07:30 IST: the page before publication shows the latest day under its own
date; within a few minutes of publication it shows today's; the dated page stays. The morning
check and the dead-man check must both stay quiet. Compare the page's text with the Reader line by
line once.

## Pulling it back

In order of reach, least first:

| Need | Do |
|---|---|
| One day is the wrong shabad | `python -m hukamnama correct …` on the service ([service runbook](hukamnama-service.md#when-a-morning-goes-wrong)). |
| Nothing should be shown right now | `python -m hukamnama pause --by <you> --reason "…"`. Within one poll interval every day reads as pending everywhere; `resume` restores it. No deploy. |
| The English layer must go | Set `HUKAMNAMA_MEANING=off` on the service. |
| The public launch itself must be undone | Revert the pull request of step 9 and release. The paths return to the static site (404), the Developers page is hidden again. The service and the iOS push are unaffected. |

## Not part of this launch

A navigation link named for the Hukamnama, a correction notice on the page and the month archive
need new translated strings and the owner's read. The daily email, the Hindi pages, Telegram and
browser push are later phases, each needing its own accounts and reviewers.
