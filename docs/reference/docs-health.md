---
title: "Docs health"
description: "How current the wiki is, measured at every build: fresh and stale verified stamps, median stamp age, coupling debt per pull request, and how often code changes touch docs/."
sidebar:
  order: 7
---
# Docs health

These numbers are measured when the site is built, by `python3 tools/docs_check.py --health`.
The deploy-docs `docs` job writes them to `docs-site/.health.json` just before the build. That
file is never committed, so a local build without it shows no numbers.

<!-- sggs:docs-health -->
On the rendered wiki this is a table of the numbers below, measured at build. On GitHub, run
`python3 tools/docs_check.py --health health.json` and read the file.

## What each number means

- **Fresh stamps.** A page with a `verified: {commit, date}` stamp is fresh unless one of three
  things is true. The code it covers changed since the stamp (its `covers:`, or the files it
  cites). It cites no code and the stamp is more than 60 days old. Or the stamp's commit is not in
  the history. The full list is `python3 tools/docs_check.py --freshness`, and the weekly
  docs-freshness pull request carries it.
- **Median stamp age.** The median number of days since each `verified.date`.
- **Coupling debt.** The pull requests merged into `integration` over the last 30 days whose
  diff changed code a page covers while that page and its stamp stayed the same and the pull
  request's final description did not excuse it. Each first-parent merge `Merge pull request #N`
  is attributed to its pull request, and the description is read from GitHub, so a page named on
  its own `Docs-impact: docs/<page>.md — …` line (or a cited-files page under a
  `Docs-impact: none — …` line) is not debt. The rule applied is today's, from
  [the docs-impact check](../contributing/writing-docs.md#docs-impact), also to pull requests
  merged before it changed. It is measured on `integration` even when the site is built from
  `main`, where every merge is a release bundling many pull requests (the page said "15 of 15
  merges" before 2026-11-22). A build without a token cannot read the descriptions: then every flag
  counts, and the table says the number is an upper bound.
- **Code commits that also changed docs/.** Of the non-merge commits in the last 30 days that
  changed code, the share that also changed a file under `docs/`. Tests, lockfiles, built output,
  `CHANGELOG.md` and the generators of generated pages do not count as code here.
- **Sibling pins behind their branch.** Shown only when the build has a token. It counts the
  commits between each sibling repository's pinned commit (`docs-site/sources.lock.json`) and the
  head of its branch.
