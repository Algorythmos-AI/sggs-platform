---
title: "What the app does"
description: "Gurbani Soul screen by screen: the five tabs and The Granth Today, the Raag Clock, sharing, widgets and Live Activity, the Hukamnama from Sri Harmandir Sahib in TestFlight builds, Siri and deep links, settings, and accessibility."
sidebar:
  order: 1
verified:
  commit: 26d86be7
  date: "2026-11-08"
---
# What the app does

A tour of the app for an engineer who has not opened it, traced to the code in `gurbani-soul-ios`
(the excerpt below is read at the pinned commit; the rest was checked against the app's `main`
on 2026-11-08, version 1.6.3). What each version added for readers is in the app's What's New
files, `docs/ios/whats-new/<version>.md`. Every screen reads through `CorpusActor`, the on-device equivalent of the
API ([app architecture](architecture.md)), and every verse it shows is verbatim, cited by [[Ang]].

## The tabs

The tab bar appears only after the [launch integrity check](db-pair-and-launch-integrity.md)
passes; until then the app shows a "Verifying" view, or a failure view that presents no scripture.
The app opens on **Nitnem**.

| Tab | What it is for | Main screens |
|---|---|---|
| **Nitnem** | The daily prayers: what to read now, today's progress, and the morning, evening, night, popular and ceremony sets. | Nitnem home (with a Hukam of the day card), bani reader, My Nitnem (reorder, hide or add banis), reminders, the reading journey (a month record of days read, which you can clear) |
| **Reader** | The Granth Ang by Ang, 1 to 1430, resuming where you left off. | Ang pages turned by the bottom page bar or a swipe ("Continues on Ang N" when a shabad carries over), Jump to Ang (type, scrub, step or pick a raag), reading options, Sehaj focus, Share this Ang, the Hukam |
| **Search** | Search and quotation checking. | Modes Auto, Gurmukhi, Roman, English (when the build has it), First letters, Theme and Verify; Verify accepts an optional Ang ("@712") |
| **Explore** | "The Granth Today": study views over the whole Granth. | Index, Themes, Lineage, Vaars, Constellation, Insights and the Raag Clock, each a card that previews what it opens (below) |
| **More** | Settings and the app's own facts. | Saved verses, settings, About (the integrity details), privacy policy, diagnostics |

Every verse row carries the same actions, from its context menu and as VoiceOver actions:
**Copy** (the Gurmukhi only), **Share** (the Gurmukhi, its citation and, since 1.5.2, a link to
`gurbanisoul.com/ang/N`, which unfurls as that Ang's card in messaging apps), **Share as card** (an
image: the verse as stored, cited by Ang), **Save**, and **Explore related**, which opens the trail
of related verses shown in bands of relatedness rather than raw scores. "Share Gurbani Soul"
sends `gurbanisoul.com`.

## Explore: The Granth Today

Since 1.5.0 the Explore tab is a hub (`ExploreScreen.swift`): a dated masthead, one featured card
that turns over each day with the Hukam's day, and a card for every other destination that previews
what it opens (the Ang last read, this watch's raags, today's theme and its verse, cited by Ang). On
an iPad the cards sit three across; at accessibility text sizes, one. The destinations:

| Destination | What it is |
|---|---|
| **Index** (Index 2.0, 1.4.9) | The Granth in its own order: the Granth Ribbon, a map of the whole saroop; a page for every raag (with "In this hour"); compositions with their printed rhythm; Continue; Find in Index; and a Forms tab of the poetic forms the printed headings name. The closing sections are named as printed (1.5.1). |
| **Themes** (Themes v2, 1.4.9) | A theme of the day, a page for every theme, a verse list that can be narrowed with true totals, and "Your themes", worked out on the phone from saved verses (it can be turned off). "Waheguru" names the theme, and every spelling finds it (1.5.0). |
| **Lineage** (Voices of the Granth, 1.4.9) | One count for each voice (36), a Voice page for every voice, the River timeline, the Voice of the day and Compare. |
| **Vaars** (Vaars v2, 1.4.9) | The 22 Vaars by voice; each Vaar's pauris and saloks woven as printed; a continuous reader with a pauris-only view that keeps your place. |
| **Constellation** (1.4.8) | Which themes a theme's verses also carry, with Focus, two rankings, the lenses, the Ang strip, the theme card, the pair sheet and the Sky, matching the website ([the Constellation](../website/constellation.md)). |
| **Insights** | Contributors, raags, theme network, resonance and flow, with the dot field, the Granth ribbon and Echoes. |
| **Raag Clock** | Below. |

Every sentence that explains rather than shows the text sits behind a scholar-review switch, which
was off when it shipped in 1.4.9.

## The Raag Clock

The Explore tab's clock shows which pahar (watch of the day) it is and the raags the traditions
assign to it. Since 1.5.0 the pahar ring and the clock face share one 12-hour geometry: the ring
shows the AM or PM half the hour hand is in, so every watch boundary, sunrise and sunset sits where
the hand points at that time, and the hour hand is the one "now". The same scale is used in
Explore's preview and the Raag now widget. It runs in **Fixed** mode (eight three-hour watches from 06:00; the midnight watch has no raags,
and says so) or **Solar** mode, the traditional reckoning: four equal watches of daylight and four
of night at your location, stretching with the season. Location is asked for only
when you choose "use my location" (when-in-use only), and only the coordinates rounded to two
decimal places are kept; you can also type them, and "Forget location" (from 1.4.0) removes them.
When the saved place is far from where the phone is, a **travel notice** (1.5.0) says whose sky the
clock shows; "Keep" silences it with one yes/no flag stored beside the rounded coordinates, which
clears when the place changes and with Forget location. A sheet shows where timing traditions disagree.
In the Reader, a timing chip on each Ang opens the clock at that raag.

## Widgets and the Live Activity

| Widget | Sizes | Shows | Refreshes | Tap opens |
|---|---|---|---|---|
| Raag now | small, medium, large, and the three Lock Screen sizes | the current pahar and its raags on the clock's own 12-hour face, following the Fixed or Solar setting; a widget keeps its own entry's time zone if the phone moves | every minute for three hours, then every fifteen minutes and at each pahar boundary | the Raag Clock |
| Hukam of the day | medium, large | one verse for the whole day, chosen by date (not the Hukamnama from Sri Harmandir Sahib), verbatim with its Ang | at each local midnight: the app writes two weeks of days ahead, so the verse turns whether or not the app is opened | that verse |
| Nitnem | small, medium, and the three Lock Screen sizes | the next bani and today's progress | at fixed points through the day | that bani, or the Nitnem tab |

A **Live Activity** (opt-in in settings) shows the bani being read and a percentage on the Lock
Screen and in the Dynamic Island; it never shows a verse. The widgets read only what the app writes
to the App Group ([privacy and on-device data](privacy-and-on-device-data.md)).

## Hukamnama · Sri Harmandir Sahib (TestFlight only)

The daily Hukamnama taken at Sri Harmandir Sahib, Amritsar, as a push, a sheet, a Nitnem card and
a widget (gurbani-soul-ios #127, #128, #130; checked against the app's `main` on 2026-11-12,
version 1.6.4). It is a separate feature from the Hukam of the day above, which it never replaces
and is never called. The server side is [the Hukamnama service](../architecture/hukamnama.md).

- **Where it ships.** Only in TestFlight builds: `testflight_archive.sh` switches it on for the
  `testflight` channel alone (`HUKAMNAMA_ENABLED=YES` and the `HUKAMNAMA_WIDGET` compilation
  condition), and those builds talk to the staging service. An App Store archive compiles it out
  while the G3 copy review (`docs/review/g3-hukamnama.md`, `REVIEWED: false`) is unsigned, which
  `HukamnamaGates` in `ios/tests/test_ios_gates.py` enforces. The privacy text and the App Store
  label (G4) must also change before it is switched on there.
- **Opt-in.** A toggle in Reminders asks for notification permission and registers the device
  (`PUT /v1/devices/<token>`): "as soon as it's published" or "at a time I choose" (a schedule of
  UTC slots built on the device; no zone name leaves it). Turning it off, or losing permission,
  deletes the registration. The line under the toggle reports today's delivery from the server's
  answer.
- **What is shown.** The push carries the date, the Ang and the opening verse the server copied
  from the corpus. The sheet reads the range from the app's own database and shows it only after
  the lines hash to `range_sha256`; otherwise it locates the shabad again by Ang and opening verse,
  or asks for an app update. No code path renders lines that failed the hash. Dates are the
  Amritsar date.
- **The Nitnem card** sits beside the Hukam of the day card and shows the Amritsar date and the
  Ang; the verse is read in the sheet.
- **The widget** (Home Screen small, medium and large, and the three Lock Screen sizes) is filled
  by the notification service extension, which writes the push into `hukamnama-snapshot.json` and
  reloads the widget without editing the notification. While today's Hukamnama is not yet published
  and only between 05:30 and 14:00 IST, the widget also makes one `GET /v1/hukamnama/today`. Its
  timeline has its own entries at Amritsar midnight, 05:30 and 14:00 IST, so it never shows an old
  verse as today's; a shabad that does not fit is not shown in part.
- **Links.** `sggs://hukamnama` and `sggs://hukamnama/yyyy-MM-dd` (a real date within ±400 days)
  open the sheet; a notification tap goes there.

## Siri, Shortcuts, Spotlight and links

- **App Intents** (`AppIntents.swift`): Today's Hukam, Draw a Hukam, What raag is it now, Read a
  bani (Japji Sahib by default), Read a Vaar, Search Gurbani, Open Ang, Show the constellation,
  Open a theme and Open a voice. All but Open Ang have Siri phrases; Open Ang is in Shortcuts only.
  The phrases are English.
- **Spotlight** indexes saved verses and the theme names (no personal data); tapping a verse opens
  its composition.
- **The `sggs://` scheme** (handled by `Router.handle`): `ang/N?line=`, `shabad/N?line=`,
  `bani/<key>?variant=`, `composition/<key>`, `raag/<name>`, `themes`, `theme/<slug>?term=&rahao=`,
  `vaars`, `vaar/<n>` (with `/read`, `?pauri=` or `?line=`), `constellation?theme=&with=&alone=`,
  `voice/<slug>`, `search?q=`, `hukam` (drawn afresh) or `hukam/today`, `nitnem`, and `clock` or
  `clock/<raag>`. A malformed value is ignored, never queried. Widgets, intents and reminder
  notifications all open the app this way.

<!-- sggs:code file="ios/App/Sources/Navigation/Router.swift" symbol="handle" repo="gurbani-soul-ios" -->
Source: `ios/App/Sources/Navigation/Router.swift` in gurbani-soul-ios, read at the pinned commit.

## Settings

| Setting | Default | Notes |
|---|---|---|
| Traditional saroop | on | A display form of the Gurmukhi; copy, share and VoiceOver use the verbatim text |
| Transliteration | on | |
| English translation | on | Only in a build that bundles English |
| Gurmukhi size | 24 | 18 to 32 |
| Appearance | system | system, light or dark |
| Accent | Soul Gold | five palettes ([brand](../engineering/brand.md)) |
| Rehras form | SGPC | or Taksal |
| Timing chip in the Reader | on | |
| Sehaj focus | off | only the Gurmukhi: the page bar, the tab bar and the raag banner step aside, and an "Exit Sehaj" chip brings them back; in its own card in the reading options |
| Line spacing, page tone | 0.4, paper | tone is paper, warm or night |
| Auto-scroll pace | steady | not offered with Reduce Motion or assistive technology |
| Live Activity | off | |
| Reminders | off | one per band, at 06:00, 18:00 and 21:30 by default; local notifications only |

## What the public build leaves out

The one build-time switch is the Hukamnama above, on in TestFlight builds only. Otherwise the app
looks at which tables its bundled database has and hides what is missing. The **public** profile, the one on the App Store, has no English layer, so
it has no English search mode, no English toggle and no translation credit. Timing and the banis
are gated the same way. See [the database pair](db-pair-and-launch-integrity.md) for the two
profiles and the licence gate that decides which may ship.

## The bani reader

Short-line banis (Jaap, Chaupai, Savaiye, Shabad Hazare Patshahi 10 and Aarti) read like a gutka
since 1.4.7 (`GutkaLayout.swift`): two half-lines to a row, centred, with the chhand headings of the
Sri Dasam Granth layer set bold and centred. A display repair lets Jaap pauris 79 and 80 draw
without a dotted circle; the stored text is unchanged, and the repair is flagged for scholar review.

## Accessibility

- VoiceOver reads the **verbatim** Gurmukhi tagged as Punjabi, never the saroop display form;
  transliteration is hidden from VoiceOver, and English is announced as "English translation".
- Gurmukhi scales with Dynamic Type. Two places cap it: the Reader's title and the Hukam widget.
- Reduce Motion is honoured in the reader, the clock and the controls.
- The Raag Clock's dial is decorative for VoiceOver; the list of pahars is the accessible path.
- The interface is in English only; there are no localisations yet. The website's Punjabi and
  French pages say so, and the app's links open the English pages.
