---
title: "Lineage roster v2: editorial recommendations for the reviewer"
description: "The evidence and an editorial recommendation for each of the 36 life paragraphs and the roster pack's six questions, for the G3 reviewer to rule on."
sidebar:
  order: 2
---
# Lineage roster v2: editorial recommendations for the reviewer

**Status: recommendations only. Nothing here is a ruling.** This page sits beside the roster review pack
([`lineage-roster-v2.md`](./lineage-roster-v2.md)). It gives the evidence and an editorial recommendation
for each life paragraph (R-01 to R-36 in the app's G3 1.4.9 pack) and for the pack's six questions. The G3
reviewer decides every item.

- No `review.status` changes.
- No field of `frontend/public/contributors.json` changes.
- Recorded on 2026-10-27 · Algorythmos · Gurbani Soul editorial.

The rest of the G3 1.4.9 review is on two companion pages:

- the app's pack, [`gurbani-soul-ios` `docs/review/g3-1.4.9/RECOMMENDATIONS.md`](https://github.com/Algorythmos-AI/gurbani-soul-ios/pull/111);
- the dataset decisions, [`sggs-data` `validation/attribution-g3-review/RECOMMENDATIONS.md`](https://github.com/Algorythmos-AI/sggs-data/pull/18).

## How the evidence was gathered

- **The Encyclopaedia of Sikhism (EoS).** Its online edition could not be opened while this page was
  prepared. Where the roster rests on an EoS entry, that entry is cited "as cited in the roster". It is
  not quoted.
- **Prof. Sahib Singh ("SS").** His notes in the *Darpan* often carry short lives of the Bhagats and the
  Bhatts. They were read line by line from the ShabadOS 4.8.7 database (sha256 `d8e07134…`, verified),
  together with the *Faridkot Teeka* ("FDK").
  - Excerpts are verbatim. Some notes are cut short in the database itself, so where an excerpt stops
    mid-sentence, the source stops there.
  - Where SS is quoting a writer he disagrees with (`ਭਗਤ-ਬਾਣੀ ਦੇ ਵਿਰੋਧੀ ਸੱਜਣ`), this page says so. Those
    facts are the other writer's, not his.
- **The text.** Every Gurmukhi verse was read from the sggs-data database by line id and carries its Ang.
- **Web searches.** A fact seen only in a web search result is marked **"search snippet only — Granthi
  to verify"**, with its URL.
- **"Confidence"** is editorial: *high*, *medium*, or *Granthi to verify*.

## At a glance

| Item | Recommendation |
|---|---|
| How many Bhatts? | Keep 11 named Bhatts and the collective entry. Add ਟਲ to Kalsahar's signatures and name the variant. |
| Bhai Mardana | Show the three saloks at Ang 553 under Guru Nanak Dev Ji. Keep Mardana in the roster, with the EoS view stated. |
| Bhagat Surdas | Confirm: one line is his, and the shabad headed `ਸਾਰੰਗ ਮਹਲਾ ੫ ਸੂਰਦਾਸ` is Guru Arjan's. |
| Raagmala | No author ("authorship disputed"). |
| Japji Sahib | Guru Nanak Dev Ji. |
| Gurmukhi forms | Approve. Make the English of Balh, Bhalh, Nalh and Salh agree with the text. |
| **Change** | R-01, R-05, R-07, R-09, R-13, R-14, R-15, **R-16 (a factual error)**, R-17, R-18, R-19, R-20, R-25 and R-32. Romanisation only: R-26, R-31, R-33 and R-35. |
| **Approve as written** | All other R items. |

---

## Questions for the scholar

### Q-Bhatts · How many Bhatts, and the ਟਲ signature

**Finding.** The roster's choice (the corpus's 11 named Bhatts plus a collective entry) follows Sahib Singh and
Teja Singh, and Sahib Singh's own notes support it. Sahib Singh counts Swaiyye per Bhatt and gives eleven names. He
reads ਟਲ as another name of Kalsahar, not as a separate Bhatt Tal.

**Evidence.**
- Corpus, the ਟਲ verse: `ਸੁ ਕਹੁ ਟਲ ਗੁਰੁ ਸੇਵੀਐ ਅਹਿਨਿਸਿ ਸਹਜਿ ਸੁਭਾਇ ॥` (line 59315, Ang 1392). The corpus credits it to
  Bhatt Kalsahar; ShabadOS writer "Bhatt Kalh Sahar".
- Sahib Singh note on line 59316, Ang 1392: `ਇਹਨਾਂ ੧੫ ਸਵਈਆਂ ਦਾ ਕਰਤਾ ਭੱਟ 'ਕਲ੍ਯ੍ਯਸਹਾਰ' ਹੈ, ਜਿਸ ਦੇ ਦੂਜੇ ਨਾਮ 'ਕਲ੍ਯ੍ਯ' ਅਤੇ 'ਟਲ੍ਯ੍ਯ' ਹਨ।`
- Sahib Singh note on line 59798, Ang 1407: `ਸੋ 'ਕਲ੍ਯ੍ਯਸਹਾਰ' ਤੇ 'ਕਲ੍ਯ੍ਯ' ਇਕੋ ਹੀ ਕਵੀ ਹੈ।`
- Sahib Singh's tallies (notes on Angs 1392–1409): Kalsahar 10 + 10 + 9 + 13 + 12 = 54 (note on line 59867,
  Ang 1409: `(੧) ਕਲ੍ਯ੍ਯਸਹਾਰ . . ੧੦ . . ੧੦ . . ੯ . . ੧੩ . . ੧੨ . . = ੫੪`); Jalap 5; Kirat 4 + 4; Bhikha 2; Salh 1 (to
  Guru Amar Das); Bhalh 1; Nalh 16; Gayand 13; Mathura 7 + 7; Balh 5; Haribans 2. Total of the Bhatt sections per his note:
  `ਕੁੱਲ ਜੋੜ = ੧੪੩` (with the 20 Swaiyye of Guru Arjan himself counted in). The note is cut off in the database
  after `(੩) ਕੀਰਤ . . ੪`.
- EoS (Bhatt Bani) as cited in the roster: 11 (Sahib Singh, Teja Singh), 17 (Santokh Singh, Bhai Vir Singh),
  19 (Kartar Singh Dakha).
- Search snippet only — Granthi to verify: the same three counts and the usual list of 11.
  https://www.sikhiwiki.org/index.php/Bhatt_Bani ; https://searchgurbani.com/bhatts

**Where sources differ.** 11 / 17 / 19. Under the 17-count, ਟਲ is a separate Bhatt (Tal). Sahib Singh reads it as
Kalsahar.

**Recommended ruling.** Keep 11 named Bhatts plus the collective entry. Do not show the 17-count names as voices.
Add ਟਲ to Kalsahar's `chhap` list (it is a signature in his Swaiyye) and state the variant once in his `disputed`
line. Suggested `disputed` addition for R-25: "His Swaiyye also sign ਟਲ; Sahib Singh reads it as another name of
Kalsahar, while the 17-Bhatt count treats it as a separate Bhatt, Tal."

**Confidence.** high (that Sahib Singh supports the roster's choice); the ruling itself is the Granthi's.

### Roster question · Bhai Mardana (Ang 553, saloks headed `ਮਰਦਾਨਾ ੧`)

**Finding.** Three saloks in Bihagre ki Vaar (lines 24461–24475) are headed `ਸਲੋਕੁ ਮਰਦਾਨਾ ੧ ॥` (line 24461, Ang 553) and `ਮਰਦਾਨਾ ੧ ॥` (line 24468, Ang 553). The dataset credits them to "Bhai Mardana".

- ShabadOS, Sahib Singh and the Faridkot Teeka all read them as **Guru Nanak Dev Ji's**, addressed to Mardana.
- The Encyclopaedia of Sikhism is reported to credit **one** salok to Mardana. This was seen in a search snippet only.

Saloks 1 and 2 sign ਨਾਨਕ / ਨਾਨਕਾ:

- `ਗੁਰਮੁਖਿ ਪਾਈਐ ਨਾਨਕਾ ਖਾਧੈ ਜਾਹਿ ਬਿਕਾਰ ॥੧॥` (line 24467, Ang 553)
- `ਨਾਨਕ ਇਹੁ ਭੋਜਨੁ ਸਚੁ ਹੈ ਸਚੁ ਨਾਮੁ ਆਧਾਰੁ ॥੨॥` (line 24473, Ang 553)

The third salok, ending `ਸਤਸੰਗਤਿ ਸਿਉ ਮੇਲਾਪੁ ਹੋਇ ਲਿਵ ਕਟੋਰੀ ਅੰਮ੍ਰਿਤ ਭਰੀ ਪੀ ਪੀ ਕਟਹਿ ਬਿਕਾਰ ॥੩॥` (line 24475, Ang 553), carries no signature and no heading of its own in the corpus.

**Evidence.**
- **Prof. Sahib Singh, Darpan, note at line 24467 (via ShabadOS 4.8.7).** `ਭਾ: ਮਰਦਾਨਾ ਆਪਣੀ ਕਿਸੇ ਰਚਨਾ ਵਿਚ ਲਫ਼ਜ਼ 'ਨਾਨਕ' ਨਹੀਂ ਸੀ ਵਰਤ ਸਕਦਾ। ਸਲੋਕ ਮ: ੧ ਹੈ ਅਤੇ ਮਰਦਾਨੇ ਨੂੰ ਸੰਬੋਧਨ ਕੀਤਾ ਹੈ। ਤਿੰਨੇ ਹੀ ਸਲੋਕ ਮ: ੧ ਦੇ ਹਨ।`
  - Gist: Mardana could not have used the name ਨਾਨਕ. The salok is M1, addressed to Mardana, and all three saloks are M1's.
- **Faridkot Teeka, line 24460.** `☬ਇਸ ਸਲੋਕ ਮੇਂ ਸ੍ਰੀ ਗੁਰੂ ਜੀ ਮਰਦਾਨੇ ਕੇ ਪੂਛਨੇ ਸੇ ਤਿਸ ਕੇ ਪ੍ਰਤਿ ਗੁਰਮੁਖਤਾ ਅਰੁ ਮਨਮੁਖਤਾ ਕੀ ਮਦਰਾ ਕਾ ਰੂਪੁ ਬਰਨਨ ਕਰਤੇ ਹੈਂ`
  - Gist: in this salok the Guru, asked by Mardana, describes to him the "wine" of the gurmukh and of the manmukh.
- **Faridkot Teeka, line 24471.** `ਸ੍ਰੀ ਗੁਰੂ ਜੀ ਕਹਤੇ ਹੈਂ: ਹੇ ਮਰਦਾਨਾ!`
  - Gist: "The Guru says: O Mardana!"
- **ShabadOS 4.8.7.** Writer **Guru Nanak Dev Ji** for BaniDB ids 2114 (salok 1) and 2115 (saloks 2 and 3). ShabadOS puts the third salok in the same record as the second.
- **Repo.**
  - `attribution_ledger.json`, entry `mardana` (status `proposed`), proposes Bhai Mardana → Guru Nanak Dev Ji (M1).
  - `shabados_crosscheck_flags.json`, key `mardana-saloks`, leaves the lines "unchanged for the scholar".
- **Encyclopaedia of Sikhism, "Bihagre ki Var" entry (https://eos.learnpunjabi.org/BIHAGRE%20KI%20VAR.html).** Reported as saying that of the Vaar's 43 saloks, "four [are] by Gurū Nānak … one by Kabīr and one by Mardānā." Search snippet only — Granthi to verify. The snippet does not say which of the three saloks it gives to Mardana.
- **Corpus structure (observation).** Line 24468 `ਮਰਦਾਨਾ ੧ ॥` is stored as a verse (`is_header = 0`) while line 24461 is a heading. All three saloks share comp 2170. This is the same kind of label issue as A-10.

**Where sources differ.**
- Sahib Singh, the Faridkot Teeka and ShabadOS credit all three saloks to Guru Nanak Dev Ji.
- The EoS, as reported in a search snippet and in the roster pack, credits one salok to Bhai Mardana.
- The corpus fact that only the third salok lacks ਨਾਨਕ fits the EoS reading if that is the salok it means. This is not confirmed.

**Recommended ruling.** Show the saloks under Guru Nanak Dev Ji, and keep Bhai Mardana in the roster as the Guru's companion and the person addressed, with the EoS view stated in R-22's *Where sources differ*. Sahib Singh's reason (the lines sign ਨਾਨਕ), the Faridkot Teeka and ShabadOS agree, and the opposing view rests on one encyclopedia entry that could not be read here.

**Suggested wording (if Change).** For R-22 *Where sources differ*: `The three saloks at Ang 553 headed ਮਰਦਾਨਾ ੧ are read by Prof. Sahib Singh and the Faridkot Teeka as Guru Nanak's, addressed to Mardana; the Encyclopaedia of Sikhism credits one of them to Mardana.`

**Confidence.** Granthi to verify

### Q-Surdas · One line, and the shabad headed `ਸਾਰੰਗ ਮਹਲਾ ੫ ਸੂਰਦਾਸ`

**Finding.** Sahib Singh's note supports the roster on every point: the single line is Surdas's; the shabad after
it is Guru Arjan's; in the shabad count the one line is counted as a whole shabad; some scholars hold there were
two Surdases. The biographical facts in R-21 (Brahmin, born Sammat 1586, real name Madan Mohan, governor of
Sandila) appear in Sahib Singh's note **only as the words of a writer he is answering**, not as his own view.
Sammat 1586 Bikrami is 1529 CE, which matches the EoS year in the roster.

The roster's `attribution_note` says "The corpus files his single line ... under Namdev". That is accurate for
the dataset the platform pins today (`sggs-data` 1.2.0). It becomes out of date when A-07 is approved: the held
dataset 1.3.0 credits line 53935 to Bhagat Surdas Ji, as ShabadOS does.

**Evidence.**
- Corpus: `ਛਾਡਿ ਮਨ ਹਰਿ ਬਿਮੁਖਨ ਕੋ ਸੰਗੁ ॥` (line 53935, Ang 1253), author Bhagat Surdas Ji; header
  `ਸਾਰੰਗ ਮਹਲਾ ੫ ਸੂਰਦਾਸ ॥` (line 53936, Ang 1253), author Guru Arjan Dev Ji (M5); closing verse
  `ਸੂਰਦਾਸ ਮਨੁ ਪ੍ਰਭਿ ਹਥਿ ਲੀਨੋ ਦੀਨੋ ਇਹੁ ਪਰਲੋਕ ॥੨॥੧॥੮॥` (line 53943, Ang 1253).
- Sahib Singh note on line 53943, Ang 1253: `ਲਫ਼ਜ਼ 'ਮਹਲਾ ੫' ਤੋਂ ਜ਼ਾਹਰ ਹੁੰਦਾ ਹੈ ਕਿ ਇਹ ਸ਼ਬਦ ਗੁਰੂ ਅਰਜਨ ਸਾਹਿਬ ਜੀ ਦਾ ਹੈ। ... ਭਾਵੇਂ ਭਗਤ ਸੂਰਦਾਸ ਜੀ ਦੀ ਇਕੋ ਹੀ ਤੁਕ ਦਰਜ ਕੀਤੀ ਹੈ, ਪਰ ਗਿਣਤੀ ਵਿਚ ਉਸ ਨੂੰ ਸਾਰੇ ਸ਼ਬਦ ਵਾਂਗ ਗਿਣਿਆ ਹੈ; ... ਕਈ ਵਿਦਵਾਨਾਂ ਦਾ ਖ਼ਿਆਲ ਹੈ ਕਿ ਦੋ ਸੂਰਦਾਸ ਹੋਏ ਹਨ, ਪਰ ਜਿਹੜਾ ਭੀ ਹੈ ਉਸ ਦੀ ਸਿਰਫ਼ ਇਕੋ ਤੁਕ ਗੁਰੂ ਗ੍ਰੰਥ ਸਾਹਿਬ ਵਿਚ ਦਰਜ ਹੈ। ਇਹ ਸ਼ਬਦ ਸਤਿਗੁਰੂ ਅਰਜਨ ਸਾਹਿਬ ਜੀ ਦਾ ਆਪਣਾ ਹੈ। ਸੂਰਦਾਸ ਦਾ ਨਹੀਂ।`
  The same note then quotes the other writer: `'ਭਗਤ ਸੂਰਦਾਸ ਜੀ ਜ਼ਾਤ ਦੇ ਬ੍ਰਾਹਮਣ ਸਨ। ਆਪ ਦਾ ਜਨਮ ਸੰਮਤ ੧੫੮੬ ਬਿ: ਦਾ ਪਤਾ ਲੱਗਦਾ ਹੈ। ਇਹਨਾਂ ਦਾ ਅਸਲ ਨਾਮ ਮਦਨ ਮੋਹਨ ਸੀ, ਪਹਿਲਾਂ ਆਪ ਸੰਧੀਲਾ ਦੇ ਹਾਕਮ ਰਹੇ। ...`
- EoS (Sūrdās) as cited in the roster: born 1529, died at Banaras, distinct from the blind poet of the Sur Sagar.
- Search snippet only — Granthi to verify: same facts. https://www.allaboutsikhs.com/sikh-bhagats-bhagat-surdas-ji

**Where sources differ.** Only on whether there were one or two Surdases; and the other writer (quoted by Sahib
Singh) says two Surdas shabads stand in Sarang, one complete, which Sahib Singh rejects.

**Recommended ruling.** Confirm the roster: the shabad headed `ਸਾਰੰਗ ਮਹਲਾ ੫ ਸੂਰਦਾਸ` is Guru Arjan's. Update the
roster's `attribution_note` in the same release that takes dataset 1.3.0 (A-07).

**Confidence.** high.

### Roster question · Raagmala (Angs 1429–1430) authorship

**Finding.** Raagmala (lines 60597–60658) carries no Mahalla in its printed caption: `ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ ॥` (line 60597, Ang 1429), then `ਰਾਗ ਮਾਲਾ ॥` (line 60598, Ang 1429). The dataset's Guru Arjan Dev Ji (M5) tag comes from the Mundavani (`ਮੁੰਦਾਵਣੀ ਮਹਲਾ ੫ ॥`, line 60586) and the `ਸਲੋਕ ਮਹਲਾ ੫ ॥` (line 60592) before it, not from anything printed on Raagmala itself. ShabadOS credits a different author, and the major Punjabi commentaries in the evidence set do not comment on it at all.

**Evidence.**
- **ShabadOS 4.8.7.** All 62 lines form BaniDB id 5540, writer **Poet Alam**.
- **Commentary coverage (count over lines 60597–60658 in ShabadOS 4.8.7).** Only Dr. Sant Singh Khalsa's English rendering is present. There is no Prof. Sahib Singh Darpan arth, no Faridkot Teeka and no Bhai Manmohan Singh text on any Raagmala line. By contrast, all three cover the Mundavani and the salok M5 before it.
- **Faridkot Teeka, line 60592, on the salok M5 before Raagmala.** `ਸ੍ਰੀ ਗੁਰੂ ਅਰਜਨ ਦੇਵ ਜੀ ਸ੍ਰੀ ਗੁਰੂ ਗ੍ਰੰਥ ਸਾਹਿਬ ਜੀ ਕੀ ਸਮਾਪਤੀ ਪਰ ਬੇਨਤੀ ਕਰਤੇ ਹੈਂ:`
  - Gist: the Teeka treats that salok as Guru Arjan's prayer at the **completion** of the Granth.
- **Repo.**
  - `attribution_ledger.json`, entry `raagmala` (status `proposed`), proposes leaving it unattributed (`to: null`) and describing the dispute.
  - `shabados_crosscheck_flags.json`, key `raagmala`: "Neither is settled."
- **Encyclopaedia of Sikhism, "Ragmala" (https://eos.learnpunjabi.org/RAGMALA.html).** Reported as saying the composition is in the Kartarpur volume and that "by consensus, Rāgmālā is taken to be part of the Sacred Text". Search snippet only — Granthi to verify.
- **Sikh Rehat Maryada.** Reported as allowing a complete reading to end with either Mundavani or Raagmala, "according to the custom", noting a difference of opinion in the Panth. Seen in search-result summaries (e.g. https://en.wikipedia.org/wiki/R%C4%81gmala_(Sikhism)). Search snippet only — Granthi to verify against the printed Rehat Maryada.

**Where sources differ.**
- The dataset says Guru Arjan Dev Ji (M5), inherited from Mundavani.
- ShabadOS says Poet Alam.
- The EoS (snippet) treats Raagmala as part of the Sacred Text without naming an author in the text retrieved.
- The Rehat Maryada (snippet) records a difference of opinion.
- Sahib Singh and the Faridkot Teeka are silent.

**Recommended ruling.** Change: remove the Guru Arjan Dev Ji (M5) credit and show Raagmala with no author ("authorship disputed"). No Mahalla is printed on it, the M5 tag is inherited from Mundavani, and the sources disagree. This is the ledger's own `raagmala` proposal.

**Suggested wording (if Change).** "Raagmala carries no Mahalla in its heading, and its authorship is disputed. The app shows it without an author."

**Confidence.** Granthi to verify

### Roster question · Japji Sahib author (Angs 1–8)

**Finding.** In the held 1.3.0 build, lines 1–385 carry Guru Nanak Dev Ji (M1), from `attribution_ledger.json` entry `japji` (status `approved`). Before that repair the field was empty, because no Mahalla is printed at Ang 1. Every source checked credits the Bani to Guru Nanak Dev Ji.

**Evidence.**
- **ShabadOS 4.8.7.** Writer **Guru Nanak Dev Ji** for Mool Mantar and Japji (BaniDB id 1) and for the closing salok (BaniDB id 39).
- **Prof. Sahib Singh, Darpan, note at line 4 (via ShabadOS 4.8.7).** `ਇਸ ਵਿਚ ਗੁਰੂ ਨਾਨਕ ਦੇਵ ਜੀ ਨੇ ਆਪਣੇ ਇਸ਼ਟ ਦਾ ਸਰੂਪ ਬਿਆਨ ਕੀਤਾ ਹੈ`
  - Gist: in the opening salok Guru Nanak describes the One he worships.
- **Prof. Sahib Singh, note at line 378.** `ਅਗਲੇ ਅਖ਼ੀਰਲੇ ਸਲੋਕ ਵਿਚ ਸਾਰੀ ਬਾਣੀ 'ਜਪੁ' ਦਾ ਸਿਧਾਂਤ ਦੱਸਿਆ ਹੈ।`
  - Gist: he treats the closing salok as part of Japji.
- **Faridkot Teeka, line 4.** `ਸ੍ਰੀ ਗੁਰੂ ਨਾਨਕ ਜੀ ਕਹਤੇ ਹੈਂ:`
  - Gist: "Sri Guru Nanak Ji says".
- **Prof. Sahib Singh, note at line 1.** `ਇਹ ਮੂਲ-ਮੰਤਰ ਵੱਖਰੀ ਚੀਜ਼ ਹੈ ਤੇ ਬਾਣੀ 'ਜਪੁ' ਵੱਖਰੀ ਹੈ।`
  - Gist: the Mool Mantar is distinct from the Bani "Japu". This bears on grouping only, not on authorship.
- **Corpus facts.** Lines 1–378 form comp 2 and include the Mool Mantar (line 1) and `॥ ਜਪੁ ॥` (line 2). The closing salok (lines 379–385) is comp 13. Japji closes with `ਨਾਨਕ ਤੇ ਮੁਖ ਉਜਲੇ ਕੇਤੀ ਛੁਟੀ ਨਾਲਿ ॥੧॥` (line 385, Ang 8).

**Where sources differ.** Only on the closing salok. It appears again at Ang 146 under `ਮਃ ੨ ॥` (line 6062, Ang 146), with variant readings ending `ਨਾਨਕ ਤੇ ਮੁਖ ਉਜਲੇ ਹੋਰ ਕੇਤੀ ਛੁਟੀ ਨਾਲਿ ॥੨॥` (line 6068, Ang 146).

- ShabadOS credits that occurrence to **Guru Angad Dev Ji** (BaniDB id 421).
- Sahib Singh's note there says only `ਇਹ ਸਲੋਕ 'ਜਪੁ ਜੀ' ਦੇ ਅਖ਼ੀਰ ਵਿਚ ਆ ਚੁਕਿਆ ਹੈ।` ("This salok has already come at the end of Japji.")
- The ledger records this as a flagged review point.

**Recommended ruling.** Confirm Guru Nanak Dev Ji (M1) as the author of Japji Sahib (lines 1–385). The sources agree. The Ang 146 occurrence of the closing salok can stay under ਮਃ ੨, as printed there.

**Suggested wording (if Change).** Not applicable. Optional note: "The closing salok also appears at Ang 146 under Mahalla 2, with small variant readings."

**Confidence.** high

### Q-Gurmukhi · The Gurmukhi forms of the names

**Finding.** Every form matches the spelling the Granth itself uses for the name, with three points for the Granthi:
1. **Bhatt names with ੍ਹ.** Gurmukhi gives `ਭੱਟ ਬਲ੍ਹ ਜੀ`, `ਭੱਟ ਭਲ੍ਹ ਜੀ`, `ਭੱਟ ਨਲ੍ਹ ਜੀ`, `ਭੱਟ ਸਲ੍ਹ ਜੀ` (modern; the Granth writes
   `ਬਲ੍ਯ੍ਯ`, `ਭਲ੍ਯ੍ਯ`, `ਨਲ੍ਯ੍ਯ`, `ਸਲ੍ਯ੍ਯ`). The English display names drop the h (`Bal`, `Bhal`, `Nal`, `Sal`) but the
   contexts write `Balh`, `Bhalh`, `Nalh`, `Salh`, and Kalsahar's context writes `Kalh`. Pick one romanisation. Recommend
   `Balh`, `Bhalh`, `Nalh`, `Salh` throughout, which matches the ੍ਹ in the Gurmukhi.
2. **Sain.** `ਭਗਤ ਸੈਣ ਜੀ` follows the heading `ਸ੍ਰੀ ਸੈਣੁ ॥` (line 30081, Ang 695); his signature is `ਸੈਨੁ` (line 30091). Both
   spellings are in the Granth. ਸੈਣ is acceptable.
3. **Trilochan.** `ਤ੍ਰਿਲੋਚਨ` follows his own signature; Ravidas writes `ਤਿਲੋਚਨੁ` (line 47545, Ang 1106). Acceptable as is.
Also consistent: Guru Amar Das and Guru Ram Das are joined (`ਅਮਰਦਾਸ`, `ਰਾਮਦਾਸ`), the others spaced; this is common
modern usage and need not change.

**Recommended ruling.** Approve the Gurmukhi forms; Change the English of the four Bhatts to Balh, Bhalh, Nalh,
Salh (or the contexts to Bal, Bhal, Nal, Sal) so the two agree.

**Confidence.** high (that the forms match the corpus); the romanisation choice is editorial.

---

## The Kabir saloks that name other Bhagats

### Roster review note (R-09, R-10, R-12, R-13) · Kabir saloks 212–213, 241 and 242 (Angs 1375–1377)

**Finding.** Inside `ਸਲੋਕ ਭਗਤ ਕਬੀਰ ਜੀਉ ਕੇ` four saloks name another Bhagat:

- 212 and 213, a dialogue: `ਨਾਮਾ ਮਾਇਆ ਮੋਹਿਆ ਕਹੈ ਤਿਲੋਚਨੁ ਮੀਤ ॥` (line 58724, Ang 1375) and `ਨਾਮਾ ਕਹੈ ਤਿਲੋਚਨਾ ਮੁਖ ਤੇ ਰਾਮੁ ਸੰਮ੍ਹਾਲਿ ॥` (line 58726, Ang 1375).
- 241: `ਕਹਿ ਨਾਮਾ ਕਿਉ ਪਾਈਐ ਬਿਨੁ ਭਗਤਹੁ ਭਗਵੰਤੁ ॥੨੪੧॥` (line 58786, Ang 1377).
- 242: `ਤੇ ਨਰ ਦੋਜਕ ਜਾਹਿਗੇ ਸਤਿ ਭਾਖੈ ਰਵਿਦਾਸ ॥੨੪੨॥` (line 58788, Ang 1377).

None of the four has a heading of its own. The dataset credits all of them to Bhagat Kabir Ji. Sahib Singh and ShabadOS hold that all four are **Kabir's own**, citing the other Bhagats. The Faridkot Teeka reads the named Bhagat as the speaker.

**Evidence.**
- **Prof. Sahib Singh, Darpan, note at line 58788 (via ShabadOS 4.8.7).** `ਭਗਤ ਨਾਮਦੇਵ ਜੀ ਅਤੇ ਭਗਤ ਰਵਿਦਾਸ ਜੀ ਦੇ ਕੋਈ ਸ਼ਲੋਕ ਨਹੀਂ ਹਨ, ਸਿਰਫ਼ ਸ਼ਬਦ ਹਨ। ਜਿਵੇਂ ਸ਼ਲੋਕ ਨੰ: ੨੧੨ ਅਤੇ ੨੧੩ ਹਨ ਤਾਂ ਕਬੀਰ ਜੀ ਦੇ ਆਪਣੇ ਉਚਾਰੇ ਹੋਏ, ਤਿਵੇਂ ਇਹ ਸ਼ਲੋਕ ਨੰ: ੨੪੧ ਅਤੇ ੨੪੨ ਭੀ ਕਬੀਰ ਜੀ ਦੇ ਆਪਣੇ ਹੀ ਹਨ।`
  - Gist: Namdev and Ravidas have no saloks, only shabads. Just as 212–213 are Kabir's own, so are 241 and 242.
- **Prof. Sahib Singh, note at line 58727.** `ਹੁਣ ਫਿਰ ਕਬੀਰ ਜੀ ਦੇ ਉਚਾਰੇ ਹੋਏ ਸ਼ਲੋਕ ਹਨ, ਕਿਉਂਕਿ ਇਹਨਾਂ ਦਾ ਸਿਰ-ਲੇਖ 'ਮਹਲਾ ੫' ਨਹੀਂ ਹੈ। … ਕਬੀਰ ਜੀ ਇਹਨਾਂ ਸ਼ਲੋਕਾਂ ਵਿਚ ਨਾਮਦੇਵ ਅਤੇ ਤ੍ਰਿਲੋਚਨ ਦੀ ਆਪੋ ਵਿਚ ਹੋਈ ਗੱਲ-ਬਾਤ ਦਾ ਜ਼ਿਕਰ ਕਰਦੇ ਹਨ।`
  - Gist: these saloks are Kabir's again, because they carry no ਮਹਲਾ ੫ heading. In them Kabir recounts a conversation between Namdev and Trilochan.
- **Faridkot Teeka.**
  - Line 58723: `☬ਸ੍ਰੀ ਗੁਰੂ ਅਰਜਨ ਸਾਹਿਬ ਜੀ ਭਾਈ ਗੁਰਦਾਸ ਜੀ ਕੋ ਸੁਨਾਵਤੇ ਹੈਂ। ਇਕ ਸਮੇਂ ਭਗਤ ਤ੍ਰਿਲੋਚਨ ਜੀ ਨੇ ਬਿਲਾਸ ਕਰ ਤਰਕ ਕਰੀ, ਸੋਈ ਕਹਿਤੇ ਹੈਂ:` Gist: the Teeka frames 212–213 as Guru Arjan recounting to Bhai Gurdas an exchange in which Trilochan reproached Namdev.
  - Line 58784: `☬ਇਸ ਮੇਂ ਨਾਮਦੇਵ ਜੀ ਕਾ ਪਰਮਾਣ ਹੈ:` Gist: salok 241 is introduced as a *pramaan* (quoted authority) from Namdev.
  - Line 58786: `ਸ੍ਰੀ ਨਾਮਦੇਵ ਜੀ ਕਹਿਤੇ ਹੈਂ:` and `☬ਰਵਿਦਾਸ ਜੀ ਕਾ ਪ੍ਰਮਾਣ ਹੈ:` Gist: Namdev is the speaker of 241, and 242 is a pramaan from Ravidas.
  - Line 58788: `ਸ੍ਰੀ ਰਵਿਦਾਸ ਭਗਤ ਜੀ: ਸਤ੍ਯ ਵਾਕ ਉਚਾਰਨ ਕਰਤੇ ਹੈਂ॥੨੪੨॥`
- **ShabadOS 4.8.7.** Writer **Bhagat Kabir Ji** for BaniDB ids 5180 (212–213), 5208 (241) and 5209 (242).
- **Repo.** `attribution_ledger.json`, entry `kabir-saloks-signed-by-others` (lines 58724–58788, status `proposed`), tags the saloks with the collection, Bhagat Kabir Ji, "as the independent edition does".
- **Corpus facts.**
  - The forms are ਕਹੈ ਤਿਲੋਚਨੁ, ਨਾਮਾ ਕਹੈ, ਕਹਿ ਨਾਮਾ and ਸਤਿ ਭਾਖੈ ਰਵਿਦਾਸ. In 212–213 they are third-person narration, "says Trilochan" and "says Nama".
  - **Grouping observation (not authorship).** Lines 58724–58727 (212–213) share comp 5318 with Guru Arjan's salok 211 (heading `ਮਹਲਾ ੫ ॥`, line 58721). Line 58731 (Kabir, 215) shares comp 5319 with Guru Arjan's salok 214. The per-line `author` is correct, but the grouping crosses authors.

**Where sources differ.**
- Prof. Sahib Singh and ShabadOS say all four saloks are Kabir's own words. The other Bhagats are named or quoted, not authors; Namdev and Ravidas wrote no saloks.
- The Faridkot Teeka reads 212–213 as words of Trilochan and Namdev, recounted by Guru Arjan to Bhai Gurdas. It reads 241 and 242 as sayings of Namdev and Ravidas cited as pramaan.

**Recommended ruling.**
- For saloks 212–213, 241 and 242: show them under Bhagat Kabir Ji, with a note that they name Namdev, Trilochan and Ravidas.
- In the R-09, R-10 and R-13 context paragraphs, describe them as "saloks among Kabir's that recount (or cite) Namdev, Trilochan and Ravidas", not as their compositions.

Reason: no heading assigns them elsewhere, Sahib Singh argues explicitly that they are Kabir's, and ShabadOS agrees. The Faridkot reading should be recorded as the differing view.

**Suggested wording (if Change).**
- R-09: "Two saloks among Kabir's (212–213, Angs 1375–1376) recount a dialogue between him and Namdev."
- R-10 and R-13 may add: "Among Kabir's saloks, salok 241 cites Namdev and salok 242 cites Ravidas (Ang 1377)."
- Where sources differ: "The Faridkot Teeka reads these lines as the words of the Bhagats they name; Prof. Sahib Singh reads them as Kabir's own."

**Confidence.** medium (212–213); Granthi to verify (241–242, where Faridkot's reading is direct)

---

## Life paragraphs with a recommended Change or a variant to flag

### R-01 · Guru Nanak Dev Ji
**Finding.** Facts follow the EoS as cited. Two dates have well-known variants: birth (15 April 1469, Vaisakh,
which the EoS follows, vs the tradition of Katak Puranmashi, the date of the Gurpurab), and death (7 September
1539 in the roster vs 22 September 1539 in many accounts, from Asu vadi 10, Sammat 1596; the difference is mainly
Julian vs Gregorian reckoning).
**Evidence.** EoS (Nānak, Gurū) as cited in the roster. Search snippet only — Granthi to verify:
https://en.wikipedia.org/wiki/Guru_Nanak ; https://www.britannica.com/biography/Guru-Nanak ; https://barusahib.org/?p=15417
**Where sources differ.** As above. Britannica notes a 1538/1539 split for the year of death (snippet only).
**Recommended ruling.** Change (name the variant, keep the EoS dates).
**Suggested wording (if Change).** "Guru Nanak was born in 1469 at Rai Bhoi ki Talwandi, now Nankana Sahib: on 15 April by the EoS, while his Gurpurab is kept on Katak Puranmashi. After years of travel he settled around 1521 at Kartarpur, where he joined devotion to God with the life of a householder. Before his death in September 1539 he installed Bhai Lahina, whom he renamed Angad, as his successor."
**Confidence.** high (that the variant exists); Granthi to verify (which day to show).

### R-05 · Guru Arjan Dev Ji
**Finding.** Correct. "16 August 1604" is the EoS day; 1 September is the common observance (see L-05a).
"Over a third of it is his own Bani" holds: 22,699 of 55,508 non-heading lines in the corpus (about 41%) are
credited to Mahala 5 (this count includes some lines the attribution repair is still reviewing).
**Evidence.** EoS (Arjan Dev, Gurū) as cited in the roster; corpus count.
**Where sources differ.** The installation day.
**Recommended ruling.** Change (small): drop the day, or name both.
**Suggested wording (if Change).** "... He compiled the Adi Granth, installed in the Harimandar in 1604; over a third of it is his own Bani. ..."
**Confidence.** high.

### R-06 · Guru Tegh Bahadur Ji
**Finding.** 11 November 1675 is the date the EoS gives (as cited). The Nanakshahi calendar keeps the Shaheedi
Purab on 24 November. "Gobind Das": the successor is more widely known by his birth name Gobind Rai; the roster's
form presumably follows the EoS and could not be checked.
**Evidence.** EoS (Tegh Bahādur, Gurū) as cited in the roster. Search snippet only — Granthi to verify:
https://www.queensu.ca/eventscalendar/calendar/events/martyrdom-guru-tegh-bahadur-ji-0 ; https://artsandculture.google.com/entity/m02nnss
**Where sources differ.** 11 Nov (historical date) vs 24 Nov (Nanakshahi observance). Gobind Das vs Gobind Rai.
**Recommended ruling.** Approve the date as written (it is the historical date); Granthi to rule on "Gobind Das".
**Suggested wording (if Change).** "... having named his son, Gobind Rai, as his successor."
**Confidence.** high (date); Granthi to verify (name).

### R-07 · Baba Sheikh Farid Ji
**Finding.** Dates follow the EoS headword (569–664 AH / 1173–1265). Other works give 1175 and/or 1266. A
substantive authorship variant is not mentioned: some scholars hold that the Farid Bani in the Granth is by a
later successor in his line, Sheikh Ibrahim (Farid Sani), whom Guru Nanak is said to have met. Others (e.g. Pritam
Singh) hold it is Farid Shakarganj's. "Known as the first recorded poet of the Punjabi language" is a claim of
reputation; "regarded as" is plainer.
**Evidence.** EoS (Farīd, Shaikh) as cited in the roster. Corpus: the Saloks open at Ang 1377 under the heading
recorded in the roster (`ਸਲੋਕ ਸੇਖ ਫਰੀਦ ਕੇ`). No Sahib Singh note on authorship was found in the Angs extracted
(1377–1378, 1384, 488). Search snippet only — Granthi to verify: https://en.wikipedia.org/wiki/Baba_Farid ;
https://tribuneindia.com/2008/20080406/spectrum/book3.htm ; https://apnaorg.com/wp/?p=62261
**Where sources differ.** Birth 1173 vs 1175; death 1265 vs 1266; author of the Bani: Farid Shakarganj vs Sheikh Ibrahim.
**Recommended ruling.** Change.
**Suggested wording (if Change).** "Shaikh Farid was born about AD 1173 (569 AH) at Kothewal, near Multan, and died about 1265. A Sufi of the Chishti order, he set up a centre at Hansi and later at Ajodhan, now Pakpattan. He is regarded as the first poet of the Punjabi language. Some scholars hold that the saloks in the Granth come from a later successor in his line, Sheikh Ibrahim."
**Confidence.** medium; Granthi to verify (whether to name the authorship variant).

### R-09 · Bhagat Trilochan Ji
**Finding.** Two variants are not named. (1) **Caste**: the roster (EoS) says a Vaishya family; Sahib Singh says
Brahmin. (2) **Birth year**: the EoS gives 1267. Sahib Singh quotes another writer (not his own view) giving
`ਸੰਮਤ ੧੨੬੭ ਬਿਕਰਮੀ`, which would be about 1210 CE, not 1267 CE. It is possible that 1267 began as a Bikrami year
and was later read as CE; this cannot be settled from the sources read.
**Evidence.**
- Sahib Singh note on line 30080, Ang 695: `* ਨੋਟ: ਭਗਤ ਤ੍ਰਿਲੋਚਨ ਜੀ ਜਾਤਿ ਦੇ ਬ੍ਰਾਹਮਣ ਸਨ।`
- Sahib Singh note on line 3707, Ang 92, quoting a writer he disagrees with: `ਭਗਤ ਤ੍ਰਿਲੋਚਨ ਜੀ ਬਾਰਸੀ ਨਾਮੀ ਨਗਰ (ਜ਼ਿਲਾ ਸ਼ੋਲਾਪੁਰ) ਮਹਾਰਾਸ਼ਟਰ ਦੇ ਰਹਿਣ ਵਾਲੇ ਸਨ। ਆਪ ਦਾ ਜਨਮ ਸੰਮਤ ੧੨੬੭ ਬਿਕਰਮੀ ਦੇ ਗਿਰਦੇ ਹੋਇਆ ਹੈ।` (The note is cut off in the database
  after this sentence.) This also supports the Barsi pin (M-P09).
- EoS (Trilochan) as cited in the roster: born 1267, Vaishya; birthplace disputed (Barsi or Uttar Pradesh).
- Corpus: four hymns, Siri (Ang 92), Gujri (Angs 525–526), Dhanasri (Ang 695): agrees with the context.
**Where sources differ.** Vaishya (EoS) vs Brahmin (Sahib Singh); 1267 (EoS) vs Sammat 1267 Bikrami (writer quoted by Sahib Singh).
**Recommended ruling.** Change.
**Suggested wording (if Change).** "Trilochan was a Maharashtrian saint-poet, said to have been born about 1267. The EoS gives his family as Vaishya; Sahib Singh calls him a Brahmin. Four of his hymns are in the Granth, in Siri, Gujri and Dhanasri. Two saloks among Kabir's present a dialogue between him and Namdev."
**Confidence.** high (that the variants exist); Granthi to verify (the year).

### R-12 · Bhagat Kabir Ji
**Finding.** Facts follow the EoS. The context gives no dates, so the 1518/1448 death-year split (recorded in
the roster's dates note) does not arise in the text. The corpus confirms Magahar. "Of all the Bhagats his
contribution ... is the largest" is a count, not a ranking of the Bani; acceptable under R3, but a plainer form is offered.
**Evidence.** EoS (Kabīr) as cited in the roster. Corpus: `ਮਰਤੀ ਬਾਰ ਮਗਹਰਿ ਉਠਿ ਆਇਆ ॥੨॥` (line 14933, Ang 326).
Search snippet only — Granthi to verify (death 1518 traditional vs 1448 scholarly; some give birth c. 1440):
https://www.encyclopedia.com/topic/Kabir.aspx
**Where sources differ.** Birth 1398 (EoS) vs c. 1440 (some); death 1518 vs 1448. Not in the context.
**Recommended ruling.** Approve as written (optional wording change).
**Suggested wording (if Change).** "Kabir's life centred on Kashi (Banaras), where he worked as a weaver. More of his Bani is in the Granth than of any other Bhagat: 227 padas in 17 raags and 237 saloks. He spent his last days at Magahar rather than Banaras."
**Confidence.** high.

### R-13 · Bhagat Ravidas Ji
**Finding.** Facts follow the EoS. "Mirabai was among his followers" is a tradition, stated as plain fact.
The corpus confirms his own words on his trade: `ਤੁਮ ਸਰਨਾਗਤਿ ਰਾਜਾ ਰਾਮ ਚੰਦ ਕਹਿ ਰਵਿਦਾਸ ਚਮਾਰਾ ॥੫॥੬॥` (line 28670, Ang 659).
**Evidence.** EoS (Ravidās) as cited in the roster; corpus.
**Where sources differ.** None found on the facts stated; the Mirabai link is traditional.
**Recommended ruling.** Change (one word).
**Suggested wording (if Change).** "... He came to reject idol-worship and distinctions of caste, and tradition counts Mirabai among his followers. Forty of his hymns are in the Granth."
**Confidence.** medium.

### R-14 · Bhagat Beni Ji
**Finding.** "Guru Arjan directed that the Siri hymn be sung in the tune of Guru Nanak's Pahire." The instruction
is real and is printed in the Granth, but it does not name who gave it, and Sahib Singh's note explains it
without naming Guru Arjan. It also says "ghar", not "tune". Sahib Singh adds that Beni was a learned Brahmin
(not in the context; optional).
**Evidence.**
- Corpus: `ਪਹਰਿਆ ਕੈ ਘਰਿ ਗਾਵਣਾ ॥` (line 3720, Ang 93).
- Sahib Singh note on line 3743, Ang 93: `* ਨੋਟ: 'ਪਹਰਿਆ ਕੈ ਘਰਿ ਗਾਵਣਾ।' ਭਾਵ: (ਇਸ ਸ਼ਬਦ ਨੂੰ) ਉਸ 'ਘਰ' ਵਿਚ ਗਾਵਣਾ ਹੈ ਜਿਸ ਵਿਚ ਉਹ ਸ਼ਬਦ ਗਾਵਣਾ ਹੈ ਜਿਸ ਦਾ ਸਿਰ-ਲੇਖ ਹੈ 'ਪਹਰੇ'। ... ਸੋ, ਬੇਣੀ ਜੀ ਦੇ ਇਸ ਸ਼ਬਦ ਦਾ 'ਘਰੁ' ਭੀ '੧' ਹੈ।`
- Sahib Singh note on line 57823, Ang 1351: `ਬੇਣੀ ਜੀ ਜਾਤਿ ਦੇ ਬ੍ਰਾਹਮਣ ਸਨ, ਵਿਦਵਾਨ ਬ੍ਰਾਹਮਣ ਸਨ।`
- EoS (Beṇī, Bhagat) as cited in the roster (the source of "Guru Arjan directed").
**Where sources differ.** EoS (per roster) names Guru Arjan; the heading and Sahib Singh do not.
**Recommended ruling.** Change.
**Suggested wording (if Change).** "Very little is known of Beni's life except his devotion to prayer and meditation; Bhai Gurdas refers to it. Three of his hymns are in the Granth, in Siri, Ramkali and Prabhati. The heading of the Siri hymn directs that it be sung in the ghar of Guru Nanak's Pahire."
**Confidence.** high.

### R-15 · Bhagat Bhikhan Ji
**Finding.** "Bhakta Bhikhan" breaks the house style used for every other voice ("Bhagat" in names; plain name in
the text). The EoS separates him from a Sufi of the same name. A writer quoted (and answered) by Sahib Singh
claims the opposite (that he was a Sufi, died about Sammat 1625 ≈ 1568 CE), which is a variant to know of but
not to print. The EoS dates (1480–1573) are not in the context.
**Evidence.** EoS (Bhīkhan, 1480–1573) as cited in the roster. Sahib Singh note on line 28694, Ang 659, quoting the
other writer: `ਆਮ ਤੌਰ ਪਰ ਇਹਨਾਂ ਦੇ ਦੇਹਾਂਤ ਸੰਮਤ ੧੬੨੫ ਦੇ ਗਿਰਦੇ ਮੰਨੀਦਾ ਹੈ। ... ਆਪ ਅਸਲੋਂ ਸੂਫ਼ੀ ਮੁਸਲਮਾਨ ਫ਼ਕੀਰਾਂ ਵਿਚੋਂ ਸਨ।`
**Where sources differ.** Sufi or not; death c. 1568 vs 1573.
**Recommended ruling.** Change (style).
**Suggested wording (if Change).** "Bhikhan was a devotee in the tradition of Ravidas and Dhanna; the EoS holds him distinct from a Sufi of the same name and time. His two hymns in the Granth call the Name of Hari the cure for all the ills of the world."
**Confidence.** high (style); medium (identity).

### R-16 · Bhagat Dhanna Ji
**Finding.** **Factual error.** "In a hymn in Asa he tells how the examples of Namdev, Kabir, Ravidas and Sain drew
him to God." That hymn is headed `ਮਹਲਾ ੫ ॥` and is Guru Arjan's, placed among Dhanna's hymns; it speaks of Dhanna
in the third person. The corpus credits it to Guru Arjan, and Sahib Singh says so explicitly. R-17 already treats
the same hymn as Guru Arjan's ("Guru Arjan names him ... (Ang 487)"), so R-16 and R-17 contradict each other.
**Evidence.**
- Corpus: header `ਮਹਲਾ ੫ ॥` (line 22053, Ang 487); `ਗੋਬਿੰਦ ਗੋਬਿੰਦ ਗੋਬਿੰਦ ਸੰਗਿ ਨਾਮਦੇਉ ਮਨੁ ਲੀਣਾ ॥` (line 22054, Ang 487);
  `ਇਹ ਬਿਧਿ ਸੁਨਿ ਕੈ ਜਾਟਰੋ ਉਠਿ ਭਗਤੀ ਲਾਗਾ ॥` (line 22062, Ang 488); `ਮਿਲੇ ਪ੍ਰਤਖਿ ਗੁਸਾਈਆ ਧੰਨਾ ਵਡਭਾਗਾ ॥੪॥੨॥` (line 22063, Ang 488).
  All four are credited to Guru Arjan Dev Ji (M5); ShabadOS writer agrees.
- Sahib Singh note on line 22063, Ang 488: `ਇਸ ਸ਼ਬਦ ਤੋਂ ਪਹਿਲੇ ਸ਼ਬਦ ਦਾ ਸਿਰ-ਲੇਖ ਹੈ 'ਆਸਾ ਬਾਣੀ ਭਗਤ ਧੰਨੇ ਕੀ'। ਇਸ ਸਿਰ-ਲੇਖ ਹੇਠ ੩ ਸ਼ਬਦ ਹਨ; ਪਰ ਇਸ ਦੂਜੇ ਸ਼ਬਦ ਦਾ ਇਕ ਹੋਰ ਨਵਾਂ ਸਿਰ-ਲੇਖ ਹੈ 'ਮਹਲਾ ੫'। ਇਸ ਦਾ ਭਾਵ ਇਹ ਹੈ ਕਿ ਇਹਨਾਂ ਤਿੰਨਾਂ ਸ਼ਬਦਾਂ ਵਿਚੋਂ ਇਹ ਦੂਜਾ ਸ਼ਬਦ ਗੁਰੂ ਅਰਜਨ ਸਾਹਿਬ ਦਾ ਆਪਣਾ ਉਚਾਰਿਆ ਹੋਇਆ ਹੈ।`
- Sahib Singh note on line 22052, Ang 487, on Dhanna's own first Asa hymn: `ਭਗਤ ਧੰਨਾ ਜੀ ਆਪਣੀ ਜ਼ਬਾਨੋਂ ਆਖਦੇ ਹਨ ਕਿ ਮੈਨੂੰ ਗੁਰੂ ਨੇ ਨਾਮ-ਧਨ ਦਿੱਤਾ ਹੈ ...`
- Corpus also supports "son of a farmer": `ਧਨੁ ਧੰਨਾ ਜਟੁ` (line 35591, Ang 835) and `ਜਾਟਰੋ` (line 22062).
- "Three of his hymns" is right: Asa (Ang 487), Asa (Ang 488, line 22064 onward), Dhanasri (Ang 695).
- Birthplace variants (Dhuan, Dhuan Kalan, Chauru) are already flagged in the roster note.
**Where sources differ.** The roster context (from the EoS as cited) vs the Granth's own heading and Sahib Singh.
**Recommended ruling.** Change.
**Suggested wording (if Change).** "Dhanna was born in the village of Dhuan in Tonk district, Rajasthan, the son of a farmer. He turned from worshipping idols to the Formless One, and three of his hymns are in the Granth. Among them in Asa, Guru Arjan set a hymn of his own (Ang 487) telling how the examples of Namdev, Kabir, Ravidas and Sain drew Dhanna to God."
**Confidence.** high.

### R-17 · Bhagat Sain Ji
**Finding.** Facts are right and the references check out. One word reads as ranking: "Ravidas ranks him with ...".
The line names those who were carried across. Also: Guru Ram Das names Sain too (Ang 835), and Guru Arjan names him
again at Angs 1192 and 1207 (not needed in the text).
**Evidence.** Corpus: `ਸੈਨੁ ਨਾਈ ਬੁਤਕਾਰੀਆ ਓਹੁ ਘਰਿ ਘਰਿ ਸੁਨਿਆ ॥` (line 22060, Ang 487);
`ਨਾਮਦੇਵ ਕਬੀਰੁ ਤਿਲੋਚਨੁ ਸਧਨਾ ਸੈਨੁ ਤਰੈ ॥` (line 47545, Ang 1106); `ਸੈਨੁ ਭਣੈ ਭਜੁ ਪਰਮਾਨੰਦੇ ॥੪॥੨॥` (line 30091, Ang 695).
Sahib Singh note on line 30091, Ang 695, records another writer's view that Sain's hymn is an arti to his
guru Ramanand, which Sahib Singh disputes. EoS (Saiṇ) as cited in the roster.
**Where sources differ.** Where he served (Rewa vs Bidar), already in the roster's `disputed`.
**Recommended ruling.** Change (one word).
**Suggested wording (if Change).** "... and Ravidas names him with Namdev, Kabir, Trilochan and Sadhna among those carried across (Ang 1106). ..."
**Confidence.** high.

### R-18 · Bhagat Pipa Ji
**Finding.** Initiation by Ramanand and the move to Dwarka are traditional, stated as fact. The EoS's own
Ramanand dates (1300–1410/11) and Pipa's birth (c. 1425) are not easy to reconcile; R-11 already says
"the dates make this impossible for all of them".
**Evidence.** EoS (Pīpā), EoS (Rāmānanda) as cited in the roster. Sahib Singh note on line 30098, Ang 695, says this hymn
rejects image-worship: `ਇਸ ਸ਼ਬਦ ਵਿਚ ਭਗਤ ਪੀਪਾ ਜੀ ਮੂਰਤੀ-ਪੂਜਾ ਦਾ ਖੰਡਨ ਕਰਦੇ ਹਨ`.
**Where sources differ.** Chronology with Ramanand.
**Recommended ruling.** Change (one phrase).
**Suggested wording (if Change).** "Pipa was a prince, born at Gagraun about 1425, who by tradition renounced his throne after initiation by Ramanand at Kashi. ..."
**Confidence.** medium.

### R-19 · Bhagat Sadhna Ji
**Finding.** "Lived by selling meat" agrees with the account Sahib Singh quotes (Pandit Tara Singh: `ਸਧਨਾ ਕਸਾਈ`).
"Was cremated at Sirhind, where a tomb honours him" reads oddly (cremation and a tomb); the roster takes it from
the EoS as cited, which could not be re-read.
**Evidence.** EoS (Sadhnā) as cited in the roster. Sahib Singh note on line 36578, Ang 858, quoting Pandit Tara Singh:
`ਸਧਨਾ ਕਸਾਈ ਅਪਨੀ ਕੁਲ ਕਾ ਕਾਰ ਤਿਆਗ ਕਾਹੂੰ ਹਿੰਦੂ ਸਾਧੂ ਸੇ ਪਰਮੇਸਰ ਭਗਤੀ ਕਾ ਉਪਦੇਸ ਲੇ ਕਰ ...`. Corpus:
`ਅਉਸਰ ਲਜਾ ਰਾਖਿ ਲੇਹੁ ਸਧਨਾ ਜਨੁ ਤੋਰਾ ॥੪॥੧॥` (Ang 858; roster example verse).
**Where sources differ.** Not found; wording only.
**Recommended ruling.** Change, unless the Granthi confirms the EoS wording.
**Suggested wording (if Change).** "... He is believed to have been born at Sehwan in Sindh, and a memorial to him stands at Sirhind. ..."
**Confidence.** Granthi to verify.

### R-20 · Bhagat Parmanand Ji
**Finding.** "He wrote under the pen-name Sarang" is confusing in the app and is not supported by the Granth:
his one hymn signs `ਪਰਮਾਨੰਦ` (the roster's own `chhap`), and "Sarang" is also the raag of that hymn. In the sources
read, the pen-name Sarang appears only in the words of a writer whom Sahib Singh is answering.
**Evidence.** Corpus: `ਪਰਮਾਨੰਦ ਸਾਧਸੰਗਤਿ ਮਿਲਿ ਕਥਾ ਪੁਨੀਤ ਨ ਚਾਲੀ ॥੩॥੧॥੬॥` (line 53934, Ang 1253). Sahib Singh note on
line 53934, Ang 1253, quoting that writer: `ਭਗਤ ਪਰਮਾਨੰਦ ਜੀ ਕਨੌਜੀਏ ਕੁਬਜ ਬ੍ਰਾਹਮਣਾਂ ਵਿਚੋਂ ਸਨ। ਆਪ ਸੁਆਮੀ ਬਲਭ ਚਾਰਯ ਦੇ ਚੇਲੇ ਬਣੇ। ... ਆਪ ਦਾ ਤਖ਼ੱਲਸ (ਕਵੀ-ਛਾਪ) ਸਾਰੰਗ ਸੀ।` EoS (Parmānand) as cited in the roster (born probably 1483, Barsi).
**Where sources differ.** The writer quoted by Sahib Singh makes him a Kanaujia Brahmin and a disciple of
Vallabhacharya, which points to a different Parmanand (of Braj) than the Maharashtrian of Barsi; whether the two
are one person is not settled in the sources read.
**Recommended ruling.** Change.
**Suggested wording (if Change).** "Parmanand was a Maharashtrian saint-poet, born probably in 1483, who is believed to have lived at Barsi, north of Pandharpur. His one hymn in the Granth (Sarang, Ang 1253), signed Parmanand, faults reading the scriptures as ritual when it does not lead to serving others."
**Confidence.** medium.

### R-21 · Bhagat Surdas Ji
**Finding.** See Q-Surdas above. The text is accurate and agrees with Sahib Singh. Note for the Granthi that the
birth year, Brahmin family, Madan Mohan and Sandila appear in Sahib Singh only as another writer's words (they
are the EoS's per the roster). Sammat 1586 = 1529 CE, consistent. R1 point: the context quotes Gurmukhi with
"(Sarang, Ang 1253)"; both quotes are verbatim (lines 53935, 53936).
**Recommended ruling.** Approve as written (optionally use the full citation form for the quoted lines, per the
pack's R1 note). Update the `attribution_note` when A-07 ships (dataset 1.3.0).
**Confidence.** high.

### R-22 · Bhai Mardana Ji (life paragraph only)
**Finding.** Life facts follow the EoS. Death at Kartarpur in 1534 is the majority account; janamsakhi traditions
place it at Kurram in Afghanistan, or in Baghdad (rejected by most). The attribution
question is set out under *Bhai Mardana* above.
**Evidence.** EoS (Mardānā, Bhāī) as cited in the roster. Search snippet only — Granthi to verify:
https://en.wikipedia.org/wiki/Bhai_Mardana ; https://nishaannagaara.com/guru-nanaks-longtime-companion/
**Where sources differ.** Place and year of death (Kartarpur 1534; Kurram; Baghdad c. 1520; 1538/39).
**Recommended ruling.** Approve the life text (it follows the tier-2 source); no variant needs to be printed.
**Confidence.** medium.

### R-24 · Bhai Satta Ji & Bhai Balwand Ji
**Finding.** Accurate. Sahib Singh adds detail that supports the text: they did kirtan for Guru Arjan; they were
not Mardana's descendants (Mardana a Chaunhbar, they Mokhar); Balwand spoke the first three pauris, Satta the last
five; he dates the Vaar to c. 1582. He does not say they were brothers (the roster's "said to be" is right to hedge).
**Evidence.** Sahib Singh note on line 41551, Ang 966: `(੧) ਸੱਤਾ ਤੇ ਬਲਵੰਡ ਭਾਈ ਮਰਦਾਨੇ ਦੀ ਸੰਤਾਨ ਵਿਚੋਂ ਨਹੀਂ ਸਨ, ਭਾਈ ਮਰਦਾਨਾ 'ਚੌਂਹਬੜ' ਸੀ ਤੇ ਇਹ 'ਮੋਖੜ' ਸਨ। (੨) ਇਹ ਦੋਵੇਂ ਗੁਰੂ ਅਰਜਨ ਸਾਹਿਬ ਪਾਸ ਕੀਰਤਨ ਕਰਦੇ ਸਨ। ... (੪) ਇਹ ਘਟਨਾ ਮਾਰਚ-ਅਪ੍ਰੈਲ ਸੰਨ ੧੫੮੨ ਦੀ ਹੈ। ... ਬਲਵੰਡ ਨੇ ਪਹਿਲੀਆਂ ੩ ਪਉੜੀਆਂ ਤੇ ਸੱਤੇ ਨੇ ਅਖ਼ੀਰਲੀਆਂ ੫ ਪਉੜੀਆਂ ...`
Corpus header: `ਰਾਮਕਲੀ ਕੀ ਵਾਰ ਰਾਇ ਬਲਵੰਡਿ ਤਥਾ ਸਤੈ ਡੂਮਿ ਆਖੀ` (line 41551, Ang 966). EoS (Balvaṇḍ, Rāi; Sattā) as cited.
**Where sources differ.** None on the facts stated.
**Recommended ruling.** Approve as written.
**Confidence.** high.

### R-25 · Bhatt Kalsahar Ji
**Finding.** Facts agree with Sahib Singh's tally (54 Swaiyye, praising all five Gurus). Two points:
(1) "is reckoned the most learned of the Bhatts" ranks the poets; it is an evaluation, not a fact, and sits
awkwardly with R3/R4; (2) the ਟਲ signature is not mentioned (see Q-Bhatts).
**Evidence.** Sahib Singh notes on lines 59316 (Ang 1392), 59798 (Ang 1407), 59867 (Ang 1409), quoted under Q-Bhatts.
Corpus: `ਸੁ ਕਹੁ ਟਲ ਗੁਰੁ ਸੇਵੀਐ ਅਹਿਨਿਸਿ ਸਹਜਿ ਸੁਭਾਇ ॥` (line 59315, Ang 1392); `ਕਹੁ ਕੀਰਤਿ ਕਲ ਸਹਾਰ ਸਪਤ ਦੀਪ ਮਝਾਰ ਲਹਣਾ ਜਗਤ੍ਰ ਗੁਰੁ ਪਰਸਿ ਮੁਰਾਰਿ ॥੧॥` (line 59272, Ang 1391).
EoS (Bhaṭṭ Bāṇī) as cited.
**Where sources differ.** Bhatt count; ਟਲ as Kalsahar or as Bhatt Tal.
**Recommended ruling.** Change.
**Suggested wording (if Change).** `Kalh, also called Kalsahar or Kal Thakur, was a son of Bhatt Bhikha. His Swaiyye, the most of any Bhatt, praise all five Gurus, Guru Nanak to Guru Arjan. Some of his verses sign ਟਲ, which Sahib Singh reads as another of his names.`
**Confidence.** high.

### R-26, R-31, R-33, R-35 · Bhatts Nal, Sal, Bal, Bhal (romanisation)
**Finding.** Facts agree with Sahib Singh's tallies (Nalh 16 to Guru Ram Das; Salh to Guru Amar Das and Guru Ram
Das; Balh 5 to Guru Ram Das; Bhalh 1 to Guru Amar Das). Only the name form differs between display name and text
(see Q-Gurmukhi).
**Evidence.** Sahib Singh notes (e.g. `* ਨੋਟ: ਇਹ ਇਕ ਸਵਈਆ ਭੱਟ ਸਲ੍ਯ੍ਯ ਦਾ ਹੈ।`, line 59436, Ang 1396; `(ਭੱਟ ਬਲ੍ਯ੍ਯ ਦੇ ਪੰਜ ਸਵਈਏ)`, line 59734, Ang 1405;
`ਭੱਟ ਨਲ੍ਯ੍ਯ ਦੇ ਤਿੰਨ ਕਿਸਮਾਂ ਦੇ ਸਵਈਏ = ੧੬।`, line 59598, Ang 1401).
**Recommended ruling.** Approve the text; Change the display names to Nalh, Salh, Balh, Bhalh (or the text to match the display names).
**Confidence.** high.

### R-27 · Bhatt Mathura Ji
**Finding.** Text is right. The roster's dates note records an EoS inconsistency (12 Swaiyye all to Guru Ram Das in
one entry; 14, seven each to Guru Ram Das and Guru Arjan, in another). Sahib Singh supports 7 + 7 = 14, as does the
corpus. Death 1634 at Amritsar (14 April 1634 per the Bhatt Vahi, as recorded in the roster).
**Evidence.** Sahib Singh notes: `ਭੱਟ ਮਥੁਰਾ ਦੇ ੭ ਸਵਈਏ।` (line 59708, Ang 1405) and `* ਨੋਟ: ਮਥੁਰਾ ਭੱਟ ਦੇ ੭ ਸਵਈਏ।` (line 59855, Ang 1409).
**Recommended ruling.** Approve as written; in the roster dates note, record that Sahib Singh supports 14.
**Confidence.** high.

### R-32 · Bhatt Bhikha Ji
**Finding.** "Introduced to him sixteen other bards" is the 17-Bhatt tradition (Bhikha + 16), while the roster
follows the 11-count. Not wrong as a report of tradition, but it may read as a contradiction beside R-36.
**Evidence.** EoS (Bhikhā, Bhaṭṭ; Bhaṭṭ Bāṇī) as cited. Sahib Singh: two Swaiyye of Bhikha (`* ਨੋਟ: ਇਹ ਦੋ ਸਵਈਏ ਭੱਟ ਭਿਖੇ ਦੇ ਉਚਾਰੇ ਹੋਏ ਹਨ।`, line 59430, Ang 1396).
**Recommended ruling.** Change (light).
**Suggested wording (if Change).** "... He lived until Guru Arjan's time and, by tradition, brought other bards to him; his Swaiyye praise Guru Amar Das."
**Confidence.** medium.

---

## Life paragraphs recommended for Approve as written

| Item | Voice | Key facts checked | Source | Confidence |
|---|---|---|---|---|
| R-02 | Guru Angad Dev Ji | b. 31 Mar 1504 Matte di Sarai; d. 29 Mar 1552 Khadur | EoS as cited | high |
| R-03 | Guru Amar Das Ji | b. 5 May 1479 Basarke; Guru 1552; Goindval; d. 1 Sep 1574 | EoS as cited | high |
| R-04 | Guru Ram Das Ji | b. 24 Sep 1534 Chuna Mandi; founded Amritsar settlement; d. 1 Sep 1581 Goindval | EoS as cited | high |
| R-06 | Guru Tegh Bahadur Ji | 1 Apr 1621; Chakk Nanaki; 11 Nov 1675 (24 Nov is the Nanakshahi observance) | EoS as cited; snippet | high (date) · Granthi to verify "Gobind Das" |
| R-08 | Bhagat Jaidev Ji | Gita Govinda; Kenduli / Kenduli-Sasan named as variants; two hymns (Gujri Ang 526, Maru Ang 1106) | EoS as cited; corpus | high |
| R-10 | Bhagat Namdev Ji | 1270; Narasi-Vamani (Satara: Sahib Singh note on line 58727, Ang 1376, `ਨਾਮਦੇਵ ਜੀ ਬੰਬਈ ਪ੍ਰਾਂਤ ਦੇ ਜ਼ਿਲਾ ਸਤਾਰਾ ਦੇ ਰਹਿਣ ਵਾਲੇ ਸਨ`); tailor; 61 hymns | EoS as cited; Sahib Singh | high |
| R-11 | Bhagat Ramanand Ji | Prayag; Kashi; disciples tradition hedged; one hymn Basant Ang 1195 | EoS as cited; corpus | high |
| R-12 | Bhagat Kabir Ji | weaver of Kashi; Magahar (line 14933, Ang 326); counts per EoS (optional rewording above) | EoS as cited; corpus | high |
| R-21 | Bhagat Surdas Ji | one line (53935); Guru Arjan's shabad (53936); Sammat 1586 = 1529 | EoS; Sahib Singh; corpus | high |
| R-22 | Bhai Mardana Ji | 1459 Talwandi; Mirasi; rabab; d. Kartarpur 1534 (majority account) | EoS as cited; snippet | medium |
| R-23 | Baba Sundar Ji | great-grandson of Guru Amar Das; six-stanza Ramkali Sadu (signature line Ang 924) | EoS as cited; corpus | high |
| R-24 | Bhai Satta & Balwand Ji | Mirasi rababis of Guru Arjan; Tikke di Vaar; Lahore | EoS as cited; Sahib Singh | high |
| R-26 | Bhatt Nal Ji | 16 Swaiyye, all to Guru Ram Das (name form only, see above) | Sahib Singh; EoS | high |
| R-27 | Bhatt Mathura Ji | 7 + 7 Swaiyye; fell at Amritsar 1634 | Sahib Singh; EoS | high |
| R-28 | Bhatt Kirat Ji | 4 + 4 Swaiyye to Guru Amar Das and Guru Ram Das | Sahib Singh; EoS | high |
| R-29 | Bhatt Gayand Ji | 13 Swaiyye to Guru Ram Das | Sahib Singh; EoS | high |
| R-30 | Bhatt Jalap Ji | 5 Swaiyye to Guru Amar Das (`ਇਹ ਪੰਜ ਸਵਈਏ ਭੱਟ ਜਾਲਪ ਦੇ ਉਚਾਰੇ ਹੋਏ ਹਨ।`, line 59393, Ang 1395) | Sahib Singh; EoS | high |
| R-31 | Bhatt Sal Ji | Swaiyye to Guru Amar Das and Guru Ram Das (name form only) | Sahib Singh; corpus (Ang 1396, 1406) | high |
| R-33 | Bhatt Bal Ji | 5 Swaiyye in the set to Guru Ram Das (name form only) | Sahib Singh; EoS | high |
| R-34 | Bhatt Haribans Ji | 2 Swaiyye to Guru Arjan (`ਇਹ ਦੋਵੇਂ ਸਵਈਏ 'ਹਰਿਬੰਸ' ਭੱਟ ਦੇ ਹਨ।`) | Sahib Singh; EoS | high |
| R-35 | Bhatt Bhal Ji | 1 Swaiyya to Guru Amar Das (name form only) | Sahib Singh; EoS | high |
| R-36 | The Bhatts | Angs 1389–1409; one light; collective entry | EoS as cited; corpus | high |

---

## For the reviewer

Rule on each item in the pull request that adds this page: **Approve as recommended**, **Change** (write
the wording you want) or **Reject**. Then, for each approved voice, an engineer follows *How to sign* in
[`lineage-roster-v2.md`](./lineage-roster-v2.md):

1. apply your wording to `context`;
2. set `review` to your name and the date;
3. regenerate the pack with `tools/gen_contributors.py`.

`tools/check_contributors.py` refuses an approved entry that has no reviewer and no date.
