## What & why
<!-- One paragraph. Link the issue: Closes #NN -->

## Scripture-safety checklist (delete if this PR does not touch search, verify, display or the dataset pin)
- [ ] Gurmukhi reaches users verbatim: no edit/normalise/reorder in storage, search, copy or share (display-only transforms stay display-only).
- [ ] A dataset change arrives only as a `dataset.lock.json` bump to a reviewed sggs-data commit; `contract/` regenerated and committed.
- [ ] A human reviewed any text-level diff.

## Definition of Done
- [ ] Tests updated/added and green locally (`make ci`).
- [ ] `python3 scripts/release/check_versions.py` passes (versions unified).
- [ ] CHANGELOG entry added under the unreleased/next version.
- [ ] Docs updated (`docs/`, `docs/engineering/`) if behaviour or invariants changed.
- [ ] Verified on staging (attach a note/screenshot) before the release PR to `main`.

## Docs impact
<!-- Before opening this pull request run:  python3 tools/docs_coupling.py origin/integration..HEAD
     It lists the wiki pages whose code this change touches (their `covers:` or the files they cite)
     and prints the lines to add. For each listed page: update it, or move its `verified` stamp after
     re-reading it, or keep one line for that page below, starting at the beginning of the line,
     with a reason of ten characters or more:
       Docs-impact: docs/<page>.md — <why this change alters nothing the page says>
     A page that declares `covers:` needs its own line (the docs-coupling check fails otherwise).
     One blanket line `Docs-impact: none — <reason>` excuses only pages covered through the files
     they cite. Delete this section's lines when every listed page was updated. -->
