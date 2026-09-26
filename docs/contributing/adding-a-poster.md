---
title: "Adding a poster"
description: "A poster is generated from a declarative spec by the poster kit: nodes, edges, groups and steps with captions and links; the rules kit 2 enforces so it reads at the size shown; the drift check."
sidebar:
  order: 3
---
# Adding a poster

Posters are the wiki's large step-through pictures. Each is generated from a spec in
`docs-site/posters/NN-slug.mjs` into an SVG and a steps sidecar under `docs/diagrams/posters/`;
the generated files are committed and checked for drift. New and redrawn posters use **kit 2**
(`docs-site/posters/kit2.mjs`, `kit: 2` in the spec), which draws for the size the wiki shows a
poster — about 630 px wide on a 1280-px laptop screen — and refuses a poster that would be hard to read. The full visual spec
and the node kinds are on [Diagrams and posters](../diagrams/README.md).

## Steps

1. Copy the nearest kit-2 spec (poster 03 is the reference); take the next number and a slug.
2. Lay out `nodes` on the 1200-wide canvas: content between y = 170 and your `height`, 40 px
   margins. Each node has `x, y, w, h`, a `kind` (box, store, actor, gate, fail, pin, ext, good,
   note) and at most three `lines` — a title and two lines of detail, at least 25 px (the smallest
   size that still shows at 13 px on a 1280-px screen), `mono: true` for code. Anything longer belongs in
   the step's caption. Give each node and edge the `step` that introduces it.
3. Connect them with `edges`. The kit draws right angles only: two boxes that share a column or a
   row get a straight line, anything else a bend through the gap between them, or give `via`
   waypoints (the first and last are projected onto the boxes). Keep 40 px or more between boxes
   that a line joins, so its arrowhead has room; `dashed: true` means "reads, pins or derives from".
4. Write `steps`: an id `step-NN`, a title, a caption a student can read on its own, and the page
   that explains it. Each step gets a numbered badge on its first node.
5. Name the files the poster was read against in `sources` (a pinned sibling file as
   `sggs-data/<path>`), and the version, date and commit in `verified`.
6. Generate and check:

   ```bash
   make posters
   cd docs-site && node scripts/build-posters.mjs --check
   ```

   Kit 2 refuses to build a poster whose text would show under 13 px, whose text overflows its
   box, whose line crosses a box, a group title, a label or another line's track, whose last run
   is too short for its arrowhead, whose two arrows land on one point, whose boxes overlap or
   straddle a group, or whose text is under 4.5:1 on its fill in either theme — and it says which
   node or edge, and why. The gate refuses colours outside the palette, a missing title or
   description, a footer that names a missing file, a sidecar that disagrees with the step groups.
7. Embed it: `![Alt text](../diagrams/posters/NN-slug.svg)` in a paragraph of its own. On GitHub it
   is a picture; on the site, a walkthrough.
8. Look at it: light and dark, phone width, keyboard only (Tab to the poster, arrow keys step,
   *Full size* opens the lightbox, where the arrow keys step too; Escape closes). Run
   `make docs-e2e` for the posters suite.

## Facts

A poster states facts about code: read the files in `sources` before you write a caption, and
when a number can be checked by a test, add the check to `tools/docs_check.py` (the search modes
and verify thresholds are checked this way).
