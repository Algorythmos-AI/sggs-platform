---
title: "The engineering wiki"
description: "How Sri Guru Granth Sahib Ji is kept verbatim across the SGGS Knowledge Base and the Gurbani Soul app: the pipeline, the database, the API, the surfaces and the checks. Start here."
sidebar:
  order: 0
---
# The engineering wiki

Sri Guru Granth Sahib Ji — all 1,430 Angs, 60,658 lines — kept **verbatim**, cited by Ang, and
never altered. This wiki explains how: the pipeline that proves the text against the source Bir,
the database and the read-only API built from it, the website ([gurbanisoul.com](https://gurbanisoul.com))
and the Gurbani Soul iOS app that show it, and the checks every change passes before it reaches
anyone. It is written for engineers first, and for anyone who wants to understand how the
scripture is kept whole.

> **Prime directive:** the Gurmukhi text is sacred and **verbatim**. It is never
> edited, normalized, or corrected. Every change is proven against the source PDF.
> See [the integrity chain](data/integrity-chain.md) and
> [Scripture integrity](https://github.com/Algorythmos-AI/sggs-data/blob/main/docs/architecture/scripture-integrity.md) (in sggs-data).

<!-- sggs:status -->
On the rendered wiki this line shows what production is serving right now — version, commit,
build date, dataset build and the health checks — read live from `/api/health`.

## Choose your path

<!-- sggs:cards -->
- [Platform engineer](learning-paths/platform-engineer.md) — the API, the search and verification engines, the data pin and the delivery pipeline, in order.
- [Data engineer](learning-paths/data-engineer.md) — the line record, the corpus pipeline and its gates, the editorial ledger, and how a dataset reaches production.
- [iOS engineer](learning-paths/ios-engineer.md) — Gurbani Soul: the contract and parity, the database pair and launch integrity, Nitnem, and how the app takes a release.
- [Reviewer or scholar](learning-paths/reviewer-scholar.md) — what the project promises, where the text is proven, what a review checks, and how to say no.

New to the project? [Your first week](onboarding/README.md) is five days to a merged change.

## Ten minutes to your first search

1. Clone the platform: `git clone https://github.com/Algorythmos-AI/sggs-platform.git && cd sggs-platform`
2. `make doctor` — checks Python 3.12, Node 22 and whether the database is installed.
3. `make dataset` — downloads the pinned database (~104 MiB), verifies its sha256, installs it.
4. `cd webapp && python3 serve.py` — the API and the website on <http://localhost:7777>.
5. Search. Every line comes back verbatim, with its Ang — or try it here, against production:

<!-- sggs:waterfall q="sat nam" limit="3" -->
On the rendered wiki this is the search simulator: it runs the query against the live API and
lights the tier of the waterfall that answered. On GitHub, run
`curl -s 'http://localhost:7777/api/search?q=sat%20nam&limit=3'` after step 4.

The whole walk-through, with what to do when a step fails: [Run it locally](onboarding/run-it-locally.md).

## The whole system

The people, the three surfaces, the one read-only API, the pinned database and where the text
comes from — press *Next* on the site to build it up step by step:

![Poster 01 — The system landscape: the people, the three surfaces (web, iOS, wiki), the one read-only API, the pinned database, and where the verbatim text comes from](diagrams/posters/01-system-landscape.svg)

## Find your way

<!-- sggs:cards -->
- [Scripture 101](scripture/README.md) — what the Granth is, its structure, the script and its Unicode, and how answers about it are given.
- [Architecture](architecture/README.md) — three repositories, one read-only API in five contexts, a pinned database: the system and how its parts fit.
- [Data](data/README.md) — a line record, the corpus pipeline and its gates, the dataset pin, the editorial ledger, the integrity chain.
- [Search & verification](search/README.md) — the search waterfall, the Roman fold, the verification engine and the harnesses that hold them.
- [The API](api/README.md) — 26 read-only routes, the contract that pins them, versioning and caching, and a reference to try.
- [The iOS app](ios/README.md) — Gurbani Soul: how it takes a release, its parity with the API, its launch-integrity check, Nitnem.
- [Ship & operate](process/README.md) — branching, environments, the CI gates, releases and the runbooks for when something goes wrong.
- [Decisions](adr/README.md) — why the system is the way it is, one decision record at a time.
- [Glossary](glossary.md) — every term the wiki uses, from Ang to X-Service.
- [Writing these docs](contributing/README.md) — how a page, a diagram, a poster or a widget gets onto this site, and the gates it passes.

## Latest changes

<!-- sggs:releases limit="3" -->
The newest releases, read from the changelog at build. Every release and what it changed:
[Releases](reference/releases.md) · the full [changelog on GitHub](https://github.com/Algorythmos-AI/sggs-platform/blob/integration/CHANGELOG.md).
