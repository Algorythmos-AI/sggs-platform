---
title: "ADR-0014: The public Hukamnama API is published once and served from the edge"
description: "Why the daily Hukamnama is written as files and served by an edge Worker, never by the process that polls SGPC and sends the push; what the API promises; why the service has its own version."
sidebar:
  order: 14
---
# ADR-0014: The public Hukamnama API is published once and served from the edge

**Status:** accepted (2026-11-11), decided by the owner. The code is merged and runs on staging; the
public host `api.gurbanisoul.com` opens with the launch of the Hukamnama on gurbanisoul.com.

**Context.** The Hukamnama service (`services/hukamnama`) polls SGPC each morning, locates the
shabad in the pinned corpus, and sends the push to the iOS app. The owner wants the same Hukamnama
on the website and open to other developers, free and without a key, so that Gurbani travels and
arrives exact. A review of the first design found that public reads would share one small process,
one lock and one database file with the poller and the push sender: a flood, or an outage, on the
public side could delay the morning's Hukamnama on every phone.

**Decision.**
- **Publish once, serve from the edge.** When a day is published, corrected or held, the service
  writes one file per published day and an index to an object-storage bucket (`public.py`,
  `r2.py`). An edge Worker (`services/hukamnama-edge`) serves the read routes from those files. It
  holds no scripture, computes no text and never calls the service for a read. Device
  registration and `/health` are the only requests it passes through.
- **The text is proved at every step.** Every Gurmukhi character comes from the corpus; SGPC's page
  only locates the shabad. A file is written only when its lines hash to the day's `range_sha256`
  in the corpus it was published in. The Worker serves a file only under the date in its own name.
  The website re-reads the lines from its own corpus and proves them again before showing them.
  Anything that does not prove is not served: late rather than wrong.
- **A date is never borrowed.** "Today" is the date in Amritsar (a fixed UTC+05:30), computed where
  the request is answered. A day with no file reads as `pending`; nothing is called today's unless
  its own date is today's.
- **Keyless, open and additive.** No key, no account, any origin. Version 1 only grows: the keys
  the shipped iOS app decodes are pinned by a test, and a removal would get twelve months' notice.
  There is no guarantee of availability. Terms and display rules are on the Developers page.
- **The contract is generated.** `contract/hukamnama.openapi.json` is inferred from what the
  service and the Worker really answer (`tools/gen_hukamnama_openapi.py`), as the Knowledge Base
  API's spec is from its server ([Contract and OpenAPI](../api/contract-and-openapi.md)).
- **The service keeps its own version.** `hukamnama.__version__` is not part of the unified version
  that web, API and app share ([ADR-0004](0004-unified-semver.md)), and
  `scripts/release/check_versions.py` does not read it. The service deploys on its own schedule,
  identified by commit (`/health.commit`), and its API has its own contract version.
- **The service's code is private to this repository's licence; the documentation, the OpenAPI
  spec and an examples repository are public.**

**Consequences.**
- A flood or an outage on the public API cannot slow the poller or the push sender, and the API
  keeps answering while the service restarts or deploys.
- A correction or a hold reaches the public files within one poll interval, and caches within
  their own lifetimes; the owner's `pause` empties the public archive without a deploy.
- Two programs must agree on a file format. The spec generator runs both, and the service's tests
  fail when either changes what it answers.
- The owner runs more infrastructure: a bucket, a Worker and a route on Cloudflare, beside the
  Render service.
