---
title: "ADR-0013: The wiki links out to assistants; it does not embed one"
description: "Why every wiki page offers 'Ask ChatGPT' and 'Ask Claude' as plain outbound links with a guarded instruction, what that does and does not promise, and how it sits with 'never AI-invented'."
sidebar:
  order: 13
---
# ADR-0013: The wiki links out to assistants; it does not embed one

**Status:** accepted (2026-10-11), decided by the owner. Extends ADR-0012.

**Context.** Readers of documentation now routinely hand a page to an assistant and ask questions
about it; help centres put that one click away. This project's positioning is the opposite of
"AI": scripture is quoted verbatim, cited by Ang, and never invented, and the product generates
nothing. An assistant can misquote Gurbani, and nothing this site does can stop a reader pasting a
page into one. The question was whether the wiki should make that easier, and if so how to keep
the scripture rule in front of both the reader and the assistant.

**Decision.**
- **Links, not a feature.** The page menu on every wiki page has two plain links, *Ask ChatGPT*
  and *Ask Claude*. Each opens that service in a new tab with a short instruction and the page's
  public Markdown address (`/md/<page>.md`, see [pages as Markdown](../contributing/pages-as-markdown.md)).
  Nothing is generated on this site, no assistant is embedded, no key or account is involved, and
  nothing is recorded: the links carry `rel="noopener noreferrer"` and there is no tracking.
- **On every page, scripture pages included.** The owner chose one behaviour everywhere rather than
  hiding the links where Gurmukhi is quoted: a reader can copy any page into an assistant anyway,
  and the instruction is where the rule can be stated.
- **The instruction holds the rule.** It tells the assistant to read the page first and answer only
  from it; never to quote, translate or transliterate Gurbani from memory; to quote only lines
  printed on the page, exactly, each with its "— Sri Guru Granth Sahib Ji · Ang N" line; and to say
  so when it cannot open the page or the page does not answer. It ends by asking the assistant to
  confirm it opened the page, so a failed fetch shows at once
  (`docs-site/plugins/assistant-links.mjs`; at most 600 characters, and a link is at most 2,000).
- **Said plainly in the menu.** Under the two links, always visible: "ChatGPT and Claude are
  third-party services. The link gives them this page's public address and a short instruction.
  This site records nothing."
- **Always the published page.** The links point at `docs.gurbanisoul.com`, never at a preview: an
  assistant cannot open a preview behind a sign-in. On a preview the menu adds that the published
  page may be older or missing.
- **A switch.** Building with `DOCS_PAGE_ACTIONS=0` removes the whole page menu
  ([the docs site runbook](../process/runbooks/docs-site.md)).

**Consequences.** A reader gets to an assistant in one click, with the scripture rule already in
the conversation. What is not promised: an assistant may ignore the instruction, and it may be
unable to fetch the page; a page that is on `integration` but not yet released does not exist on
the published site, so an assistant asked about it is told to stop. The product's own surfaces —
the Knowledge Base and the app — are unchanged: they generate nothing and link to no assistant,
and "verbatim, cited by Ang, never AI-invented" remains what they promise. If the links ever do
harm, the switch removes them without a code change.
