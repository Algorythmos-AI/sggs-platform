// plugins/git-dates.mjs: every page is dated by the right file, and a shallow clone never shows a wrong date.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { _resetForTests, commitDates, datedFile, parseLog } from '../git-dates.mjs';

test('the newest commit wins: git log lists newest first', () => {
  const log = 't:1758000000\n\ndocs/a.md\ndocs/b.md\nt:1757000000\n\ndocs/a.md\ndocs/c.md\n';
  const d = parseLog(log);
  assert.equal(d.get('docs/a.md').getTime(), 1758000000 * 1000);
  assert.equal(d.get('docs/c.md').getTime(), 1757000000 * 1000);
});

test('a page is dated by its own file, a pinned page by its pin, the API reference by the spec', () => {
  assert.equal(datedFile('data/line-record', '../docs/data/line-record.md'), 'docs/data/line-record.md');
  assert.equal(datedFile('data/answer-protocol', '../docs-site/.sources/sggs-data/Answer-Protocol.md'), 'docs-site/sources.lock.json');
  assert.equal(datedFile('data/answer-protocol', '.sources/sggs-data/Answer-Protocol.md'), 'docs-site/sources.lock.json');
  assert.equal(datedFile('api/reference/operations/meta', undefined), 'contract/openapi.json');
  assert.equal(datedFile('404', 'src/content/docs/404.md'), null);
});

test('a shallow clone shows no dates locally and fails in CI (one commit would date every page)', () => {
  const run = (_git, args) => (args[0] === 'rev-parse' ? 'true\n' : '');
  _resetForTests();
  assert.equal(commitDates({ env: {}, run }).size, 0);
  _resetForTests();
  assert.throws(() => commitDates({ env: { CI: 'true' }, run }), /shallow/);
  _resetForTests();
});

test('this checkout dates its pages', () => {
  _resetForTests();
  const d = commitDates({ env: {} });
  assert.ok(d.get('docs/README.md') instanceof Date);
  _resetForTests();
});
