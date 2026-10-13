import test from 'node:test';
import assert from 'node:assert/strict';
import { TABS, tabFor, litTab } from '../tabs.mjs';
import { LAYOUT } from '../../sidebar.mjs';
import { readPages } from '../nav.mjs';
import { splitRuns } from '../rehype-lang-pa.mjs';
import { rehypeLangPa } from '../rehype-lang-pa.mjs';

test('every tab names sidebar groups that exist, and no group has two tabs', () => {
  const top = LAYOUT.map((g) => g.label);
  const seen = new Set();
  for (const t of TABS) for (const g of t.groups) {
    assert.ok(top.includes(g), `tab "${t.label}" names a sidebar group that does not exist: ${g}`);
    assert.ok(!seen.has(g), `${g} is in two tabs`); seen.add(g);
  }
  assert.equal(tabFor('Data').label, 'Platform');
  assert.equal(tabFor('Brand'), null);
});

test('the lit tab is the one whose group holds the current page', () => {
  const link = (isCurrent) => ({ type: 'link', isCurrent });
  const side = (where) => [
    { type: 'group', label: 'Data', entries: [link(where === 'data'), { type: 'group', label: 'Runbooks', entries: [link(where === 'deep')] }] },
    { type: 'group', label: 'Brand', entries: [link(where === 'brand')] },
    link(where === 'loose'),
  ];
  assert.equal(litTab(side('data')).label, 'Platform');
  assert.equal(litTab(side('deep')).label, 'Platform');
  assert.equal(litTab(side('brand')), null);
  assert.equal(litTab(side('loose')), null);
});

test('every tab opens a published page', () => {
  const { pages } = readPages();
  for (const t of TABS) assert.ok(pages.has(t.slug), `tab "${t.label}" opens /${t.slug}/, which is not a page`);
});

// Gurmukhi built from code points — none is typed in this file.
const G = (...cps) => String.fromCodePoint(...cps);
const word = G(0x0A38, 0x0A24, 0x0A3F), word2 = G(0x0A28, 0x0A3E, 0x0A2E, 0x0A41), danda = G(0x0965), zwj = G(0x200D);

test('splitRuns cuts at the edges of a run and loses nothing', () => {
  for (const s of [`a ${word} ${word2} ${danda}1${danda} b`, `${word}`, `no runs here`, `(${word}${zwj}${word2})`, `${danda} alone`, ` ${word} `, '']) {
    const parts = splitRuns(s);
    assert.equal(parts.map((p) => p.value).join(''), s);
    for (const p of parts) assert.equal(/[\u0A00-\u0A7F]/.test(p.value), p.pa, JSON.stringify(p));
    for (const p of parts.filter((x) => x.pa)) assert.equal(p.value, p.value.trim(), 'a run has no outer space');
  }
  assert.deepEqual(splitRuns(`x ${word} ${word2} y`).map((p) => p.pa), [false, true, false]);
  assert.equal(splitRuns(`${danda} alone`).some((p) => p.pa), false);
});

test('the tree keeps its text; code blocks, drawings and marked elements are left alone', () => {
  const text = (n) => (n.type === 'text' ? n.value : (n.children ?? []).map(text).join(''));
  const el = (tagName, children, properties = {}) => ({ type: 'element', tagName, properties, children });
  const t = (value) => ({ type: 'text', value });
  const tree = { type: 'root', children: [
    el('p', [t(`before ${word} after`), el('code', [t(word2)])]),
    el('pre', [el('code', [t(word)])]),
    el('svg', [el('text', [t(word)])]),
    el('p', [t(word)], { lang: 'pa' }),
  ] };
  const before = text(tree);
  rehypeLangPa()(tree);
  assert.equal(text(tree), before);
  const [p, pre, svg, marked] = tree.children;
  assert.deepEqual(p.children.map((c) => c.tagName ?? 'text'), ['text', 'span', 'text', 'code']);
  assert.equal(p.children[1].properties.lang, 'pa');
  assert.equal(p.children[3].children[0].properties.lang, 'pa');
  assert.equal(pre.children[0].children[0].type, 'text');
  assert.equal(svg.children[0].children[0].type, 'text');
  assert.equal(marked.children[0].type, 'text');
});
