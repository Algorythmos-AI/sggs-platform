---
title: "Release Process"
description: "The steps that take a green integration branch to a tagged production release."
covers: "scripts/release/**"
sidebar:
  order: 4
verified:
  commit: c5806fdd
  date: "2026-11-22"
---
# Release Process

<!-- sggs:steps -->
1. On `integration`, ensure everything is green on staging.
2. Bump the unified version on a `release/bump-X.Y.Z` branch: `make release VERSION=1.2.0` (runs
   `bump.py` + `check_versions.py`). `bump.py` writes `APP_VERSION`/`APP_BUILT` in
   `webapp/serve.py`, `frontend/package.json`, the README badge and "Current release" line and
   the `MASTER-INDEX.md` header, then rewrites every wiki value marked as a fact
   (`tools/gen_facts.py --write`, so the version facts move with the bump). Fill in the
   CHANGELOG section it stubs, and land the bump in `integration` by a pull request.
3. If the dataset changed: it was rebuilt, proven and published in sggs-data first; here the
   release carries the reviewed `dataset.lock.json` bump and the regenerated contract (`make contract`).
4. Check readiness with `make release-preflight` (trunk green, versions unified, a CHANGELOG
   section, the version not yet tagged, no release PR already open), then open a **release PR
   `integration → main`** titled `release: vX.Y.Z — …`. All gates must pass.
5. Merge (a merge commit). `deploy-production` deploys the exact commit, verifies it, and only
   then tags `vX.Y.Z` and cuts a GitHub Release from the CHANGELOG section. The tag names the
   commit, and that commit's `dataset.lock.json` names the exact database it serves. Follow it
   with `make watch-deploy`. The release does not deploy the production Hukamnama service; when
   the release changes it, the owner dispatches `hukamnama-deploy-production.yml` with the tag
   ([Hukamnama runbook](runbooks/hukamnama.md#deploys-and-the-freeze)).
6. Confirm with `make verify-prod` (commit identity, health, Ang 712 heading, web deployment).
   The release that moves production's API contexts onto their own functions (a later one, after
   the app is live; [services-production](runbooks/services-production.md) steps 2–3) also owes the
   performance gate, from the same vantage as the baseline:
   `python3 tools/perf_baseline.py --base https://gurbanisoul.com --from "<same vantage>" --compare docs/perf/baseline-2026-09.json`
   must PASS (p95 within +10 % per context), and each context's `X-Service` must name itself.
7. **iOS is part of every release.** After `main` is tagged `vX.Y.Z`, the app repository
   ([`Algorythmos-AI/gurbani-soul-ios`](https://github.com/Algorythmos-AI/gurbani-soul-ios)) vendors this release (`make vendor-sync-platform REF=vX.Y.Z`), sets
   `MARKETING_VERSION` to `X.Y.Z`, tags its own `vX.Y.Z` and uploads the App Store binary
   (`make testflight TEAM_ID=… BUILD=1 CHANNEL=appstore UPLOAD=1`; the archive refuses an
   `appstore` upload not built against platform `vX.Y.Z`). It commits its ledger. The release
   is **complete** only when `scripts/release/check_release_complete.py X.Y.Z` passes.

## Versioning
SemVer, **one unified version number across web, API and iOS** — the footer, `/api/meta`,
`/api/health`, the iOS About screen and the App Store all read the same X.Y.Z, and they are
never allowed to differ. **Every release is re-archived at the same version** and uploaded as
iOS `X.Y.Z (1)` from the release tag, even when the change is web-only — so the number in the
App Store always equals the live site. The iOS **build number restarts at 1 per version** and
only increments for a re-upload of the *same* version (e.g. an App Review fix). Never ship a
one-sided hotfix: web or iOS fixes bump the **patch** everywhere. **MAJOR** = breaking
API/data-model (e.g. a `comp_id` renumber); **MINOR** = features or data corrections; **PATCH**
= fixes. `bump.py` accepts only `X.Y.Z`: there are no release-candidate versions. The DB keeps its
own decoupled `meta.version`.
See [ADR-0004](../adr/0004-unified-semver.md).
