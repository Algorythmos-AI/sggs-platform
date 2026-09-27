---
title: "Architecture Overview"
description: "The system in one page: who uses it, the containers across three repositories, production deployment and the five data layers."
sidebar:
  order: 1
verified:
  commit: a6615276
  date: "2026-09-26"
---
# Architecture Overview

The whole system on one poster — press *Next* on the site to build it up step by step:

![Poster 01 — the system landscape: people, surfaces, API, pinned database, sources, CI](../diagrams/posters/01-system-landscape.svg)

## System context (C4 level 1)

Poster 01 above is the system context: three kinds of people, three surfaces, one read-only API,
the pinned database, the source Bir and the labelled English layer, and CI as the only way to
production.

## Containers (C4 level 2)

The containers live in three repositories joined by reviewed lock files — the data repository
builds and proves the database, this one pins and serves it and publishes the golden contract, the
app vendors both at a release:

![Poster 02 — three repositories and their pins: sggs-data builds and publishes the database, sggs-platform pins and serves it, gurbani-soul-ios pins the contract and the dataset, one version number](../diagrams/posters/02-three-repositories-and-pins.svg)

## Deployment (production)

```mermaid
flowchart TB
    accTitle: Production deployment
    accDescr: A release merged into main runs deploy-production in CI. It waits for every required check, deploys the Render single API as the standby and verifies it by commit, then builds one Vercel deployment holding the website and the API as Python functions, proves it unaliased and promotes it to gurbanisoul.com, where /api is rewritten internally to the functions as gateway/routes.json says. The iOS app is archived from the release tag and goes to TestFlight and the App Store.
    main[A release merged into main] --> gates[deploy-production<br/>every required check]
    gates --> render[Render: the single API<br/>the standby, verified by commit]
    render --> build[One Vercel deployment<br/>website + API functions]
    build -->|proven unaliased, then promoted| site[gurbanisoul.com]
    site -->|/api/* internal rewrite| fn[The API functions<br/>as gateway/routes.json says]
    main -.->|the release tag| ios[iOS X.Y.Z build 1<br/>TestFlight, then the App Store]
```

The web frontend and API are **same-origin**: the browser calls `/api/*` and Vercel's internal
rewrites send those paths to the API, which runs as Python functions in the same Vercel project
([ADR-0011](../adr/0011-api-as-functions-in-the-web-project.md)). There is no CORS and the frontend
carries no API-base configuration. `gateway/routes.json` decides the routing per environment:

- **Staging** routes each of the five bounded contexts (`reader`, `search`, `verify`, `insights`,
  `knowledge`) to its own function, with `all` — the whole API — as the catch-all.
- **Production today (v1.3.10)** answers every `/api` path with `all`.
- **From the release after 1.3.10** production routes the five contexts the same way as staging —
  all five in that one release, the first after the app is live on the App Store
  ([services-production](../process/runbooks/services-production.md), step 3). The change is already
  on `integration`.

Setting production's `api_platform` back to `render` proxies `/api` to the Render single API, which
every release still deploys as the rollback target until it is retired. See
[Environments](../process/environments.md) and [bounded contexts](bounded-contexts-and-gateway.md).

## The five layers
1. **Scripture core** — `lines` (60,658 verbatim rows), raags, sections, authors, vaars.
2. **Search indexes** — [[FTS5]] (`fts`, `fts_en`, `fts_shabad`; `fts_tri` is built but no route reads it), `variants`, `word_freq`.
3. **Translations** — the Khalsa English layer, a separate labelled table (never blended into [[Gurmukhi]]).
4. **Analytics / Insight Engine** — theme network, stylometry, resonance, semantic neighbours.
5. **Knowledge layer** — attributed raag-timing claims (divergence preserved, never adjudicated).

## Source of truth vs generated
- **In sggs-data:** the PDF-derived corpus and database, the timing seed, the concept definitions and
  the private translation inputs (fetched from `Algorythmos-AI/sggs-source`, checksum-verified).
- **Here, source of truth:** `webapp/serve.py` + `verify.py` + `romannorm.py` (the behaviour the Swift
  port mirrors), `frontend/src/`, and `dataset.lock.json` (which database is served).
- **Here, generated:** `contract/*.ndjson` + `contract/openapi.json`, `frontend/dist/`, `webapp/static/`;
  `db/sggs.sqlite` is installed from the pin, never committed.

See [microservices roadmap](microservices-roadmap.md) for how the monolith is
factored for a later service split.
