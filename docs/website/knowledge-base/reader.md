---
title: "The Reader"
description: "The Knowledge Base Reader at /reader: Ang-by-Ang reading, the Go to sheet and page bar, reading options, the timing chip, related verses, deep links and what the browser remembers."
covers: "frontend/src/pages/reader.astro, frontend/src/scripts/reader.ts, frontend/src/scripts/readerchrome.ts"
sidebar:
  order: 2
verified:
  commit: c5806fdd
  date: "2026-11-22"
---
# The Reader

`/reader` shows Sri Guru Granth Sahib Ji one Ang at a time, verbatim, from Ang 1 to Ang 1430. It
is the page every other tool opens a verse in.

## What the reader sees

- **The Ang, grouped by composition.** `reader.ts` takes the lines of `/api/ang/{n}` in order and
  starts a new group at each run of heading lines, so a composition's printed heading sits above
  its verses. Each verse shows its Gurmukhi, the transliteration and, where the English layer has
  one, the labelled translation. A refrain line (`is_rahao`) is marked.
- **Context chips** above the text: the Ang's raag, its section and its authors, from the same
  response.
- **"Continues" pills.** When `continued_from` says the first composition began on an earlier Ang,
  a pill links back to it. A pill at the foot says the last composition continues on the next Ang;
  it is derived from the *next* Ang's `continued_from`, never from the last line's `comp_id` (which
  can belong to a heading that opens the next composition). The slot has a fixed height, so the
  page does not shift when it fills in.
- **A raag banner** while the reader is inside a raag opened from the Index or the Raag Clock
  (`?raag=`): the raag's name, its Ang span and its counts from `/api/meta`. It goes away once the
  reader pages out of that raag.
- **The timing chip**, beside the raag chip: when the raag has an attributed timing claim, a small
  link to the Raag Clock gives the primary watch (or the season) and notes a disputed variant. It
  is metadata about the raag, kept visually apart from the scripture and never inline with a
  verse; it is loaded after the Ang and a failure simply leaves it out. See
  [the Raag Clock](raag-clock.md).

## Moving through the Granth

| Control | What it does |
|---|---|
| ‹ and › in the page bar, the arrow keys, the buttons at the foot of the Ang | turn one Ang back or on |
| a quick sideways swipe on the page (one finger, not from the screen's edge, not while zoomed or with text selected) | turn the Ang (`readerchrome.ts`) |
| the title, "Go to", or the progress bar | open the Go to sheet: type an Ang, drag the scrubber across the whole Granth, step by one, or pick a raag; an impossible number disables Go and says why |
| "Hukam" in the page bar | a complete composition at random, in the composition panel |
| tapping a verse | an inline drawer of related verses (below) |

The bars hide while the reader scrolls down with a wheel or a finger and come back on any upward
scroll, near the top, on a key press or a tap near the top edge. A landing jump or a late font
never hides them: only a scroll the reader made does.

The neighbouring Angs are fetched in the background after each page, so a page turn usually draws
from memory. At most six Angs are kept, the farthest from the current one dropped first; a
prefetch that fails stays silent, and a newer page cancels an older request so a late answer
never paints over it.

## Reading options

The "ਅA" button opens a small panel: text size (one step is 2 px, from 16 to 40), transliteration
on or off, the timing chip on or off, **Sehaj** focus mode (the chrome folds away, Escape leaves
it), and **Share this Ang**, which shares or copies the `/ang/N` link (it unfurls as that Ang's own
card; see [the website](../README.md)).

## Deep links and what is remembered

| URL | Lands on |
|---|---|
| `/reader?ang=N` | Ang N (clamped to 1–1430) |
| `/reader?ang=N&raag=<name>` | Ang N with that raag's banner |
| `/reader?ang=N&line=<id>` | Ang N, with that verse scrolled to the centre, highlighted and focused |
| `/reader?ang=N&comp=<comp_id>` | Ang N at the first verse of that composition |
| `/reader` | the Ang last turned to in this browser, or Ang 1 |

The URL follows the page (with `history.replaceState`, so Back leaves the Reader rather than
stepping through every Ang). The place is stored (`sggs_last_ang`) **only when the reader turned a
page**: opening an Ang from a search result or typing a number is a lookup and must not move a
place kept in a long reading.

## Related verses

Tapping a verse asks `/api/neighbors?line_id=…&limit=6` and opens a drawer under it with the
closest verses, each with a relatedness band ("Strong echo", "Related", "Faint echo") rather than
a raw percentage, and a "walk a trail" link to the [Verse trail](index-themes-trail.md#the-verse-trail).
The neighbours and their scores are built offline; see
[the insights context](../../architecture/insights-context.md).

## Accessibility

- The Go to sheet and the reading options are modal dialogs with `inert` while closed; the
  overlay stack (`overlay.ts`) traps Tab, closes the top one on Escape, and returns focus to the
  control that opened it. While anything is open the arrow keys stop turning pages.
- The toggles are `role="switch"` with `aria-checked`, usable with Enter and Space.
- The timing chip is `role="note"` with a spoken label that says it is scholarly metadata, not
  scripture.
- Tests: `frontend/e2e/reader-chrome.spec.ts`, `reader-nitnem.spec.ts`, `verse-actions.spec.ts`.

## Known limits

- The place is per browser (see [what a browser keeps](README.md#what-a-browser-keeps)).
- Related verses are measured on the English translation, so a verse with no translation span has
  weaker neighbours; a verse with none above the floor shows "No related verses found."
