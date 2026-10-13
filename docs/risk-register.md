---
title: "Risk Register"
description: "The project's open risks — likelihood, impact, what already mitigates each, and who owns it — reviewed at every release."
sidebar:
  order: 3
---
# Risk Register

The open risks, reviewed at every release (issues labelled `type/risk` track the work). *Owner*
is who acts when the risk moves: **owner** is the product owner, **data** / **platform** / **app**
the maintainers of sggs-data, this repository and gurbani-soul-ios.

| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|
| A rebuild changes something scriptural | low | critical | character-exact `reconcile.py`, the golden suite, `verify_regroup`, the database integrity gate and the editorial ledger in sggs-data; the dataset arrives only by a reviewed pin; the data canary compares production with the pin every six hours ([the integrity chain](data/integrity-chain.md)) | data |
| A single maintainer: knowledge and access sit with one person | high | high | CI-gated deploys, runbooks for every routine and incident, this wiki, backups of the source PDF in two places, secrets in GitHub environments rather than on a laptop | owner |
| The English translation is not licensed for distribution | high | medium | the App Store build uses the Gurmukhi-only `public` profile; the release gate refuses an English build unless `TRANSLATION-LICENSE.md` says `LICENSED: true` ([database pair](ios/db-pair-and-launch-integrity.md)) | owner |
| The brand is not yet cleared by a trademark professional | medium | high | brand gate G4 closed on a documented self-search for the first submission; professional clearance in Australia, the US and India follows launch; "Algorythmos" is the mark to protect first ([brand](brand/README.md)) | owner |
| Scholar review is one Granthi's time | medium | medium | the review pack (`make review-pack`) prints exactly what needs reading; pages awaiting review say so on the page; engineers never decide a question of the text | owner |
| Production depends on one Vercel project (the website and the API together) | low | high | the Render API keeps deploying every release as a standby until it is retired; `vercel rollback` is instant; uptime, the data canary and the docs watch alert within minutes ([rollback](process/runbooks/rollback.md)) | platform |
| iOS saved lines break on a data change | low | high | the keep-last `comp_id` rule (no body line ever changes its `comp_id`); `SavedStoreLadderTests`; the launch-integrity check | app |
| macOS CI minutes run out | medium | medium | the iOS job is path-filtered and concurrency-cancelled; the heavy jobs run nightly | app |
| Toolchain drift (two Python interpreters with different SQLite builds on the owner's Mac) | medium | medium | `make doctor`, `.python-version`, pinned toolchains in CI and in sggs-data's rebuild container | platform |

Closed and removed at the last review: the Apple Developer enrolment (active since 2026-09), the
organisation transfer (done 2026-09; see the [archive](archive.md)), cold starts on a Render staging
service (staging's API runs as Vercel functions).
