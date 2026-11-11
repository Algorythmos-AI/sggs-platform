---
title: "Writing a page"
description: "The rules a wiki page must meet: frontmatter, headings, relative links, the scripture rule, glossary terms, quizzes and code excerpts, verified stamps, and how a sibling page reaches the site."
sidebar:
  order: 1
---
# Writing a page

## Frontmatter and headings

Every page begins with `title` (8–120 characters) and `description` (40–200) and a body whose
first `# H1` equals the title (GitHub shows it; the site strips it). Pages under `docs/process/`, `docs/engineering/` and `docs/architecture/` must
carry `verified: {commit, date}`, the commit you last read the page against. A stamp goes stale in
two ways. The code the page covers can change after that commit: its `covers:` (see
[Docs impact](#docs-impact)), or else the code it cites (a code excerpt, a linked source file, a
poster's *Source of truth*). Or the page cites no code and its `date` is more than 60 days old.
`make docs-check` prints one notice that counts the stale stamps. The list is
`python3 tools/docs_check.py --freshness`, and the weekly `docs-freshness` pull request carries
the same list.

**The description is read by people.** It is shown under the page's title as a summary, as well
as to search engines and in link previews. Write one or two sentences saying what the page covers,
and do not open it with the page's first sentence: a description that repeats the opening
paragraph is left out of the page.

## Where a page appears in the sidebar

A new page in an existing directory appears in that directory's sidebar group by itself, after the
directory's `README.md` (listed as "Overview"), ordered by `sidebar.order` and then by title. The
sidebar shows the title unless the page sets a shorter `sidebar.label`; keep labels to 48
characters. A page at the top of `docs/`, or a new directory, must be placed in
[`docs-site/sidebar.mjs`](../../docs-site/sidebar.mjs) — the build fails until it is, because
every published page must be reachable from the sidebar. `draft: true` or `sidebar.hidden: true`
leaves a page out. The sidebar is read when the site starts, so restart `make docs-dev` after adding
or removing a page.

## Links

Write relative Markdown links as you would for GitHub (`../data/line-record.md#explore-real-records`).
The site turns them into page links, sends links to code files to GitHub at the right ref, and
turns a GitHub link to a document the wiki pins into the wiki page. Never a root-absolute `/…`
link, never `localhost`. Anchors are checked with GitHub's slug rules.

## The scripture rule

No verse is ever typed into a page. Scripture appears in exactly two ways: fetched live by a
widget, verbatim with its Ang; or as a cited blockquote whose last line is
`— Sri Guru Granth Sahib Ji · Ang N`, which the gate verifies against the pinned database line by
line. A run of Gurmukhi of four words or thirty characters outside a code span is refused; names
and tokens (`ਰਹਾਉ`, `ਮਃ`, a raag's name) go in code spans or stay short. Posters and diagrams carry
no scripture at all.

## Terms, quizzes and excerpts

- `[[Term]]` or `[[Term|as shown]]` makes a hover-card from the [glossary](../glossary.md); an
  unknown term fails the build. Add the term first.
- `<!-- sggs:quiz -->` followed by a ```quiz fence: `Q:` lines, `-` answers, one marked `✓`,
  optionally `— why`. It reads as text on GitHub.
- `<!-- sggs:code file="…" symbol="…" repo="…" -->` shows a function read from the source at
  build time; never paste code that could drift.
- `<!-- sggs:steps -->` on the line before an ordered list sets it as a procedure: numbered
  circles joined by a line. Use it for three to nine actions done in order (a runbook, a set-up).
  Do not use it for concepts, and never for the structure of scripture. Everywhere else — GitHub,
  paper, the Markdown export — the list is a plain numbered list.

**Gurmukhi is marked as Punjabi for you.** The build wraps every run of Gurmukhi in prose, tables
and inline code in `lang="pa"` (`docs-site/plugins/rehype-lang-pa.mjs`), so a screen reader reads
it as Punjabi. Write the text as it is; do not add `<span lang>` by hand.

**Notes and quotations look different on purpose.** A blockquote that opens with bold text and has
no Gurmukhi becomes a callout: a tinted box with a thick rule. A blockquote that quotes scripture
stays a quotation: no tint, no box, a thin rule, the Gurmukhi and its Ang. Never dress a note as a
quotation, or a quotation as a note.

The full widget list is in `docs-site/plugins/widgets.schema.json`; every widget needs a fallback
sentence within three lines.

## Numbers

A number that describes the data or the code should come from it: generate the table, read the
constant, quote the test. Where that is not possible, name the file and the commit. The gates
check what they can (search modes, verify thresholds, generated pages); the rest is your
`verified` stamp.

A count or a version written in prose is marked so the code fills it in:
`<!--fact:routes-->29<!--/fact-->`. The comments are invisible on GitHub and dropped by the wiki,
so readers see only the number; `python3 tools/gen_facts.py --write` rewrites the value from its
source, and `--check` (in `make docs-check` and the docs job) fails when a value has drifted or a
fact name is unknown. `python3 tools/gen_facts.py --list` shows every fact and where it is read.
Keep a marker on one line, outside code; add a format after a colon for a number in words
(`fact:contexts:words`) or without a thousands separator (`fact:angs:plain`). A new fact is one
entry in `FACTS` in that script. Leave ADRs, the changelogs and statements of what was true on a
given day as they are: they record their day. A release bump (`scripts/release/bump.py`) rewrites
the version facts with the rest of the release.

[Environment variables](../reference/environment.md) is generated the same way: the generator
finds every variable the code reads, and each needs one sentence in
`docs/reference/environment.descriptions.json`. Reading a new variable in the code without
describing it fails `tools/gen_env_vars.py --check`.

## Docs impact

A page can name the code it describes in its frontmatter, as one quoted, comma-separated string:

```yaml
covers: "webapp/serve.py#api, webapp/sggs/search.py, .github/workflows/*.yml"
```

Each entry is either a glob over tracked files or a `file#symbol`. In a glob, `*` stays within one
directory, `**` crosses directories, and a directory path covers everything under it. A symbol is
a top-level `def`, `class`, assignment, function or export. It counts as changed only when a
changed line falls inside it. `make docs-check` fails on a glob that matches no tracked file and
on a symbol it cannot find. A page without `covers:` covers the files it cites.

On every pull request the `docs-coupling` job runs
`python3 tools/docs_coupling.py BASE..HEAD`. It lists the pages whose covered code the change
touches while neither the page nor its `verified` stamp changes, and posts the list as one comment
on the pull request, updated on each push and each edit of the description. Tests, lockfiles, built output, `CHANGELOG.md` and the
generators of generated pages are not counted.

For each listed page, re-read it against the code and either update it or move its stamp. When
no page needs a change, say why in the pull request description, on a line of its own:

```text
Docs-impact: none — renames a private helper; no behaviour a page describes changed
```

The reason must be at least ten characters. The check reports only for now; the runbook says how
it is turned on ([Docs site](../process/runbooks/docs-site.md#the-docs-impact-check)).
[Docs health](../reference/docs-health.md) shows the same numbers across the whole wiki: fresh
stamps, coupling debt over 30 days, and how often code changes touch `docs/`.

### New code needs a page

The check can only name pages that cover the code, so new code that no page covers passes it
silently. `make docs-check` therefore fails on a new **code area** that no page covers: a directory
or file directly under `services/`, `webapp/` or `frontend/src/pages/`, or a workflow in
`.github/workflows/` (the patterns are in `tools/docs_areas.json`). Add the new path to the
`covers:` of the page that describes it, or link or excerpt one of its files there. When it never
needs a page (built output, tests), list it under `exempt` in `tools/docs_areas.json` with the
reason. `python3 tools/docs_check.py --areas` lists the areas still waiting for a page.

## Sibling repositories

The data and app repositories' documents are published here by pin
(`docs-site/sources.lock.json`); to change one, edit it in its own repository, and bump the pin
with `python3 tools/fetch_sibling_docs.py --update <name>` in a small pull request here.

## Before the pull request

```bash
make docs-check    # every gate the docs job runs, in seconds
make docs          # the full build, with every Mermaid rendered and every link resolved
```
