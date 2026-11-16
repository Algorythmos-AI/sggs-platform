---
title: "API changelog"
description: "What changed in the API, release by release, from a client's point of view: new routes and headers, changed statuses, and the releases that changed nothing a client can see."
sidebar:
  order: 6
verified:
  commit: 14c89ad9
  date: "2026-11-12"
---
# API changelog

Only what a client of the API can observe: routes, statuses, headers and response shapes. The
project's full history, including the website, the app and the data, is in
[`CHANGELOG.md`](../../CHANGELOG.md). Since the golden contract arrived, every release has kept the
legacy `/api` bodies byte-identical unless an entry below says otherwise. The contract's own
version, `info.version` in the [OpenAPI description](contract-and-openapi.md), is `1.0.0`.

| Release | Date | What a client sees |
|---|---|---|
| A later release | — | Production's five contexts each answer from their own function, so `X-Service` names the context (`search`, `reader`, …) instead of `all`. Bodies unchanged. Staging routes by context today; production still answers every path from `all`. |
| 1.6.1 – 1.6.4 | 2026-11-05 – 11-09 | None. |
| 1.6.0 | 2026-11-05 | **`en_span`** (`{first, last}` line ids) on every line that belongs to an English record covering two to four printed lines (dataset 1.4.0, `translation_spans`). The English is attached once, as `en` on the last member present in the response, so a list shows it once under the group even when an Ang boundary cuts the span. Additive: a client that ignores `en_span` still finds the English. More lines carry `en` than before, and the English-derived golden vectors moved with the data. |
| 1.5.2 | 2026-10-29 | None. |
| 1.5.1 | 2026-10-28 | Bodies follow dataset 1.3.0: `author`, `comp_id` and `section` move where the scholar ruled (Angs 1253, 1363–1384, 695, 524 and 323). No route, parameter or field changed. |
| 1.5.0 | 2026-10-27 | `mode=auto` finds the same lines for every common spelling of the Name (waheguru, vaheguru, vahiguru, wahiguru, with or without "ji"), and theme search opens the theme whose slug a query folds to. Six golden search vectors added; every existing one unchanged. The Vaar routes follow dataset 1.2.0 (`vaar_units` 1,426 → 1,443). |
| 1.4.9 | 2026-10-25 | `/api/analytics/author?author=` adds per-voice **`facts`**, **`named_by`** and **`names`** (lines where the voice is named, or names another), and **`dialogues`**; each is omitted when the dataset lacks its table. Bodies follow dataset 1.1.0 (corrected `author` tags). |
| 1.4.8 | 2026-10-23 | Three routes: **`/api/analytics/sky`**, **`/api/analytics/pair`** and **`/api/analytics/theme`** (29 in all). `/api/analytics/constellation` gains the lens parameters `raags`, `rahao`, `min_themes`, `ang_min` and `ang_max` beside `concept`, `author` and `raag`, and its body gains solo, shared, companions and Ang bins. A `golden_constellation` suite of 31 vectors pins them. |
| 1.4.1 – 1.4.7 | 2026-10-15 – 10-20 | None. |
| 1.4.0 | 2026-10-14 | The OpenAPI operations gain short summaries (documentation only). Production still answers every path from `all`. |
| 1.3.10 | 2026-09-25 | Production's API runs as Vercel functions inside the website's project, on the same origin. Every body is byte-identical to 1.3.9, proven by replaying the golden contract before the switch; `X-Service` is `all`. |
| 1.3.9 | 2026-09-25 | **`/api/v1/*`**: every route with the same body and strict errors (`404` for an unknown endpoint; `{"error": {"code", "message", "request_id"}}`). **`X-Request-Id`** on every response, reusing a valid incoming id. **`X-Service`** on every response. |
| 1.3.8 | 2026-09-24 | None. The code moved into three repositories; the database bytes and every response are unchanged. |
| 1.3.7 | 2026-09-24 | The **OpenAPI 3.1** description (`contract/openapi.json`) of all 26 routes, with schemas inferred from real responses. **`/healthz`** (liveness) and **`/readyz`** (readiness, per service). |
| 1.3.1 | 2026-09-20 | `/api/verify` rejects a claim over 600 characters (`400`). Readings get `Cache-Control` and an **`ETag`**, and answer `If-None-Match` with `304`. HSTS on every response. A 15-second socket timeout and a bounded worker pool. The access log stops recording query strings. |
| 1.1.1 | 2026-09-15 | `/api/meta` and `/api/health` report **`commit`**, the running build's source commit. |
| 1.1.0 | 2026-09-15 | `/api/shabad/{comp_id}` returns the composition's printed heading with its body (a heading run shares the composition's `comp_id`), and **`404`** for an unknown or vacated `comp_id` instead of an empty result. |

The public [Hukamnama API](hukamnama.md) at `api.gurbanisoul.com` is a separate API with its own
version and its own spec (`contract/hukamnama.openapi.json`); it is not listed here and is not live
yet. The Knowledge Base API is unchanged by it: on staging only, the website's `all` function also
answers the Hukamnama pages, feeds, sitemap and embed, which are HTML and feed paths outside `/api`.

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
