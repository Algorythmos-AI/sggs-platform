# Hukamnama edge Worker

Serves the **public Hukamnama API** (`api.gurbanisoul.com/v1/hukamnama/…`) from the snapshot
files the Hukamnama service writes (`services/hukamnama`, `hukamnama/public.py`). It is a
Cloudflare Worker with no dependencies: `src/core.js` holds all the logic and runs under plain
Node in the tests.

It holds no scripture and computes no text. It reads one file per published day, plus an index,
from an R2 bucket. Public readers therefore never reach the process that polls SGPC and sends
the pushes, and the API keeps answering while that process restarts.

## Routes

| Route | Returns |
|---|---|
| `GET /v1/hukamnama/today` | the current **Amritsar** day: the published record with every line, or `pending` (`expected_by`, `latest`) |
| `GET /v1/hukamnama/YYYY-MM-DD` | one day, from 2026-11-01 up to today (the archive is permanent); a future or earlier date is 404; a day with no file is `pending` |
| `GET /v1/hukamnama?limit=N` | the latest published days, newest first, N in 1..30 (default 7); `&include=lines` adds each day's lines |
| `GET /v1/hukamnama/index` | every published day, newest first: date, Ang, `range_sha256`, `published_at`; no text |
| `GET /v1/status` | today's status, its publication time, the latest published date, `scripture_sha256` |
| `PUT`/`DELETE /v1/devices/<token>`, `GET /health` | passed to the service unchanged |

Anything else is 404 and never reaches the service.

## Rules it enforces

- **Never another day's text.** "Today" is the Amritsar date computed at request time (a fixed
  UTC+05:30). A file is served only when its own `amritsar_date` equals the date asked for, it
  says `published`, and it carries lines and a `range_sha256`. Otherwise the answer is 503
  `no-store`, never a different day.
- **Pending, not held.** A day without a file is `pending`. A held day has no file, so the
  word `held` never appears in the public API.
- **Never ahead.** A future date is 404 even if a file for it exists; the list drops any day
  after today.
- **Caching.** Today 60 s; a past published day `max-age=3600, s-maxage=86400`; pending 30 s;
  errors `no-store`. Every 200 has a strong `ETag`, and a matching `If-None-Match` gets 304.
- **CORS** is open (`*`) on the reads only. Passed-through requests get no CORS headers here.
- **Errors** are `{"error": "<text>", "code": "<slug>", "request_id": "…"}`. `error` stays a
  plain string.
- **Where passed-through requests go.** `/health` and `/v1/devices/*` go to `ORIGIN_URL` (a
  plain variable: the service's own https origin, for example its `onrender.com` address) when it
  is set, with the path and query kept. That is required when the Worker owns its hostname as a
  Custom Domain, as `api.gurbanisoul.com` does: nothing sits behind that hostname, so forwarding to
  it fails with 522. Without `ORIGIN_URL` they go to the same URL, which suits a Worker on a route
  in front of the service. A value that is not exactly an https origin answers 503 and sends
  nothing.
- **Origin secret.** Passed-through requests carry `X-Origin-Auth` from the `ORIGIN_SECRET`
  secret, and `X-Client-IP` from the address Cloudflare saw; values sent by the caller are always
  replaced. The service believes `X-Client-IP` only with the secret (`HUKAMNAMA_ORIGIN_SECRET`).
- **Rate limit.** The `RATE_LIMITER` binding limits reads per client address (`CF-Connecting-IP`)
  to 120 a minute and answers 429 with `Retry-After`. Cloudflare counts per location and
  approximately: a burst of 300 requests from one address on 2026-11-16 got 235 answers and 65
  429s. Without the binding the Worker does not limit.

## Run the tests

```bash
cd services/hukamnama-edge
npm test
```

CI runs the same command in the `frontend` job of `web-ci`.

## Deploy (owner, not yet done)

Nothing deploys this Worker automatically. It needs, first: the R2 bucket named in
`wrangler.toml`, the service writing its snapshot there, and `api.gurbanisoul.com` proxied by
Cloudflare. No account id, zone id or secret is kept in this repository.

```bash
npx wrangler deploy --env staging
```
