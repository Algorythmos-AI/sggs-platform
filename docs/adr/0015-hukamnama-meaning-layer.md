---
title: "ADR-0015: The Hukamnama may carry an English meaning layer, behind one switch"
description: "The owner's decision to show Dr. Sant Singh Khalsa's English translation with the daily Hukamnama as a labelled layer without a written licence, its risk, and the one switch that removes it."
sidebar:
  order: 15
---
# ADR-0015: The Hukamnama may carry an English meaning layer, behind one switch

**Status:** accepted (2026-11-11), decided by the owner. The switch is **off** everywhere today.

**Context.** People who search for the day's Hukamnama mostly want its meaning as well as its
text. The database holds Dr. Sant Singh Khalsa's English translation (via the ShabadOS database),
attached line by line. [`NOTICE.md`](../../NOTICE.md) records that no written licence to
distribute it is held: ShabadOS states that translations are subject to their source copyrights.
For that reason the iOS app ships without it, and the licence gate (G4) blocks any build that
bundles it.

**Decision.**
- The owner has decided that the Hukamnama pages, the public API, the feeds and the daily email
  may show this translation, **without written permission and without waiting for it**. The
  owner's judgment is that Dr. Sant Singh Khalsa and SGPC want Gurbani and its meaning spread, and
  that a clearly attributed, non-commercial daily Hukamnama is within that wish.
- It is always a **separate, labelled layer**: "English translation: Dr. Sant Singh Khalsa",
  under the Gurmukhi, never inside it, and never presented as the Gurbani. In the API it is
  `lines[].en` with a top-level `translation` naming the translator and source.
- **One switch, `HUKAMNAMA_MEANING`** (the Hukamnama service's environment). Off, the layer is in
  no public file, so it is on no page, feed or API answer; the website shows it only when the API
  record says it is there. Turning the switch off removes it everywhere within one poll interval,
  and caches follow within their lifetimes.
- SGPC's Punjabi explanation (viakhya), audio and katha are **linked, never copied**.
- This decision covers the daily Hukamnama only. It does not license the translation for the iOS
  app, for the Knowledge Base as a whole, or for any bulk form; those stay behind gate G4.

**Consequences.**
- **This is a risk the owner has accepted, stated plainly:** the layer would be shown without a
  licence. If a rights holder objects, the switch removes it the same day, and that is the whole
  remedy on offer. A courtesy note to the rights holders was recommended and is not a condition.
- The examples repository's fixtures and the Developers page's sample do not include the layer.
- Before the switch is turned on in production: the `NOTICE.md` section on this decision is read
  again, and the privacy and terms pages need no change (no new data is collected).
