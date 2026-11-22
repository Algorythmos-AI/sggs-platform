---
title: "The Raag Clock and the divergence table"
description: "The Knowledge Base Raag Clock at /raag-clock and its divergence table at /divergence: the dial, fixed and solar watches, the claims explorer, privacy of the location, and the pahar code."
covers: "frontend/src/pages/raag-clock.astro, frontend/src/pages/divergence.astro, frontend/src/scripts/raagclock.ts, frontend/src/scripts/divergence.ts, frontend/src/scripts/timing.ts, frontend/src/scripts/pahar.js, frontend/src/scripts/paharface.js"
sidebar:
  order: 8
verified:
  commit: c5806fdd
  date: "2026-11-22"
---
# The Raag Clock and the divergence table

The Raag Clock answers "which raags are traditionally sung at this hour?" with **attributed
scholarly claims, not facts**. Where traditions disagree, every placement is kept with its source,
and `/divergence` lays the disagreements side by side. All of it is metadata about raags: the
scripture is never touched, and every API string passes `esc()` before it reaches the page.

The claims, their sources, the pahar convention and what counts as a divergence are defined by the
[knowledge context](../../architecture/knowledge-context.md#raag-timing). The pages read two
routes: `/api/timing/clock` and `/api/timing/divergence`.

## The Raag Clock (`/raag-clock`)

From the top:

- **"What raag is it now?"** The current watch, its hours (with sunrise and sunset in solar
  mode), and a button for each raag a claim places in it, which opens the Reader at the raag's
  first Ang. A seasonal raag in season is added as "in season · any time". The third watch of the
  night has no raag, and the card says that this silence is deliberate. Under it: the next watch,
  how long until it, and its raags.
- **The dial.** A ring of the watches around the reader's own 12-hour clock face, with hour,
  minute and second hands. Ring and face share one scale: each watch sits where the hour hand
  points at that time, and the ring shows the half of the day the hand is in (AM or PM). Each raag
  is a bead in its watch, filled for a primary claim and ringed for a disputed variant. Tapping a
  watch shows its claims in the panel beside the dial.
- **The eight watches** and **in season · any time**: the same content as lists of buttons.
- **All timing claims**: a table of every claim, searchable (raag, source, occasion, season,
  notes) and filterable by claim type or "disputed only", with a strip per row showing where the
  claim falls across the day. Each source links to its URL when it has an `http(s)` one.

`/raag-clock?raag=<roman or Gurmukhi name>` opens that raag's watch (or season); the Reader's
timing chip links here this way. Without it the current watch is chosen.

### Fixed and solar watches

A toggle switches how the watches are measured:

- **Fixed** (the default): eight three-hour watches, the first at 6 AM, a modern rendering.
- **Solar**: four equal watches of daylight and four of night, from sunrise and sunset where the
  reader is, worked out on the device with the NOAA solar equations (`pahar.js`). It needs a
  location, asked for only by a button: "Use my location" (the browser's geolocation) or
  latitude and longitude typed in. The place is **rounded to two decimals (about 1 km), stored in
  this browser only (`pahar_loc`), and never sent**; "Forget location" removes it. Above 60°
  latitude, or in polar day or night, the clock falls back to the fixed watches and says why.

The choice (`pahar_mode`) is shared with the Library's "now" line through `timing.ts`, and a
change in another tab is followed.

## The divergence table (`/divergence`)

One table of every raag with conflicting claims, from `/api/timing/divergence`: per raag, one row
per attributed claim with its type, when (watch, hours, season or occasion), tradition (Gurmat
Sangeet or Hindustani), confidence and source. Nothing is merged or adjudicated; the caption says
so and the route's note is shown under it. Each raag links to the Reader at its first Ang. Under
640 px the table becomes stacked cards, in CSS only.

## The code

| File | Role |
|---|---|
| `timing.ts` | one `/api/timing/clock` fetch per session, kept in `sessionStorage` under a key carrying the app version; `claimsFor()` for the Reader's chip; `currentPahar()` for fixed or solar mode |
| `pahar.js` | pure, DOM-free watch arithmetic in integer minutes with half-open intervals, and the NOAA sunrise and sunset; DST days are taken as wall-clock time |
| `paharface.js` | where the watches sit on a 12-hour face (presentation geometry only, matching the app's `PaharFace.swift`) |
| `raagclock.ts`, `divergence.ts` | the two pages |

`pahar.js` and `paharface.js` are plain JavaScript so that `frontend/scripts/test-pahar.mjs` can
test them in Node; `frontend/scripts/gen-pahar-vectors.mjs` writes `contract/golden_pahar.ndjson`
from the same `pahar.js`, the vectors the app's Swift port asserts against.

## Accessibility

- The dial is a group with a spoken label naming the half of the day it shows; each watch on it is
  a button. The face and its hands are decoration, hidden from screen readers: the time is in words
  under the dial, and the lists below carry the whole content for a keyboard or a screen reader.
- The "now" region is a polite live region that changes once a watch; the countdown sits outside
  it so it is not read out every minute.
- With reduced motion there is no second hand and the other hands step once a minute.
- The divergence table is a real table (caption, `scope`, `rowspan`).
- Tests: `frontend/e2e/raag-clock.spec.ts`.

## Known limits

- When the database build has no timing layer, both pages say so and show nothing else.
- Fixed mode uses the device's local clock; solar mode needs a location the reader gives.
