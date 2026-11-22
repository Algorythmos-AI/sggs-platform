---
title: "Nitnem on the web"
description: "The Knowledge Base Nitnem page at /nitnem: the bani list ordered by the time of day, the paper reader over /api/bani, Rehras versions, the separate non-SGGS layer and the kept place."
covers: "frontend/src/pages/nitnem.astro, frontend/src/scripts/nitnem.ts"
sidebar:
  order: 4
verified:
  commit: c5806fdd
  date: "2026-11-22"
---
# Nitnem on the web

`/nitnem` lists the daily banis and reads one at a time. It reads the bani registry from
`/api/banis` and each bani from `/api/bani/{key}`; how the registry is built (a list of pointers
into the verbatim corpus, plus a separate labelled layer) is
[ADR-0006](../../adr/0006-bani-registry-over-verbatim-corpus.md), and the app's own Nitnem is
[Nitnem for engineers](../../ios/nitnem-for-engineers.md).

## The list

The day is split into four bands from 3 AM, as in the app. The band it is now leads the page, and
the clock only **orders** the list; every bani is always there.

| Band | From | To | Brings forward |
|---|---|---|---|
| Amrit Vela | 3 AM | 9 AM | the morning banis |
| Morning banis | 9 AM | 5 PM | the morning banis |
| Evening | 5 PM | 9 PM | the evening bani |
| Night | 9 PM | 3 AM | the night bani |

The hero gives the date, the band, a half-arc of the day from 3 AM to 3 AM with the moment marked,
a ring for each of the band's banis showing how far this browser has read, and a button to
continue (or start) the first one begun. Below it the banis follow in the band's order, then the
popular and ceremony banis. Each row shows the English and Gurmukhi titles, the estimated minutes,
the percentage read, and "includes Sri Dasam Granth text" where that applies. A "Hukam" card draws
a complete composition at random. The list is drawn again when the tab comes back in another band.

**Rehras Sahib** has two versions in the registry, SGPC (the default) and Damdami Taksal. The
choice under the list is stored (`sggs_rehras_variant`) and decides which version the list, the
Library tiles and the reader use.

## The reader

- **Sri Guru Granth Sahib Ji lines** are served verbatim from the corpus. Each carries its
  citation, "Sri Guru Granth Sahib Ji · Ang N", and tapping it opens the Reader at that very line.
  The heading shows the Ang range the bani spans.
- **Lines from the separate layer** (Sri Dasam Granth and Ardaas, from ShabadOS) carry their own
  label — "Sri Dasam Granth · Panna N" or "Ardaas", always with "separate layer" — and are never
  cited as an Ang. A bani that includes them says so under its title.
- **Versions.** Where a bani has more than one version, buttons in the toolbar switch between them.
- **Reading options** are the Reader's: text size and transliteration.
- **The place is kept.** While reading, the first line under the toolbar is saved half a second
  after scrolling stops (`sggs_bani_pos_<key>` or `…_<key>/<variant>`); reopening the bani scrolls
  that line back under the toolbar. "Mark as read · start again" clears it.

`/nitnem?bani=<key>` (and `&variant=`) opens a bani directly; the key must be lower-case letters,
digits or `_`, at most 32 characters. The address follows the bani open.

## Accessibility

- Each bani row is a button whose label includes the percentage read; the progress rings are
  decorative and hidden from screen readers, and the day arc is one image with a spoken label.
- The reading options panel is a modal dialog handled by the overlay stack, as in the Reader.
- Tests: `frontend/e2e/nitnem.spec.ts`, `nitnem-home.spec.ts`, `reader-nitnem.spec.ts`.

## Known limits

- When the database build has no bani registry, the page says so and lists nothing.
- The kept place and the Rehras choice are per browser.
- The bands use the device's local clock; they are an ordering aid, not a statement of when a bani
  must be read.
