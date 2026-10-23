---
title: "The Constellation"
description: "How the Constellation (web and iOS) shows which themes a verse also carries: the additive caption, two rankings, encodings, lenses, the Sky and its caveats."
sidebar:
  order: 3
---
# The Constellation

The Constellation lets a reader pick one of the 54 corpus themes and see which other themes its verses
also carry. It exists on the website (`/constellation`) and in the iOS app (Explore → Constellation).
Both read the same data, and the golden contract proves that they give the same numbers. Everything it
shows comes from tables the shipped database already has (`concept_lines`, `theme_network`,
`theme_fingerprint`, `concepts`, `lines`, and the raag-timing claims). Nothing is computed by a model,
and no verse, raag or voice is ranked: only the companion themes are put in order.

## What a verse "carrying" a theme means

A verse carries a theme when it contains one of that theme's verified Gurmukhi words
(`concepts.gurmukhi_terms`, stored per verse in `concept_lines.term`). "Naam ✦ Haumai" therefore
means *the verses that contain a word of each theme*. It is a word match, not an interpretation, and
the pair view says so under every list. Some themes are broad by construction (Ik Onkar matches the
common forms of "one") and some are sparse (Akal has 15 verses). The Sky shows that honestly as star
size.

## Focus: one theme at the centre

- **The caption adds up.** "5,672 verses carry Naam · 3,720 also carry another theme · 1,952 carry
  Naam alone." A verse is *shared* when it also carries another theme. The verses that carry the theme
  alone sit in a halo round the centre and can be opened.
- **Two orders for the companions.**
  - **Most shared** orders companions by how many of the centre's verses also carry them.
  - **Most distinctive** orders them by PPMI, which measures how much more often the two themes share
    a shabad than chance would give. Raw counts favour the largest themes (Satguru, Man, Sach) for
    every centre; PPMI removes that base-rate bias. For Naam it brings forward Bani, Amrit, Bhavjal,
    Manmukh and Haumai.
- **Encodings.**
  - Distance from the centre: the PPMI bond (closer is stronger).
  - Line weight: Jaccard (the share of shabads the two themes have in common).
  - Star size: the verses shared.
  - Colour: the theme's theological group. The six group colours (`themeGroup.*` in
    [the brand tokens](../brand/tokens.json)) are shared by the web and the app, and none is red or
    brand gold.
- **Companion counts overlap** by design: a verse with three themes counts under two companions. Only
  the caption's three numbers are a partition.
- **The Ang strip** shows where the theme falls in reading order, in 15 bins of 100 Angs. Choosing a
  bin narrows the view to those Angs.

## Lenses

Every lens re-runs the same parameterised query, so the caption still adds up under any lens.

| Lens | What it keeps |
|---|---|
| Voice | Verses by one author |
| Raag | Verses in one raag |
| This hour | Verses in the raags whose attributed timing claim names the current watch (attributed timing claims, as the Raag Clock shows them with their sources) |
| Refrains only | Rahao lines |
| Many themes | Verses that carry five or more themes |
| Ang bin | Verses in one 100-Ang span |

## The pair view

Choosing a companion (or the alone-halo) lists the verses, 50 at a time:
- grouped by shabad, under a raag · voice · Ang eyebrow;
- each verse verbatim, with its transliteration and the Rahao marker;
- the matched word of each theme. The website marks the whole word inside the verse; the app lists the
  words under the verse, leaving the verse text undecorated.

A verse opens in the Reader. In the app, a verse can be saved, shared as a card (verbatim, with its
Ang and the constellation it came from), or used to start a Study Trail.

## The theme card and the Sky

- **The theme card** (the centre star) shows:
  - the theme's description and its Gurmukhi words, verbatim;
  - its verse, shabad and refrain counts;
  - the raags and voices where it concentrates. Each is shown as a lift over the Granth's rate, with
    both rates beside it, and only where `theme_fingerprint.is_reliable` is set.
- **The Sky** shows all 54 themes at once. Its force layout is deterministic: the app uses a seeded
  SplitMix64 layout with fixed iterations, and the website uses d3-force with a fixed tick count. Every
  theme pair pulls by its PPMI, and only pairs with PPMI of 0.7 or more are drawn. The Five Vices form
  a visibly tight cluster with no label saying so. Choosing a star focuses that theme.

## Where it lives

| Piece | Website | iOS |
|---|---|---|
| Focus, lenses, Ang strip | `/api/analytics/constellation?concept=` + lens parameters | `CorpusActor.constellationFocus(concept:lens:)` |
| The Sky | `/api/analytics/sky` | `constellationSky(minPPMI:)` |
| Pair and alone pages | `/api/analytics/pair?concept=&with=` (or `alone=1`) | `constellationPair(concept:with:lens:offset:)` |
| Theme card | `/api/analytics/theme?concept=` | `themeCard(concept:)` |
| Parity | `contract/golden_constellation.ndjson`, replayed over HTTP by `tools/contract_http.py` | `ConstellationParityTests` |
| Deep link | `/constellation?theme=naam&with=haumai&rank=distinctive` | `sggs://constellation?theme=naam&with=haumai` |

The [insights context](../architecture/insights-context.md) lists the routes and their tables, and the
[API reference](../api/routes.md) lists every parameter.

## Accessibility

Every drawing has a list twin fed by the same model. On the website, the twin is a list of buttons
after the chart. In the app, a toolbar button switches to it, and it is always shown at accessibility
type sizes. Stars are keyboard-focusable buttons with a visible ring and spoken counts. Under Reduce
Motion nothing animates.
