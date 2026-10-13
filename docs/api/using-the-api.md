---
title: "Using the API"
description: "What a client can rely on, what the service does not promise, how to be a good citizen of it, and what you owe the text and its translation when you show them."
sidebar:
  order: 2
verified:
  commit: c761e513
  date: "2026-09-27"
---
# Using the API

The API is open: no key, no account, no charge, and read-only. This page describes how the
service behaves today and what it expects of a client. It records facts about the service; it is
not a contract or a licence.

## What you can rely on

- **The text is verbatim and proven.** Every `gurmukhi` string is the printed line, proven
  character for character against the source and re-checked in production every six hours
  ([the integrity chain](../data/integrity-chain.md)).
- **Answers are pinned.** A golden contract of recorded responses is replayed against every
  deploy before it goes live; a change to any pinned answer is a reviewed decision, never a side
  effect ([contract and OpenAPI](contract-and-openapi.md)).
- **The legacy shape is frozen.** Bodies under `/api` are held byte for byte. `/api/v1` returns the
  same bodies with structured errors. A breaking change would get a new major contract version
  and a new path prefix, not a silent change.
- **One dataset everywhere.** Web, API and the app serve the same pinned database; `/api/health`
  reports the `commit` and `db_version` of what is running.

## What the service does not promise

- **No uptime or latency guarantee.** Production is watched every 15 minutes and rolled back
  automatically after a failed deploy ([quality and observability](../architecture/quality-and-observability.md)),
  but there is no service-level agreement.
- **No CORS.** The API sends no `Access-Control-Allow-Origin`, so a web page on another origin
  cannot call it from the browser. Call it from your server and pass the result on.
- **No published rate limit, and no bulk endpoint.** The hosting platform protects itself: a burst
  of rapid requests from one address can be met with a challenge instead of JSON (the project's
  own verification scripts have tripped it). Pace your requests, cache what you can, and do not
  crawl the Granth Ang by Ang in a tight loop.
- **`mode` and `note` are for people.** Search's `mode` names the tier that answered and a
  `note` explains a response; both may change wording. Branch on statuses, error `code`s and data
  fields ([error reference](errors.md)).

## Being a good client

- Send `If-None-Match` with the `ETag` you were given; readings are cacheable for five minutes in
  the browser and an hour at the CDN, and a `304` has no body.
- Keep `limit` to what you will show (at most 200) and page with `offset`.
- Keep the `X-Request-Id` of a failing request and quote it in a report: it finds the request in
  the server log without anything else about you.
- Expect clamping: an Ang of 0 returns Ang 1, a `limit` of 999 returns 200. Validate your own
  input if you need to tell the user.

## What you owe the text

When you show what the API returns:

- **Show the Gurmukhi exactly as returned.** Do not correct, normalise, shorten or re-order it. A
  display font may render it traditionally; the characters stay as they are.
- **Cite every line as "Sri Guru Granth Sahib Ji · Ang N"**, from the line's own `ang`.
- **Label the layers.** `translit` is a reading aid, not scripture. `en` is a translation by
  Dr. Sant Singh Khalsa; show it as a translation, credit the translator, and never present it as
  the original. Its sources' terms are recorded in the database and on
  [the English translation layer](../data/translation-layer.md); the project holds no licence it
  could extend to you.
- **Do not generate scripture.** If your product uses a language model, quote only lines the API
  returned, and verify a quotation with `/api/verify` before presenting it as Gurbani.

The reasoning behind each rule is in [the Answer Protocol for engineers](../scripture/answer-protocol-for-engineers.md).

## Privacy

The API logs one line per request: method, path, status, duration and request id. It never
records the query string, your IP address or your user agent, so what you search for is not kept
([security and privacy](../architecture/security-and-privacy.md)). The hosting provider keeps its
own standard logs.

## Contact

Questions and problems: `support@gurbanisoul.com`, with the request id. Security issues: follow
[SECURITY.md](../../SECURITY.md) and do not open a public issue.
