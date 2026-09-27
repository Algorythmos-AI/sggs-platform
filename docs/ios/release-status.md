---
title: "Release status"
description: "Where the app stands with Apple: every upload from the app's ledger, rendered at build from the pinned commit, and the sign-off record of the first App Store submission."
sidebar:
  order: 5
verified:
  commit: 0f89c40f
  date: "2026-09-27"
---
# Release status

Two records in `gurbani-soul-ios` say where the app stands, and this page reads both at the commit
the wiki pins. The **ledger** (`ios/testflight-builds.json`) records every upload, written by the
archive script at upload time. The **build log** in the TestFlight test plan records the owner's
sign-offs and the submission. Neither records what Apple decides afterwards: an approval, a
rejection or the day a version goes live is known in App Store Connect, not here.

## The first App Store submission

**1.3.10 (1)** is the first build submitted for App Review: submitted on 2026-09-26 at 03:49 UTC,
with **manual release**, built from platform `b5c6a0d` and the public (Gurmukhi-only) database
profile. Every owner gate of the [App Store submission runbook](https://github.com/Algorythmos-AI/gurbani-soul-ios/blob/2f89359ca41f0bd1df10acfc0bf8ba5c40c627a4/docs/process/runbooks/app-store-submission.md)
is signed in the
[sign-off record](https://github.com/Algorythmos-AI/gurbani-soul-ios/blob/2f89359ca41f0bd1df10acfc0bf8ba5c40c627a4/docs/ios/testflight-test-plan.md#sign-off-record--1310-1-the-first-app-store-submission):
the brand and trade-dress gates, the scripture-fidelity charter (8 of 8 on a physical iPhone), the
hardware pass (10 of 10) and the App Store Connect listing (no drift; "Data Not Collected"; free,
4+).

Manual release means an approved version waits at *Pending Developer Release* until the owner
releases it; approval alone does not put it on the store.

## Every upload

<!-- sggs:app-builds -->
On the rendered wiki this is the table of every upload, newest first. On GitHub, read the ledger
itself: [`ios/testflight-builds.json`](https://github.com/Algorythmos-AI/gurbani-soul-ios/blob/main/ios/testflight-builds.json).

How to read it:

- **Channel.** A *TestFlight* build is for testers. An *App Store* build is archived from the
  release tag with `CHANNEL=appstore`, the only kind the submission preflight accepts. Such a
  build is a *candidate*: most platform releases since 1.3.2 have one (the ledger has no upload
  for 1.3.1 or 1.3.6), and 1.3.10 (1) is the first to be submitted
  ([one version number](how-the-app-takes-a-release.md)).
- **Profile.** Every upload so far is *public*: the English translation layer is not licensed for
  distribution, so no build carrying it has been uploaded
  ([the licence gate](db-pair-and-launch-integrity.md)).
- **Platform and dataset.** The commits the build was made from; the database hash proves the
  archive holds exactly that dataset's iOS database.

## How this page stays current

The ledger is read when the wiki is built, from the commit in `docs-site/sources.lock.json`. Every
Monday the `docs-pins` workflow moves that pin to the app repository's `main` when a pinned file
has changed (the ledger is one), through a reviewed pull request, so a new upload appears here
within a week of it, once that pull request merges. The paragraph about the first submission is
written by hand; the next submission's record belongs in the build log first, then here.
