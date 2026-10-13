// plugins/remark-adr.mjs: a decision record gets sections and a status badge on the site; its source is untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { remarkAdr } from '../remark-adr.mjs';

const ADR = '**Status:** accepted (2026-09-24, release 1.3.8)\n\n**Context.** Why.\n\n**Decision.** What.\n\n**Consequences.** Then.\n';
const run = (md, path) => { const tree = unified().use(remarkParse).parse(md); remarkAdr()(tree, { path }); return tree; };

test('Context, Decision and Consequences become headings; the text follows without its label', () => {
  const tree = run(ADR, '/repo/docs/adr/0007-three-repositories.md');
  const heads = tree.children.filter((n) => n.type === 'heading').map((h) => h.children[0].value);
  assert.deepEqual(heads, ['Context', 'Decision', 'Consequences']);
  const afterContext = tree.children[tree.children.findIndex((n) => n.type === 'heading') + 1];
  assert.equal(afterContext.children[0].value, 'Why.');
});

test('the status line is a badge named for its status', () => {
  const tree = run(ADR, '/repo/docs-site/.sources/sggs-data/docs/adr/0003-integrity-proofs.md');
  assert.deepEqual(tree.children[0].data.hProperties.className, ['adr-status', 'adr-status--accepted']);
});

test('only decision records are touched', () => {
  const tree = run(ADR, '/repo/docs/process/release.md');
  assert.equal(tree.children.filter((n) => n.type === 'heading').length, 0);
  assert.equal(tree.children[0].data, undefined);
});
