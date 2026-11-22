---
title: "Search and Verify quote"
description: "The Knowledge Base search page at /search: the seven mode chips, search as you type, results and the composition panel, the Verify quote mode, deep links and its limits."
covers: "frontend/src/pages/search.astro, frontend/src/scripts/search.ts"
sidebar:
  order: 3
verified:
  commit: c5806fdd
  date: "2026-11-22"
---
# Search and Verify quote

`/search` is the page's face on two API routes: `/api/search` and `/api/verify`. How the server
finds and ranks a line — the waterfall, the Roman fold, the variant index — is in
[Search & verification](../../search/README.md); this page is what the browser does with it.

## Modes

Seven chips, a radio group, sit under the box:

| Chip | Sends |
|---|---|
| Auto | `/api/search?mode=auto` (the server picks the way) |
| Gurmukhi | `mode=gurmukhi` |
| Roman | `mode=roman` |
| English | `mode=english` (the labelled translation layer) |
| First letters | `mode=first` |
| Theme | `mode=theme` |
| Verify quote | `/api/verify` instead of a search |

The six search modes are the API's own ([modes and tiers](../../search/modes-and-tiers.md)).
Verify quote is a mode of this page only. Before anything is typed, the page shows a few lines on
what the chosen mode takes, as the app does.

## Searching

- **As you type.** After a pause of 300 ms, a query of two characters or more is searched. The
  previous results stay, dimmed, until the new ones arrive, and a result that arrives after a
  newer search was started is dropped. Enter searches at once. In Verify quote nothing is sent until
  Enter: half a line would always read "not found".
- **Results** come 50 at a time, with "More ›" for the next 50. The count line says how the server
  interpreted the query (`interpreted as …`). Each card shows the verse, its transliteration, the
  translation where there is one, and chips for the Ang, raag, section, author, a refrain mark and,
  in theme mode, the matched term. Query words are highlighted; Gurmukhi is marked a whole word at
  a time, so a highlight never splits a conjunct or parts a vowel sign from its consonant.
- **Opening a result** opens its whole composition in the composition panel
  (`/api/shabad/{comp_id}`), from where "Open Ang" goes to the Reader.
- **Themes.** A theme answer shows the theme's description, its Gurmukhi terms and its line count;
  any answer may list related themes, each a link that re-runs the search in theme mode. With no
  results the page suggests fewer words, first letters, three themes or the Index.

## Verify quote

The pasted line goes to `/api/verify?q=…`. Ending it with `@` and an Ang (for example `… @1`)
sends that Ang as the claimed page (`&ang=1`). The verdict is shown in one of three styles —
verified, not found, or a close match to compare — with the confidence (not for "not found"), and
the canonical line with its Ang as a card that opens the Reader. The verdicts and thresholds are
the [verification engine](../../search/verification-engine.md)'s.

## Deep links

`/search?q=<text>&mode=<mode>` runs that search on arrival; `mode` may be any of the seven
(`verify` included). The page keeps the address in step with the box with `history.replaceState`,
so a search can be shared and Back is not filled with one entry per keystroke. Theme tiles,
contributor profiles and the Insights network link here with `mode=theme`.

## Accessibility

- The mode chips are `role="radio"` in a `radiogroup`; the arrow keys move between them and Enter
  or Space chooses one.
- The results region is `aria-live="polite"`. Result cards are focusable and open with Enter or
  Space.
- The box takes focus on arrival only on a wide screen with a fine pointer; on a phone that would
  raise the keyboard.
- Tests: `frontend/e2e/search-live.spec.ts`, `waheguru.spec.ts`.

## Known limits

- The page asks for at most 50 results per request and pages by offset; the API allows up to 200
  (`limit`).
- A failed request replaces the results with a "couldn't be loaded" line; the toast from `api()`
  carries the server's error message.
