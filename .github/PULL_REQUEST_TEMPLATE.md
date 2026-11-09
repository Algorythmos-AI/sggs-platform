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
<!-- The docs-coupling check comments on this pull request with the wiki pages whose code it changes
     (their `covers:` or the files they cite). Update each listed page, or move its `verified` stamp
     after re-reading it against the code. If no page needs changing, keep one line below, starting
     at the beginning of the line, with a reason of ten characters or more. Delete it otherwise. -->
Docs-impact: none — <reason>
