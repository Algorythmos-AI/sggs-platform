---
name: sggs-docs-sync
description: Bring the wiki pages in docs/ back in line with a code change before its pull request. Run it before opening ANY pull request in this repository (every agent that writes a PR), when the docs-coupling comment lists pages, or when asked to "sync the docs", "update the wiki for this change" or write the Docs-impact lines.
---

# Sync the wiki with a code change

Run each step from the repository root, on the feature branch, **before opening the pull request**.
The `docs-coupling` check is enforced: a page that declares `covers:` and is neither updated,
re-stamped nor named on its own `Docs-impact:` line fails it.

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
6. **When a flagged page needs no change.** Put one line per page, on its own, in the pull request
   description, naming the page:
   `Docs-impact: docs/<page>.md — <reason>`.
   The reason must be at least 10 characters and say why this change alters nothing *that page*
   says. `python3 tools/docs_coupling.py origin/integration..HEAD` prints the exact lines to fill in.
   A blanket `Docs-impact: none — <reason>` line excuses only pages covered through the files they
   cite (`Coverage: cited files` in the report), never a page with `covers:`. Do not copy a line
   with its `<…>` placeholder left in: it excuses nothing.
7. **Check it.** Save the description to a file and run
   `python3 tools/docs_coupling.py origin/integration..HEAD --pr-body body.md`: it must end with
   "Every page whose code changed … is accounted for." (`COUPLING_ENFORCE=1` makes it exit 1 otherwise.)

## Never

- Type, edit, normalise or move Gurmukhi anywhere. Do not touch a quotation from scripture or
  anything under `docs/scripture/`; if one looks wrong, flag it for a person.
- Before committing, run `python3 tools/gurmukhi_diff.py origin/integration...HEAD`. It must report
  nothing.
- Never move a stamp to make a warning go away.
