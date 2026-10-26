# Gurbani Soul — marketing screenshots

Captured 2026-09-23 · worktree `wt-pra` @ `1197e2b` (feat/site-v2-foundations, iOS 1.3.4 build 1, Debug) · Xcode 26.5 · iOS 26.5 simulator runtime.
All shots use the **public** (Gurmukhi-only) DB profile (`db_sha256 f30a2fc0…`, `profile: public`), swapped into a copy of the built app; the in-app integrity check passed (About shows all green). No English translation layer appears anywhere.
Status bar overridden to 9:41, full battery/signal. Env = `SIMCTL_CHILD_*` launch variables. Nothing is mocked: progress shown (Japji read today, Live Activity 1%) was produced by using the app.

| name | device | iOS | appearance | deep link / steps | env | raw sha256 | compId |
|---|---|---|---|---|---|---|---|
| iphone-reader-light | iPhone 17 Pro | 26.5 | light | sggs://ang/1 | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `be801551601ed762a2e04f736c17527d3e6cde53b1a6e2446c9742ea3ad02d45` |  |
| iphone-search-roman-light | iPhone 17 Pro | 26.5 | light | sggs://search?q=naam (Auto mode) | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `e05a4690aca38201afb0bf5b0cd1ab250ff49ba2e0afaa3d2f18d8bd5c79688c` |  |
| iphone-search-first-letters-light | iPhone 17 Pro | 26.5 | light | Search → First letters pill → typed `s s n h j s l v` (→ ਸੋਚੈ ਸੋਚਿ ਨ ਹੋਵਈ…, Ang 1; the keyboard auto-capitalised the first s) | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `67c85e25bbb9a17195f31e361ba4eb100ed5edcecdb2ae7aa16d79e96cef8768` |  |
| iphone-verify-verdict-light | iPhone 17 Pro | 26.5 | light | Search → Verify pill → pasted `ਆਦਿ ਸਚੁ ਜੁਗਾਦਿ ਸਚੁ ॥` → Verified 100% | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `e225ff628df74eaa244359b80683558cdb8577195a92b1a24732ee5a49a8af33` |  |
| iphone-hukam-light | iPhone 17 Pro | 26.5 | light | sggs://shabad/29 (Dhanasari M1 "Aarti", Ang 13) | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `2eee73bf712b898d795c0a7fd0a1f68f141c3af766a4c6db738018a93ffbea93` | 29 |
| iphone-nitnem-light | iPhone 17 Pro | 26.5 | light | sggs://nitnem (after Japji genuinely marked read today in-app) | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `e56195281dfa8e0eb5e99f9f914600f8a1b8906555ddf66a8d3b83e349ad8ced` |  |
| iphone-bani-japji-light | iPhone 17 Pro | 26.5 | light | sggs://bani/japji, scrolled ~180pt | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `98bfc074e37522cc806cbf6f313aee78616c69e21f9ea7cd61fabb51c136cb95` |  |
| iphone-nitnem-journey-light | iPhone 17 Pro | 26.5 | light | Nitnem → Reading journey (honest: only Japji read; the calendar counts a full set, so no day is filled) | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 (+ SGGS_AUTOSCROLL_PPS=3000 on that launch, unused — completed via jump-to-end + "Mark as read today") | `a7e93ec1bbf13c80a949b32c27722f3f2a8f59b88beb47783fabe8ead4c83294` |  |
| iphone-themes-light | iPhone 17 Pro | 26.5 | light | Explore → Themes | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `e220c8776e3f3fefa0401f8b72c46fd27f96ddd482a347fdc61ff51f0288bfb1` |  |
| iphone-lineage-light | iPhone 17 Pro | 26.5 | light | Explore → Lineage | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `093450873aee85839d8e36779bc7d8874a29ec66511c3ea6da8aac9d5af6dece` |  |
| iphone-insights-light | iPhone 17 Pro | 26.5 | light | Explore → Insights (Contributors tab) | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `85048ac592170f65afd0def5308fbb280e4304faf874519b899b0486207f5637` |  |
| iphone-constellation-light | iPhone 17 | 26.5 | light | Explore → Constellation (Theme: Naam) — Recaptured 2026-09-23 after #120: shows concept display names ("Dukh Sukh"), not raw ids. iPhone 17 sim, iOS 26.5, build `ec222c1` (Debug, bundled DB), `testCaptureScreens` shot, status bar overridden to 9:41; this screen shows no translation text, so the DB profile does not change it | status bar 9:41 | `f7c50235dff6e39fcc6e75f7004ec6bf7a7df4efc088f5b55fad6091fdcc74ca` |  |
| iphone-index-light | iPhone 17 Pro | 26.5 | light | Explore → Index | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `fadfc1ee0c3d31f70056b5bbe3a2216770cf5ed75dd8d96ac7d4b79f6357f273` |  |
| iphone-about-light | iPhone 17 Pro | 26.5 | light | More → About & credits (ad-hoc signed copy so the App Group row is green) | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `ce1079a0dfccc808c50caa814ed60f88778b926d55909f2451178d75c4b5310a` |  |
| iphone-more-display-light | iPhone 17 Pro | 26.5 | light | More, scrolled to Display (accent swatches) | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `b53fbc06ca82e47866a43824cae82e744da8ec765b956b30018993b1a534c32f` |  |
| iphone-saroop-on-light | iPhone 17 Pro | 26.5 | light | sggs://ang/1400?line=59566 (ਜਲ੍ਯ੍ਯਨ line), Traditional saroop ON (default) | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `9286181cc09a3036407298dc8c3b7eaa4367f0d0ad4445d3f9d24b0b0f8b764f` |  |
| iphone-saroop-off-light | iPhone 17 Pro | 26.5 | light | same deep link + landing after More → Display → Traditional saroop OFF (reset ON afterwards) | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `afc9667501bed3cec5e6dc5f38e285def68abc1946e98d32cbef05755bfb30fc` |  |
| iphone-pahar-divergence-light | iPhone 17 Pro | 26.5 | light | sggs://clock → "See every disagreement" → Where traditions disagree | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `fe0af8ba270c340039560f2077316ddbad7f3cd10fc7153a9da5806d1ae2f4e0` |  |
| iphone-live-activity-island-light | iPhone 17 Pro | 26.5 | light | More → Live Activity ON (drag the switch), sggs://bani/japji, scroll, wait >20 s, HOME → Dynamic Island (1%, real progress) | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `6e7b47a151c628da8e0a4dd79bcc805b86a8df640af67fe89cdd05e7d0b86e27` |  |
| iphone-live-activity-lock-light | iPhone 17 Pro | 26.5 | light | LOCK ×2 → Lock Screen; accepted the one-time "Allow Live Activities" prompt, then shot | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `282cfe4b3f899a26d3b88c447208c5ad9d708c2cdcc91a408b337f8c639e54cf` |  |
| iphone-live-activity-card | iPhone 17 Pro | 26.5 | light | **derived** from `iphone-live-activity-lock-light` (sharp `extract` 0,1450 900×260 — the Live Activity card only; the simulator's status bar / date are cropped away), palette PNG | — | (derived) |  |
| accent-soul | iPhone 17 Pro | 26.5 | light | More → Display → Accent swatch 1 (Soul, default) → sggs://ang/1; top 900×700 band | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `be801551601ed762a2e04f736c17527d3e6cde53b1a6e2446c9742ea3ad02d45` |  |
| accent-saffron | iPhone 17 Pro | 26.5 | light | swatch 2 → sggs://ang/1; top band | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `642fb3da53ef3a6c20a880ea78a04becfabfb5d3b35358778f2de323985eef2c` |  |
| accent-gold | iPhone 17 Pro | 26.5 | light | swatch 3 → sggs://ang/1; top band | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `b3cde3ea364acb3896c024b3ca3ab306902d46ca6d8cbe794835aa406323884a` |  |
| accent-indigo | iPhone 17 Pro | 26.5 | light | swatch 4 → sggs://ang/1; top band | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `bdc03f80bc9e7e37ca6c63683d3d6be18e815a743878de147ad9b6963aa5e9f5` |  |
| accent-teal | iPhone 17 Pro | 26.5 | light | swatch 5 → sggs://ang/1; top band (accent reset to Soul afterwards) | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `6583f11a5f8513abde16d85c7495dc90c65fd40f3a1039ffa5570ef8c8a64d61` |  |
| iphone-reader-dark | iPhone 17 Pro | 26.5 | dark | sggs://ang/1 | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `c286289ba536e8f0de03b0785a1ff18df44b14390bb2f5241a0d94c736e15861` |  |
| iphone-clock-dark | iPhone 17 Pro | 26.5 | dark | sggs://clock | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `9a23c974daa474cf9cefc6145c19807c41ef1535f4395bae37ae03ea92596c6f` |  |
| iphone-constellation-dark | iPhone 17 | 26.5 | dark | Explore → Constellation (Theme: Naam) — Recaptured 2026-09-23 after #120: shows concept display names ("Dukh Sukh"), not raw ids. iPhone 17 sim, iOS 26.5, build `ec222c1` (Debug, bundled DB), `testCaptureScreens` shot, status bar overridden to 9:41; this screen shows no translation text, so the DB profile does not change it | status bar 9:41 | `71e4bb1cc48706ac7f83ae8153cbf27d21d606dbd1b7e6b2a08a2e5b466d7dee` |  |
| iphone-clock-solar-dark | iPhone 17 Pro | 26.5 | dark | sggs://clock → "Use my location" → Allow While Using App; sim location 31.62,74.88 (Amritsar) | CLOCK_NOW=581 · CLOCK_MODE=solar · TZ=Asia/Kolkata (so the Amritsar sun-times read in local time) | `c6987ff166e07ff28fecefcc200a890fa7c6dafe2df468694980d74696ee7882` |  |
| ipad-reader-landscape-light | iPad Pro 13" (M5) | 26.5 | light | Landscape. Ang **705** (not 712): frame polled with `simctl io screenshot` while the repo UI test `testRapidChevronTapsStayInSync` navigated (deep link 700 → 5× Next); settled frame, rotated 270° | SGGS_UITEST=1 (test launch) | `d69eddfef8aab07d9af30bc1ea9170c28da78afddeaabcac9f8a20f52cbd7d25` |  |
| ipad-nitnem-landscape-light | iPad Pro 13" (M5) | 26.5 | light | Landscape. Cold launch (Nitnem is the default tab = sggs://nitnem target) | CLOCK_NOW=581 · CLOCK_MODE=fixed · CLOCK_NO_COORDS=1 | `3f7de8725f6f54738fab3c99ba02d06eea934d5399d3d1e97423b030e613f3b8` |  |
| ipad-explore-landscape-light | iPad Pro 13" (M5) | 26.5 | light | Landscape. Settled frame polled during repo UI test `testExploreHubReachesEverySurface`; rotated 270° | SGGS_UITEST=1 (test launch) | `d192dabd3c54f285d945033ec7c850ccfd092aebfed2420c8eebfac2916bba29` |  |

## Widgets (`final/widgets/`)

Rendered by unit tests through `ImageRenderer` (scale 3) with `TEST_RUNNER_SGGS_WIDGET_SNAPSHOT_DIR`, native size, palette-PNG re-encoded:
- `raagnow-*` — `WidgetRenderTests` (every family, fixed + solar, light + dark; fixture pahar→raag table, 16:40 on 2026-09-18).
- `nitnem_*` — `NitnemWidgetRenderTests` (every family, "next"/"done" states from the test fixture — **illustrative states, not a real reader's progress**).
- `hukam-{medium,large}-{light,dark}` — **new** `ios/App/Tests/Unit/HukamWidgetRenderTests.swift`. The verse is real: drawn exactly as the app draws its widget snapshot (`hukamUnit(seed: 29)` on the bundled DB, first non-header line — ਗਗਨ ਮੈ ਥਾਲੁ ਰਵਿ ਚੰਦੁ ਦੀਪਕ ਬਨੇ ਤਾਰਿਕਾ ਮੰਡਲ ਜਨਕ ਮੋਤੀ ॥, Ang 13). Because `HukamView` lives in the widget-extension target (not importable from SGGSTests), the test renders a line-for-line mirror of its body built from the same shared components; the citation truncates to "Sri Guru Granth Sahib Ji · An…" at medium/large width exactly as the shared `Citation` does in the real widget.

## Not captured
- `iphone-saved-light` — skipped (Saved verses would be the empty state).
- iPad Reader is Ang 705, not 712 (see row).

## Widgets shipped to the site (curated)
Only clean renders are used: `widget-hukam-medium-*`, `widget-nitnem-{medium,small}-*` (the render
test's sample "next bani" state), `widget-raagnow-small-*`. **Not shipped:** Hukam **large** (citation
truncates to "Sri Guru Granth Sahib Ji · An…" — an app bug, being fixed separately) and Raag Now
**medium/large** ("next watch in 4 days, 18 hrs" — countdown bug under investigation), and the light
lock-screen accessory renders (near-blank on a black background). Re-render once the fixes land.

## 1.4.9 site refresh (2026-10-26)

App 1.4.9 (gurbani-soul-ios `v1.4.9`, `f700fb3`) changed screens these 1.3.4 shots show. Shots whose
content is now **untrue** were taken off the pages (the files stay here until the 1.4.9 set replaces them):

| file | why it is off the pages |
|---|---|
| iphone-lineage-light | says "30 voices · 60,273 verses"; the roster is 36 voices (dataset 1.1.0 attribution) |
| ipad-explore-landscape-light | its Lineage tile says "30 voices across five centuries" |
| iphone-insights-light | per-author counts before the 1.1.0 re-attribution, and a "lexical diversity" figure computed on the English layer that 1.4.9 no longer shows |
| iphone-themes-light | shows English theme descriptions, which 1.4.9 holds back for scholar review (G3) |
| iphone-constellation-dark, iphone-constellation-light | Constellation v1 drawing; the copy now describes v2 (Focus, lenses, the Sky) |
| iphone-more-display-light | its chapter was rewritten for Display; no longer referenced (`iphone-index-light` is now the 1.4.9 Index, below) |

### The 1.4.9 set (2026-10-26)

Source: gurbani-soul-ios workflow `ios-site-shots`, run **40283477272**, at tag `v1.4.9` (`f700fb3`), Xcode 26.3,
iPhone 17 Pro and iPad Pro 13" (M5) simulators on **iOS 26.2**. The public Gurmukhi-only DB
(`bf9141739ca0210926da71b24c9bbfda98387698aa851dd9100243bf07854fef`, the one in App Store build 1.4.9 (1)) was
swapped into the built app and proved by sha256 and by the absence of the `translations` and `fts_en` tables.
Status bar 9:41 (wifi 3, cell 4, 100%), clock pinned with `SGGS_CLOCK_NOW=581` (09:41), fixed mode, no
coordinates; 0 tests failed. Every source file matched the run's `SHA256SUMS` before it was placed.

Encoding: iPhone shots resized to 900 px wide, widgets kept at native size, all palette-PNG re-encoded with sharp
(quality 92); the pages serve Astro's responsive WebP (AVIF+WebP for iPad). The sha256 below is of the **raw source
PNG**, as in the 1.3.4 table. Same-named files replace their 1.3.4 versions; the others are new.

| file | source (`shots149/`) | device | iOS | appearance | source sha256 | run |
|---|---|---|---|---|---|---|
| iphone-reader-light.png | `iphone-light/reader.png` | iPhone 17 Pro | 26.2 | light | `def5d7176b7eea4b1aa29847902a926abb2da6f388cdd7a3b1fe82a1a23d1b3f` | 40283477272 |
| iphone-reader-dark.png | `iphone-dark/reader.png` | iPhone 17 Pro | 26.2 | dark | `ff5eee4f04ec5a266733c327f9dca600d98a08a473f86c1cd512f27b23ca3128` | 40283477272 |
| iphone-search-roman-light.png | `iphone-light/after_search.png` | iPhone 17 Pro | 26.2 | light | `ee6b1024b166205051a5dae4bfd27820632566da0a4a3153c4d1c65b026b75a9` | 40283477272 |
| iphone-verify-verdict-light.png | `iphone-light/verify.png` | iPhone 17 Pro | 26.2 | light | `7227c464b3bd6604a5b3592578742937c36c16b135736b2287f6168c590511ce` | 40283477272 |
| iphone-hukam-light.png | `iphone-light/hukam.png` | iPhone 17 Pro | 26.2 | light | `223c298f7a5df5b1a12753bf885dad58d37b25c803d7cf2a442c19e5b4356bde` | 40283477272 |
| iphone-bani-japji-light.png | `iphone-light/bani_reader.png` | iPhone 17 Pro | 26.2 | light | `25e66bea550f87871f9feadb61261c228c11afa9430d0c5ba1c7b433d0981b78` | 40283477272 |
| iphone-clock-dark.png | `iphone-dark/clock.png` | iPhone 17 Pro | 26.2 | dark | `cecb099cdef184c0496dfd16a2440c992b838ba470991d8e4d94384c5f04c555` | 40283477272 |
| iphone-about-light.png | `iphone-light/about.png` | iPhone 17 Pro | 26.2 | light | `829607befabbfb1c775e88448c091a9ea3870b285c0551e604b0f21cf29c55a2` | 40283477272 |
| iphone-vaars-light.png | `iphone-light/vaars_home.png` | iPhone 17 Pro | 26.2 | light | `e0d709e824e5d705cc34bcb414f4b261148ecd20ab07da1be7124b59b759350a` | 40283477272 |
| iphone-vaar-weave-light.png | `iphone-light/vaar_weave_top.png` | iPhone 17 Pro | 26.2 | light | `306ba98751c0844c35f6db3d1d8958b12b46573c9fcfbb1bf72f7a4e92da8633` | 40283477272 |
| iphone-vaar-reader-light.png | `iphone-light/vaar_reader_top.png` | iPhone 17 Pro | 26.2 | light | `c7f0f4c3b8cfe2d9f80252072b0f8e051c9ed5807709b58400669057a8f34f7d` | 40283477272 |
| iphone-index-light.png | `iphone-light/index.png` | iPhone 17 Pro | 26.2 | light | `4b517ce0ad5766bf0e78198f03a3e72bdbc04f854686cd9629cb5c88bc9c3313` | 40283477272 |
| iphone-raag-gauri-light.png | `iphone-light/raag_gauri.png` | iPhone 17 Pro | 26.2 | light | `e9e89608cc07422f343fbb23842b974e9b6f8ff5dcbf2709bfdc16c12331ee76` | 40283477272 |
| iphone-index-forms-light.png | `iphone-light/index_forms.png` | iPhone 17 Pro | 26.2 | light | `192462c52bce7a4611917cf120454e120477f821b9271b37f41e171fdcc5c6c1` | 40283477272 |
| iphone-voice-m9-light.png | `iphone-light/voice-m9.png` | iPhone 17 Pro | 26.2 | light | `02d8b322c2c1e543395665bc02504af6a85903a5c1f18aadddad842e2901136a` | 40283477272 |
| iphone-compare-light.png | `iphone-light/compare-v2.png` | iPhone 17 Pro | 26.2 | light | `b684b915ac04d5c942294de065802b5a12312382e0a447d5ff3c099625d50145` | 40283477272 |
| widget-hukam-medium-light.png | `widgets/hukam-medium-light.png` | widget render (unit test, `ImageRenderer` scale 3) | 26.2 | light | `3aefd1d621b72ceccb89cc9d609a122cc840312e67195568477f5fff7a0d7a1c` | 40283477272 |
| widget-hukam-medium-dark.png | `widgets/hukam-medium-dark.png` | widget render (unit test, `ImageRenderer` scale 3) | 26.2 | dark | `5011996f16d852e6d6ca1143ddd35e5327c3aaf18d5eff8b51882de8656e2c54` | 40283477272 |
| widget-nitnem-medium-light.png | `widgets/nitnem_medium_next_light.png` | widget render (unit test, `ImageRenderer` scale 3) | 26.2 | light | `2779c67ce2c04edcc80623dac4d0d75326a8a87d319595c09917989adc5f86bf` | 40283477272 |
| widget-nitnem-medium-dark.png | `widgets/nitnem_medium_next_dark.png` | widget render (unit test, `ImageRenderer` scale 3) | 26.2 | dark | `e499636a80a77ddd2c82868170526e83ed28a9682aa89734397860ec5f2b4c72` | 40283477272 |
| widget-nitnem-small-light.png | `widgets/nitnem_small_next_light.png` | widget render (unit test, `ImageRenderer` scale 3) | 26.2 | light | `84b8e801892055b44c124c48dbb7bafd563cb3f6840ab45ac2f72bad75b7dc3c` | 40283477272 |
| widget-raagnow-small-light.png | `widgets/raagnow-small-fixed-light.png` | widget render (unit test, `ImageRenderer` scale 3) | 26.2 | light | `5ee97f4f885ca89ee81c80a2409bb6e8b70699686b0f3d6520aae2602536d10e` | 40283477272 |
| widget-raagnow-small-dark.png | `widgets/raagnow-small-fixed-dark.png` | widget render (unit test, `ImageRenderer` scale 3) | 26.2 | dark | `c6838f767be56e42f1c26eab10639a41d32dced73a7ef514ca91d0ae92af4230` | 40283477272 |

Widget renders come from `WidgetRenderTests` / `NitnemWidgetRenderTests` / `HukamWidgetRenderTests` fixtures:
the Raag Now dial is the fixture's 16:40, the Nitnem widget shows the fixture's "next bani" state, and the Hukam
widget draws the seed-29 unit (Ang 13), so it is not the same Hukam as `iphone-hukam-light` (Ang 1319). The Hukam
widget's eyebrow now reads "HUKAM OF THE DAY" and its citation is no longer truncated.

`iphone-about-light`: the four scripture integrity checks are green and the version reads 1.4.9+1. Behind the
tab bar, a few pixels of the next row's red icon show: the CI build is not signed, so its "Widget App Group"
row fails. That row is not one of the integrity checks, and its text is hidden.

### Not placed from the 1.4.9 set

| source | why |
|---|---|
| `themes-index`, `themes` (all four sets) | capture fault: they show the Index **Forms** tab, not Themes (the iphone-light files are byte-identical to each other). Themes stays figures only |
| `constellation`, `constellation-focus` (all four sets) | same capture fault (Index Forms tab). Explore stays copy only |
| `themes-search-gurmukhi` | shows "No Results for ਹਉਮੈ" with the keyboard up: not a picture of the feature |
| `ipad-landscape/*` | the landscape UI is rotated 90° onto the 2752×2064 canvas and clipped, with a black band. The 1.3.4 iPad landscape Reader and Nitnem stay. `ipad-landscape-frames/frame-004` proves a clean landscape capture is possible: recapture Reader and Nitnem that way |
| `voices_ribbon`, `insights_contributors`, `lineage*` | **held**: they read "35 voices / 35 contributors"; the site says 36. The owner is deciding the wording |
| `explore_hub` | **held**: the old flat-gold hub, replaced by the Explore redesign in the next app release |
| `index_find`, `search_results` | the keyboard covers half the screen; `after_search` (same results, no keyboard) is used for Search |
| `nitnem_home`, `vaar_reader_pauris_only`, the other surfaces | not needed by a page today |
| `hukam-large-*`, `raagnow-medium/large-*` | now clean (citation whole, countdown right), but the widget rows have no large or second medium slot |

### Still from 1.3.4 (no 1.4.9 equivalent was captured)

`iphone-search-first-letters-light`, `iphone-saroop-on/off-light`, `accent-*`, `iphone-nitnem-journey-light`,
`iphone-clock-solar-dark`, `iphone-pahar-divergence-light`, `iphone-live-activity-card`, and
`ipad-reader/nitnem-landscape-light` (see above). Each is still true of 1.4.9. The unreferenced 1.3.4 files
listed at the top of this section stay in the repo but are on no page.
