---
title: "API changelog"
description: "What changed in the API, release by release, from a client's point of view: new routes and headers, changed statuses, and the releases that changed nothing a client can see."
sidebar:
  order: 6
verified:
  commit: c761e513
  date: "2026-09-27"
---
# API changelog

Only what a client of the API can observe: routes, statuses, headers and response shapes. The
project's full history, including the website, the app and the data, is in
[`CHANGELOG.md`](../../CHANGELOG.md). Since the golden contract arrived, every release has kept the
legacy `/api` bodies byte-identical unless an entry below says otherwise. The contract's own
version, `info.version` in the [OpenAPI description](contract-and-openapi.md), is `1.0.0`.

| Release | Date | What a client sees |
|---|---|---|
| Next release (on `integration`) | — | Production's five contexts each answer from their own function, so `X-Service` names the context (`search`, `reader`, …) instead of `all`. Bodies unchanged. The OpenAPI operations gain short summaries (documentation only). |
| 1.3.10 | 2026-09-25 | Production's API runs as Vercel functions inside the website's project, on the same origin. Every body is byte-identical to 1.3.9, proven by replaying the golden contract before the switch; `X-Service` is `all`. |
| 1.3.9 | 2026-09-25 | **`/api/v1/*`**: every route with the same body and strict errors (`404` for an unknown endpoint; `{"error": {"code", "message", "request_id"}}`). **`X-Request-Id`** on every response, reusing a valid incoming id. **`X-Service`** on every response. |
| 1.3.8 | 2026-09-24 | None. The code moved into three repositories; the database bytes and every response are unchanged. |
| 1.3.7 | 2026-09-24 | The **OpenAPI 3.1** description (`contract/openapi.json`) of all 26 routes, with schemas inferred from real responses. **`/healthz`** (liveness) and **`/readyz`** (readiness, per service). |
| 1.3.1 | 2026-09-20 | `/api/verify` rejects a claim over 600 characters (`400`). Readings get `Cache-Control` and an **`ETag`**, and answer `If-None-Match` with `304`. HSTS on every response. A 15-second socket timeout and a bounded worker pool. The access log stops recording query strings. |
| 1.1.1 | 2026-09-15 | `/api/meta` and `/api/health` report **`commit`**, the running build's source commit. |
| 1.1.0 | 2026-09-15 | `/api/shabad/{comp_id}` returns the composition's printed heading with its body (a heading run shares the composition's `comp_id`), and **`404`** for an unknown or vacated `comp_id` instead of an empty result. |

Before 1.0.0 (2026-09-06), the project used separate web version numbers; the routes a client
uses today, from `ang` and `search` to the analytics, timing and forms routes, were added then.
Their history is in the older sections of `CHANGELOG.md`.

## What counts as a change here

- **Added**: a route, a parameter, a response field or a header. Clients should ignore fields they
  do not know.
- **Changed**: a status, an error, a limit or the meaning of a field. The golden contract makes
  each of these a reviewed decision; a breaking change would get a new contract major version and a
  new path prefix ([versioning and caching](versioning-and-caching.md)).
- **Not a change**: the wording of `note` fields or search's `mode`, the order of JSON keys, and
  anything under the hood (hosting, services, caching layers) that leaves bodies and statuses as they
  were.
