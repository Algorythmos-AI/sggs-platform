// The Markdown export (plugins/portable-md.mjs): what it resolves, what it refuses, and the proof
// that scripture passes through untouched — on fixtures and on every published page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { protectedRuns, splitFrontmatter, applyEdits, verifyExport, planEdits, exportPage, exportHeader, readingMinutes } from '../portable-md.mjs';
import { listExportPages, exportOne, manifestEntry, llmsText, exportedIds, SITE_ORIGIN } from '../export-pages.mjs';
import { parseWidget } from '../remark-widgets.mjs';
import { sidebarLinks } from '../nav.mjs';
import { SIDEBAR } from '../../sidebar.mjs';
import { REPO_ROOT, loadSources } from '../paths.mjs';

// Gurmukhi for fixtures is assembled from code points at run time: letters only, never a line of scripture.
const cp = (...points) => String.fromCodePoint(...points);
const WORD_A = cp(0x0A15, 0x0A16);                       // two consonants
const WORD_B = cp(0x0A17, 0x0A3F, 0x0A18);               // with a vowel sign
const NUKTA_PAIR = cp(0x0A32, 0x0A3C);                   // a letter + nukta, deliberately not the precomposed U+0A33
const PRECOMPOSED = cp(0x0A33);
const JOINED = cp(0x0A15, 0x0A4D, 0x200D, 0x0A30);       // a conjunct held with ZWJ
const DANDA = cp(0x0965);
const LINE = `${WORD_A} ${WORD_B} ${DANDA}`;

const glossary = { Ang: {}, 'comp_id': {}, [WORD_A]: {} };
const ctx = (extra = {}) => ({
  repoRel: 'docs/api/fixture.md', title: 'Fixture', origin: SITE_ORIGIN, pageUrl: `${SITE_ORIGIN}/api/fixture/`,
  sources: loadSources(), glossary, commit: undefined, ...extra,
});
const run = (body, extra) => {
  const { edits, words, left } = planEdits(body, ctx(extra));
  const out = applyEdits(body, edits);
  verifyExport(body, edits, out);
  return { out, edits, words, left };
};

test('protected runs cover Gurmukhi, the dandas and joiners, wherever they are', () => {
  const text = `a ${LINE} b | ${JOINED} | \`${WORD_B}\``;
  const runs = protectedRuns(text).map((r) => text.slice(r.start, r.end));
  assert.deepEqual(runs, [LINE, JOINED, WORD_B]);
  assert.deepEqual(protectedRuns('no scripture here'), []);
});

test('frontmatter is skipped by offset: LF, CRLF and a byte-order mark', () => {
  assert.equal(splitFrontmatter('---\ntitle: "T"\n---\nbody').bodyStart, 19);
  const crlf = '---\r\ntitle: "T"\r\n---\r\nbody';
  assert.equal(crlf.slice(splitFrontmatter(crlf).bodyStart), 'body');
  const bom = '﻿---\ntitle: "T"\n---\nbody';
  assert.equal(bom.slice(splitFrontmatter(bom).bodyStart), 'body');
  assert.equal(splitFrontmatter('no frontmatter').bodyStart, 0);
});

test('the title heading is dropped once; other headings stay', () => {
  const { out } = run('# Fixture\n\nText.\n\n## Fixture\n');
  assert.equal(out, 'Text.\n\n## Fixture\n');
  assert.equal(run('# Another title\n\nText.\n').out, '# Another title\n\nText.\n');
});

test('glossary terms become their plain words, by deleting only the brackets', () => {
  assert.equal(run('Cited by [[Ang]] and [[comp_id|the composition id]].\n').out, 'Cited by Ang and the composition id.\n');
  assert.equal(run('Spaces [[ Ang ]] and [[Ang |  shown  ]] end.\n').out, 'Spaces Ang and shown end.\n');
});

test('a term in a table cell: the escaped bar is handled and the row keeps its cells', () => {
  const body = '| A | B |\n|---|---|\n| [[comp_id\\|the id]] | [[Ang]] |\n';
  assert.equal(run(body).out, '| A | B |\n|---|---|\n| the id | Ang |\n');
});

test('term syntax inside code, and as link text, is left exactly as written', () => {
  const body = 'Write `[[Ang]]` like so:\n\n```md\n[[Ang]] and <!-- sggs:status -->\n```\n\n[see [[Ang]]](https://example.com/)\n';
  assert.equal(run(body).out, body);
});

test('an unknown term, and a term with two bars, fail the build', () => {
  assert.throws(() => run('A [[Nope]] here.\n'), /not a glossary term/);
  assert.throws(() => run('A [[Ang|a|b]] here.\n'), /more than one/);
});

test('widgets: a comment goes; its fallback stays; one with no fallback gets a line saying where it is live', () => {
  const explained = '<!-- sggs:api-try route="/api/ang/{n}" -->\nOn the rendered wiki this is a console.\n\nAfter.\n';
  assert.equal(run(explained).out, 'On the rendered wiki this is a console.\n\nAfter.\n');
  const bare = 'Before.\n\n<!-- sggs:status -->\n\nAfter.\n';
  assert.equal(run(bare).out, `Before.\n\n*On the wiki this part is live (status): <${SITE_ORIGIN}/api/fixture/>*\n\nAfter.\n`);
  const cards = '<!-- sggs:cards -->\n- [One](https://example.com/) — a card\n';
  assert.equal(run(cards).out, '- [One](https://example.com/) — a card\n');
});

test('a code excerpt becomes the real lines of the file, in a fence, with where they were read', () => {
  const { out } = run('<!-- sggs:code file="docs-site/plugins/features.mjs" lines="1-2" -->\nSource: the features module.\n');
  const file = readFileSync(path.join(REPO_ROOT, 'docs-site/plugins/features.mjs'), 'utf8').split('\n');
  assert.ok(out.startsWith('```js\n' + file[0] + '\n' + file[1] + '\n```\n\n*`docs-site/plugins/features.mjs`, lines 1–2, read at `'));
  assert.match(out, /blob\/[0-9a-z]+\/docs-site\/plugins\/features\.mjs#L1-L2>\*\nSource: the features module\.\n$/);
});

test('an excerpt that itself contains a fence is wrapped in a longer one', () => {
  const rel = 'docs/contributing/writing-docs.md';
  const lines = readFileSync(path.join(REPO_ROOT, rel), 'utf8').split('\n');
  const at = lines.findIndex((l) => l.startsWith('```')) + 1;
  assert.ok(at > 0, 'the fixture page has a fenced block');
  const { out } = run(`<!-- sggs:code file="${rel}" lines="${at}-${at + 1}" -->\n`);
  assert.ok(out.startsWith('````text\n' + lines[at - 1] + '\n'), out.slice(0, 80));
  assert.equal(fromMarkdown(out).children[0].type, 'code');
  assert.equal(fromMarkdown(out).children[0].value.split('\n')[0], lines[at - 1]);
});

test('a misplaced or broken excerpt fails the build', () => {
  assert.throws(() => run('- item\n\n  <!-- sggs:code file="docs-site/plugins/features.mjs" lines="1-2" -->\n'), /must start its line/);
  assert.throws(() => run('<!-- sggs:code file="docs-site/plugins/nope.mjs" lines="1-2" -->\n'), /not on disk/);
});

test('relative links become absolute: pages to the site, other files to GitHub; the rest is untouched', () => {
  const body = [
    '[quick](quickstart.md) [anchor](quickstart.md#1-read-an-ang) [titled](quickstart.md "A title") [angle](<quickstart.md>)',
    '[code](../../webapp/serve.py) [dir](../search/) [abs](https://example.com/a_(b)) [here](#section) <https://example.com/>',
    '',
  ].join('\n');
  const { out } = run(body);
  assert.equal(out, [
    `[quick](${SITE_ORIGIN}/api/quickstart/) [anchor](${SITE_ORIGIN}/api/quickstart/#1-read-an-ang) [titled](${SITE_ORIGIN}/api/quickstart/ "A title") [angle](${SITE_ORIGIN}/api/quickstart/)`,
    `[code](https://github.com/Algorythmos-AI/sggs-platform/blob/integration/webapp/serve.py) [dir](${SITE_ORIGIN}/search/) [abs](https://example.com/a_(b)) [here](#section) <https://example.com/>`,
    '',
  ].join('\n'));
});

test('a poster image points at the published file; any other relative image fails the build', () => {
  assert.equal(run('![Poster 01 — the system](../diagrams/posters/01-system-landscape.svg)\n').out,
    `![Poster 01 — the system](${SITE_ORIGIN}/posters/01-system-landscape.svg)\n`);
  assert.throws(() => run('![x](../images/x.png)\n'), /no rule for it/);
  assert.equal(run('![x](https://example.com/x.png)\n').out, '![x](https://example.com/x.png)\n');
});

test('forms the export cannot edit safely fail the build instead of guessing', () => {
  assert.throws(() => run('[ref][r]\n\n[r]: quickstart.md\n'), /reference-style|only inline links/);
  assert.throws(() => run('[x](quick\\_start.md)\n'), /escapes the export does not rewrite|only inline/);
});

test('scripture passes through byte for byte: prose, table, heading, list, CRLF, joiners and nukta pairs', () => {
  const body = [
    '# Fixture', '',
    `A name in prose, ${WORD_A}, next to a [[Ang]] and a [link](quickstart.md).`, '',
    `## A heading with ${WORD_B}`, '',
    `| Form | Note |`, `|---|---|`, `| ${NUKTA_PAIR} | not ${PRECOMPOSED} |`, `| ${JOINED} | [[comp_id\\|id]] |`, '',
    `- ${LINE}`, '',
  ].join('\r\n');
  const { out, edits } = run(body);
  assert.ok(edits.length >= 5);
  const want = protectedRuns(body).map((r) => Buffer.from(body.slice(r.start, r.end), 'utf8'));
  const got = protectedRuns(out).map((r) => Buffer.from(out.slice(r.start, r.end), 'utf8'));
  assert.equal(got.length, want.length);
  want.forEach((b, i) => assert.ok(b.equals(got[i]), `run ${i} differs`));
  assert.ok(out.includes(NUKTA_PAIR) && out.includes(PRECOMPOSED), 'no normalisation: the pair and the precomposed letter both survive');
  assert.ok(out.includes('\r\n') && !/[^\r]\n/.test(out), 'line endings are not rewritten');
});

test('a quotation with Gurmukhi is frozen whole: a link inside it stays as written', () => {
  const body = `> ${LINE}  \n> see [the page](quickstart.md)  \n> — a citation line\n\nAfter [the page](quickstart.md).\n`;
  const { out, left } = run(body);
  assert.equal(left, 1);
  assert.ok(out.startsWith(body.slice(0, body.indexOf('\n\nAfter'))), 'the quotation is byte-identical');
  assert.ok(out.endsWith(`After [the page](${SITE_ORIGIN}/api/quickstart/).\n`));
});

test('an edit that would remove Gurmukhi fails the build', () => {
  assert.throws(() => run(`A [[${WORD_A}|shown]] term.\n`), /would touch scripture/);
  // a title heading that carries Gurmukhi is never dropped
  const title = `About ${WORD_A}`;
  assert.equal(run(`# ${title}\n\nText.\n`, { title }).out, `# ${title}\n\nText.\n`);
});

test('verifyExport catches a changed, moved, dropped or added run, and a wrong undo', () => {
  const body = `One ${WORD_A} two [[Ang]] three ${LINE} four.\n`;
  const { edits } = planEdits(body, ctx());
  const good = applyEdits(body, edits);
  verifyExport(body, edits, good);
  assert.throws(() => verifyExport(body, edits, good.replace(WORD_A, WORD_B)), /moved or changed/);
  assert.throws(() => verifyExport(body, edits, good.replace(` ${DANDA}`, '')), /moved or changed/);
  assert.throws(() => verifyExport(body, edits, good.replace('four', `four ${WORD_B}`)), /run\(s\) outside inserted text/);
  assert.throws(() => verifyExport(body, edits, good.replace('three', 'tree')), /moved or changed/);            // everything after it shifted
  assert.throws(() => verifyExport(body, edits, good.replace('three', 'thrxe')), /does not give the source back/); // same length, other text
  const cut = [{ start: body.indexOf(WORD_A), end: body.indexOf(WORD_A) + 1, text: '', kind: 'test' }];
  assert.throws(() => verifyExport(body, cut, applyEdits(body, cut)), /touches scripture/);
});

test('the header says what the page is, where it lives and how current it is', () => {
  const header = exportHeader({ title: 'T', description: 'D.', pageUrl: 'https://x/t/', updated: '2026-10-01', verified: { commit: 'abcdef1234', date: '2026-09-30' },
    pinned: { repository: 'o/r', commit: '0123456789abcdef', rel: 'docs/a.md' } });
  assert.ok(header.startsWith('# T\n\nD.\n\n- Page: <https://x/t/>\n- Updated: 2026-10-01\n- Verified against: `abcdef1` on 2026-09-30\n- Pinned copy of `o/r` `docs/a.md` at `0123456`'));
  assert.ok(header.endsWith('never altered.\n\n---\n\n'));
  assert.equal(exportHeader({ title: 'T', pageUrl: 'https://x/' }).split('\n')[2], '- Page: <https://x/>');
});

test('reading time counts what is read — prose, tables and code, not a diagram — and is at least a minute', () => {
  assert.equal(readingMinutes(0), 1);
  assert.equal(readingMinutes(220), 1);
  assert.equal(readingMinutes(221), 2);
  const prose = 'word '.repeat(50);
  const body = `${prose}\n\n\`\`\`js\n${'code '.repeat(30)}\n\`\`\`\n\n\`\`\`mermaid\n${'node '.repeat(400)}\n\`\`\`\n\n| a | b |\n|---|---|\n| ${'cell '.repeat(10)} | x |\n`;
  assert.equal(planEdits(body, ctx()).words, 50 + 30 + 2 + 10 + 1);
});

test('a file that is not well-formed Unicode is refused', () => {
  assert.throws(() => exportPage('---\ntitle: "T"\n---\nbad \uD800 text\n', ctx()), /not well-formed/);
});

// ---------------------------------------------------------------------------- every published page

const pages = listExportPages();           // throws when a sibling's docs are not installed: never a silent skip
const exported = pages.map((p) => exportOne(p));
const parse = (md) => fromMarkdown(md, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });

test('every published page is exported, once', () => {
  assert.ok(pages.length >= 130, `only ${pages.length} pages`);
  assert.equal(new Set(pages.map((p) => p.id)).size, pages.length);
  assert.equal(exportedIds().size, pages.length);
  assert.ok(pages.some((p) => p.id === 'index') && !pages.some((p) => p.id === '404'));
  assert.ok(pages.some((p) => p.source), 'pinned sibling pages are included');
});

test('every page: each Gurmukhi run of the source is in the export, in order, byte for byte', () => {
  let runs = 0;
  for (const e of exported) {
    const want = protectedRuns(e.body).map((r) => Buffer.from(e.body.slice(r.start, r.end), 'utf8'));
    const out = Buffer.from(e.exported, 'utf8');
    let at = 0;
    for (const b of want) {
      const found = out.indexOf(b, at);
      assert.ok(found >= 0, `${e.id}: a run is missing or out of order`);
      at = found + b.length;
      runs++;
    }
    verifyExport(e.body, e.edits, e.exported, e.id);
  }
  assert.ok(runs > 150, `only ${runs} runs checked — the pages with Gurmukhi were not read`);
});

test('every page: nothing site-only is left outside code, and no link is relative', () => {
  for (const e of exported) {
    const walk = (node, parent) => {
      if (node.type === 'code' || node.type === 'inlineCode') return;
      if (node.type === 'html') assert.equal(parseWidget(node.value), null, `${e.id}: a widget comment is left`);
      if (node.type === 'text' && parent.type !== 'link' && e.left === 0) assert.doesNotMatch(node.value, /\[\[[^\[\]\n]{1,60}\]\]/, `${e.id}: a [[term]] is left`);
      if ((node.type === 'link' || node.type === 'image' || node.type === 'definition') && e.left === 0) {
        assert.match(node.url, /^(?:[a-z][a-z0-9+.-]*:|#)/i, `${e.id}: "${node.url}" is not absolute`);
      }
      (node.children ?? []).forEach((c) => walk(c, node));
    };
    walk(parse(e.exported), null);
  }
});

test('every page: the export opens with its header and carries the title once', () => {
  for (const e of exported) {
    assert.ok(e.markdown.startsWith(`# ${e.title}\n\n`), e.id);
    assert.ok(e.markdown.includes(`- Page: <${e.url}>`), e.id);
    const h1 = parse(e.markdown).children.filter((n) => n.type === 'heading' && n.depth === 1);
    assert.ok(h1.length >= 1, e.id);
    assert.ok(e.minutes >= 1 && Number.isInteger(e.minutes), e.id);
  }
});

test('llms.txt lists every exported page under its sidebar group, and refuses a page it cannot place', () => {
  const entries = exported.map(manifestEntry);
  const text = llmsText(entries, [...sidebarLinks(SIDEBAR)]);
  assert.equal((text.match(/^- \[/gm) ?? []).length, entries.length);
  assert.ok(text.startsWith('# Sri Guru Granth Sahib Ji — Knowledge Base wiki\n'));
  assert.match(text, /^## Get started$/m);
  for (const e of entries) assert.ok(text.includes(`](${e.markdown})`), e.id);
  assert.throws(() => llmsText([...entries, { id: 'x/unplaced', title: 'X', markdown: 'm', description: '' }], [...sidebarLinks(SIDEBAR)]), /missing from the sidebar/);
});
