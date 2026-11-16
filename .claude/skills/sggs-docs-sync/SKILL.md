---
name: sggs-docs-sync
description: Bring the wiki pages in docs/ back in line with a code change before its pull request. Use when a branch changes code that wiki pages cover or cite, when the docs-coupling comment lists pages to re-read, or when asked to "sync the docs", "update the wiki for this change" or write the Docs-impact line.
---

# Sync the wiki with a code change

Run each step from the repository root, on the feature branch.

1. **List the pages.**
   `python3 tools/docs_coupling.py origin/integration..HEAD --json`.
   The ones to handle are in `flagged`. Under `pages`, each entry's `changed` names the code that
   moved.
2. **Edit only those pages.** Read each flagged page against the changed code, and correct what
   the change made untrue. Do not rewrite pages that are not listed, and do not restyle anything.
3. **Regenerate.** Run `make docs-regen` (every generator in the Makefile's `DOCS_GENERATORS`, in
   write mode). Never edit a generated page by hand.
3b. **New code areas.** `python3 tools/docs_check.py --areas`. A new directory or file directly under
   `services/`, `webapp/` or `frontend/src/pages/`, or a new workflow, must be in the `covers:` of
   the page that describes it (or be linked from it); `make docs-check` fails otherwise. Only built
   output or tests go under `exempt` in `tools/docs_areas.json`, with a reason.
4. **Stamps.** Move a page's `verified: {commit, date}` only after re-reading the whole page
   against the code at that commit. Use the HEAD commit and today's date. A page you did not
   re-read keeps its stamp.
5. **Gate.** `make docs-check` must end with 0 errors. If you added or changed a `covers:`, every
   glob must match a tracked file and every `file#symbol` must exist.
6. **When no page needs a change.** Put this line, on its own, in the pull request description:
   `Docs-impact: none — <reason>`. The reason must be at least 10 characters and say why the change
   alters nothing a page describes.

## Never

- Type, edit, normalise or move Gurmukhi anywhere. Do not touch a quotation from scripture or
  anything under `docs/scripture/`; if one looks wrong, flag it for a person.
- Before committing, run `python3 tools/gurmukhi_diff.py origin/integration...HEAD`. It must report
  nothing.
- Never move a stamp to make a warning go away.
