// plugins/remark-alerts.mjs: notes become asides; quotations stay blockquotes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { remarkAlerts } from '../remark-alerts.mjs';

const run = (md) => { const tree = unified().use(remarkParse).parse(md); remarkAlerts()(tree); return tree.children[0]; };
const cls = (n) => n.data?.hProperties?.className;

test('a bold-led note becomes a note aside; a rule about the text becomes a caution', () => {
  assert.deepEqual(cls(run('> **Stale by design.** Numbers here are those of their day.\n')), ['starlight-aside', 'starlight-aside--note']);
  assert.deepEqual(cls(run('> **Prime directive:** the text is sacred and verbatim.\n')), ['starlight-aside', 'starlight-aside--caution']);
});

test('GitHub alert syntax is honoured and its marker removed', () => {
  const n = run('> [!TIP]\n> Run make doctor first.\n');
  assert.deepEqual(cls(n), ['starlight-aside', 'starlight-aside--tip']);
  assert.equal(n.children[0].children[0].children[0].value.trim(), 'Run make doctor first.');
});

test('a quotation stays a blockquote: plain, or with Gurmukhi even when bold-led', () => {
  assert.equal(run('> A plain quotation.\n').type, 'blockquote');
  assert.equal(run(`> **${String.fromCodePoint(0x0a38)}** a bold Gurmukhi letter\n`).type, 'blockquote');
});
