---
title: "Release timeline & known issues"
description: "The releases that explain today's invariants, in order, with what each one changed and the rule it left behind; then the items that are still open and who owns them."
sidebar:
  order: 5
verified:
  commit: 26d86be7
  date: "2026-11-08"
---
# Release timeline & known issues

`CHANGELOG.md` is the authoritative release history. This page keeps the releases that explain an
invariant you will meet in the code, and the items that are still open. A release that changed
copy, layout or tooling but left no new rule (1.4.1, 1.4.2, 1.4.5–1.4.7) is only in the changelog. The 2026-06 static audit
and live verification passes live under [reports](../reports/README.md).

## Timeline

| Release | Date | What changed | The invariant it left |
|---|---|---|---|
| **Live verification** | 2026-06-19 | Scripture integrity proven end to end: reconcile char-exact, golden all-pass, 1,430 Angs gap-free, 60,658 lines; footer/version bug fixed. | The Ang 1256 "duplicate" is a **legitimate refrain — never de-duplicate it.** |
| **v2.9.3** | 2026-06-19 | `MANIFEST.json` re-certified; version strings synced; `build_db.py` no longer hardcodes a version; `rebuild_all.sh` builds the analytics, vaar and semantic tables (validated by a full green rebuild, vaars=22); `concept_lines(line_id)` index fixes the Constellation hang. | A rebuild populates every layer; large concepts need that index. |
| **v2.9.4** | 2026-06-19 | Lineage redesign, plain-language Insights captions; `line_neighbors` rebuilt as exact sparse cosine (header-excluded, verbatim-twin de-duplicated, 0.30 floor, `source='tfidf-exact-cosine-lite'`, scipy at build) with relatedness bands; `db_sha256` re-certified. | Neighbour scores are shown as bands, never a raw percentage. Scripture byte-identical. |
| **v2.9.5** | 2026-06-19 | Insights accuracy from the audit: theme tags curated, `akal_kaal` split into `akal` + `kaal` (concepts 53 → 54), resonance refreshed, full-edge theme network (min-PPMI 0.7 by default), hardened neighbour matmul; PPMI/Jaccard recompute exact. | 54 concepts. Scripture byte-identical. |
| **v2.10.0** | 2026-06-20 | Bundled **Sant Lipi** Gurmukhi webfont (SIL OFL 1.1, `unicode-range`-scoped) and the **traditional saroop** display toggle (`saroop.ts`), which collapses the doubled subjoined ya in rendered glyphs only. | **Display only:** the corpus, DB, API, search and copy stay verbatim; the saroop markup never enters stored text or `/api`. Sant Lipi's inline addha-yayya is a legitimate but *different* tradition from the printed Bir's deep subscript; pending a scholar's review. |
| **v2.10.1** | 2026-06-20 | Saroop becomes the default rendering without writing `localStorage`; an explicit choice (`sggs_saroop` `'0'`/`'1'`) is stored and respected. | To change the default, flip `let ON` in `saroop.ts`. |
| **v2.11.0** | 2026-06-26 | Apple-grade hardening: `verify.py` FTS tokens sanitised and quoted with a central empty-`MATCH` guard (a crafted quote/asterisk no longer 500s or leaks the exception type); `min_ppmi` clamped; `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` on every response; `lang="pa"` on verse containers; pinch-zoom re-enabled; charts honour reduced motion; theme network gains a data-table alternative; styled 404. | 500s return a generic body. Security headers on every response. |
| **v2.12.1 / iOS 1.1.1** | 2026-09-05 | Pre-TestFlight hardening. | `romannorm.py` is the single Roman fold and must equal the pipeline's (24,719 golden vectors); every integer query parameter goes through `_int()`; the Study-Trail pin reads verbatim text from `data-gm`, never rendered text (`/api/lines?ids=` repairs old pins); iOS `sheetHosted` gate, SwiftData ladder, `SavedLineSchemaV1`; an English-bundled iOS build needs `LICENSED: true`. |
| **v1.0.0** | 2026-09-06 | Version strings reset to one unified baseline ahead of the first public release; no code, corpus or DB change. | One version number across web, API and app ([ADR-0004](../adr/0004-unified-semver.md)). |
| **v1.1.0 – v1.1.5** | 2026-09 | `comp_id` groups a heading run with its composition (post-pass 1b); v1.1.4 demoted 233 verses mis-flagged as headings; CI-gated deploys; Soul Gold brand. | No body line ever changes `comp_id`; deploys only through CI. |
| **v1.3.8** | 2026-09-24 | Three repositories: data, platform, app ([ADR-0007](../adr/0007-three-repositories.md)); the database arrives by pin ([ADR-0008](../adr/0008-dataset-by-pin.md)). | `dataset.lock.json` is the only way a dataset changes here; the editorial ledger is 4 rules, 11 applications. |
| **v1.3.9** | 2026-09-25 | Every bounded context runs as its own service on staging behind a gateway generated from the route table ([ADR-0010](../adr/0010-services-behind-a-generated-gateway.md)); `/api/v1/*` with strict errors beside a byte-identical legacy `/api/*`; request ids; continuous production verification. | Routing is generated, never hand-written; legacy `/api/*` stays byte-identical (the golden contract pins it). |
| **v1.3.10** | 2026-09-25 | The API runs as Python functions inside the Vercel web project in production ([ADR-0011](../adr/0011-api-as-functions-in-the-web-project.md)), replayed against the golden contract before it goes live; the Render API keeps deploying as the rollback; this wiki launches at docs.gurbanisoul.com. | The website and the API deploy — and roll back — together. |
| **v1.4.0** | 2026-10-14 | The Knowledge Base is redressed (thirteen themes, a new shell) and gains the app's Reader, Nitnem, Search and Raag Clock; the wiki gains its page menu, Markdown and PDF. The API is unchanged and production keeps the single `all` function. | A web release ships first and the app follows as an App Store candidate from the same tag; the store version can lag the site until that candidate is released ([release status](../ios/release-status.md)). |
| **v1.4.3** | 2026-10-17 | The traditional saroop draws each doubled subjoined ya as the yakash sign (U+0A75), as the printed Bir does. | Display only: a test checks on every build that the corpus has no U+0A75 of its own and stores every subjoined ya as one doubled pair; a copied selection is mapped back to the stored characters. |
| **v1.4.4** | 2026-10-18 | `/contribute`: optional support through Stripe-hosted Payment Links, behind the build-time `PUBLIC_CONTRIBUTE_MODE` switch. | A link that does not match the mode fails the build; the page loads no Stripe script; they are contributions, never donations, and never linked from the app ([Contribute and Stripe](../website/contribute.md)). |
| **v1.4.8** | 2026-10-23 | Constellation v2 on the web and in the app; three new analytics routes (29 in all) and a 31-vector `golden_constellation` suite. | The website and the app must give the same numbers: the suite is replayed over HTTP and by the app's `ConstellationParityTests`. |
| **v1.4.9** | 2026-10-25 | Dataset 1.1.0: 1,045 author tags corrected from the evidence printed in the Granth; the contributors roster v2 (`contributors.json`) becomes the one source for web and app. | Attribution changes only `author`, proven byte-identical scripture (`verify_attribution.py`); life facts are cited only from The Encyclopaedia of Sikhism and Sahib Singh's Darpan; `check_contributors.py --channel appstore` refuses entries not yet approved. |
| **v1.5.0** | 2026-10-27 | Dataset 1.2.0 reads each Vaar from the print (`vaar_units` 1,426 → 1,443); the site's counts are generated from the database and the roster. | No number on a marketing page is typed by hand (`landing-facts.json`, checked by the `LandingPage` gate). |
| **v1.5.1** | 2026-10-28 | Dataset 1.3.0 applies the scholar's G3 rulings on attribution and grouping (Angs 1253, 1363–1384, 695, 524 and 323). | A ruling moves metadata and grouping only; it is recorded as relayed, with the owner's signature (sggs-data `validation/attribution-g3-review/SIGN-OFF.md`). |
| **v1.5.2** | 2026-10-29 | Share cards drawn with HarfBuzz and resvg; a share page for every Ang at `/ang/N`; shared verses from the app link to it. | A card's verse is read from the database, never typed (`AngSharePages`); the share pages are `noindex` and stay out of `routes.ts`. |
| **v1.6.0** | 2026-11-05 | Marketing pages move under a language prefix with permanent redirects from the old URLs; one message catalog; dataset 1.4.0 aligns the English in source order with multi-line spans. | No interface English outside the catalog (pseudo-locale build in CI); the redirects are generated, never hand-edited; a span's English sits once, on its last line ([translation layer](../data/translation-layer.md)). |
| **v1.6.1 – v1.6.3** | 2026-11-05 – 11-06 | The Punjabi (1.6.1) and French (1.6.2) sites are switched on; the Punjabi copy is revised after a native-speaker review (1.6.3). | A language ships whole or not at all: every key translated and current, and a signed review record that pins the catalog's sha256 (`i18n-status.mjs` in CI); Ang numbers stay in Western digits in every language ([internationalisation](../architecture/i18n.md)). |

## Still open

| Item | State | Owner |
|---|---|---|
| Analytics-chart accessibility: the D3 charts are mouse-driven; the theme network has a data-table alternative, the others do not yet | open | web |
| One line with an empty `translit_norm` (id 35328, Ang 829) | fixes on the next rebuild; tracked row by row in sggs-data's data-quality baseline | data |
| 21 source-faithful lines with a vowel sign that has no base consonant (Angs 214, 342, 695, 698, 699, 897, 1203, 1205) | flagged for scholarly review; never silently changed (the Ang 1354/1358/1387 rows were resolved by the editorial corrections approved in the scholar review of 2026-09-24) | scholar review |
| Eight web-only colour themes (`review` in `docs/brand/web-themes.json`) and the rule that Gurmukhi is ink in every theme: scholar review | shipped in 1.4.0 labelled `review`; the review was waived for the release by the owner on 2026-10-13 and runs after it | brand |
| Five-person task check of the redressed Knowledge Base | waived for the 1.4.0 release by the owner on 2026-10-13; runs after it | web |
| The scholar's direction on the segmentation of the closing word on Angs 323, 517, 524 and 654 (his Q6 in the G3 review) | recorded in 1.5.1 and not applied: changing a record's boundary changes its `gurmukhi` field, so it needs its own sggs-data change with a logged entry, the reconcile proof and a scholar's review | data, scholar review |
| Biographical entries in the contributors roster | all 36 entries in `frontend/public/contributors.json` carry review status `draft`; four ask the scholar to rule (the signed dialogues inside Bhagat Kabir Ji's saloks, one birthplace); `check_contributors.py --channel appstore` refuses entries not yet approved | scholar review |
| English still missing after dataset 1.4.0 | 41 verse lines and 33 headings have no English; line 47530 waits for a structure review of line 47529 (sggs-data `validation/translation-alignment-reviewed.json`) | data |
| Learn articles in Punjabi and French | none is translated yet; the translated pages link to the English article (`frontend/src/i18n/content.ts`) | web |
| The app's Sufficient Contrast and Larger Text accessibility labels | not declared in App Store Connect until gurbani-soul-ios issue #23 is done | iOS |
| The Jaap pauris 79 and 80 display repair (iOS 1.4.7) | draws without a dotted circle; the stored text is unchanged; flagged for scholar review | scholar review |
| The yakash display of the subjoined ya (1.4.3) | accepted by the owner for that release on 2026-10-17; the scholar's review continues, and a requested change ships in the next release | brand |
| Japji `author = null`: author filters for Guru Nanak miss it | known, deferred | data |
| `comp_type` mislabelled in places | suppressed at the display layer; prefer `comp_id`/`section` | data |

What each of these means for the text is on [the editorial ledger](../data/editorial-ledger.md) page.

Closed since the last list: the gap between the site's version and the App Store's closed when 1.3.10
was released on 2026-10-13 and 1.4.0 followed it; the app's store version can still trail the site
between releases, which [release status](../ios/release-status.md) explains. The 1.4.0 entry for
the eight web-only colour themes and the five-person task check is kept until their reviews are
recorded. Earlier: the traditional saroop rendering was accepted as the app's default at the
brand sensitivity gate on 2026-09-26. The deep-subscript ya that acceptance said would need another font
was in Sant Lipi all along, as the yakash sign U+0A75: since 2026-10-16 the saroop draws it, matching the
printed Bir, and goes back to the scholar with icon v2; `Validation-Report.md` is archived.
