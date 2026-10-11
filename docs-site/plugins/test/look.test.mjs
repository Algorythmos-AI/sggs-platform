// The reading layout (src/styles/look.css): the callout tints are what the brand tokens say they
// are and stay readable, and the summary under a title never repeats the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, SITE_DIR } from '../paths.mjs';
import { pageFacts, summaryFor, SUMMARY_MIN } from '../export-pages.mjs';

const tokens = JSON.parse(readFileSync(path.join(REPO_ROOT, 'docs', 'brand', 'tokens.json'), 'utf8'));
const css = readFileSync(path.join(SITE_DIR, 'src', 'styles', 'look.css'), 'utf8');
const theme = readFileSync(path.join(SITE_DIR, 'src', 'styles', 'theme.css'), 'utf8');

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, share) => '#' + rgb(a).map((v, i) => Math.round(v * share + rgb(b)[i] * (1 - share)).toString(16).padStart(2, '0')).join('');
const luminance = (hex) => rgb(hex).map((v) => v / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

// kind -> the token whose colour is the rule; the page and ink colours are theme.css's own
const KINDS = { '': tokens.status.info, '--tip': tokens.status.positive, '--caution': tokens.soul.accent, '--danger': tokens.status.negative };
const page = (leg) => new RegExp(leg === 0 ? /:root\[data-theme="light"\]\s*\{[^}]*--sl-color-bg:\s*(#[0-9a-f]{6})/i : /:root\s*\{[^}]*--sl-color-bg:\s*(#[0-9a-f]{6})/i).exec(theme)[1];
const ink = (leg) => new RegExp(leg === 0 ? /:root\[data-theme="light"\]\s*\{[^}]*--sgs-ink:\s*(#[0-9a-f]{6})/i : /:root\s*\{[^}]*--sgs-ink:\s*(#[0-9a-f]{6})/i).exec(theme)[1];
const tintIn = (kind, leg) => {
  const selector = (leg === 1 ? ':root:not\\(\\[data-theme="light"\\]\\) ' : '(?:^|\\n)') + `\\.starlight-aside${kind}\\s*\\{[^}]*--callout-tint:\\s*(#[0-9a-f]{6})`;
  const m = new RegExp(selector, 'i').exec(css);
  assert.ok(m, `no tint for .starlight-aside${kind}, leg ${leg}`);
  return m[1].toLowerCase();
};

test('each callout tint is its status colour mixed into the page: 10% on paper, 14% on ink', () => {
  for (const [kind, token] of Object.entries(KINDS)) {
    for (const leg of [0, 1]) {
      const want = mix(token[leg].toLowerCase(), page(leg).toLowerCase(), leg === 0 ? 0.10 : 0.14);
      assert.equal(tintIn(kind, leg), want, `.starlight-aside${kind || ' (note)'} ${leg ? 'dark' : 'light'}`);
    }
  }
});

test('on every tint, ink reads at 4.5:1 and the rule shows at 3:1', () => {
  for (const [kind, token] of Object.entries(KINDS)) {
    for (const leg of [0, 1]) {
      const tint = tintIn(kind, leg);
      assert.ok(contrast(ink(leg), tint) >= 4.5, `ink on ${tint}: ${contrast(ink(leg), tint).toFixed(2)}`);
      assert.ok(contrast(token[leg], tint) >= 3, `rule ${token[leg]} on ${tint}: ${contrast(token[leg], tint).toFixed(2)}`);
    }
  }
});

test('a quotation is never tinted, and gold is never text', () => {
  const quote = /\.sl-markdown-content blockquote\s*\{([^}]*)\}/.exec(css)[1];
  assert.match(quote, /background:\s*none/);
  assert.match(quote, /border-inline-start:\s*2px solid var\(--sgs-kraft\)/);
  assert.doesNotMatch(css, /color:\s*var\(--sgs-accent-fill\)/);
  assert.doesNotMatch(css, /color:\s*#ffbc0d/i);
  assert.doesNotMatch(css, /:lang\(pa\)\s*\{|font-family:[^;]*Sant Lipi/, 'how Gurmukhi is drawn belongs to theme.css alone');
});

test('the summary under a title is the description — unless it would only repeat the page', () => {
  const facts = pageFacts();
  assert.equal(summaryFor('index'), null, 'not on the home page');
  let shown = 0;
  for (const [id, f] of facts) {
    const s = summaryFor(id);
    if (f.pinned) assert.equal(s, null, `${id}: a pinned page's description is its first paragraph`);
    if (s) {
      shown++;
      assert.equal(s, f.description);
      assert.ok(s.length >= SUMMARY_MIN, id);
      assert.notEqual(s.slice(0, 40).toLowerCase(), f.lead.slice(0, 40).toLowerCase(), `${id}: repeats the first paragraph`);
    }
  }
  assert.ok(shown > 80, `only ${shown} pages have a summary`);
  assert.equal(summaryFor('no/such/page'), null);
});
