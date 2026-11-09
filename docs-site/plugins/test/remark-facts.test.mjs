import test from 'node:test';
import assert from 'node:assert/strict';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { toString } from 'mdast-util-to-string';
import { remarkFacts, FACT_MARKER } from '../remark-facts.mjs';

const parse = (md) => fromMarkdown(md, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
const htmlNodes = (n) => (n.type === 'html' ? [n] : (n.children ?? []).flatMap(htmlNodes));

test('fact markers are dropped and the value stays as text', () => {
  const t = parse('The API serves <!--fact:routes-->29<!--/fact--> routes in <!--fact:contexts:words-->five<!--/fact--> contexts.');
  remarkFacts()(t);
  assert.equal(htmlNodes(t).length, 0);
  assert.equal(toString(t), 'The API serves 29 routes in five contexts.');
});

test('markers inside a table cell are dropped too', () => {
  const t = parse('| a | b |\n|---|---|\n| version | <!--fact:app_version-->1.6.3<!--/fact--> |\n');
  remarkFacts()(t);
  assert.equal(htmlNodes(t).length, 0);
  assert.match(toString(t), /1\.6\.3/);
});

test('other comments and widgets are kept', () => {
  const t = parse('<!-- sggs:repo-map -->\n\nText <!-- a note --> here.');
  remarkFacts()(t);
  assert.equal(htmlNodes(t).length, 2);
  assert.ok(!FACT_MARKER.test('<!-- sggs:repo-map -->'));
  assert.ok(FACT_MARKER.test('<!--fact:routes-->') && FACT_MARKER.test('<!--/fact-->'));
});
