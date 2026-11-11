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
| `GET /v1/hukamnama/YYYY-MM-DD` | one day, within ±400 days; a future date is 404; a day with no file is `pending` |
| `GET /v1/hukamnama?limit=N` | the latest published days, newest first, N in 1..30 (default 7); `&include=lines` adds each day's lines |
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
- **Origin secret.** Passed-through requests carry `X-Origin-Auth` from the `ORIGIN_SECRET`
  secret; a value sent by the caller is always replaced. (The service does not check it yet.)
- **Rate limit.** When a `RATE_LIMITER` binding is present, reads are limited per client address
  and answer 429 with `Retry-After`. The binding is not configured in `wrangler.toml` yet: check
  the current Cloudflare documentation for its configuration before enabling it.

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
