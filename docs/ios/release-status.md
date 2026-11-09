---
title: "Release status"
description: "Where the app stands with Apple: why there are more uploads than store versions, where each version's status and evidence are kept, and every upload from the app's ledger."
sidebar:
  order: 5
verified:
  commit: 26d86be7
  date: "2026-11-08"
---
# Release status

Two records in `gurbani-soul-ios` say where the app stands, and this page reads both at the commit
the wiki pins. The **ledger** (`ios/testflight-builds.json`) records every upload, written by the
archive script at upload time. The **build log** in the TestFlight test plan records the owner's
sign-offs for the first submission and the first update. Neither records what Apple decides afterwards: an approval, a
rejection or the day a version goes live is known in App Store Connect, not here.

## Where the app stands

Gurbani Soul has been on the App Store since 2026-10-13, when **1.3.10 (1)**, the first version
submitted, was released. Every version since is a free update from the same listing.

Not every build reaches the store. Each platform release that the app follows is archived from
its tag as an App Store *candidate* and uploaded; it is submitted only when the previous version
has been released, because App Store Connect accepts a new version only after the previous one is
released. A candidate
that is overtaken by a newer release while it waits is never submitted, and its changes reach
readers with the next version that is. So the ledger below lists more versions than the store has
shipped.

Which versions went to the store, which is in review and which were superseded is recorded per
version in the app repository's What's New index,
[`docs/ios/whats-new/README.md`](https://github.com/Algorythmos-AI/gurbani-soul-ios/blob/main/docs/ios/whats-new/README.md),
updated in each release's records pull request. App Store Connect remains the authority on what
Apple has decided; this page does not repeat those statuses, because they change between releases.

## The first submission and the first update

**1.3.10 (1)** was the first build submitted for App Review: on 2026-09-26 at 03:49 UTC, with
**manual release**, built from platform `b5c6a0d` and the public (Gurmukhi-only) database
profile. Every owner gate of the [App Store submission runbook](https://github.com/Algorythmos-AI/gurbani-soul-ios/blob/2f89359ca41f0bd1df10acfc0bf8ba5c40c627a4/docs/process/runbooks/app-store-submission.md)
is signed in the
[sign-off record](https://github.com/Algorythmos-AI/gurbani-soul-ios/blob/2f89359ca41f0bd1df10acfc0bf8ba5c40c627a4/docs/ios/testflight-test-plan.md#sign-off-record--1310-1-the-first-app-store-submission):
the brand and trade-dress gates, the scripture-fidelity charter (8 of 8 on a physical iPhone), the
hardware pass (10 of 10) and the App Store Connect listing (no drift; "Data Not Collected"; free,
4+). Apple approved it, and it was released on 2026-10-13 at 21:16 UTC.

Manual release means an approved version waits at *Pending Developer Release* until the owner
releases it; approval alone does not put it on the store.

**1.4.0 (1)**, the first update, was uploaded on 2026-10-13 from the app's tag `v1.4.0`, built
against platform `2c41123` with the public profile. It is the first build archived and uploaded by
the hosted workflow instead of a maintainer's Mac, and it was submitted on 2026-10-14 at 00:11 UTC
with manual release and a seven-day phased release. Its sign-off record is in the same build log.

## Where a release's evidence lives

The two sign-off records above are the only ones in the TestFlight test plan. Later versions keep
their records in the places the app repository's `AGENTS.md` names: the What's New text of every
version (`docs/ios/whats-new/<version>.md`), the physical-device test runs
(`ios/device-runs/<version>/`, with the bundles in a private evidence repository), and the upload
ledger below. The release run on a phone at the tag gates the submission, and
`make appstore-preflight` must pass on the app's `main` before one is made.

## Every upload

<!-- sggs:app-builds -->
On the rendered wiki this is the table of every upload, newest first. On GitHub, read the ledger
itself: [`ios/testflight-builds.json`](https://github.com/Algorythmos-AI/gurbani-soul-ios/blob/main/ios/testflight-builds.json).

How to read it:

- **Channel.** A *TestFlight* build is for testers. An *App Store* build is archived from the
  release tag with `CHANNEL=appstore`, the only kind the submission preflight accepts. Such a
  build is a *candidate*. Most platform releases since 1.3.2 have one; a release with no app build
  simply has no row ([one version number](how-the-app-takes-a-release.md)). A row records an
  upload, not a submission.
- **Profile.** Every upload so far is *public*: the English translation layer is not licensed for
  distribution, so no build carrying it has been uploaded
  ([the licence gate](db-pair-and-launch-integrity.md)).
- **Built from.** The app, platform and dataset commits the build was made from, and the sha256
  of the database inside the archive, which proves it holds exactly that dataset's iOS database.
  The platform and dataset commits are recorded from 1.3.8, when the code split into three
  repositories. The earliest rows were backfilled from App Store Connect after the fact, so they
  have no date or commits, and their note says so.

## How this page stays current

The ledger is read when the wiki is built, from the commit in `docs-site/sources.lock.json`. Every
Monday the `docs-pins` workflow moves that pin to the app repository's `main` when a pinned file
has changed (the ledger is one), through a reviewed pull request, so a new upload appears here
within a week of it, once that pull request merges. Nothing else on this page needs editing at a
release: the per-version status belongs in the What's New index and the evidence in the app
repository, as above.
