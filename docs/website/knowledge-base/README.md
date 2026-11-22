---
title: "The Knowledge Base tools"
description: "A map of the study site's pages: the Library home, what every page shares (the API helper, the composition panel, the saved verses, the stored preferences), and a page for each tool."
covers: "frontend/src/pages/library.astro, frontend/src/scripts/library.ts, frontend/src/scripts/core.ts, frontend/src/scripts/panel.ts"
sidebar:
  order: 1
verified:
  commit: c5806fdd
  date: "2026-11-22"
---
# The Knowledge Base tools

The Knowledge Base is the scholarly study site inside the `frontend/` build: the pages that use the
`Base.astro` layout, under unprefixed paths such as `/library` and `/reader`. How it sits beside
the Gurbani Soul pages, how it is built and how it reaches the API is on
[the website](../../architecture/website.md) (architecture) and [the website — gurbanisoul.com](../README.md)
(domains, languages, SEO). This section describes each tool a reader can open.

| Tool | Path | Page |
|---|---|---|
| Library (the home) | `/library` | this page, [below](#the-library) |
| Reader | `/reader` | [The Reader](reader.md) |
| Search and Verify quote | `/search` | [Search](search.md) |
| Nitnem | `/nitnem` | [Nitnem](nitnem.md) |
| Index, Themes, Verse trail | `/browse`, `/themes`, `/trail` | [Index, Themes and the Verse trail](index-themes-trail.md) |
| Contributors | `/lineage` | [The Contributors](contributors.md) |
| Insights | `/analytics` | [Insights](insights.md) |
| Raag Clock and divergence | `/raag-clock`, `/divergence` | [The Raag Clock](raag-clock.md) |
| Constellation | `/constellation` | [The Constellation](../constellation.md) |

Every tool only reads. The scripture it shows comes from the API as the corpus holds it, cited by
Ang; no page writes to the database, and nothing a reader does changes the text.

## The places

`Base.astro` groups the pages into five places, the same on every screen: a row in the top bar on
a wide screen and a tab bar on a phone. A place with several pages lists them in a second row.

| Place | Pages |
|---|---|
| Home | `/library` |
| Read | `/reader`, `/nitnem`, `/browse` (shown as "Index"), and the day's Hukamnama once it is launched |
| Search | `/search` |
| Explore | `/themes`, `/constellation`, `/trail`, `/lineage`, `/analytics`, `/raag-clock` (`/divergence` belongs here too, under the Raag Clock) |
| Saved | not a page: a button that opens the saved-verses drawer |

## What every page shares

Each page imports its own script from `frontend/src/scripts/`. `Base.astro` also loads, on every
page, `core.ts`, `panel.ts`, `studytrail.ts`, `saroop.ts` and `display.ts`.

- **`core.ts`** holds the helpers every script uses:
  - `api(path)` fetches `/api/` + path on the same origin and shows a toast when the server
    cannot be reached or answers with an error.
  - `esc()` is the one HTML-escape helper: every value that reaches `innerHTML` or an attribute
    passes through it.
  - `guard()` catches a failed section so the page shows an honest "couldn't be loaded" line
    (`failHTML`) instead of a stuck "Loading…".
  - `meta()` keeps `/api/meta` in `sessionStorage` (`sggs_meta`), one request per browser session.
  - `goReader()` and `goSearchTheme()` move between pages by URL (`/reader?ang=…`,
    `/search?q=…&mode=theme`); a rendered button carries its target as `data-go-*` attributes,
    never as text spliced into a script.
  - `applyPrefs()` applies the stored reading preferences on every page (below), and the footer
    shows the running version from `/api/meta`.
  - ⌘K or Ctrl+K, or `/` when not typing, opens the jump palette (`palette.ts`, loaded the first
    time it is asked for).
- **`panel.ts`** is the composition panel: `shabad(comp_id)` opens a whole composition from
  `/api/shabad/{comp_id}`, and any element with `data-random` draws a complete composition at
  random from `/api/random` (the "Hukam-style random" buttons). The panel offers "Another" and
  "Open Ang N".
- **The verse sheet and the saved verses** (`verse.ts`, `store.ts`, `studytrail.ts`): the "⋯"
  button on a verse opens one sheet to pin it, open it in the Reader, see related verses, open its
  composition, copy or share it. Pins live in `localStorage`, in this browser only. The text copied,
  shared or pinned is always the verbatim line from the API model (`data-gm`), never the painted
  glyphs.
- **The display sheet** (`display.ts`, `appearance.ts`, `saroop.ts`): appearance, colour theme,
  paper tone, text size and the traditional saroop rendering. All of it is presentation only; see
  [known issues](../../engineering/known-issues.md) for the saroop's rules.

### What a browser keeps

Everything below is in the reader's own browser and is never sent anywhere.

| Key | Where | What |
|---|---|---|
| `show_t` | `localStorage` | transliteration shown (`1`, the default) or hidden (`0`) |
| `show_timing` | `localStorage` | the Reader's raag timing chip, on by default |
| `gsize` | `localStorage` | the Gurmukhi text size the reader chose (16–40 px, steps of 2) |
| `sggs_last_ang` | `localStorage` | the Ang the Reader last turned to |
| `sggs_bani_pos_<bani>` | `localStorage` | the place reached in each bani (Nitnem) |
| `sggs_rehras_variant` | `localStorage` | the Rehras Sahib version chosen (Nitnem) |
| `pahar_mode`, `pahar_loc` | `localStorage` | the Raag Clock's fixed or solar watches, and the rounded location |
| `sehaj` | `localStorage` | the Reader's focus mode |
| `sggs_meta`, `sggs_timing_v<version>` | `sessionStorage` | `/api/meta` and `/api/timing/clock`, for the session |
| `sggs_trail` | `sessionStorage` | the Verse trail's path |

## The Library

`/library` is the Knowledge Base home (`library.astro`, `library.ts`). It shows:

- a search box that submits to `/search` as a plain form;
- the current watch of the day (pahar) and the raags the timing layer records for it, each a
  button into the Reader at that raag; a watch with no raag says so;
- "Continue reading" tiles: the Ang the Reader last turned to, and up to two more for banis read
  part of the way (with the percentage), from the keys above;
- the "Hukam-style random" button;
- a door into each tool.

The search form and the doors are plain HTML, so the page works before its script runs and
without it. The watch and the tiles are drawn again when the page is shown from the back/forward
cache or the tab comes back to the front, and each is rewritten only when its content changed, so
the polite live region is not read out again for the same watch. The watch comes from the shared
timing cache (`timing.ts`); see [the Raag Clock](raag-clock.md#fixed-and-solar-watches).

## Languages and accessibility

- **English only.** The Knowledge Base pages are not localised: `<html lang="en">`, with
  `lang="pa"` on every Gurmukhi container so a screen reader reads it as Punjabi. The three
  languages of the marketing site are on [internationalisation](../../architecture/i18n.md).
- The tests that walk these pages are in `frontend/e2e/` (`kb-shell*.spec.ts`,
  `kb-reflow.spec.ts` at 320 and 375 px, `kb-contrast.spec.ts`, `kb-motion.spec.ts`,
  `library.spec.ts` and one spec per tool, named on each tool's page).
- D3 and canvas charts honour `prefers-reduced-motion` through `prefersReducedMotion()` in
  `core.ts`; the CSS rule covers only CSS transitions.

## Known limits

- Stored places, pins and preferences are per browser: they do not follow a reader to another
  device, and clearing site data removes them.
- When the API cannot be reached, each section shows its own failure line; nothing is cached for
  offline use beyond the session keys above.
