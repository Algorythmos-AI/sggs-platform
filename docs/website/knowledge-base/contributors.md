---
title: "The Contributors page"
description: "The Knowledge Base Contributors page at /lineage: the roster joined to live corpus counts, the four views, the kind filter, a voice's profile, comparing two voices, and the review gate."
covers: "frontend/src/pages/lineage.astro, frontend/src/scripts/lineage.ts, frontend/src/scripts/voices.ts"
sidebar:
  order: 6
verified:
  commit: c5806fdd
  date: "2026-11-22"
---
# The Contributors page

`/lineage` ("The Contributors") shows the voices whose Bani is in the Granth: the Gurus, the
Bhagats, the Bhatts and the Gursikhs. It describes the corpus and never touches it. The roster it
draws on, with every voice's dates, places and sources, is published as its own page:
[the contributors to the Granth](../../reference/contributors.md).

## Where the data comes from

`lineage.ts` joins two things when the page loads:

- **The roster**, `frontend/public/contributors.json` (served as `/contributors.json`): a
  hand-authored, public-domain chronology — name, kind, dates (with `circa`), the century a voice
  is known from when no year is, region, tradition, a short blurb, a longer `context`, sources and
  a review status. `name` is the corpus author string, the key of the join.
- **The live corpus**, `/api/meta` → `authors`: each voice's first and last Ang and its line count.

Opening a voice adds `/api/analytics/author?author=<name>`: composition and raag counts, the
signature themes and the distinctive words.

## The page

- **The hero**: how many voices, how many verses are preserved, and the span of centuries.
- **The kind filter**: All, Gurus, Bhagats, Bhatts, Gursikhs, each with its count.
- **Four views**:

  | View | Order |
  |---|---|
  | Granth order (the default) | by first Ang; voices with no indexed lines follow, by date |
  | Timeline | by century of birth (else death, else the century known from); "Dates not established" last |
  | By tradition | one band per kind, by date |
  | Most Bani | by line count, with the band saying "never importance" |

  The default is never by volume: the page's lede says a voice's size reflects how much of its Bani
  is preserved here, never its importance.
- **A voice's profile**, in the shared panel: the name in English and Gurmukhi, kind (and Mahala
  for a Guru), lifespan, region, tradition, the life text, counts (lines, compositions, raags or
  "outside the raag framework", Ang range), signature themes (lift over the Granth's average, each
  a link to a theme search), up to ten distinctive Gurmukhi words, the sources, and a button to
  read the voice's first composition.
- **Compare**: the toggle, or "Compare with another voice" in a profile, picks two voices and shows
  their profiles side by side in compact form. Choosing a third drops the first.

`voices.ts` says a name and a number the same way here and on [Insights](insights.md): the full
name with the Mahala as a small badge where it helps; the stored author strings are never changed.

## Rules the page keeps

- **The review gate.** The longer `context` reaches readers only once a scholar has approved the
  entry (gate G3), exactly as the app does; until then the short `blurb` is shown, and the sources
  are marked "awaiting scholar review".
- **Only counts of the Bani itself.** Stylometry measured on the English translation (vocabulary
  variety, words per line) describes the translator, not the voice, so the profile does not show
  it. When a voice's sample is too small to compare reliably, its themes and words are withheld and
  the profile says why.
- **Sources.** The corpus is not a biographical source, so it is not listed as one; a source link
  is shown only for an `http(s)` URL.
- A voice with no indexed lines is not asked about (that would only raise an error) and says its
  attribution is being reviewed.

## Accessibility

- The filter chips and view buttons are toggle buttons with `aria-pressed`; each voice is a button
  with a spoken label. The medallions and bars are decorative and hidden from screen readers.
- The compare tray is a `status` region.
- Tests: `frontend/e2e/voices.spec.ts` (names and counts here and on Insights),
  `charts-theme.spec.ts`.

## Known limits

- Dates are historical approximations, as the page says.
- The roster is a static file in the build; a change to it needs a release.
