---
title: "Index, Themes and the Verse trail"
description: "Three smaller Knowledge Base tools: the Index at /browse (compositions, raags, sections), Themes at /themes (the corpus themes by group) and the Verse trail at /trail (verse to related verse)."
covers: "frontend/src/pages/browse.astro, frontend/src/scripts/browse.ts, frontend/src/pages/themes.astro, frontend/src/scripts/themes.ts, frontend/src/scripts/themegroups.ts, frontend/src/pages/trail.astro, frontend/src/scripts/trail.ts"
sidebar:
  order: 5
verified:
  commit: c5806fdd
  date: "2026-11-22"
---
# Index, Themes and the Verse trail

Three ways into the Granth that are each one small page and one script. All three only read, and
each sends the reader on to the Reader, Search or the next verse.

## The Index (`/browse`)

Three tabs:

| Tab | Shows | From |
|---|---|---|
| Major Compositions | quick access to well-known compositions that sit inside a raag, each with its starting Ang | a list in `browse.ts` (`QUICK_ACCESS`) |
| The 31 Raags | every raag in the order of the Granth, with its Ang span and its composition and line counts | `/api/meta` → `raags` |
| Banis & Sections | the closing collections as printed, with their Ang spans and line counts | `/api/meta` → `sections` |

A tile opens the Reader: a raag at its first Ang with the raag banner (`?raag=`), a composition or
a section at its first Ang. The tabs follow focus: the arrow keys move and switch at once (it is
only a display toggle), and Enter or Space works on a tile.

**Known limit.** The quick-access list is written by hand in `browse.ts`. Its comment says each Ang
was checked against the section-header line in the corpus. The end-to-end suite only checks that
the tiles render (`frontend/e2e/kb-states.ts`), not their Angs, so a dataset that moved a heading
would need the list updated by hand.

## Themes (`/themes`)

The corpus themes (`/api/meta` → `concepts`, each with its description and line count), set out
in the six theological groups of `themegroups.ts`. The groups and their colours are shared with
[the Constellation](../constellation.md) and the app's Themes screen; a theme that no group lists
is still shown, under "More Themes", so none is ever dropped. `themeName()` gives the English name
a theme is shown under across the site; the slug stays the same in URLs and the API.

A tile opens [Search](search.md) in theme mode (`/search?q=<slug>&mode=theme`): every verse that
carries one of the theme's verified Gurmukhi words, verbatim, with its Ang. A theme is a word
match, not an interpretation; how the tags are built is in
[the insights context](../../architecture/insights-context.md).

## The Verse trail (`/trail`)

A walk from verse to related verse. The current verse is shown with its Ang, raag and author, and
under it the closest verses to step to (`/api/neighbors?line_id=…&limit=8`), each a link with a
relatedness band.

- **Every step is a page** (`/trail?line_id=N`), so Back and Forward work. With no `line_id` the
  page draws a random composition (`/api/random`) and starts at its first verse that is not a
  heading.
- **The breadcrumb** of Angs is kept in `sessionStorage` (`sggs_trail`, at most 40 steps).
  Returning to a verse already on the path cuts the path back to it, so the trail never loops.
  "reset" clears it.
- **Bands, not percentages.** `relBand()` in `core.ts` turns the cosine score into "Strong echo"
  (0.65 and up), "Related" (0.45 and up) or "Faint echo", with the percentage beside it. The
  heading says whether the neighbours are verses or, where the line table is not built,
  compositions by theme profile.
- **A dead end is honest.** A verse with no neighbour above the relatedness floor says so and
  offers a new trail; nothing is padded in.
- **Actions** on the current verse: open it in the Reader, pin it, or copy it (the Gurmukhi, the
  transliteration, the translation and the Ang).

The neighbours are measured on the English translation and built offline (exact sparse TF-IDF
cosine over the English, headings left out, verbatim twins removed, a floor of 0.30); see
[the insights context](../../architecture/insights-context.md).

## Accessibility

- Languages: English only, with Gurmukhi marked `lang="pa"`; see
  [languages and accessibility](README.md#languages-and-accessibility).
- The Index tabs are a `tablist` with `aria-selected` and roving `tabindex`; tiles are focusable
  buttons with spoken labels.
- Theme group titles are headings (`role="heading"`, level 3).
- The trail's breadcrumb links say which step they are ("Step 2 of 5, Ang N, current").
- Tests: these pages are visited by the shared Knowledge Base specs (`frontend/e2e/kb-shell.spec.ts`, `kb-shell-bugs.spec.ts`, `kb-shell-layout.spec.ts`, `waheguru.spec.ts`, `reverence.spec.ts`).
