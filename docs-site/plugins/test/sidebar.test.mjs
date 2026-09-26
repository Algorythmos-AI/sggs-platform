// plugins/nav.mjs + sidebar.mjs: the sidebar is built from the pages that exist, every published page
// is placed exactly once, no group is empty, and labels are short and human.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LABEL_MAX, buildSidebar, group, page, pages, readPages, sidebarLinks } from '../nav.mjs';
import { LAYOUT, LABELS, ORDER, BADGES, SIDEBAR } from '../../sidebar.mjs';

const RAW_DIR = /^[a-z0-9-]+$/;

/** A throwaway repository: { 'docs/x/README.md': frontmatter-object | string, ... } */
function fakeRepo(files, sources = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'nav-'));
  for (const [rel, fm] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    const body = typeof fm === 'string' ? fm
      : `---\n${Object.entries(fm).map(([k, v]) => `${k}: ${typeof v === 'object' ? `\n${Object.entries(v).map(([a, b]) => `  ${a}: ${b}`).join('\n')}` : v}`).join('\n')}\n---\n\nText.\n`;
    writeFileSync(path.join(root, rel), body);
  }
  return { root, sources };
}
const quiet = () => {};

test('the real sidebar: every published page is placed exactly once, and no group is empty', () => {
  const found = readPages({ warn: quiet });
  const links = [...sidebarLinks(SIDEBAR)];
  const slugs = links.map((l) => l.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'a page is placed twice');
  assert.deepEqual(new Set(slugs), new Set(found.pages.keys()), 'every published page is in the sidebar, and nothing else');
  const walk = (items) => { for (const it of items) if (it.items) { assert.ok(it.items.length, `empty group ${it.label}`); walk(it.items); } };
  walk(SIDEBAR);
});

test('the real sidebar: labels are short, human and unique among their siblings', () => {
  const check = (items, where) => {
    const seen = new Set();
    for (const it of items) {
      assert.ok(it.label && it.label.length <= LABEL_MAX, `${where} › "${it.label}" is longer than ${LABEL_MAX}`);
      assert.ok(!RAW_DIR.test(it.label), `${where} › "${it.label}" looks like a raw directory name`);
      assert.ok(!seen.has(it.label), `${where} has two items labelled "${it.label}"`);
      seen.add(it.label);
      if (it.items) check(it.items, `${where} › ${it.label}`);
    }
  };
  check(SIDEBAR, 'sidebar');
  for (const [id, label] of Object.entries(LABELS)) assert.ok(label.length <= LABEL_MAX, `LABELS["${id}"]`);
});

test('the real sidebar: labels, order and badges only name pages that exist', () => {
  const found = readPages({ warn: quiet }).pages;
  for (const id of [...Object.keys(LABELS), ...Object.keys(ORDER)]) assert.ok(found.has(id), `sidebar.mjs names "${id}", which is not a published page`);
  for (const l of sidebarLinks(SIDEBAR)) {
    const p = found.get(l.slug);
    if (p.source) assert.deepEqual(l.badge, BADGES[p.source], `${l.slug} is pinned from ${p.source} and says so`);
    else assert.equal(l.badge, undefined, `${l.slug} is this repository's page and carries no badge`);
  }
});

test('the real sidebar: only "Get started" is open by default', () => {
  assert.deepEqual(SIDEBAR.filter((g) => g.collapsed === false).map((g) => g.label), ['Get started']);
});

test('a directory lists its index first ("Overview"), then its pages by sidebar.order, then title', () => {
  const repo = fakeRepo({
    'docs/guide/README.md': { title: 'Guide', sidebar: { order: 0 } },
    'docs/guide/b.md': { title: 'Bravo', sidebar: { order: 2 } },
    'docs/guide/a.md': { title: 'Alpha', sidebar: { order: 1 } },
    'docs/guide/z.md': { title: 'Zed' },
    'docs/guide/y.md': { title: 'Yankee' },
  });
  const sb = buildSidebar([group('Guide', [pages('guide')])], readPages({ ...repo, warn: quiet }));
  assert.deepEqual(sb[0].items.map((i) => [i.label, i.slug]),
    [['Overview', 'guide'], ['Alpha', 'guide/a'], ['Bravo', 'guide/b'], ['Yankee', 'guide/y'], ['Zed', 'guide/z']]);
});

test('drafts and hidden pages are left out (a slug link to a draft fails `astro build`)', () => {
  const repo = fakeRepo({
    'docs/guide/README.md': { title: 'Guide' },
    'docs/guide/draft.md': { title: 'Draft', draft: 'true' },
    'docs/guide/hidden.md': { title: 'Hidden', sidebar: { hidden: 'true' } },
  });
  const sb = buildSidebar([group('Guide', [pages('guide')])], readPages({ ...repo, warn: quiet }));
  assert.deepEqual(sb[0].items.map((i) => i.slug), ['guide']);
});

test('a label comes from LABELS, then sidebar.label, then "Overview" for an index, then the title', () => {
  const repo = fakeRepo({
    'docs/guide/README.md': { title: 'Guide' },
    'docs/guide/a.md': { title: 'A very long title', sidebar: { label: 'Short' } },
    'docs/guide/b.md': { title: 'Bee' },
  });
  const sb = buildSidebar([group('Guide', [pages('guide')])], readPages({ ...repo, warn: quiet }), { labels: { 'guide/b': 'B' } });
  assert.deepEqual(sb[0].items.map((i) => i.label), ['Overview', 'Short', 'B']);
});

test('the build fails on an empty group, a page placed twice, a page placed nowhere, or a missing page', () => {
  const repo = fakeRepo({ 'docs/guide/README.md': { title: 'Guide' }, 'docs/other.md': { title: 'Other' } });
  const found = readPages({ ...repo, warn: quiet });
  assert.throws(() => buildSidebar([group('Guide', [pages('guide')]), group('Empty', [pages('nothing')])], found), /no pages in nothing/);
  assert.throws(() => buildSidebar([group('A', [pages('guide'), page('other')]), group('B', [page('other')])], found), /placed twice/);
  assert.throws(() => buildSidebar([group('Guide', [pages('guide')])], found), /placed in no group: other/);
  assert.throws(() => buildSidebar([group('Guide', [pages('guide'), page('other'), page('ghost')])], found), /no published page "ghost"/);
});

test('pinned pages come from the lock, carry their badge, and are left out (not fatal) when not installed', () => {
  const sources = { sib: { repository: 'o/sib', commit: 'a'.repeat(40), alias: 'sib', include: ['docs/*.md'],
    files: { 'docs/b.md': {}, 'docs/a.md': {}, 'docs/code.py': {} } } };
  const files = {
    'docs/README.md': { title: 'Home' },
    'docs-site/.sources/sib/docs/a.md': { title: 'Alpha' },
    'docs-site/.sources/sib/docs/b.md': { title: 'Bravo' },
    'docs-site/.sources/sib/docs/stale.md': { title: 'No longer pinned' },
  };
  const layout = [group('Sib', [pages('sib', { from: 'sib' })])];
  const badges = { sib: { text: 'sib', variant: 'note' } };

  const missing = fakeRepo(files, sources);
  const warned = [];
  const notInstalled = readPages({ ...missing, warn: (m) => warned.push(m) });
  assert.deepEqual(buildSidebar(layout, notInstalled, { badges }), [], 'a group of only uninstalled pinned pages is dropped');
  assert.match(warned.join(), /sib docs are not installed/);

  const installed = fakeRepo({ ...files, 'docs-site/.sources/sib/.installed.json': '{}' }, sources);
  const sb = buildSidebar(layout, readPages({ ...installed, warn: quiet }), { badges, order: { 'sib/b': 1, 'sib/a': 2 } });
  assert.deepEqual(sb[0].items.map((i) => [i.slug, i.badge.text]), [['sib/b', 'sib'], ['sib/a', 'sib']], 'ordered by ORDER; stale cache files are not pages');
});

test('the layout names every group the owner sees, in this order', () => {
  assert.deepEqual(LAYOUT.map((g) => g.label), ['Get started', 'Scripture 101', 'Architecture', 'Data', 'Search & verification',
    'API', 'iOS app', 'Ship & operate', 'Brand', 'Decisions', 'Reference']);
});
