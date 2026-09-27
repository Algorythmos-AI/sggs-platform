---
title: "Privacy and on-device data"
description: "What the app stores and where, what the widgets see, why it makes no network request, what sharing sends, how data is deleted, and the tests behind 'Data Not Collected'."
sidebar:
  order: 3
verified:
  commit: 0f89c40f
  date: "2026-09-27"
---
# Privacy and on-device data

The App Store privacy label for Gurbani Soul is **Data Not Collected**. This page shows what that
rests on in the code of `gurbani-soul-ios` at the pinned commit: what the app keeps, where, and the
tests that fail if it starts to do more.

## Nothing leaves the device on its own

- **No network code.** The app contains no `URLSession`, `URLRequest`, web view or network
  connection, and a source gate fails the build if one appears. It has no third-party packages and
  no analytics or crash-reporting SDK.
- **No accounts, no tracking, no push.** The privacy manifest declares no tracking, no tracking
  domains and no collected data types. The only entitlement is the App Group the widgets share.
- **Two links out.** The privacy policy and support pages (`gurbanisoul.com/privacy`,
  `/support`) open in Safari, outside the app, only when tapped. A reminders screen can open the
  system Settings app. Every other link is an internal `sggs://` link.
- **Diagnostics stay local.** Crash and performance reports (MetricKit) are written to the app's
  own storage, at most 50, excluded from backups. They leave the device only if you share them from
  More, and More can delete them.

<!-- sggs:code file="ios/tests/test_ios_gates.py" symbol="test_no_network_code" repo="gurbani-soul-ios" -->
Source: `ios/tests/test_ios_gates.py` in gurbani-soul-ios, read at the pinned commit.

## What the app keeps

| Data | Where | Holds |
|---|---|---|
| The scripture database | the app bundle, read-only | the verbatim corpus; opened `mode=ro&immutable=1`, never written |
| Saved verses | a SwiftData store | per verse: the line id, its Gurmukhi and transliteration, Ang, composition id, and when you saved it |
| Nitnem progress | `nitnem-progress.json` in the App Group | per bani: where you stopped, when you last read, and the days you completed (at most 400) |
| My Nitnem | `nitnem-plan.json` in the App Group | your own sets: order, hidden and added banis |
| Widget snapshot | `widget-snapshot.json` in the App Group | a Hukam verse and its Ang, the pahar-to-raag tables, the clock mode and coordinates, the set names |
| Settings | the app's preferences | display and reader settings, the last Ang read, reminder times, and the launch-integrity cache |
| Clock settings | the App Group's preferences | the clock mode and, in Solar mode, your coordinates rounded to two decimal places (about a kilometre); the exact position is never stored |
| Spotlight | the system index | your saved verses only (Gurmukhi, transliteration, Ang), so system search can find them |
| Diagnostics | Application Support | MetricKit reports, as above |

The JSON files fall back to the app's own Application Support folder when the App Group is not
available. The saved-verses store is opened with SwiftData's default configuration; the code never
names its file or container. If it fails to open twice in a row, the app deletes and recreates it,
because a bookmark is a user annotation, never scripture
([the bookmarks ladder](db-pair-and-launch-integrity.md)).

## What the widgets see

The widget extension never opens the scripture database and writes nothing. It reads the snapshot
the app writes after each launch, the Nitnem progress file, and the two clock settings, all in the
App Group `group.org.sggs`. Everything it can show is already on the device.

## What leaves when you share

| Action | Sends |
|---|---|
| Copy | the verbatim Gurmukhi only |
| Share | the Gurmukhi and "— Sri Guru Granth Sahib Ji, Ang N" (or its source, for a non-SGGS line), as text |
| Share as card | an image of the verse, with the transliteration, the English if it is shown, and the Ang |
| Share diagnostics | the MetricKit reports, as files |

The app never reads the clipboard.

## Permissions

| Permission | Asked when | Used for |
|---|---|---|
| Location, while using the app | you choose "use my location" on the Raag Clock | computing sunrise and sunset for Solar mode |
| Notifications | you turn a Nitnem reminder on | local reminders; nothing is pushed from a server |

There is no background mode, no "always" location and no App Tracking Transparency prompt (the app
does not track); the gates test all three, the last through the manifest's "no tracking, nothing
collected" entries. Encryption is declared exempt (`ITSAppUsesNonExemptEncryption` is
false).

## The privacy manifest

`PrivacyInfo.xcprivacy` is bundled into the app and the widget extension. It declares two
required-reason APIs: UserDefaults (`CA92.1` for the app's own settings, `1C8F.1` for the App
Group) and file timestamps (`C617.1`, for the launch-integrity check, which reads the database's
size and modification date). A test keeps the manifest and the code in step.

<!-- sggs:code file="ios/App/Resources/PrivacyInfo.xcprivacy" lines="1-33" repo="gurbani-soul-ios" -->
Source: `ios/App/Resources/PrivacyInfo.xcprivacy` in gurbani-soul-ios, read at the pinned commit.

## Deleting data

- **A saved verse:** swipe to delete; its Spotlight entry goes with it.
- **Diagnostics:** More → Delete diagnostics.
- **My Nitnem:** Reset to default.
- **A bani's reading position:** Start again (the days completed are kept).
- **Everything:** delete the app. iOS removes its containers; the App Group goes with the last app
  that uses it.

## Known gaps

Found while writing this page; none of them sends data anywhere.

- There is no in-app way to clear the Nitnem completion history or the stored coordinates, short of
  deleting the app (the coordinates can be overwritten).
- When the saved-verses store is recreated after two failed opens, its Spotlight entries are not
  removed, so a search can show a verse that is no longer saved.
- The App Store review notes say the widget snapshot holds today's Nitnem progress; in the code,
  progress lives in its own file, which the widgets read directly.
