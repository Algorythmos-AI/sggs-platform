---
title: "The Insights page"
description: "The Knowledge Base Insights page at /analytics: the theme network, author fingerprint, resonance chord, raag progression and Vaar anatomy, the routes behind each, text alternatives and caveats."
covers: "frontend/src/pages/analytics.astro, frontend/src/scripts/analytics.ts, frontend/src/scripts/viz.ts"
sidebar:
  order: 7
verified:
  commit: c5806fdd
  date: "2026-11-22"
---
# The Insights page

`/analytics` ("Insights") shows five patterns across the whole Granth. They are **observations,
never judgements**: nothing on the page ranks or rates the scripture. Every number is computed
offline by the data pipeline and read from the insights routes; the page computes nothing of its
own beyond laying the numbers out. What the tables hold and how they are built is
[the insights context](../../architecture/insights-context.md).

## The five cards

| Card | Shows | Controls | Route |
|---|---|---|---|
| Theme Co-occurrence Network | each theme a circle sized by its verses; a line where two themes share hymns more than chance would give (PPMI) | a min-PPMI slider (opens at 0.7; 0 shows every bond), drag, pinch or Ctrl/⌘ + wheel to zoom; a theme opens its search | `/api/themes/network?limit=1500`, with `/api/meta` for sizes |
| Author Theme Fingerprint | a radar of one author's nine most distinctive themes, as lift over the Granth's average (1.0 = the average) | an author, and an optional second to compare | `/api/analytics/author` (the list), `/api/analytics/author?full=1&author=` |
| Cross-Contributor Resonance | a chord of which voices' verses land on each other's nearest neighbours in meaning, ribbon width as lift over the overlap their size predicts | voices with at least 250, 90 or 40 lines; a min-lift slider (1.0×–2.5×) | `/api/analytics/resonance?min_lines=&min_lift=&min_edges=8`, with `/contributors.json` for each voice's kind |
| Raag Theme-Progression | a streamgraph of a raag's seven leading themes across its Angs, in reading order | a raag | `/api/analytics/progression?raag=&bins=40&top=7` |
| Vaar Anatomy | one Vaar in reading order: its saloks, then the pauri they introduce, each coloured by voice, with a salok by a different Guru than the pauris marked as cross-voice | a Vaar | `/api/analytics/vaars`, `/api/analytics/vaar?id=` |

Every unit of the Vaar anatomy is a button that opens the Reader at its Ang. The author list is in
Granth order (first Ang), never by volume, and leaves out the voices whose sample is too small to
compare reliably; names are said as on [the Contributors page](contributors.md) (`voices.ts`).

## How it is drawn

- The network and the chord and stream charts are D3; the radar is Chart.js.
- `viz.ts` holds what the charts share. Colours are read from the stylesheet when a chart draws,
  so `onTheme()` draws it again when the appearance, colour theme or paper tone changes, once per
  change. Category colours are fixed (`--viz-1` … `--viz-10`), so a colour means the same voice or
  theme whichever accent is chosen. `cached()` keeps each route's answer, so a redraw does not ask
  the server again.
- Each card loads on its own: one failing route shows an honest error line in its card and leaves
  the others drawn.
- The network chart does not trap the page: a plain wheel and a one-finger drag scroll the page;
  only a pinch (or Ctrl/⌘ + wheel) zooms.

## Accessibility

- Languages: English only, with Gurmukhi marked `lang="pa"`; see
  [languages and accessibility](README.md#languages-and-accessibility).
- The network, resonance and progression charts each have a **data table** after them, closed by
  default (a `details` element), rebuilt whenever the chart is: the 50 strongest co-occurrences,
  the resonances, and the progression.
- Every network node is a focusable button: focus shows the same highlight and tooltip as the
  hover, and Enter or Space searches that theme.
- The charts carry `role="img"` with a label that points to the caption; the radar's selected
  authors and their emphases are written in the note under it.
- With reduced motion, the force layout settles at once and renders still, and the chord's
  transitions take no time.
- Tests: `frontend/e2e/chart-tables.spec.ts`, `charts-theme.spec.ts`, `voices.spec.ts`.

## Caveats the page states

- The fingerprint's lift is measured on **the English translation** (its caption says so), and the
  resonance rests on the verse neighbours, which are measured on the English too; both describe the
  translated text as much as the voice.
- Theme counts are word matches on corpus-verified Gurmukhi terms, not interpretations.
- When the database has no Vaar tables, the Vaar card says so.
