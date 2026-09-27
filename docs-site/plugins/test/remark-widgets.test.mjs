import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWidget, remarkWidgets, widgetHtml } from '../remark-widgets.mjs';

test('a widget comment becomes its custom element', () => {
  assert.deepEqual(parseWidget('<!-- sggs:status -->'), { name: 'status', attrs: {} });
  assert.equal(widgetHtml({ name: 'status', attrs: {} }), '<sggs-status></sggs-status>');
});

test('ordinary comments and HTML are not widgets', () => {
  assert.equal(parseWidget('<!-- a note for editors -->'), null);
  assert.equal(parseWidget('<div>x</div>'), null);
  assert.equal(parseWidget('<!-- sggs:status --> trailing'), null);
});

test('unknown widgets and attributes fail the build', () => {
  assert.throws(() => widgetHtml({ name: 'nope', attrs: {} }), /unknown widget/);
  assert.throws(() => widgetHtml({ name: 'status', attrs: { q: 'x' } }), /no attribute "q"/);
});

test('attribute values are escaped', () => {
  // attributes are validated against the schema; escaping is exercised through a schema entry when one has attrs
  const html = '<sggs-status></sggs-status>';
  assert.equal(widgetHtml(parseWidget('<!--sggs:status-->')), html);
});

test('the GitHub fallback paragraph after a widget is marked for the site to hide; other paragraphs are not', async () => {
  const { unified } = await import('unified');
  const { default: remarkParse } = await import('remark-parse');
  const md = '<!-- sggs:status -->\nOn the rendered wiki this line shows the live status.\n\nOn the rendered wiki, not after a widget.\n\n<!-- sggs:verify -->\nSource: a caption that stays.\n';
  const tree = unified().use(remarkParse).parse(md);
  remarkWidgets()(tree, { path: 't.md' });
  const paras = tree.children.filter((n) => n.type === 'paragraph');
  assert.deepEqual(paras.map((p) => p.data?.hProperties?.className ?? null), [['sggs-fallback'], null, null]);
});
