---
title: "Lineage roster v2: editorial recommendations for the reviewer"
description: "The evidence and an editorial recommendation for each of the 36 life paragraphs, the roster pack's six questions and one added review note, for the G3 reviewer to rule on."
sidebar:
  label: "Roster: recommendations"
  order: 2
---
# Lineage roster v2: editorial recommendations for the reviewer

**Status: recommendations only. Nothing here is a ruling.** This page sits beside the roster review pack
([`lineage-roster-v2.md`](./lineage-roster-v2.md)). It gives the evidence and an editorial recommendation
for each life paragraph (R-01 to R-36 in the app's G3 1.4.9 pack), for the pack's six questions, and for one
review note this page adds (the Kabir saloks), which makes seven questions in the ruling form. The G3
reviewer decides every item.

- No `review.status` changes.
- No field of `frontend/public/contributors.json` changes.
- Recorded on 2026-10-27 · Algorythmos · Gurbani Soul editorial.

The rest of the G3 1.4.9 review is on two companion pages:

- the app's pack, [`gurbani-soul-ios` `docs/review/g3-1.4.9/RECOMMENDATIONS.md`](https://github.com/Algorythmos-AI/gurbani-soul-ios/pull/111);
- the dataset decisions, [`sggs-data` `validation/attribution-g3-review/RECOMMENDATIONS.md`](https://github.com/Algorythmos-AI/sggs-data/pull/18).

Ids from those pages that this page uses:

- **R1–R4** are the G3 writing rules, set out in the app pack's `README.md`: R1 verbatim and cited; R2 explanation
  labelled; R3 descriptive, never a ranking of scripture; R4 reverent, plain and exact.
- **A-07** and **A-10** are dataset decisions in sggs-data#18. A-07 credits line 53935 to Bhagat Surdas Ji; A-10 makes
  the three labels on Ang 695 into headings.
- **L-05a** and **M-P09** are items in the app pack. L-05a is the 1604 "Adi Granth" timeline label; M-P09 is
  Trilochan's map pin at Barsi.

## Review status

Status last updated 2026-10-27. That is the date this section was written, not a review date: no review date has
been confirmed.

**Reviewer decision: pending Kanwaljit Singh's direct confirmation.**

| Kind of record | What exists |
|---|---|
| Recommendations | Every section of this page. They are editorial and not binding. |
| Decisions confirmed by the reviewer | None. No comment, formal GitHub review or signed message from Kanwaljit Singh is in the record. |
| Decisions awaiting confirmation | All seven questions and R-01 to R-36. On 2026-10-27 the account `skalaliya` entered a sign-off on his behalf, approving the recommendations subject to the documented corrections, source qualifications and verification requirements. His direct confirmation, exact role and review date are not verified. The history is kept in [PR #321](https://github.com/Algorythmos-AI/sggs-platform/pull/321). |
| Source verification outstanding | One item. The Western date 22 September 1539 originates, per McLeod, in Karam Singh's *Gurapurb Nirṇay*, which was not found. The lunar date it converts (Asu sudi 10, S. 1596) was read in a printed *Gyan-ratanavali*, but the conversion was not inspected or recomputed. Facts marked *Search snippet only* below are leads, not evidence. Every EoS row was read on a page image (see *Evidence index*). |
| Ruling-form ticks | The pull-request description shows R-04 ticked "Approve as recommended". Who ticked it is not recorded, so it is not counted as a decision. No other ruling box is ticked. |
| Automated checks | Run by CI on every commit. The results for each commit are on PR #321. |

**The five acceptance conditions** (from the review comment on PR #321):

| # | Condition | Status | Remaining action |
|---|---|---|---|
| 1 | Guru Nanak Dev Ji's birth and death date variants, with identifiable references | Partly met | Met for the EoS dates: vol. III (3rd ed., 2011), *Nānak, Gurū*, pp. 165–183, on page images. Birth Baisakh sudi 3, 1526 Bk / 15 April 1469, with the Kartik full-moon observance (p. 166); death Assu vadi 10, 1596 Bk / 7 September 1539 (p. 182). Met for the lunar dates behind the variants: McLeod (1968, pp. 99–101) names three traditions, and the *Gyan-ratanavali* date, Asu sudi 10, S. 1596, was read in a printed edition (p. 481). **Not met for the origin of the Western date 22 September 1539.** McLeod reports it as Karam Singh's conversion; Gupta (p. 54) and Mandair (p. 27) give it without a calendar basis. Karam Singh's book was not found, and this page did not recompute the conversion. Remaining action: inspect *Gurapurb Nirṇay*, or the reviewer accepts McLeod's report. Neither choice changes the recommended wording, which gives the month only. |
| 2 | Raagmala with neutral authorship wording | Met in the recommendation text | Q-Raagmala assigns no author and records the differing sources. Nothing to apply until the reviewer decides. |
| 3 | 11 Bhatts, Gurmukhi forms and romanisation, consistent and traceable | Met in the recommendation text | Each part is traced. The 11-count is Sahib Singh's, Teja Singh's and Taran Singh's (EoS I p. 351), and the per-Bhatt counts are Sahib Singh's (Salh corrected to 1 + 2 = 3, so the counts reach his 123 + 20 = 143). The Granth's own running total, `੧੪੩` at line 59867, confirms 143, and the EoS's 17-name count also sums to 123: the two readings count persons differently, not verses (see *Counting terms* under Q-Bhatts). ਟਲ signs exactly one verse (line 59315) and is recommended as a variant signature of Kalsahar. Balh / Bhalh / Nalh / Salh is the EoS's spelling (I p. 352), against today's display names Nal / Sal / Bal / Bhal. The Gurmukhi forms with ੍ਹ are editorial and labelled so (the Granth writes ਨਲ੍ਯ੍ਯ etc.); the choice of spelling is the reviewer's. The roster data changes only after the reviewer decides. |
| 4 | Traditions, memorials and disputed claims qualified | Met in the recommendation text | The facts behind the qualified wording are now read on page images. R-06: "Gobind Das" is the EoS's own form (IV p. 332). R-07: the Ibrahim view is Macauliffe's (vol. VI p. 357), and the EoS rejects it (II p. 13). R-19: cremation at Sirhind with a tomb is the EoS's wording (IV p. 7). R-09: the EoS gives AD 1267 explicitly, while the writer Sahib Singh quotes gives Sammat 1267; the page records this as a disagreement and the suggested wording says "said to have been born about 1267". "By tradition" in R-13, R-18 and R-32 is this page's hedge: the EoS states those claims plainly. Which name or wording to print is the reviewer's choice. |
| 5 | Script and docs checks pass; no unrelated changes | Met for this revision | Run on this revision before it was pushed: `python3 tools/docs_check.py --db db/sggs.sqlite`, and the Gurmukhi verbatim check against the pinned corpus and ShabadOS 4.8.7. The only misses are the four modern roster name forms named in *Q-Gurmukhi*. The diff against `integration` is this one page. CI results for each commit are on PR #321. |

The roster data, `review.status` and the generated pack change only in a separate pull request. That follows the
reviewer's direct confirmation and the closing of condition 1.

### Condition 1 sources (checked 2026-10-27)

"Page image" means the printed page was viewed in the Internet Archive scan, not only its OCR text. Leaf numbers
fetch that page's image at `https://archive.org/download/<identifier>/page/n<leaf>`; this was checked against the printed page number on each image used.

| Source | How it was read | What it says |
|---|---|---|
| *The Encyclopaedia of Sikhism*, ed. Harbans Singh, vol. III (M–R), 3rd ed., Punjabi University, Patiala, 2011 (ISBN 81-7380-349-8), entry *Nānak, Gurū (Srī Gurū Nānak Dev)*, pp. 165–183. Archive `TheEncyclopediaOfSikhism-VolumeIiiM-r` (scan uploaded by DiscoverSikhism.com), leaves 181–198. | Page images of pp. 165, 166 and 182, plus the imprint (leaf 2). The OCR text was searched for every "September" in the entry. | Birth Baisakh sudi 3, 1526 Bk / 15 April 1469. The entry says modern research has tended to establish this, while the birthday is kept by custom on the full moon of Kartik (p. 166). Death Assu vadi 10, 1596 Bk / 7 September 1539 (p. 182). The entry does not give 22 September 1539. The headword begins at the foot of p. 165 and the bibliography ends on p. 183, so the range cited earlier as pp. 166–182 was off at both ends. |
| W. H. McLeod, *Gurū Nānak and the Sikh Religion*, Clarendon Press, Oxford, 1968. Archive `guru-nanak-and-sikh-religion-w.-h.-mc-leod`, leaves 100–101 and 105–107. | Page images of pp. 94–95 and 99–101. | **Birth (p. 94).** The *Miharban* and *Puratan* traditions, supported by the *Gyan-ratanavali*, give Vaisakh sudi 3, S. 1526 = 15 April 1469. The *Bala* janam-sakhis give Kattak Puran-masi, S. 1526 (his note: 20 October 1469). **Death (pp. 99–101).** He finds three dates. (1) *Puratan*: Asu sudi 10, S. 1595 (September 1538). (2) *Gyan-ratanavali*: Asu sudi 10, S. 1596. His note 3, p. 99, says Karam Singh, *Gurapurb Nirṇay*, pp. 47–49 and 57, gives 22 September 1539 as its exact equivalent. (3) Some *Bala* janam-sakhis, the *Mahima Prakash Varatak*, and the death-date lists in Adi Granth manuscripts, including the Kartarpur manuscript: Asu vadi 10, S. 1596, fifteen days earlier than (2). He judges (3) the most likely, and equates it with 7 September 1539, with stated uncertainty. |
| Hari Ram Gupta, *History of the Sikhs*, vol. I, *The Sikh Gurus, 1469–1708*, Munshiram Manoharlal, New Delhi, this edition 2008. Archive `history-of-sikhs-1-sikh-gurus-hr-gupta`, leaf 65. | Page image of p. 54. | Death on Asauj shudi 10, S. 1596 = September 22, 1539; birth April 15, 1469. His note refers the reader to McLeod, pp. 99–101, so for 22 September he is **not independent** of McLeod's source. |
| M. A. Macauliffe, *The Sikh Religion*, vol. I, Clarendon Press, Oxford, 1909. Archive `dli.csl.3707`, leaves 80 and 277. | Page images of pp. lxxxiv and 191. | Death on the tenth of the light half of Assu, Sambat 1595 (A.D. 1538), the *Puratan* date (p. 191). This is the source of the 1538 year that some references give. The older janam-sakhis give Baisakh as the birth month; he describes how the Kartik date came to be celebrated at Amritsar (p. lxxxiv). |
| Arvind-pal S. Mandair, *Sikhism: A Guide for the Perplexed*, Bloomsbury, 2013. Archive `sikhism-guide-for-the-perplexed`, leaf 37. | Page image of p. 27. | Gives 22 September 1539, with no calendar basis. |
| Wikipedia, "Guru Nanak" (read 2026-10-27). | Article source text. | A lead only. It gives 22 September 1539 (citing Mandair and Gupta), and 7 September 1539 in its succession box. Not relied on. |
| Sikhitihas, *Guru Nanak Dev Ji*: https://sikhitihas.org/people/guru-nanak-dev/ | Web page. A secondary summary. | It led to the archive scan above. Not relied on. |
| *Purātan Janam Sākhī Srī Gurū Nānak Dev Jī*, attributed to Bhai Mani Singh, incl. the *Gyān-ratanāvalī*, ed. Bhai Gurpartap Singh, Bhai Chatar Singh Jiwan Singh, Amritsar, 4th printing July 2013 (ISBN 81-7601-195-9). Archive `bhai-mani-singh-vali-janam-sakhi`, leaf 480. | Page image of p. 481; imprint on leaf 1. | Gives the death as Sammat 1596, Asu sudi 10 (`ਸੰਮਤ ੧੫੯੬ ਅਸੂ ਸੁਦੀ ਦਸਮੀ`, janam-sakhi prose transcribed from the page image, not Gurbani; the scan's OCR text agrees). It gives no Western date. This is a modern popular edition, not the one McLeod used (he cites GR p. 587), so it confirms the lunar date only. |
| Karam Singh, *Gurapurb Nirṇay* | **Not found.** Archive.org was searched by English and Gurmukhi title. Hira Singh Dard's *Karam Singh Historian di Itihasak Khoj* lists it among his works and nothing more. | Known only through McLeod's note (pp. 47–49 and 57, giving 22 September 1539 as the equivalent of Asu sudi 10, S. 1596). |
| eos.learnpunjabi.org, online entry for Guru Nanak | **Not opened:** "resource removed or unavailable". | Nothing. |
| IGNCA, *The Life and Teachings of Guru Nanak*: https://ignca.gov.in/Asi_data/44707.pdf | **Not opened:** the PDF did not load. | Nothing. |

## How the evidence was gathered

- **The Encyclopaedia of Sikhism (EoS).** The EoS (ed. Harbans Singh, Punjabi University, Patiala) was read in
  the Internet Archive scans of its four volumes: vol. I, 4th ed., 2002 (`TheEncyclopediaOfSikhism-VolumeIA-d`);
  vol. II, 3rd ed., 2011 (`…-VolumeIiE-l`); vol. III, 3rd ed., 2011 (`…-VolumeIiiM-r`); vol. IV, 2nd ed., 2004
  (`…-VolumeIvS-z`). The editions were read from each imprint page; the scans were uploaded by DiscoverSikhism.com.
  - Each entry was found in the OCR text, then its consequential wording was checked on the page image, citing the
    printed page and the scan leaf. The editor viewed most pages; the rest were viewed by the audit agent, and four
    of those were re-viewed by the editor as a spot check (all agreed). The *Evidence index* marks which. A first attempt to read the online edition (eos.learnpunjabi.org) failed,
    and earlier drafts cited entries "as cited in the roster". Those labels have been replaced wherever the
    entry was read.
  - EoS page numbers are for these editions; other printings may paginate differently.
- **Prof. Sahib Singh ("SS").** His notes in the *Darpan* often carry short lives of the Bhagats and the
  Bhatts. They were read line by line from the ShabadOS 4.8.7 database (sha256 `d8e07134…`, verified),
  together with the *Faridkot Teeka* ("FDK").
  - Excerpts are verbatim. Some notes are cut short in the database itself, so where an excerpt stops
    mid-sentence, the source stops there.
  - The words are identical to the database, but most excerpts write the dotted letters (`ਸ਼`, `ਜ਼`, `ਖ਼`, `ਫ਼`) as a letter plus
    a separate nukta, while ShabadOS stores the single combined character. A byte-for-byte comparison therefore
    needs Unicode normalisation; no scripture line contains these letters.
  - Where SS is quoting a writer he disagrees with (`ਭਗਤ-ਬਾਣੀ ਦੇ ਵਿਰੋਧੀ ਸੱਜਣ`), this page says so. Those
    facts are the other writer's, not his.
- **The text.** Every Gurmukhi verse was read from the sggs-data database by line id and carries its Ang.
- **Web searches.** A fact seen only in a web search result is marked **"search snippet only — Granthi
  to verify"**, with its URL.
- **"Confidence"** is editorial: *high*, *medium*, or *Granthi to verify*.
- **Evidence classes.** Each Evidence line says how its source was read. The *Evidence index* at the end lists
  every item by class.
  - *Primary text*: the Granth, by line id and Ang, from the pinned dataset (`sggs-data` 1.2.0).
  - *Commentary*: Sahib Singh or the Faridkot Teeka, from ShabadOS 4.8.7.
  - *Reference, page image*: a printed reference read on the scan's page image, with page and leaf.
  - *Search snippet only*: seen only in a search result; marked "Granthi to verify".
  - *Tradition*: the source itself reports the claim as tradition.
  - *Reviewer decision*: the evidence is in, and what to print is the reviewer's choice.

## At a glance

| Item | Recommendation |
|---|---|
| How many Bhatts? | Keep 11 named Bhatts and the collective entry. Add ਟਲ to Kalsahar's signatures and name the variant. |
| Bhai Mardana | Two decisions: show the three saloks at Ang 553 under Guru Nanak Dev Ji (the EoS credits one to Mardana, recorded as a variant); keep Mardana in the roster, with the EoS view stated. |
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
  Ang 1409: `(੧) ਕਲ੍ਯ੍ਯਸਹਾਰ . . ੧੦ . . ੧੦ . . ੯ . . ੧੩ . . ੧੨ . . = ੫੪`); Jalap 5; Kirat 4 + 4; Bhikha 2; Salh 1 + 2 (one to
  Guru Amar Das, Ang 1396; two to Guru Ram Das, lines 59756 and 59762, Ang 1406); Bhalh 1; Nalh 16; Gayand 13; Mathura 7 + 7; Balh 5; Haribans 2. Total of the Bhatt sections per his note:
  `ਕੁੱਲ ਜੋੜ = ੧੪੩` (with the 20 Swaiyye of Guru Arjan himself counted in). The note is cut off in the database
  after `(੩) ਕੀਰਤ . . ੪`. These eleven counts add up to 123; with Guru Arjan's 20, that gives the 143 of his note.
  (Earlier drafts listed Salh as 1, which leaves the sum two short.)
- **The Granth's own running numbers.** The last Bhatt Swaiyya closes with `॥੨॥੨੧॥੯॥੧੧॥੧੦॥੧੦॥੨੨॥੬੦॥੧੪੩॥` (line
  59867, Ang 1409), and Guru Arjan's own Swaiyye close with `॥੨॥੧੧॥੨੦॥` (line 59212, Ang 1389). Read with the EoS's
  split (I p. 352), this gives 10 + 10 + 22 + 60 + 21 = 123 Swaiyye addressed to the five Gurus, plus Guru Arjan's 9 + 11
  = 20, for 143 in all. Which number belongs to which section is this page's reading, matched to the EoS.
- **Counting terms, defined.** These figures do not contradict one another; they count different things.
  - *Swaiyye*: the verses. Sahib Singh and the EoS agree on 123 by the Bhatts.
  - *Signatures*: the names inside the verses, e.g. ਕਲ੍ਯ੍ਯ, ਕਲ੍ਯ੍ਯਸਹਾਰ, ਟਲ.
  - *Named persons* (contributors): a reading of which signatures are separate poets. Sahib Singh reads 11; the EoS
    list reads 17.
  - *Corpus authors*: the dataset's 11 named Bhatts plus a collective "The Bhatts" for headings.
- **How the two 123s map.** Sahib Singh's Kalsahar 54 = EoS Kalh 53 + Tal 1; Jalap 5 = Jalap 4 + Jalh 1; Mathura 14 =
  Mathura 12 + Jalan 2. Nalh 16 + Gayand 13 = 29 = EoS Nalh 5 + Gayand 5 + Das 10 + Parmanand 5 + Sevak 4; the split
  inside that 29 was not mapped. The remaining Bhatts agree. This is arithmetic on the two sources, not a statement by
  either.
- EoS, *Bhaṭṭ Bāṇī*, vol. I (4th ed., 2002), pp. 351–352 (page images, leaves 368–369). The entry gives the
  differing counts: 11 (Sahib Singh, Teja Singh, Taran Singh and other modern scholars), 17 (Santokh Singh, *Sri Gur
  Pratap Suraj Granth*; Bhai Vir Singh and some other traditional scholars) and 19 (Pandit Kartar Singh Dakha). Its own
  list has 123 Swaiyye spread over 17 names, including Tal (1) and others the 11-count does not name.
  - Its per-Bhatt figures differ from Sahib Singh's: Kalh 53, Jalap 4, Kirat 8, Mathura 12, Salh 3, Bhalh 1, Balh 5,
    Haribans 2, Nalh 5, Gayand 5.
  - It also calls Kalh "reckoned to be the most learned of all the Bhatts" (see R-25).
- Search snippet only (a lead, not relied on): https://www.sikhiwiki.org/index.php/Bhatt_Bani ;
  https://searchgurbani.com/bhatts

**Where sources differ.** 11 / 17 / 19. Under the 17-count, which the EoS's own list follows, ਟਲ is a separate Bhatt
(Tal) with one Swaiyya. Sahib Singh reads it as Kalsahar. The per-Bhatt Swaiyya counts also differ between the EoS and
Sahib Singh (above); the roster's counts follow Sahib Singh.

**Recommended ruling.** Keep 11 named Bhatts plus the collective entry. Do not show the 17-count names as voices.
Add ਟਲ to Kalsahar's `chhap` list (it signs one of his Swaiyye, line 59315; it is used as a signature nowhere else in the corpus) and state the variant once in his `disputed`
line. Suggested `disputed` addition for R-25: "One of his Swaiyye signs ਟਲ; Sahib Singh reads it as another name of
Kalsahar, while the 17-Bhatt count treats it as a separate Bhatt, Tal."

**Confidence.** high (that Sahib Singh supports the roster's choice); the ruling itself is the Granthi's.

### Roster question · Bhai Mardana (Ang 553, saloks headed `ਮਰਦਾਨਾ ੧`)

**Finding.** Three saloks in Bihagre ki Vaar (lines 24461–24475) are headed `ਸਲੋਕੁ ਮਰਦਾਨਾ ੧ ॥` (line 24461, Ang 553) and `ਮਰਦਾਨਾ ੧ ॥` (line 24468, Ang 553). The dataset credits them to "Bhai Mardana".

- ShabadOS, Sahib Singh and the Faridkot Teeka all read them as **Guru Nanak Dev Ji's**, addressed to Mardana.
- The Encyclopaedia of Sikhism credits **one** salok to Mardana and two to Guru Nanak, addressed to him (vol. III p. 54; read on the page image).

Saloks 1 and 2 sign ਨਾਨਕ / ਨਾਨਕਾ (salok 2 twice):

- `ਗੁਰਮੁਖਿ ਪਾਈਐ ਨਾਨਕਾ ਖਾਧੈ ਜਾਹਿ ਬਿਕਾਰ ॥੧॥` (line 24467, Ang 553)
- `ਇਤੁ ਮਦਿ ਪੀਤੈ ਨਾਨਕਾ ਬਹੁਤੇ ਖਟੀਅਹਿ ਬਿਕਾਰ ॥` (line 24471, Ang 553)
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
- **EoS, *Bihāgṛe kī Vār*, vol. I (4th ed., 2002), p. 368 (page image, leaf 385).** Of the Vaar's forty-three saloks, it counts four by Guru Nanak and one by Mardana.
- **EoS, *Mardānā, Bhāī*, vol. III (3rd ed., 2011), p. 54 (page image, leaf 70).** One of his saloks appears in Bihagre ki Var "along with two others of Guru Nanak's addressed to Mardana". It describes his salok as saying an evil body may be cleansed of sin in *sangat* (GG 553).
  - That description fits the third salok (line 24475, the one with `ਸਤਸੰਗਤਿ` and no signature). This identification is this page's inference; the EoS does not quote the line.
- **Corpus structure (observation).** Line 24468 `ਮਰਦਾਨਾ ੧ ॥` is stored as a verse (`is_header = 0`) while line 24461 is a heading. All three saloks share comp 2170. This is the same kind of label issue as A-10.

**Where sources differ.**
- Sahib Singh, the Faridkot Teeka and ShabadOS credit all three saloks to Guru Nanak Dev Ji.
- The EoS credits one salok to Bhai Mardana (III p. 54; I p. 368), apparently the third, the one without ਨਾਨਕ.
- The third salok has no heading of its own, and ShabadOS stores it in the same record as the second.

**Recommended ruling.** This question holds two separate decisions; the ruling form asks them separately.
1. **Where the saloks are shown.** Show all three under Guru Nanak Dev Ji. Sahib Singh's reason (the lines sign ਨਾਨਕ), the Faridkot Teeka and ShabadOS agree. The EoS's one-salok reading is recorded as a variant. It applies most naturally to the unsigned third salok, so the reviewer may prefer to show that one salok with the variant named.
2. **Whether Bhai Mardana keeps a roster entry.** Keep him, as the Guru's companion and the person addressed, with the EoS view stated in R-22's *Where sources differ*.

**Suggested wording (if Change).** For R-22 *Where sources differ*: `The three saloks at Ang 553 headed ਮਰਦਾਨਾ ੧ are read by Prof. Sahib Singh and the Faridkot Teeka as Guru Nanak's, addressed to Mardana; the Encyclopaedia of Sikhism credits one of them to Mardana and the other two to Guru Nanak.`

**Confidence.** High on the sources and the textual evidence. Both decisions are the reviewer's.

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
- Corpus: `ਛਾਡਿ ਮਨ ਹਰਿ ਬਿਮੁਖਨ ਕੋ ਸੰਗੁ ॥` (line 53935, Ang 1253), author Bhagat Namdev Ji in the pinned dataset 1.2.0
  (Bhagat Surdas Ji in the held 1.3.0, as above); header
  `ਸਾਰੰਗ ਮਹਲਾ ੫ ਸੂਰਦਾਸ ॥` (line 53936, Ang 1253), author Guru Arjan Dev Ji (M5); closing verse
  `ਸੂਰਦਾਸ ਮਨੁ ਪ੍ਰਭਿ ਹਥਿ ਲੀਨੋ ਦੀਨੋ ਇਹੁ ਪਰਲੋਕ ॥੨॥੧॥੮॥` (line 53943, Ang 1253).
- Sahib Singh note on line 53943, Ang 1253: `ਲਫ਼ਜ਼ 'ਮਹਲਾ ੫' ਤੋਂ ਜ਼ਾਹਰ ਹੁੰਦਾ ਹੈ ਕਿ ਇਹ ਸ਼ਬਦ ਗੁਰੂ ਅਰਜਨ ਸਾਹਿਬ ਜੀ ਦਾ ਹੈ। ... ਭਾਵੇਂ ਭਗਤ ਸੂਰਦਾਸ ਜੀ ਦੀ ਇਕੋ ਹੀ ਤੁਕ ਦਰਜ ਕੀਤੀ ਹੈ, ਪਰ ਗਿਣਤੀ ਵਿਚ ਉਸ ਨੂੰ ਸਾਰੇ ਸ਼ਬਦ ਵਾਂਗ ਗਿਣਿਆ ਹੈ; ... ਕਈ ਵਿਦਵਾਨਾਂ ਦਾ ਖ਼ਿਆਲ ਹੈ ਕਿ ਦੋ ਸੂਰਦਾਸ ਹੋਏ ਹਨ, ਪਰ ਜਿਹੜਾ ਭੀ ਹੈ ਉਸ ਦੀ ਸਿਰਫ਼ ਇਕੋ ਤੁਕ ਗੁਰੂ ਗ੍ਰੰਥ ਸਾਹਿਬ ਵਿਚ ਦਰਜ ਹੈ। ਇਹ ਸ਼ਬਦ ਸਤਿਗੁਰੂ ਅਰਜਨ ਸਾਹਿਬ ਜੀ ਦਾ ਆਪਣਾ ਹੈ। ਸੂਰਦਾਸ ਦਾ ਨਹੀਂ।`
  The same note then quotes the other writer: `'ਭਗਤ ਸੂਰਦਾਸ ਜੀ ਜ਼ਾਤ ਦੇ ਬ੍ਰਾਹਮਣ ਸਨ। ਆਪ ਦਾ ਜਨਮ ਸੰਮਤ ੧੫੮੬ ਬਿ: ਦਾ ਪਤਾ ਲੱਗਦਾ ਹੈ। ਇਹਨਾਂ ਦਾ ਅਸਲ ਨਾਮ ਮਦਨ ਮੋਹਨ ਸੀ, ਪਹਿਲਾਂ ਆਪ ਸੰਧੀਲਾ ਦੇ ਹਾਕਮ ਰਹੇ। ...`
- Reference, page image: EoS, *Sūrdās*, vol. IV (2nd ed., 2004), p. 288 (leaf 305). He is said to have been born in 1529, and died at Banaras. The entry also says Guru Arjan composed a hymn to explain and supplement the single line, agreeing with the `ਮਹਲਾ ੫` heading. The entry places him as distinct from the blind poet of the Sur Sagar.
- Search result with the same facts (a lead, not relied on): https://www.allaboutsikhs.com/sikh-bhagats-bhagat-surdas-ji

**Where sources differ.**
- One Surdas or two (Sahib Singh notes the view).
- The other writer quoted by Sahib Singh says two Surdas shabads stand in Sarang, one complete. Sahib Singh rejects this.
- **ShabadOS 4.8.7 credits the whole shabad headed `ਸਾਰੰਗ ਮਹਲਾ ੫ ਸੂਰਦਾਸ` (BaniDB 4532) to Bhagat Surdas Ji, not to Guru Arjan.**
  Earlier drafts of this page left this out.
- The Faridkot Teeka is mixed. Its note on line 53934 says the Guru uttered the shabad, while its gloss on line 53943 has
  Surdas speaking.

**Recommended ruling.** Confirm the roster: the shabad headed `ਸਾਰੰਗ ਮਹਲਾ ੫ ਸੂਰਦਾਸ` is Guru Arjan's. This rests on
the `ਮਹਲਾ ੫` in the printed heading, which Sahib Singh reads the same way. Update the roster's `attribution_note` in
the same release that takes dataset 1.3.0 (A-07).

**Confidence.** High on the textual marker. The reviewer should weigh the ShabadOS attribution to Surdas before confirming.

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
- **EoS, *Rāgmālā*, vol. III (3rd ed., 2011), pp. 422–423 (page image of p. 422, leaf 438).** Because the caption gives no indication, its authorship "has been the subject of controversy", and so has whether it belongs in a complete reading. It is entered in the original volume preserved at Kartarpur, and "by consensus" it is taken to be part of the Sacred Text.
- **Sikh Rehat Maryada.** Reported as allowing a complete reading to end with either Mundavani or Raagmala, "according to the custom", noting a difference of opinion in the Panth. Seen in search-result summaries (e.g. https://en.wikipedia.org/wiki/R%C4%81gmala_(Sikhism)). Search snippet only — Granthi to verify against the printed Rehat Maryada.

**Where sources differ.**
- The dataset says Guru Arjan Dev Ji (M5), inherited from Mundavani.
- ShabadOS says Poet Alam.
- The EoS records the authorship as controversial and names no author; by consensus it treats Raagmala as part of the Sacred Text.
- The Rehat Maryada (snippet) records a difference of opinion.
- Sahib Singh and the Faridkot Teeka are silent.

**Recommended ruling.** Change: remove the Guru Arjan Dev Ji (M5) credit and show Raagmala with no author ("authorship disputed"). No Mahalla is printed on it, the M5 tag is inherited from Mundavani, and the sources disagree. This is the ledger's own `raagmala` proposal.

**Suggested wording (if Change).** "Raagmala carries no Mahalla in its heading, and its authorship is disputed. The app shows it without an author."

**Confidence.** High that the authorship is disputed (EoS, ShabadOS, the dataset); the wording is the reviewer's decision.

### Roster question · Japji Sahib author (Angs 1–8)

**Finding.** In the dataset the platform pins today (`sggs-data` 1.2.0), lines 1–385 already carry Guru Nanak Dev Ji (M1), from `attribution_ledger.json` entry `japji` (status `approved`). Before that repair the field was empty, because no Mahalla is printed at Ang 1. Every source checked credits the Bani to Guru Nanak Dev Ji.

**Evidence.**
- **ShabadOS 4.8.7.** Writer **Guru Nanak Dev Ji** for Mool Mantar and Japji (BaniDB ids 1–38) and for the closing salok (BaniDB id 39).
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
   `Balh`, `Bhalh`, `Nalh`, `Salh` throughout. That is the EoS's spelling (*Bhaṭṭ Bāṇī*, vol. I p. 352) and matches the
   modern Gurmukhi forms with ੍ਹ. Those forms are editorial: the Granth's signatures end in the subjoined ਯ (`ਨਲ੍ਯ੍ਯ` etc.),
   and the Swaiyye headings do not name these Bhatts.
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
**Finding.** The roster's facts agree with the EoS. Both dates have variants, and each now has an identifiable source (see *Condition 1 sources*).
- **Birth.** Vaisakh sudi 3, S. 1526 = 15 April 1469 is the date of the *Miharban* and *Puratan* janam-sakhis and the *Gyan-ratanavali* (McLeod, p. 94), which the EoS says modern research favours (p. 166). Katak Puranmashi, S. 1526 is the date of the *Bala* janam-sakhis (McLeod, p. 94), and the Gurpurab is kept on it.
- **Death.** Three dates appear in the sources, all in the month of Asu (McLeod, pp. 99–101):
  - Asu sudi 10, S. 1595 (1538), in the *Puratan* janam-sakhis, which Macauliffe follows (vol. I, p. 191);
  - Asu sudi 10, S. 1596, in the *Gyan-ratanavali*, which Karam Singh converts to 22 September 1539 (as cited by McLeod) and which Gupta (p. 54) and Mandair (p. 27) give;
  - Asu vadi 10, S. 1596, in some *Bala* janam-sakhis and the Kartarpur manuscript's list, which the EoS gives as 7 September 1539 (p. 182). McLeod judges it the most likely of the three.

  The 7 and 22 September dates are fifteen days apart because they fall in different halves of the lunar month: vadi is the dark half and sudi the light half.
**Evidence.** Published reference inspected, on page images: EoS vol. III (3rd ed., 2011), pp. 165–183; McLeod (1968), pp. 94–95 and 99–101; Gupta (2008 edition), p. 54; Macauliffe (1909), vol. I, pp. lxxxiv and 191; Mandair (2013), p. 27. Primary text inspected: the *Gyan-ratanavali* in a modern printed edition (p. 481), which gives Asu sudi 10, S. 1596 and no Western date. Not inspected: Karam Singh, *Gurapurb Nirṇay*, pp. 47–49 and 57.
- **What McLeod states himself:** the three lunar dates, the fifteen-day gap, and his judgement that Asu vadi 10, S. 1596 (7 September 1539) is the most likely.
- **What he reports:** that Karam Singh gives 22 September 1539 as the equivalent of the *Gyan-ratanavali* date.

The Western-calendar equivalents are the cited authors' own; this page did not recompute them.
**Where sources differ.** As above. Earlier drafts of this page said the 7/22 September gap was "mainly Julian vs Gregorian reckoning", and the next draft said the "source and reckoning have not been identified". Both are superseded: McLeod shows the gap is vadi against sudi. A Julian-to-Gregorian shift in 1539 would be ten days, not fifteen.
**Recommended ruling.** Change (name the variant, keep the EoS dates). The suggested wording gives the month of death and no day, so it holds whichever date the reviewer prefers.
**Suggested wording (if Change).** "Guru Nanak was born in 1469 at Rai Bhoi ki Talwandi, now Nankana Sahib: on 15 April by the EoS, while his Gurpurab is kept on Katak Puranmashi. After years of travel he settled around 1521 at Kartarpur, where he joined devotion to God with the life of a householder. Before his death in September 1539 he installed Bhai Lahina, whom he renamed Angad, as his successor."
**Confidence.** High that the lunar variants exist and come from these traditions. The 22 September conversion is not independently verified. Which day to show, if any, is the reviewer's decision.

### R-05 · Guru Arjan Dev Ji
**Finding.** Correct. "16 August 1604" is the EoS day; 1 September is the common observance (see L-05a).
"Over a third of it is his own Bani" holds: 22,699 of 55,511 non-heading lines in the corpus (about 41%) are
credited to Mahala 5 (this count includes some lines the attribution repair is still reviewing).
**Evidence.** EoS, *Arjan Dev, Gurū*, vol. I (4th ed., 2002), p. 191 (checked on the page image by the audit agent); corpus count.
**Where sources differ.** The installation day.
**Recommended ruling.** Change (small): drop the day, or name both.
**Suggested wording (if Change).** "... He compiled the Adi Granth, installed in the Harimandar in 1604; over a third of it is his own Bani. ..."
**Confidence.** high.

### R-06 · Guru Tegh Bahadur Ji
**Finding.** 11 November 1675 is the date the EoS gives. The Nanakshahi calendar keeps the Shaheedi Purab on
24 November. "Gobind Das" is the EoS's own form in this entry: it says that on 8 July 1675 the Guru nominated
"his son Gobind Das" as his successor. The successor is more widely known by his birth name Gobind Rai. Which form
to print is the reviewer's choice.
**Evidence.** Reference, page image: EoS, *Tegh Bahādur, Gurū*, vol. IV (2nd ed., 2004), p. 332 (leaf 349):
Gobind Das nominated on 8 July 1675; beheaded at Chandni Chowk, Delhi, on 11 November 1675. Search snippet only, for
the 24 November observance (a lead, not relied on):
https://www.queensu.ca/eventscalendar/calendar/events/martyrdom-guru-tegh-bahadur-ji-0 ; https://artsandculture.google.com/entity/m02nnss
**Where sources differ.** 11 Nov (historical date) vs 24 Nov (Nanakshahi observance). Gobind Das vs Gobind Rai.
**Recommended ruling.** Approve the date as written (it is the EoS date); reviewer to choose "Gobind Das" (the EoS's form) or "Gobind Rai".
**Suggested wording (if Change).** "... having named his son, Gobind Rai, as his successor."
**Confidence.** high (date and source of each name form); reviewer decision (which name).

### R-07 · Baba Sheikh Farid Ji
**Finding.** Dates follow the EoS headword (569–664 AH / AD 1173–1265). The EoS's own Ibrahim entry gives
1173–1266, and other works give 1175. The roster does not mention a substantive authorship variant:
- Macauliffe (1909) held it "certain" that the saloks and hymns bearing Farid's name were composed by Shaikh Brahm
  (Ibrahim), Farid's successor, known as Farid the Second, whom Guru Nanak met.
- The EoS records these doubts, "led by M.A. Macauliffe", and rejects them as unsustainable.

"Known as the first recorded poet of the Punjabi language" is the EoS's wording and a claim of reputation; "regarded
as" is plainer.
**Evidence.** References, page images:
- EoS, *Farīd, Shaikh*, vol. II (3rd ed., 2011), pp. 11 and 13 (leaves 25 and 27).
- EoS, *Ibrāhīm, Shaikh*, vol. II, p. 297 (leaf 311).
- M. A. Macauliffe, *The Sikh Religion*, vol. VI, Clarendon Press, Oxford, 1909, p. 357 (archive `sikhreligionitsg06unse`,
  leaf 368).

Corpus: the Saloks open at Ang 1377 under the heading
recorded in the roster (`ਸਲੋਕ ਸੇਖ ਫਰੀਦ ਕੇ`). No Sahib Singh note on authorship was found in the Angs extracted
(1377–1378, 1384, 488). Search results that led here (not relied on): https://en.wikipedia.org/wiki/Baba_Farid ;
https://tribuneindia.com/2008/20080406/spectrum/book3.htm ; https://apnaorg.com/wp/?p=62261
**Where sources differ.** Birth 1173 vs 1175; death 1265 vs 1266 (the EoS gives both, in different entries). Author of
the Bani: Farid Shakarganj (the EoS) vs Sheikh Ibrahim (Macauliffe).
**Recommended ruling.** Change.
**Suggested wording (if Change).** "Shaikh Farid was born about AD 1173 (569 AH) at Kothewal, near Multan, and died about 1265. A Sufi of the Chishti order, he set up a centre at Hansi and later at Ajodhan, now Pakpattan. He is regarded as the first poet of the Punjabi language. Macauliffe held that the saloks in the Granth come from a later successor in his line, Sheikh Ibrahim; the Encyclopaedia of Sikhism rejects that view."
**Confidence.** high (that the variant exists and who holds it); reviewer decision (whether to name it).

### R-09 · Bhagat Trilochan Ji
**Finding.** Two variants are not named. (1) **Caste**: the roster (EoS) says a Vaishya family; Sahib Singh says
Brahmin. (2) **Birth year**: the EoS gives 1267. Sahib Singh quotes another writer (not his own view) giving
`ਸੰਮਤ ੧੨੬੭ ਬਿਕਰਮੀ`, which would be about 1210 CE, not 1267 CE. The EoS states its year explicitly as AD ("said to
have been born in AD 1267"). Neither source gives its evidence, so the two years stand as a disagreement. (Earlier drafts
suggested 1267 might have begun as a Bikrami year; that was conjecture and is withdrawn.)
**Evidence.**
- Sahib Singh note on line 30080, Ang 695: `* ਨੋਟ: ਭਗਤ ਤ੍ਰਿਲੋਚਨ ਜੀ ਜਾਤਿ ਦੇ ਬ੍ਰਾਹਮਣ ਸਨ।`
- Sahib Singh note on line 3707, Ang 92, quoting a writer he disagrees with: `ਭਗਤ ਤ੍ਰਿਲੋਚਨ ਜੀ ਬਾਰਸੀ ਨਾਮੀ ਨਗਰ (ਜ਼ਿਲਾ ਸ਼ੋਲਾਪੁਰ) ਮਹਾਰਾਸ਼ਟਰ ਦੇ ਰਹਿਣ ਵਾਲੇ ਸਨ। ਆਪ ਦਾ ਜਨਮ ਸੰਮਤ ੧੨੬੭ ਬਿਕਰਮੀ ਦੇ ਗਿਰਦੇ ਹੋਇਆ ਹੈ।` (The note is cut off in the database
  after this sentence.) This also supports the Barsi pin (M-P09).
- Reference, page image: EoS, *Trilochan*, vol. IV (2nd ed., 2004), p. 365 (leaf 380): "said to have been born in AD 1267 of a Vaisya family"; no unanimity on the birthplace (Barsi, or Uttar Pradesh).
- Corpus: four hymns, Siri (Ang 92), Gujri (Angs 525–526), Dhanasri (Ang 695): agrees with the context.
**Where sources differ.** Vaishya (EoS) vs Brahmin (Sahib Singh); 1267 (EoS) vs Sammat 1267 Bikrami (writer quoted by Sahib Singh).
**Recommended ruling.** Change.
**Suggested wording (if Change).** "Trilochan was a Maharashtrian saint-poet, said to have been born about 1267. The EoS gives his family as Vaishya; Sahib Singh calls him a Brahmin. Four of his hymns are in the Granth, in Siri, Gujri and Dhanasri. Two saloks among Kabir's present a dialogue between him and Namdev."
**Confidence.** high (that the variants exist, and in what year system each is stated); unresolved (which year is right).

### R-12 · Bhagat Kabir Ji
**Finding.** Facts follow the EoS. The context gives no dates, so the 1518/1448 death-year split (recorded in
the roster's dates note) does not arise in the text. The corpus confirms Magahar. "Of all the Bhagats his
contribution ... is the largest" is a count, not a ranking of the Bani; acceptable under R3, but a plainer form is offered.
**Evidence.** EoS, *Kabīr*, vol. II (3rd ed., 2011), p. 403 (checked on the page image by the audit agent). Corpus: `ਮਰਤੀ ਬਾਰ ਮਗਹਰਿ ਉਠਿ ਆਇਆ ॥੨॥` (line 14933, Ang 326).
Search snippet only — Granthi to verify (death 1518 traditional vs 1448 scholarly; some give birth c. 1440):
https://www.encyclopedia.com/topic/Kabir.aspx
**Where sources differ.** Birth 1398 (EoS) vs c. 1440 (some); death 1518 vs 1448. Not in the context.
**Recommended ruling.** Approve as written (optional wording change).
**Suggested wording (if Change).** "Kabir's life centred on Kashi (Banaras), where he worked as a weaver. More of his Bani is in the Granth than of any other Bhagat: 227 padas in 17 raags and 237 saloks. He spent his last days at Magahar rather than Banaras."
**Confidence.** high.

### R-13 · Bhagat Ravidas Ji
**Finding.** Facts follow the EoS. "Mirabai was among his followers" is a tradition, stated as plain fact.
The corpus confirms his own words on his trade: `ਤੁਮ ਸਰਨਾਗਤਿ ਰਾਜਾ ਰਾਮ ਚੰਦ ਕਹਿ ਰਵਿਦਾਸ ਚਮਾਰਾ ॥੫॥੬॥` (line 28670, Ang 659).
**Evidence.** EoS, *Ravidās*, vol. III (3rd ed., 2011), p. 493 (checked on the page image by the audit agent), which states the Mirabai link plainly; corpus. The "by tradition" hedge is this page's.
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
- Sahib Singh note on line 3743, Ang 93: `* ਨੋਟ: "ਪਹਰਿਆ ਕੈ ਘਰਿ ਗਾਵਣਾ।" ਭਾਵ: (ਇਸ ਸ਼ਬਦ ਨੂੰ) ਉਸ 'ਘਰ' ਵਿਚ ਗਾਵਣਾ ਹੈ ਜਿਸ ਵਿਚ ਉਹ ਸ਼ਬਦ ਗਾਵਣਾ ਹੈ ਜਿਸ ਦਾ ਸਿਰ-ਲੇਖ ਹੈ "ਪਹਰੇ"। ... ਸੋ, ਬੇਣੀ ਜੀ ਦੇ ਇਸ ਸ਼ਬਦ ਦਾ 'ਘਰੁ' ਭੀ '੧' ਹੈ।`
- Sahib Singh note on line 57823, Ang 1351: `ਬੇਣੀ ਜੀ ਜਾਤਿ ਦੇ ਬ੍ਰਾਹਮਣ ਸਨ, ਵਿਦਵਾਨ ਬ੍ਰਾਹਮਣ ਸਨ।`
- Reference, page image: EoS, *Beṇī, Bhagat*, vol. I (4th ed., 2002), p. 309 (leaf 326). The hymn closely resembles Guru Nanak's Pahire, so Guru Arjan, compiling the Holy Book, "recorded the instruction" that it be sung in the same tune. This is the source of the roster's "Guru Arjan directed".
**Where sources differ.** The EoS names Guru Arjan; the instruction and Sahib Singh do not. The instruction does not
say whose Pahare; Sahib Singh identifies them as Guru Nanak's Pahare in Siri Raag. That identification is his, so the
suggested wording leaves it out. The instruction (line 3720) is stored as a verse line, not as a heading.
**Recommended ruling.** Change.
**Suggested wording (if Change).** "Very little is known of Beni's life except his devotion to prayer and meditation; Bhai Gurdas refers to it. Three of his hymns are in the Granth, in Siri, Ramkali and Prabhati. An instruction printed with the Siri hymn directs that it be sung in the ghar of the Pahare."
**Confidence.** high.

### R-15 · Bhagat Bhikhan Ji
**Finding.** "Bhakta Bhikhan" breaks the house style used for every other voice ("Bhagat" in names; plain name in
the text). The EoS separates him from a Sufi of the same name. A writer quoted (and answered) by Sahib Singh
claims the opposite (that he was a Sufi, died about Sammat 1625 ≈ 1568 CE), which is a variant to know of but
not to print. The EoS dates (1480–1573) are not in the context.
**Evidence.** EoS, *Bhīkhan* (1480–1573), vol. I (4th ed., 2002), pp. 355–356 (checked on the page image by the audit agent). Sahib Singh note on line 28694, Ang 659, quoting the
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
- Sahib Singh note on line 22063, Ang 488: `ਇਸ ਸ਼ਬਦ ਤੋਂ ਪਹਿਲੇ ਸ਼ਬਦ ਦਾ ਸਿਰ-ਲੇਖ ਹੈ "ਆਸਾ ਬਾਣੀ ਭਗਤ ਧੰਨੇ ਕੀ"। ਇਸ ਸਿਰ-ਲੇਖ ਹੇਠ ੩ ਸ਼ਬਦ ਹਨ; ਪਰ ਇਸ ਦੂਜੇ ਸ਼ਬਦ ਦਾ ਇਕ ਹੋਰ ਨਵਾਂ ਸਿਰ-ਲੇਖ ਹੈ "ਮਹਲਾ ੫"। ਇਸ ਦਾ ਭਾਵ ਇਹ ਹੈ ਕਿ ਇਹਨਾਂ ਤਿੰਨਾਂ ਸ਼ਬਦਾਂ ਵਿਚੋਂ ਇਹ ਦੂਜਾ ਸ਼ਬਦ ਗੁਰੂ ਅਰਜਨ ਸਾਹਿਬ ਦਾ ਆਪਣਾ ਉਚਾਰਿਆ ਹੋਇਆ ਹੈ।`
- Sahib Singh note on line 22052, Ang 487, on Dhanna's own first Asa hymn: `ਭਗਤ ਧੰਨਾ ਜੀ ਆਪਣੀ ਜ਼ਬਾਨੋਂ ਆਖਦੇ ਹਨ ਕਿ ਮੈਨੂੰ ਗੁਰੂ ਨੇ ਨਾਮ-ਧਨ ਦਿੱਤਾ ਹੈ ...`
- Corpus also supports "son of a farmer": `ਧਨੁ ਧੰਨਾ ਜਟੁ` (line 35591, Ang 835) and `ਜਾਟਰੋ` (line 22062).
- "Three of his hymns" is right: Asa (Ang 487), Asa (Ang 488, line 22064 onward), Dhanasri (Ang 695).
- Birthplace variants (Dhuan, Dhuan Kalan, Chauru) are already flagged in the roster note.
**Where sources differ.** The roster's sentence follows the EoS, *Dhannā, Bhagat*, vol. I (4th ed., 2002), p. 567 (page image, leaf 584). The EoS says Dhanna describes himself in an Asa hymn as an ignorant Jatt drawn to God by the examples of Namdev, Kabir, Ravidas and Sain. Against it stand the Granth's own `ਮਹਲਾ ੫ ॥` heading, the corpus, Sahib Singh, the Faridkot Teeka and ShabadOS. The textual marker decides the attribution.
**Recommended ruling.** Change.
**Suggested wording (if Change).** "Dhanna was born in the village of Dhuan in Tonk district, Rajasthan, the son of a farmer. He turned from worshipping idols to the Formless One, and three of his hymns are in the Granth. Next to his Asa hymns the Granth places a hymn headed Mahalla 5, Guru Arjan's own (Ang 487), which tells how the examples of Namdev, Kabir, Ravidas and Sain drew Dhanna to God."
**Confidence.** high.

### R-17 · Bhagat Sain Ji
**Finding.** Facts are right and the references check out. One word reads as ranking: "Ravidas ranks him with ...".
The line names those who were carried across. Also: Guru Ram Das names Sain too (Ang 835), and Guru Arjan names him
again at Angs 1192 and 1207 (not needed in the text).
**Evidence.** Corpus: `ਸੈਨੁ ਨਾਈ ਬੁਤਕਾਰੀਆ ਓਹੁ ਘਰਿ ਘਰਿ ਸੁਨਿਆ ॥` (line 22060, Ang 487);
`ਨਾਮਦੇਵ ਕਬੀਰੁ ਤਿਲੋਚਨੁ ਸਧਨਾ ਸੈਨੁ ਤਰੈ ॥` (line 47545, Ang 1106); `ਸੈਨੁ ਭਣੈ ਭਜੁ ਪਰਮਾਨੰਦੇ ॥੪॥੨॥` (line 30091, Ang 695).
Sahib Singh note on line 30091, Ang 695, records another writer's view that Sain's hymn is an arti to his
guru Ramanand, which Sahib Singh disputes. EoS, *Saiṇ or Sain*, vol. IV (2nd ed., 2004), p. 25 (checked on the page image by the audit agent).
**Where sources differ.** Where he served (Rewa vs Bidar), already in the roster's `disputed`.
**Recommended ruling.** Change (one word).
**Suggested wording (if Change).** "... and Ravidas names him with Namdev, Kabir, Trilochan and Sadhna among those carried across (Ang 1106). ..."
**Confidence.** high.

### R-18 · Bhagat Pipa Ji
**Finding.** Initiation by Ramanand and the move to Dwarka are traditional, stated as fact. The EoS's own
Ramanand dates (headword "1300–1410?", vol. III p. 447; 1299–1410 in its Dhanna entry, I p. 567; 1300–1411 in its Sain
entry) and Pipa's birth (c. 1425) are not easy to reconcile; R-11 already says
"the dates make this impossible for all of them".
**Evidence.** EoS, *Pīpā*, vol. III, p. 342, and *Rāmānanda*, vol. III, p. 447 (checked on the page images by the audit agent; the Dhanna entry's dates re-viewed here). Sahib Singh note on line 30098, Ang 695, says this hymn
rejects image-worship: `ਇਸ ਸ਼ਬਦ ਵਿਚ ਭਗਤ ਪੀਪਾ ਜੀ ਮੂਰਤੀ-ਪੂਜਾ ਦਾ ਖੰਡਨ ਕਰਦੇ ਹਨ`.
**Where sources differ.** Chronology with Ramanand.
**Recommended ruling.** Change (one phrase). "By tradition" covers both the initiation and the move to Dwarka.
**Suggested wording (if Change).** "Pipa was a prince, born at Gagraun about 1425, who by tradition renounced his throne after initiation by Ramanand at Kashi, and later lived at Dwarka. ..."
**Confidence.** medium.

### R-19 · Bhagat Sadhna Ji
**Finding.** "Lived by selling meat" agrees with the account Sahib Singh quotes (Pandit Tara Singh: `ਸਧਨਾ ਕਸਾਈ`)
and with the EoS. "Was cremated at Sirhind, where a tomb honours him" is the EoS's own account: it says he was
cremated at Sirhind, "where even today a tomb stands in his memory". The pairing of cremation and tomb reads oddly in
the app, so "memorial" is offered.
**Evidence.** Reference, page image: EoS, *Sadhnā*, vol. IV (2nd ed., 2004), p. 7 (leaf 24); it also says he is
believed to have been born at Sehvan in Sindh. Sahib Singh note on line 36578, Ang 858, quoting Pandit Tara Singh:
`ਸਧਨਾ ਕਸਾਈ ਅਪਨੀ ਕੁਲ ਕਾ ਕਾਰ ਤਿਆਗ ਕਾਹੂੰ ਹਿੰਦੂ ਸਾਧੂ ਸੇ ਪਰਮੇਸਰ ਭਗਤੀ ਕਾ ਉਪਦੇਸ ਲੇ ਕਰ ...`. Corpus:
`ਅਉਸਰ ਲਜਾ ਰਾਖਿ ਲੇਹੁ ਸਧਨਾ ਜਨੁ ਤੋਰਾ ॥੪॥੧॥` (Ang 858; roster example verse).
**Where sources differ.** Not found; wording only.
**Recommended ruling.** Change (wording only), unless the reviewer prefers the EoS wording.
**Suggested wording (if Change).** "... He is believed to have been born at Sehwan in Sindh, and a memorial to him stands at Sirhind. ..."
**Confidence.** high (source); reviewer decision (wording).

### R-20 · Bhagat Parmanand Ji
**Finding.** "He wrote under the pen-name Sarang" is confusing in the app and is not supported by the Granth:
his one hymn signs `ਪਰਮਾਨੰਦ` (the roster's own `chhap`), and "Sarang" is also the raag of that hymn. The pen-name
Sarang does appear in two sources: the EoS says he used the *nom de plume* Sarang in his songs, and so does the writer
Sahib Singh answers. (Earlier drafts said it appeared only in that writer's words; the EoS entry shows otherwise.)
**Evidence.** Corpus: `ਪਰਮਾਨੰਦ ਸਾਧਸੰਗਤਿ ਮਿਲਿ ਕਥਾ ਪੁਨੀਤ ਨ ਚਾਲੀ ॥੩॥੧॥੬॥` (line 53934, Ang 1253). Sahib Singh note on
line 53934, Ang 1253, quoting that writer: `ਭਗਤ ਪਰਮਾਨੰਦ ਜੀ ਕਨੌਜੀਏ ਕੁਬਜ ਬ੍ਰਾਹਮਣਾਂ ਵਿਚੋਂ ਸਨ। ਆਪ ਸੁਆਮੀ ਬਲਭ ਚਾਰਯ ਦੇ ਚੇਲੇ ਬਣੇ। ... ਆਪ ਦਾ ਤਖ਼ੱਲਸ (ਕਵੀ-ਛਾਪ) ਸਾਰੰਗ ਸੀ।` Reference, page image: EoS, *Parmānand*, vol. III (3rd ed., 2011), p. 302 (leaf 318): born probably in 1483, believed to have lived at Barsi, and used the *nom de plume* Sarang.
**Where sources differ.** The writer quoted by Sahib Singh makes him a Kanaujia Brahmin and a disciple of
Vallabhacharya, which points to a different Parmanand (of Braj) than the Maharashtrian of Barsi; whether the two
are one person is not settled in the sources read. The EoS's "Sarang" belongs to his songs in general; the hymn in the
Granth signs ਪਰਮਾਨੰਦ.
**Recommended ruling.** Change. The reason is that the Granth's signature is ਪਰਮਾਨੰਦ, not that the EoS lacks the pen-name.
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
**Finding.** Life facts follow the EoS (*Mardānā, Bhāī*, vol. III, pp. 52–54; page image of p. 54), which gives his death
at Kartarpur in 1534. Other accounts, seen in search results only, place it at Kurram in Afghanistan or in Baghdad. The attribution
question is set out under *Bhai Mardana* above.
**Evidence.** Reference, page image: EoS vol. III (3rd ed., 2011), p. 54 (leaf 70). Search snippet only, for the other death places — Granthi to verify:
https://en.wikipedia.org/wiki/Bhai_Mardana ; https://nishaannagaara.com/guru-nanaks-longtime-companion/
**Where sources differ.** Place and year of death (Kartarpur 1534; Kurram; Baghdad c. 1520; 1538/39).
**Recommended ruling.** Approve the life text (it follows the EoS). If the reviewer accepts Q-Mardana, add the salok variant to *Where sources differ* (wording under Q-Mardana); no death-place variant needs to be printed.
**Confidence.** medium.

### R-24 · Bhai Satta Ji & Bhai Balwand Ji
**Finding.** Accurate. Sahib Singh adds detail that supports the text: they did kirtan for Guru Arjan; they were
not Mardana's descendants (Mardana a Chaunhbar, they Mokhar); Balwand spoke the first three pauris, Satta the last
five; he dates this incident to March–April 1582. He does not say they were brothers (the roster's "said to be" is right to hedge).
**Evidence.** Sahib Singh note on line 41551, Ang 966: `(੧) ਸੱਤਾ ਤੇ ਬਲਵੰਡ ਭਾਈ ਮਰਦਾਨੇ ਦੀ ਸੰਤਾਨ ਵਿਚੋਂ ਨਹੀਂ ਸਨ, ਭਾਈ ਮਰਦਾਨਾ 'ਚੌਂਹਬੜ' ਸੀ ਤੇ ਇਹ 'ਮੋਖੜ' ਸਨ। (੨) ਇਹ ਦੋਵੇਂ ਗੁਰੂ ਅਰਜਨ ਸਾਹਿਬ ਪਾਸ ਕੀਰਤਨ ਕਰਦੇ ਸਨ। ... (੪) ਇਹ ਘਟਨਾ ਮਾਰਚ-ਅਪ੍ਰੈਲ ਸੰਨ ੧੫੮੨ ਦੀ ਹੈ। ... ਬਲਵੰਡ ਨੇ ਪਹਿਲੀਆਂ ੩ ਪਉੜੀਆਂ ਤੇ ਸੱਤੇ ਨੇ ਅਖ਼ੀਰਲੀਆਂ ੫ ਪਉੜੀਆਂ ...`
Corpus header: `ਰਾਮਕਲੀ ਕੀ ਵਾਰ ਰਾਇ ਬਲਵੰਡਿ ਤਥਾ ਸਤੈ ਡੂਮਿ ਆਖੀ` (line 41551, Ang 966). EoS, *Balvaṇḍ, Rāi*, vol. I, pp. 269–270, and *Sattā*, vol. IV, p. 78 (checked on the page image by the audit agent).
**Where sources differ.** None on the facts stated.
**Recommended ruling.** Approve as written.
**Confidence.** high.

### R-25 · Bhatt Kalsahar Ji
**Finding.** Facts agree with Sahib Singh's tally (54 Swaiyye, praising all five Gurus). Two points:
(1) "is reckoned the most learned of the Bhatts" is the EoS's evaluation (*Bhaṭṭ Bāṇī*, I p. 352: "reckoned to be the
most learned of all the Bhatts"), not a fact. It ranks the poets and sits awkwardly with R3/R4; (2) the ਟਲ signature is not mentioned (see Q-Bhatts).
**Evidence.** Sahib Singh notes on lines 59316 (Ang 1392), 59798 (Ang 1407), 59867 (Ang 1409), quoted under Q-Bhatts.
Corpus: `ਸੁ ਕਹੁ ਟਲ ਗੁਰੁ ਸੇਵੀਐ ਅਹਿਨਿਸਿ ਸਹਜਿ ਸੁਭਾਇ ॥` (line 59315, Ang 1392); `ਕਹੁ ਕੀਰਤਿ ਕਲ ਸਹਾਰ ਸਪਤ ਦੀਪ ਮਝਾਰ ਲਹਣਾ ਜਗਤ੍ਰ ਗੁਰੁ ਪਰਸਿ ਮੁਰਾਰਿ ॥੧॥` (line 59272, Ang 1391).
EoS, *Bhaṭṭ Bāṇī*, vol. I, p. 352 (page image): 53 Swaiyye (Sahib Singh: 54).
**Where sources differ.** Bhatt count; ਟਲ as Kalsahar or as Bhatt Tal; 53 (EoS) vs 54 (Sahib Singh) Swaiyye.
**Recommended ruling.** Change.
**Suggested wording (if Change).** `Kalh, also called Kalsahar or Kal Thakur, was a son of Bhatt Bhikha. His Swaiyye, the most of any Bhatt, praise all five Gurus, Guru Nanak to Guru Arjan. One of his Swaiyye signs ਟਲ, which Sahib Singh reads as another of his names.`
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
**Evidence.** EoS, *Bhikhā, Bhaṭṭ*, vol. I (4th ed., 2002), p. 355 (checked on the page image by the audit agent), which states the sixteen bards plainly; *Bhaṭṭ Bāṇī*, p. 352. Sahib Singh: two Swaiyye of Bhikha (`* ਨੋਟ: ਇਹ ਦੋ ਸਵਈਏ ਭੱਟ ਭਿਖੇ ਦੇ ਉਚਾਰੇ ਹੋਏ ਹਨ।`, line 59430, Ang 1396).
**Recommended ruling.** Change (light).
**Suggested wording (if Change).** "... He lived until Guru Arjan's time and, by tradition, brought other bards to him; his Swaiyye praise Guru Amar Das."
**Confidence.** medium.

---

## Life paragraphs recommended for Approve as written

"EoS (checked)" means the entry was read on a page image and supports the facts listed. The *Evidence index* gives each page and who viewed it.

| Item | Voice | Key facts checked | Source | Confidence |
|---|---|---|---|---|
| R-02 | Guru Angad Dev Ji | b. 31 Mar 1504 Matte di Sarai; d. 29 Mar 1552 Khadur | EoS I 146, 148 (page images) | high |
| R-03 | Guru Amar Das Ji | b. 5 May 1479 Basarke; Guru 1552; Goindval; d. 1 Sep 1574 | EoS I 87–89 (page images) | high |
| R-04 | Guru Ram Das Ji | b. 24 Sep 1534 Chuna Mandi; founded Amritsar settlement; d. 1 Sep 1581 Goindval | EoS III 451–452 (page images) | high |
| R-06 | Guru Tegh Bahadur Ji | 1 Apr 1621; Chakk Nanaki; 11 Nov 1675 (24 Nov is the Nanakshahi observance) | EoS IV p. 332 (page image) | high (date) · reviewer to choose "Gobind Das" (EoS) or "Gobind Rai" (see above) |
| R-08 | Bhagat Jaidev Ji | Gita Govinda; Kenduli / Kenduli-Sasan named as variants; two hymns (Gujri Ang 526, Maru Ang 1106) | EoS II 321 (page image); corpus | high |
| R-10 | Bhagat Namdev Ji | 1270; Narasi-Vamani (Satara: Sahib Singh note on line 58727, Ang 1376, `ਨਾਮਦੇਵ ਜੀ ਬੰਬਈ ਪ੍ਰਾਂਤ ਦੇ ਜ਼ਿਲਾ ਸਤਾਰਾ ਦੇ ਰਹਿਣ ਵਾਲੇ ਸਨ`); tailor; 61 hymns | EoS III 161 (page image); Sahib Singh | high |
| R-11 | Bhagat Ramanand Ji | Prayag; Kashi; disciples tradition hedged; one hymn Basant Ang 1195 | EoS III 447 (page image); corpus | high |
| R-12 | Bhagat Kabir Ji | weaver of Kashi; Magahar (line 14933, Ang 326); counts per EoS (optional rewording above) | EoS (checked); corpus | high |
| R-21 | Bhagat Surdas Ji | one line (53935); Guru Arjan's shabad (53936); Sammat 1586 = 1529 | EoS; Sahib Singh; corpus | high |
| R-22 | Bhai Mardana Ji | 1459 Talwandi; Mirasi; rabab; d. Kartarpur 1534 (the EoS account) | EoS III pp. 52–54 | high (source) · see Q-Mardana |
| R-23 | Baba Sundar Ji | great-grandson of Guru Amar Das; six-stanza Ramkali Sadu (signature line Ang 924) | EoS IV 274 (page image); corpus | high |
| R-24 | Bhai Satta & Balwand Ji | Mirasi rababis of Guru Arjan; Tikke di Vaar; Lahore | EoS (checked); Sahib Singh | high |
| R-26 | Bhatt Nal Ji | 16 Swaiyye, all to Guru Ram Das (name form only, see above) | Sahib Singh (EoS *Bhaṭṭ Bāṇī* counts 5) | high |
| R-27 | Bhatt Mathura Ji | 7 + 7 Swaiyye; fell at Amritsar 1634 | Sahib Singh; corpus (EoS *Bhaṭṭ Bāṇī* counts 12) | high |
| R-28 | Bhatt Kirat Ji | 4 + 4 Swaiyye to Guru Amar Das and Guru Ram Das | Sahib Singh; EoS I p. 352 (8) | high |
| R-29 | Bhatt Gayand Ji | 13 Swaiyye to Guru Ram Das | Sahib Singh (EoS *Bhaṭṭ Bāṇī* counts 5) | high |
| R-30 | Bhatt Jalap Ji | 5 Swaiyye to Guru Amar Das (`ਇਹ ਪੰਜ ਸਵਈਏ ਭੱਟ ਜਾਲਪ ਦੇ ਉਚਾਰੇ ਹੋਏ ਹਨ।`, line 59393, Ang 1395) | Sahib Singh (EoS *Bhaṭṭ Bāṇī* counts 4) | high |
| R-31 | Bhatt Sal Ji | 3 Swaiyye: 1 to Guru Amar Das, 2 to Guru Ram Das (name form only) | Sahib Singh; corpus (Ang 1396, 1406); EoS I p. 352 (3) | high |
| R-33 | Bhatt Bal Ji | 5 Swaiyye in the set to Guru Ram Das (name form only) | Sahib Singh; EoS I p. 352 (5) | high |
| R-34 | Bhatt Haribans Ji | 2 Swaiyye to Guru Arjan (`ਇਹ ਦੋਵੇਂ ਸਵਈਏ 'ਹਰਿਬੰਸ' ਭੱਟ ਦੇ ਹਨ।`) | Sahib Singh; EoS I p. 352 (2) | high |
| R-35 | Bhatt Bhal Ji | 1 Swaiyya to Guru Amar Das (name form only) | Sahib Singh; EoS I p. 352 (1) | high |
| R-36 | The Bhatts | Angs 1389–1409; one light; collective entry | EoS I 351–352 (page image); corpus | high |

---

## Evidence index

The sources behind each item, by class (see *How the evidence was gathered*). "Text" = corpus line ids (pinned
dataset 1.2.0). "Commentary" = ShabadOS 4.8.7. "Reference" = printed page read on the scan's page image (★ = viewed
by the editor; otherwise by the audit agent). "Open" = what the evidence leaves to the reviewer
or could not settle.

| Item | Text | Commentary | Reference | Snippet only | Open |
|---|---|---|---|---|---|
| Q-Bhatts | 59315; 59436, 59756, 59762 | SS 59316, 59798, 59867 | EoS I 351–352 ★ | leads only | reviewer decision |
| Q-Mardana / R-22 | 24461–24475 | SS 24467; FDK 24460, 24471; ShabadOS 2114–2115 | EoS III 54 ★, I 368 ★ | other death places | two reviewer decisions |
| Q-Surdas / R-21 | 53935–53943 | SS 53943; FDK 53934, 53943; ShabadOS 4532 | EoS IV 288 ★ | — | reviewer decision (ShabadOS credits Surdas) |
| Q-Raagmala | 60586–60658 | FDK 60592; ShabadOS 5540 | EoS III 422 ★ | Rehat Maryada | reviewer decision |
| Q-Japji | 1–385; 6062–6068 | SS 1, 4, 378; FDK 4; ShabadOS 1–39, 421 | EoS II 347 | — | none |
| Q-Gurmukhi | Bhatt signatures; 30081, 30091; 47545 | — | EoS I 352 ★ (spellings) | — | reviewer decision |
| Kabir saloks | 58719–58789 | SS; FDK; ShabadOS 5179–5182 | — | — | reviewer decision |
| R-01 | — | — | EoS III 165–183 ★; McLeod 94–95, 99–101 ★; Gupta 54 ★; Macauliffe I lxxxiv, 191 ★; Mandair 27 ★; *Gyan-ratanavali* (2013 ed.) p. 481 ★ | — | Karam Singh not seen (22 Sep conversion); which day to show |
| R-05 | count over 55,511 lines | — | EoS I 191 ★ | — | reviewer decision (day) |
| R-06 | — | — | EoS IV 332 ★ | 24 Nov observance | reviewer decision (name) |
| R-07 | 1377 heading | — | EoS II 11, 13, 297 ★; Macauliffe VI 357 ★ | — | reviewer decision (name the view?) |
| R-09 | 92, 525–526, 695 | SS 30080, 3707 | EoS IV 365 ★ | — | sources differ on the year (AD 1267 vs Sammat 1267); unresolved |
| R-12 | 14933 | — | EoS II 403 | date variants | none |
| R-13 | 28670 | — | EoS III 493 ★ | — | none |
| R-14 | 3720 | SS 3743, 57823 | EoS I 309 ★ | — | none |
| R-15 | — | SS 28694 | EoS I 355–356 | — | none |
| R-16 | 22053–22063; 35591 | SS 22052, 22063; ShabadOS | EoS I 567 ★ | — | none (textual marker) |
| R-17 | 22060, 47545, 30091 | SS 30091 | EoS IV 25 | — | none |
| R-18 | — | SS 30098 | EoS III 342, 447; I 567 ★ | — | none |
| R-19 | Ang 858 | SS 36578 | EoS IV 7 ★ | — | reviewer decision (wording) |
| R-20 | 53934 | SS 53934 | EoS III 302 ★ | — | none |
| R-24 | 41551 | SS 41551 | EoS I 269–270, IV 78 | — | none |
| R-25 | 59272, 59315 | SS 59316, 59798, 59867 | EoS I 352 ★ | — | none |
| R-26, R-31, R-33, R-35 | Bhatt signatures | SS 59436, 59598, 59734 | EoS I 352 ★ | — | reviewer decision (spelling) |
| R-27 | — | SS 59708, 59855 | EoS I 352 ★, III 68 | — | none |
| R-32 | — | SS 59430 | EoS I 355 ★, 352 ★ | — | none |
| R-02, R-03, R-04 | — | — | EoS I 146, 148 ★; I 87–89 ★; III 451–452 ★ | — | none |
| R-08, R-10, R-11, R-23, R-36 | corpus | SS 58727 (R-10) | EoS II 321 ★; III 161 ★; III 447 ★; IV 274 ★; I 351–352 ★ | — | none |

---

## For the reviewer

Nothing on this page, or in its pull request, counts as your decision until you give it yourself. To record it,
please reply on PR #321 from your own GitHub account, or send a signed message. Give:

1. the name and role you would like recorded;
2. the date on which you reviewed this material;
3. for each of the seven questions and R-01 to R-36: **Approve as recommended**, **Change** (with the wording you want)
   or **Reject**. "All as recommended, except …" is fine;
4. which of the items under *Source verification outstanding* you accept as unresolved, and which must be resolved
   before anything is applied.

Then, for each approved voice, an engineer follows *How to sign* in
[`lineage-roster-v2.md`](./lineage-roster-v2.md):

1. apply your wording to `context`;
2. set `review` to your name and the date;
3. regenerate the pack with `tools/gen_contributors.py`.

`tools/check_contributors.py` refuses an approved entry that has no reviewer and no date.
