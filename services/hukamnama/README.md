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

Runtime is Python-stdlib only. Environment: `HUKAMNAMA_DB`, `HUKAMNAMA_STATE`, `PORT`.

`serve` refuses to start if the corpus fingerprint differs from the one recorded in the state
file. Published ranges are pinned to the corpus they were resolved in.

## API

| Route | Returns |
|---|---|
| `GET /v1/hukamnama/today` | `published` (range, opening verse from the corpus, hashes, citation, credit) or `pending` (with `expected_by`) |
| `GET /v1/hukamnama/YYYY-MM-DD` | one day, within ±400 days; a future date is 404 |
| `GET /v1/hukamnama?limit=N` | the latest published days, N in 1..30 |
| `GET /health` | today's status, the last poll, today's alerts, `scripture_sha256` (`no-store`) |

A day held by the gate is served as `pending`. There is no access log.

## Owner tools

```bash
python3 -m hukamnama approve 2026-11-09 --first-line 29237 --last-line 29247 --by <name> --reason "<why>"
python3 -m hukamnama hold    2026-11-09 --by <name> --reason "<why>"
python3 -m hukamnama show    2026-11-09
```

Both write to the `audit` table. An automatic publish never replaces an owner decision.

## Polling and alerts

- Polling runs every minute 05:00–09:00 IST, then every 10 minutes until 14:00 IST, using an
  honest User-Agent, `Cache-Control: no-cache` and ETag.
- Alerts, one per day and kind, are listed on `/health`:
  - `late`: nothing resolved by 07:00 IST
  - `not_published`: nothing by 14:00 IST
  - `held_no_match`: a settled page does not match the corpus
  - `held_veto`
  - `hs_layout_changed`
  - `hs_parse_failing`: 5 unparseable polls in a row
  - `changed_after_publish`
  - `veto_after_publish`

## Not in this PR (see the approved plan)

- Device registration and the APNs sender.
- The Render service definition. It needs an always-on instance and a persistent disk, which is a
  cost decision for the owner.
- Litestream backup and the external dead-man check.
- A 14-day staging soak with the fetch archive, before any push is enabled.
- Permission letters to SGPC and to the Khalis Foundation (BaniDB). BaniDB is not used: its terms
  allow personal, non-commercial use only.
