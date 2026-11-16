import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { docsHealthHtml, readHealth, remarkDocsHealth, NOT_MEASURED } from '../remark-docs-health.mjs';

const H = {
  generated: '2026-11-09', commit: 'f8b2e506d8bc', window_days: 30, stale_days: 60, pages: 130, stamped: 67, fresh: 58,
  fresh_pct: 86.6, stale_by_reason: { 'code-changed': 9 }, median_stamp_age_days: 43,
  coupling_debt: { merges: 59, merges_with_debt: 28, page_flags: 70 },
  code_commits_with_docs: { code_commits: 104, with_docs: 49, pct: 47.1 },
};

const tree = () => ({ type: 'root', children: [{ type: 'html', value: '<sggs-docs-health></sggs-docs-health>' }] });

test('the health table shows each number', () => {
  const html = docsHealthHtml(H);
  assert.match(html, /^<sggs-docs-health><table class="docs-health">/);
  assert.match(html, /86\.6% \(58 of 67\)/);
  assert.match(html, /9 cited code changed since the stamp/);
  assert.match(html, /28 of 59 merges/);
  assert.match(html, /47\.1% \(49 of 104\)/);
  assert.match(html, /<code>f8b2e506d8bc<\/code>/);
  assert.ok(!/Sibling pins/.test(html), 'no lag row without lag data');
  assert.match(docsHealthHtml({ ...H, sibling_pin_lag: { 'sggs-data': { commits: 3 } } }), /sggs-data: 3 commits behind/);
  assert.ok(!/Code areas/.test(html), 'no areas row without area data');
  assert.match(docsHealthHtml({ ...H, code_areas: { total: 61, covered: 45, exempt: 4, backlog: 12, missing: 0 } }),
    /45 of 61 \(4 exempt, 12 in the backlog with no page yet\)/);
});

test('without .health.json the widget says it was not measured', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'health-'));
  const t = tree();
  remarkDocsHealth({ file: path.join(dir, 'absent.json') })(t);
  assert.ok(t.children[0].value.includes(NOT_MEASURED));
  assert.equal(readHealth(path.join(dir, 'absent.json')), null);
  writeFileSync(path.join(dir, 'bad.json'), '{not json');
  assert.equal(readHealth(path.join(dir, 'bad.json')), null);
});

test('with .health.json the widget renders the table', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'health-'));
  writeFileSync(path.join(dir, 'h.json'), JSON.stringify(H));
  const t = tree();
  remarkDocsHealth({ file: path.join(dir, 'h.json') })(t);
  assert.match(t.children[0].value, /<table class="docs-health">/);
});

test('values are escaped', () => {
  assert.ok(!docsHealthHtml({ ...H, commit: '<x>' }).includes('<x>'));
});
