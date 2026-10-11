---
title: "Pages as Markdown"
description: "Every wiki page is also published as portable Markdown under /md/, with a manifest and llms.txt: what the export changes, what it never changes, and what an author must keep in mind."
sidebar:
  order: 6
---
# Pages as Markdown

Every published page is also served as plain Markdown, so a reader can copy it, a tool can fetch
it, and an assistant can be pointed at exactly what the page says:

| Address | What it is |
|---|---|
| `/md/<id>.md` | one page, for example `/md/api/quickstart.md`; the home page is `/md/index.md` |
| `/md-manifest.json` | every exported page: title, address, Markdown address, date, reading time |
| `/llms.txt` | the site described for language-model tools, one line per page, grouped like the sidebar |

Each page also carries `<link rel="alternate" type="text/markdown">` in its head. The 404 page and
the generated API reference have no Markdown source and are not exported; the reference's source is
`contract/openapi.json`.

## What the export changes

The Markdown in `docs/` is written for two renderers, GitHub and this site, so it carries things
only this site understands. The export resolves them and changes nothing else:

| In the source | In the export |
|---|---|
| a glossary term in double square brackets | the plain word |
| a `sggs:code` comment | the real lines of the file, in a code fence, with the commit they were read at |
| any other widget comment | removed; the "On the rendered wiki…" paragraph stays, or one line says where the part is live |
| a relative link to a page | the page's full address on this site |
| a relative link to any other file | its GitHub address |
| a poster image | the address of the published SVG |
| the `# Title` line | removed; a short header gives the title, description, address, dates and the "Verified against" stamp |

Mermaid and quiz blocks are left as written.

## What it never changes

The export **does not re-write Markdown**. The page is parsed only to find positions; a list of
small edits is made against the original text, and every other character passes through untouched.
There is no Unicode normalisation and no change to line endings or spacing.

Scripture is held mechanically (`docs-site/plugins/portable-md.mjs`):

- Every run of Gurmukhi in a page is protected, wherever it is: a quotation, a table, a heading, a
  list. An edit that would touch one fails the build.
- A quotation that contains Gurmukhi is frozen whole. A link inside it stays as written.
- After each page is exported, the build proves that every run is in the export, in order,
  character for character, and that undoing the edits gives the source back.

<!-- sggs:code file="docs-site/plugins/portable-md.mjs" symbol="verifyExport" -->
Source: `docs-site/plugins/portable-md.mjs`, read at build time.

## What an author must keep in mind

The export fails the build, with the page and the reason, on anything it cannot edit safely:

- **Write links inline**, `[text](target.md)`. A reference-style link to a relative target is refused.
- **Images are posters.** Any other relative image is refused until a rule exists for it.
- **A `sggs:code` comment starts its own line**, at the left margin.
- **Give an interactive widget its fallback paragraph**, starting "On the rendered wiki". It is what
  a reader of the Markdown, of GitHub, and of a printed page gets in its place.
- **Do not put a glossary term whose name is Gurmukhi behind a different shown word.** The export
  would have to delete the Gurmukhi, and it never does.

## Where it is tested

- `docs-site/plugins/test/portable-md.test.mjs` exports **every** published page and checks each
  Gurmukhi run byte for byte; its fixtures build Gurmukhi from code points, so no line of scripture
  is typed into a test. It fails, not skips, when a pinned repository's docs are not installed.
- `docs-site/e2e/markdown.spec.ts` fetches every page's Markdown from the built site and compares a
  quotation in the export with the same quotation on the page.
- After each deploy, `scripts/ci/docs_smoke.py` fetches `/md/index.md` and checks its type and
  character set, on builds that announce the `md1` feature.

The files are served as `text/plain; charset=utf-8` so they open in a browser tab, and with
`X-Robots-Tag: noindex` so search engines index the page, not its copy. Both come from a rule in
`docs-site/vercel.json`.
