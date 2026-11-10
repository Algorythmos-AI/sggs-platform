# Hukamnama service

Locates the daily **Hukamnama from Sri Harmandir Sahib, Amritsar** (published by SGPC) inside the
pinned Sri Guru Granth Sahib Ji corpus and serves it as a range of corpus lines. It is the server
side of the Gurbani Soul "Hukamnama · Sri Harmandir Sahib" notification and widget. It is a
**different thing** from the app's *Hukam of the day*, which is chosen by date on the device.

This first part only **reads and decides**. Push delivery (APNs, device registration) is a later
PR; nothing here contacts a phone.

## The fidelity rule

SGPC's page is used **only to locate** the shabad. Every Gurmukhi character this service returns
comes from `lines.gurmukhi` in the pinned corpus. Two hashes prove it to a client:

| Field | Definition |
|---|---|
| `scripture_sha256` | sha256 over every line, in id order, of `id` `\0` `gurmukhi` `\n`. This is byte-identical to the iOS DB manifest's value, so equal values mean the same ids carry the same text. |
| `range_sha256` | sha256 of the range's `gurmukhi` lines joined by `\n` (UTF-8). The phone recomputes it before it renders. |

A day publishes automatically only when **all** of these hold. Anything else waits, or is held for
the owner; a late Hukamnama is acceptable and a wrong one is not.

1. hs.sgpc.net parses into one complete Gurmukhi card. The page's own date stamp must be today's
   **Amritsar** date (`clock.amritsar_date`; IST is a fixed UTC+05:30 offset).
2. Its verse words equal, word for word, a run of consecutive corpus lines that starts on a verse,
   lies within one Ang of SGPC's Ang, and ends where a composition ends (the next line is a heading
   or a new `comp_id`). There is no fuzzy tier.
3. The same resolution has been seen in an unbroken run of polls lasting at least 2 minutes, so a
   page saved half-way never publishes.
4. The sgpc.net Mukhwak marquee, if it already shows today, agrees (Ang + opening words). If it
   still shows yesterday, or cannot be reached, it is not waited for.

The locate key (`hukamnama/locate.py`) is: NFC; drop zero-width characters; read U+0A51 (udaat) as
U+0A4D U+0A39 (subjoined ha); treat dandas as separators; drop verse numbers in verse bodies (keep
them in headings). SGPC writes subjoined ha with U+0A51, a legacy-font conversion; the corpus never
contains it, and a test proves so.

**Proof over the whole Granth.** `tests/test_corpus.py` writes every composition the way SGPC
writes it (one paragraph, U+0A51 for subjoined ha, the heading without the space before the
double danda) and resolves it:

| Set | Exact | Held | Wrong |
|---|---|---|---|
| All compositions | 4,519 | 9 | **0** |
| Vaar units (saloks + pauri) | 462 | 9 | **0** |

The held cases are whole long banis, and pauri units whose `vaar_units.n_lines` stops short. They
go to the owner.

After a publish, the service keeps reading both pages for 2 hours. A change raises an alert and is
**never** applied automatically.

## Run

```bash
make dataset                                   # the pinned scripture DB (repo root)
cd services/hukamnama
python3 -m hukamnama --db ../../db/sggs.sqlite --state /tmp/hk.sqlite serve --port 8080
python3 -m hukamnama --db ../../db/sggs.sqlite --state /tmp/hk.sqlite tick --force   # one poll
python3 -m unittest discover -s tests -t .     # or: make test-hukamnama (repo root)
```

Runtime is Python-stdlib only. Environment: `HUKAMNAMA_DB`, `HUKAMNAMA_STATE`, `HUKAMNAMA_ARCHIVE`
(keep every distinct page fetched, for replay; `hukamnama/archive.py`), `HUKAMNAMA_COMMIT`, `PORT`.

**Deployed** as the Render service `sggs-hukamnama-staging` (Docker, `services/hukamnama/Dockerfile`,
1 GB disk at `/var/data`) by `.github/workflows/hukamnama-deploy.yml`, watched from outside by
`hukamnama-deadman.yml`. Setup and operations: `docs/process/runbooks/hukamnama-service.md`.

`serve` refuses to start if the corpus fingerprint differs from the one recorded in the state
file. Published ranges are pinned to the corpus they were resolved in.

## API

| Route | Returns |
|---|---|
| `GET /v1/hukamnama/today` | `published` (range, opening verse from the corpus, hashes, citation, credit) or `pending` (with `expected_by`) |
| `GET /v1/hukamnama/YYYY-MM-DD` | one day, within ±400 days; a future date is 404 |
| `GET /v1/hukamnama?limit=N` | the latest published days, N in 1..30 |
| `GET /health` | today's status, the last poll, today's alerts, `scripture_sha256`, and `push` (sending on/off, device counts by mode, today's send states) (`no-store`) |
| `PUT /v1/devices/<token>` | opt a device in: `{env, mode: asap\|scheduled, schedule?, scripture_sha256?, replaces?}`, at most 1 KB; `replaces` deletes the rotated-away token in the same transaction |
| `DELETE /v1/devices/<token>` | opt out: the row is deleted (404 when it was already gone; the app treats that as done) |

A day held by the gate is served as `pending`. There is no access log. Device writes are rate
limited per client address (in memory only, one minute) and new devices are capped per hour
(`device_flood` alert). Nothing about a reader is stored beyond the token, its APNs environment,
the mode, the UTC slot schedule and the corpus fingerprint.

## Push

Off unless `HUKAMNAMA_SEND=on`, which needs the APNs Auth Key (`HUKAMNAMA_APNS_KEY_FILE`,
`HUKAMNAMA_APNS_KEY_ID`, `HUKAMNAMA_APNS_TEAM_ID`); without a usable key the service refuses to
start. `push.py`:

- **What is sent** is built only from the published decision, so every Gurmukhi character is the
  corpus's. Its shape equals the app's `hukamnama.apns` fixture (`tests/fixtures/ios-hukamnama.apns`,
  copied from gurbani-soul-ios; `test_payload_equals_the_apps_fixture`).
- **When:** `asap` devices are queued the moment a day is published (within 6 h; a device first
  registered after the publish waits for tomorrow). `scheduled` devices at their own UTC slot,
  from the schedule entry in force on that day; a slot that came before the publish gets it at
  publish time when within 6 h. Never a day older than yesterday.
- **Durable:** each send is a row (`queued → inflight → sent | failed | suspect | gone`); a row
  left inflight for 2 minutes is sent again after a restart, and `apns-collapse-id:
  hukamnama-<date>` collapses repeats on the phone. `apns-expiration` is the next 05:00 IST.
- **APNs responses:** 200 sent; 410 deletes only when Apple's timestamp is newer than the last
  registration; `BadDeviceToken`/`DeviceTokenNotForTopic` retries the other environment once
  (and corrects it on success), else counts a suspect day and deletes after 3 separate days; 429
  is not retried that day; 5xx and network errors back off (5 attempts); 403
  `ExpiredProviderToken` rebuilds the provider token once; 413 or any other 403 stops the run with
  an alert. One provider token is minted per 40 minutes.
- **Circuit breaker:** more than 5% 4xx among the first 200 results (at least 20) stops the
  day's run (`push_breaker`) and deletes nothing. Deletions happen only after a day's run
  finishes untripped.
- Devices that have not re-registered for 180 days are pruned (the app re-registers daily when
  opened).

## Owner tools

```bash
python3 -m hukamnama approve 2026-11-09 --first-line 29237 --last-line 29247 --by <name> --reason "<why>"
python3 -m hukamnama hold    2026-11-09 --by <name> --reason "<why>"
python3 -m hukamnama show    2026-11-09
python3 -m hukamnama resend  2026-11-09 --by <name> --reason "<why>"   # push the day again (a correction)
```

They write to the `audit` table. Approving a held day publishes it at that moment, so `asap`
devices get it then; `resend` re-queues a day already sent (the same collapse id replaces the
first notification on the phone). An automatic publish never replaces an owner decision.

## Polling and alerts

- Polling runs every minute 05:00–09:00 IST, then every 10 minutes until 14:00 IST, using an
  honest User-Agent, `Cache-Control: no-cache` and ETag.
- Alerts, one per day and kind, are listed on `/health`:
  - `late`: nothing resolved by 07:00 IST
  - `not_published`: nothing by 14:00 IST
  - `held_no_match`: a settled page does not match the corpus. When one run of corpus lines with
    the page's word count differs in at most 3 words, the alert names it and the words, e.g.
    `nearest run lines 29433-29442 differs in 1 word: word 79/81 ਨਾਨਕੁ (source) vs ਨਾਨਕ (corpus)`.
    That is a diagnosis for the owner, never a decision: the day stays held.
  - `held_veto`
  - `hs_layout_changed`
  - `hs_parse_failing`: 5 unparseable polls in a row
  - `changed_after_publish`
  - `veto_after_publish`

## Not yet

- The R2 copy of the fetch archive.
- BaniDB is not used: its terms allow personal, non-commercial use only. (SGPC's own pages are the
  source; the owner confirmed on 2026-11-11 that SGPC does not object to sharing the Hukamnama.)
