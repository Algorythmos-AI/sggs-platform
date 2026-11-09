---
title: "Docs health"
description: "How current the wiki is, measured at every build: fresh and stale verified stamps, median stamp age, coupling debt, and how often code changes touch docs/."
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
- **Coupling debt.** The first-parent merges into the branch over the last 30 days whose diff
  changed code a page covers while that page and its stamp stayed the same. A merge commit does
  not keep the pull request's `Docs-impact: none — …` line, so this number is an upper bound.
  [The docs-impact check](../contributing/writing-docs.md#docs-impact) is the same rule, applied to
  one pull request at a time.
- **Code commits that also changed docs/.** Of the non-merge commits in the last 30 days that
  changed code, the share that also changed a file under `docs/`. Tests, lockfiles, built output,
  `CHANGELOG.md` and the generators of generated pages do not count as code here.
- **Sibling pins behind their branch.** Shown only when the build has a token. It counts the
  commits between each sibling repository's pinned commit (`docs-site/sources.lock.json`) and the
  head of its branch.
