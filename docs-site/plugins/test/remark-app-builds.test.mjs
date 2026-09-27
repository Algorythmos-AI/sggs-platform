import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLedger, appBuildsHtml } from '../remark-app-builds.mjs';

const LEDGER = JSON.stringify({ schema: 1, builds: [
  { version: '1.3.0', build: 5, profile: 'public', db_sha256: 'f30a2fc0aa', uploaded_at: '2026-09-19T19:32:13Z' },
  { version: '1.3.10', build: 1, profile: 'public', channel: 'appstore', platform_commit: 'b5c6a0d80f92', dataset_commit: 'bc5b0f0c2614', db_sha256: 'b10809c4997b', xcode: '26.5', uploaded_at: '2026-09-25T22:13:11Z' },
] });
const PIN = { repository: 'Algorythmos-AI/gurbani-soul-ios', commit: '2f89359abcdef' };

test('the ledger is read newest first, with defaults for older entries', () => {
  const b = parseLedger(LEDGER);
  assert.equal(b[0].version, '1.3.10');
  assert.equal(b[0].uploaded, '2026-09-25');
  assert.equal(b[1].channel, 'testflight');
  assert.equal(b[1].platform, '');
});

test('the table links commits, names the pin and marks the channel', () => {
  const html = appBuildsHtml(parseLedger(LEDGER), PIN);
  assert.match(html, /<strong>1\.3\.10<\/strong> \(1\)/);
  assert.match(html, /App Store<\/td>/);
  assert.match(html, /TestFlight<\/td>/);
  assert.match(html, /sggs-platform\/commit\/b5c6a0d80f92"><code>b5c6a0d<\/code>/);
  assert.match(html, /blob\/2f89359abcdef\/ios\/testflight-builds\.json/);
  assert.match(html, /All 2 uploads\./);
  assert.ok(html.indexOf('1.3.10') < html.indexOf('1.3.0<'), 'newest first');
});

test('limit keeps the newest N and says so', () => {
  const html = appBuildsHtml(parseLedger(LEDGER), PIN, 1);
  assert.doesNotMatch(html, /1\.3\.0</);
  assert.match(html, /The newest 1 of 2 are shown\./);
});

test('a malformed ledger fails the build', () => {
  assert.throws(() => parseLedger('{}'), /no "builds" array/);
  assert.throws(() => parseLedger(JSON.stringify({ builds: [{ version: '1.0.0' }] })), /lacks version, build or uploaded_at/);
});

test('text from the ledger is escaped', () => {
  const html = appBuildsHtml(parseLedger(JSON.stringify({ builds: [{ version: '<b>', build: 1, uploaded_at: '2026-01-01' }] })), PIN);
  assert.match(html, /&lt;b>/);
  assert.doesNotMatch(html, /<b>/);
});
