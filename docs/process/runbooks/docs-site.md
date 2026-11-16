---
title: "Runbook: the docs site (launch and after)"
description: "Launching docs.gurbanisoul.com and keeping it honest: one-time setup, the staging walkthrough, DNS cut-over, production smoke, rollback, and the routine after launch."
sidebar:
  order: 6
verified:
  commit: 4adc454a
  date: "2026-09-26"
---
# Runbook: the docs site (launch and after)

The wiki (`docs-site/` over `docs/`, [ADR-0012](../../adr/0012-docs-site.md)) deploys through
`deploy-docs.yml` with the product's posture: CI builds, deploys, smokes by commit, promotes, rolls
back; the Vercel project's own git deployments are off. This runbook is the launch checklist and
the routine that follows it.

## 1. One-time setup (owner)

The Vercel project, the domain, the staging alias and the two secrets — steps 1–5 of
[the deploy runbook's wiki section](deploy.md#the-wiki-docsgurbanisoulcom--one-time-setup-owner).
Until they exist, every push to `integration` still runs the full `docs` job (the required check),
and `deploy-staging` fails clearly at preflight.

Then apply the ruleset that makes the docs job required:

```bash
REPO=Algorythmos-AI/sggs-platform bash scripts/gh/apply_rulesets.sh --dry-run   # prints the change
REPO=Algorythmos-AI/sggs-platform bash scripts/gh/apply_rulesets.sh
```

### The pin bot's token (`DOCS_BOT_TOKEN`)

`docs-pins` and `docs-freshness` open their pull requests with a fine-grained personal access
token, so the required checks run on them (a pull request opened with the workflow's own token would trigger none). At
<https://github.com/settings/personal-access-tokens/new>:

| Field | Value |
|---|---|
| Resource owner | **Algorythmos-AI** — not your personal account (it cannot be changed later) |
| Repository access | Only select repositories → `sggs-platform` |
| Repository permissions | **Contents** and **Pull requests**: Read and write (nothing else) |
| Expiration | 90 days, with a renewal reminder |

If the organization requires approval, approve it under Organization settings → Personal access
tokens → Pending requests. Then `gh secret set DOCS_BOT_TOKEN --repo Algorythmos-AI/sggs-platform`
(a hidden prompt; never paste a token into chat or a file).

Before it writes anything, the workflow checks the token with a dry-run push. A token that
authenticates but cannot push — a personal resource owner, pending approval, read-only Contents —
does not fail silently: the bump arrives as the issue *docs: the sibling docs changed — bump the
pins* (and the weekly refresh as *docs: wiki pages to re-verify*), which names the cause. An expired
or removed token does the same.

## 2. Staging walkthrough (before the first promotion)

Most of this walkthrough is automated now. After every staging deploy `deploy-docs` runs the
**live suite** (`docs-site/e2e-live/live.spec.ts`) against the staging alias with the real API: the
status strip, the search simulator, the Ang explorer on Angs 1, 712 and 1256, a line read from
`/api/ang/1` verifying as `VERIFIED_EXACT`, the API console, ⌘K search, axe on five pages as
deployed, and no Content-Security-Policy errors. Run it by hand with
`make docs-live URL=https://docs.gurbanisoul.com` (add `VERCEL_BYPASS=…` for the staging alias).
What stays human is taste: one visual pass on a new release.

Open `https://sggs-docs-staging.vercel.app` logged in to Vercel. Run the visual pass the build
cannot judge — the same list the repository's QA script shoots
(`cd docs-site && node scripts/visual-qa.mjs <url>` writes light, dark and phone screenshots of
every section under `docs-site/qa-shots/`):

| Check | Where |
|---|---|
| The landing, the live status strip shows production's version and health | `/` |
| A poster walkthrough: Next, arrow keys, a step chip, Full size, Escape returns focus | `/architecture/request-lifecycle/` |
| The Ang explorer on Angs 1, 712, 1256; the English toggle; the outage message with the network off | `/data/line-record/` |
| The search simulator with `sat nam`, `waheguru`, `mercy`, a Gurmukhi query; the tier lights on poster 05 | `/architecture/search-waterfall/` |
| The verify playground with a line from memory; the rung lights on poster 07 | `/search/verification-engine/` |
| The API console: an Ang, a search, copy as curl | `/api/` |
| A pinned page's canonical banner and edit link | `/data/architecture/database-schema/`, `/ios/nitnem/spec/` |
| Hover-cards and a quiz; the two cited lines stack Gurmukhi, transliteration, citation | `/scripture/what-sggs-is/` |
| A learning path's ticks survive a reload | `/learning-paths/platform-engineer/` |
| Search (⌘K) finds a technical term and a scripture term | any page |
| Dark mode on every section; phone width with no horizontal scroll | every section |
| The 404 page; a page's Open Graph card (`/og/v2/<id>.png`) | `/nope/`, `/og/v2/index.png` |

Anything wrong is a normal pull request into `integration`; the site redeploys to staging on merge.

## 3. Production

1. Cloudflare: `CNAME docs →` Vercel's recommended target, DNS-only. Vercel: the domain is attached to
   `sggs-docs` and shows *Valid Configuration*.
2. Merge the next release PR `integration → main` (a merge commit, as always). `deploy-docs`'s
   `deploy-production` job records the deployment the domain serves now (the rollback target),
   builds, deploys unaliased, smokes by commit, promotes to `docs.gurbanisoul.com`, smokes again —
   and rolls back if the public smoke fails. Every failure opens an issue that says whether
   production changed.

   > [!NOTE]
   > **A project's first Vercel deployment became production.** On 2026-09-26 the docs
   > project's first deployment — a *preview* from `deploy-staging` — was recorded as production,
   > and `docs.gurbanisoul.com` attached to it, so the domain served an `integration` build until
   > the 1.3.10 release. `deploy-staging` now refuses to run while the project has no production
   > deployment (`scripts/ci/vercel_api.py has-production`) and fails if its own deployment is not
   > a preview. For a new Vercel project, the first deployment must come from `deploy-production`.
3. Prove it:

   ```bash
   python3 scripts/ci/docs_smoke.py https://docs.gurbanisoul.com --commit <sha>
   ```

   The smoke checks the landing, a Mermaid render, the search index, `/api/health` and `/api/meta`
   through the rewrite, the poster the architecture page links as "open full size" and an Open
   Graph card, and that `<meta name="sggs-docs-commit">` equals the commit. Nothing may redirect:
   a redirect on `/api` is how the widgets broke before launch (`trailingSlash`).
4. Owner walkthrough of section 2 on the public domain, once.

## 4. Rollback

The job rolls back on its own when the public smoke fails **after** promotion, to the deployment
the domain served before the run (read from Vercel by the domain, never "the newest production
deployment": a build deployed with `--skip-domain` whose smoke failed is also a READY production
deployment, but it never served anyone). A failure before promotion changes nothing and says so in
its issue. By hand: `python3 scripts/ci/vercel_api.py live docs.gurbanisoul.com` names the serving
deployment; Vercel → `sggs-docs` → Deployments → the previous good deployment → *Instant Rollback*,
or `vercel rollback <previous-url> --scope <team>` with the docs project's token. After a rollback
Vercel stops assigning the domain automatically; the next `deploy-production` run's `vercel promote`
restores it. The wiki carries no state, so a rollback costs nothing but the newer pages.

**If the PDFs fail a build.** `build-pdfs` names the page that could not be rendered, and
`check-pdf` names the file and the promise it broke (most seriously: Gurmukhi set outside Sant
Lipi, which means the font did not load). Fix the page or the stylesheet; never deploy around the
gate. To ship without PDFs while that is investigated, remove `DOCS_PDF: "1"` from the three build
steps of `deploy-docs.yml`: the build then makes none, the menu shows no *Download PDF*, and the
build stops announcing `pdf1`.

**Switching the page menu off.** If the page menu (copy, view as Markdown, the assistant links,
print) ever misbehaves, it can be removed without a code change: set `DOCS_PAGE_ACTIONS=0` in the
docs project's build environment and deploy again. The build then leaves the menu out of every page
and stops announcing `actions1`, so the live checks do not look for it
(`docs-site/plugins/features.mjs`, [ADR-0013](../../adr/0013-outbound-assistant-links.md)).

### Visual baselines

The `docs` check compares a picture of the top of six kinds of page (wide and phone, light and
dark: 24 pictures in `docs-site/e2e-visual/__screenshots__/`) with what the pull request's build
draws. The sidebar, "On this page", the dates under a title and live widgets are masked, so a new
page or a re-verified stamp does not trip it; a change to the layout, the type or one of the six
pages' opening content does.

When it fails:

1. Open the run, download the **`visual-baselines`** artifact. `__screenshots__/` holds what this
   build drew; `test-results/` holds expected, actual and diff for each picture that changed.
2. If the change is a mistake, fix it. If it is meant, replace the files in
   `docs-site/e2e-visual/__screenshots__/` with the artifact's and commit them in the same pull
   request, saying in the description what changed to the eye.

Never commit a baseline made on your own machine: fonts differ between systems, and the comparison
runs only in the pinned Playwright container (`PW_IMAGE` in `deploy-docs.yml`; raise it together
with the `playwright` version in `docs-site/package.json`, and refresh the baselines in that pull
request).

## 5. After launch: the routine

| When | What |
|---|---|
| every pull request | `scripture-diff-guard`: fails a bot's pull request that adds or removes a Gurmukhi code point, reports for everyone else (below) |
| every pull request | the `docs` check (required on `integration` and `main`): gates, build, links, budgets, CSP, e2e, axe on every page, the visual baseline, Lighthouse on five pages (all twenty nightly and on `main`) — about nine minutes |
| a dataset bump lands | nothing to do: the docs job installs the pinned database and re-verifies the cited lines |
| every 15 minutes | `uptime` probes the wiki's landing page and `/api/health` through its rewrite; issue *uptime: docs site probe failing* |
| every 6 hours | `docs-watch`: the domain serves the last deployed commit, the smoke and the live suite pass; issue *docs-watch: production wiki check failing* (after a manual rollback it stays open until the next release — expected) |
| every night | the `docs` job re-runs on `integration`; issue *docs: nightly wiki build failing* while red |
| every day, and right after every release | `docs-pins` opens *docs(wiki): bump the sibling docs pins* when a sibling changed a published file (or issue *docs: the sibling docs changed — bump the pins* until `DOCS_BOT_TOKEN` exists); `deploy-production`'s `release` job dispatches it as its last step. It runs the source-level docs gates on the new pins first ([below](#the-pins-pull-request)) |
| Mondays | `docs-links` checks every external link (issue *docs: broken external links*); `security` scans the history; `docs-freshness` opens or refreshes the pull request *docs(wiki): weekly refresh — N pages to re-read* (below), or rewrites issue *docs: wiki pages to re-verify* when it cannot |
| a page is in the weekly refresh | re-read it against the code it cites, fix what drifted, move its `verified` stamp — in commits pushed to `bot/docs-refresh`; merge the pull request with `--merge`. The bot closes it itself when every page is fresh and nothing was regenerated |
| a scholar review is due | `make review-pack` writes one PDF — Scripture 101, the glossary's scripture and script sections, the contributors — with a sign-off sheet |
| a new page | frontmatter, links, the scripture rule and the fallback rule are gated; a poster or a widget follows [the contributing guides](../../contributing/README.md) |

### The weekly refresh pull request

`docs-freshness` (Mondays, or by hand: `gh workflow run docs-freshness.yml --ref integration`)
installs the sibling docs and the pinned database as the `docs` job does, runs every page
generator in write mode (`make docs-regen`; the list is `DOCS_GENERATORS` in the `Makefile`, and
`tools/tests/test_docs_generators.py` keeps it equal to the generators `make docs-check` and the
`docs` job check), and runs `python3 tools/docs_check.py --freshness` and `--areas`. When a
generator changed a file or a page is stale, it makes **one** commit on `integration` — empty when
only pages are stale — force-pushes `bot/docs-refresh` and opens or refreshes one pull request into
`integration`: the regenerated files, the generators run, the pages to re-read and the code areas
no page covers yet.

Until 2026-11-12 the run picked its generators by looking for a quoted `"--write"` in their source.
None has one (each writes unless given `--check`), so every weekly run skipped them all and still
went green. The generated pages stayed current only because the `docs` check fails a pull request
whose generated page is stale; what the weekly run adds is a regeneration when an input changes
outside a pull request (the pinned database or sibling docs).

Merging the pull request does not re-read anything: it carries an empty commit. The pages it lists
are fresh again only when someone re-reads each one and moves its stamp on `bot/docs-refresh`.

What the bot will not do:

- **Move a stamp.** A commit that changes a `verified:` block is refused, and the list arrives as
  the issue instead. Re-reading a page and moving its stamp is a person's work, done on the same
  branch.
- **Overwrite a person's work.** Every bot commit carries the trailer `Refreshed-by: docs-freshness`;
  when `bot/docs-refresh` holds any other commit, the branch is left alone and only the pull
  request's title and body are refreshed.
- **Touch scripture.** Before pushing, the commit must pass `tools/gurmukhi_diff.py` (next section),
  and the pull request is checked again by `scripture-diff-guard`.

Without `DOCS_BOT_TOKEN`, with a token that cannot push, or when a step refuses the commit, the list
is written to the issue *docs: wiki pages to re-verify* with the reason, as before; the issue is
closed once a pull request carries the list.

### The pins pull request

`docs-pins` moves a pin only when a published file changed (`tools/docs_pins.py`), then runs the
source-level gates a pin can break: `fetch_sibling_docs.py --check`, `docs_check.py`,
`gen_repo_map.py --check` (sibling paths against the new pinned trees) and the sidebar test
(`docs-site/plugins/test/sidebar.test.mjs`: a new sibling *directory* must be placed in
`docs-site/sidebar.mjs`; a new page in an existing directory places itself). When a gate fails,
the pull request is still opened or refreshed, with the failing commands and their output in its
description, and the run is red. Fix the cause on `integration`: the bot rebuilds its branch from
`integration` every day (or `gh workflow run docs-pins.yml --ref integration`), so the next run
carries the fix. Never push to `bot/docs-pins`; it is force-pushed.

Each daily run force-pushes a new commit while a bump is pending, so every check runs again: a
check that failed for a reason outside the change (the runner's network on 2026-11-11, #392) goes
green on the next run without anyone touching it. To re-run sooner, re-run the failed jobs on the
pull request or dispatch the workflow.

The browsers and fonts the docs jobs and `e2e` need are installed by
`scripts/ci/install_browsers.sh`, which skips packages the runner already has and retries the
network four times. Before it, a few minutes without the Ubuntu mirrors turned #392's `docs` check
red (apt exit 100) and kept `e2e · playwright` retrying for two hours.

### The docs-impact check

The `docs-coupling` workflow (`.github/workflows/docs-coupling.yml`) runs
`python3 tools/docs_coupling.py BASE..HEAD` on every pull request: when it is opened, on each push,
and when its description is **edited**, so adding a `Docs-impact: none — <reason>` line updates
the report at once (until 2026-11-12 the job lived in `deploy-docs.yml` and ran only on pushes,
and four comments kept flagging pages their final description had excused). It writes the pages
the change should touch to the job summary and to one comment on the pull request, which is found
by its hidden marker `<!-- docs-coupling-report -->` and updated on each run. A pull request from a fork gets only the summary, because its token
cannot comment. To see the list locally, run
`python3 tools/docs_coupling.py origin/integration..HEAD`. The rules are in
[Writing a page](../../contributing/writing-docs.md#docs-impact).

The check reports only and the job is always green. To make it a gate:

1. Wait out at least two weeks of report-only. Read the comments it posted and the coupling debt
   on [Docs health](../../reference/docs-health.md). Fix any `covers:` that flags changes the page
   does not describe. The owner decides when the noise is low enough.
2. In `.github/workflows/docs-coupling.yml`, set `COUPLING_ENFORCE: "1"` in the `docs-coupling`
   job's `env`. From then on, a page that declares `covers:` and was neither updated, re-stamped
   nor excused by a `Docs-impact: none — <reason>` line fails the job. Pages covered only through
   the files they cite are still just reported.
3. To make the check block merges, add `docs-coupling` to the required checks of `integration`.
   That is a ruleset change for the owner.

To turn it off again, set the value back to `"0"`.

### Code areas with no page

A page can only be flagged for code it covers, so a new service, server module, website page or
workflow that no page names is invisible to the docs-impact check: the Hukamnama pull requests
after 1.6.4 changed `services/hukamnama*`, `webapp/hukamnama_*.py` and the Hukamnama pages with the
report saying "No page covers the code changed". `tools/docs_areas.json` lists the area patterns
(`services/*`, `webapp/*`, `frontend/src/pages/*`, `.github/workflows/*.yml`); each immediate child
of those directories is an area, and it must be covered by some page here (its `covers:`, or a file
it cites), or be listed in the file:

- `exempt`, with the reason it never needs a page (built output, tests);
- `backlog`, the gap known when the gate was added (2026-11-12). It only shrinks: once a page
  covers an area, the docs check asks for the entry to be removed.

A new area on no page fails `docs_check.py` (and so the `docs` check). The list:
`python3 tools/docs_check.py --areas`; the count is on [Docs health](../../reference/docs-health.md)
and in the weekly refresh pull request.

### The scripture diff guard

`tools/gurmukhi_diff.py [BASE...HEAD]` (default `origin/integration...HEAD`) lists every changed line
that adds or removes a character in U+0A00–U+0A7F (Gurmukhi), U+0964–U+0965 (dandas) or
U+200C–U+200D (joiners), as `file:line` with the code points written `U+XXXX` — never the characters
— and exits 1. `scripture-diff-guard.yml` runs it on every pull request: it **fails** when the head
branch starts with `bot/` or `docs/auto-` or the pull request has the label `automated`, and only
writes the list to the job summary otherwise (a person's scripture edit is reviewed by people and
proven by sggs-data's gates). A bot pull request it fails is never merged: close it and find the
generator that wrote the text.

## 6. Sibling README links

Done (2026-09-26): both sibling READMEs open with a line pointing at the wiki's published copy of
their docs ([sggs-data#11](https://github.com/Algorythmos-AI/sggs-data/pull/11),
[gurbani-soul-ios#19](https://github.com/Algorythmos-AI/gurbani-soul-ios/pull/19)).

## 7. Open review items

- The scholar review of [Scripture 101](../../scripture/README.md), the glossary's
  scripture terms and the contributors chronology. `make review-pack` builds the PDF with a
  sign-off sheet.
- Resolved: sggs-data's `database-schema.md` now states the database's counts (4,527 compositions,
  `max(comp_id)` 5,376), and `pipeline/tests/test_docs_facts.py` there holds them to the database.
