// The pre-built PDFs: where a page's file comes from, and what the gate refuses (scripts/check-pdf.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileFor, pdfPathFor, ORIGIN } from '../../scripts/build-pdfs.mjs';
import { problemsOf, FILE_BUDGET } from '../../scripts/check-pdf.mjs';

test('a request is answered from dist/ or not at all', () => {
  const dist = mkdtempSync(path.join(tmpdir(), 'pdf-dist-'));
  mkdirSync(path.join(dist, 'api', 'quickstart'), { recursive: true });
  writeFileSync(path.join(dist, 'index.html'), 'home');
  writeFileSync(path.join(dist, 'api', 'quickstart', 'index.html'), 'page');
  assert.equal(fileFor(dist, '/'), path.join(dist, 'index.html'));
  assert.equal(fileFor(dist, '/api/quickstart/'), path.join(dist, 'api', 'quickstart', 'index.html'));   // a wiki page under /api/
  assert.equal(fileFor(dist, '/api/health'), null);                 // the live API is not a file: refused
  assert.equal(fileFor(dist, '/../etc/passwd'), null);
  assert.equal(fileFor(dist, '/missing.css'), null);
  assert.equal(pdfPathFor('api/quickstart'), '/pdf/api/quickstart.pdf');
  assert.equal(ORIGIN, 'https://docs.gurbanisoul.com');
});

const entry = { id: 'x', title: 'A page' };
const html = '<div class="sl-markdown-content"><h2>One</h2><a href="http://localhost:7777">run it</a></div>';
const good = () => ({ pages: 2, title: 'A page · Sri Guru Granth Sahib Ji — Knowledge Base', tagged: true, outline: 1, fonts: new Set(['SourceSerif4Variable', 'SantLipi']),
  links: ['https://docs.gurbanisoul.com/x/', 'http://localhost:7777/'], gurmukhi: { runs: 3, sant: 3, signsElsewhere: 0, lettersElsewhere: [] }, strayCitations: [] });

test('a sound PDF has no problems — a local address the page itself links to is not a leak', () => {
  assert.deepEqual(problemsOf(entry, good(), 1000, html), []);
});

test('each promise, broken, is reported', () => {
  const broken = (change) => { const info = good(); change(info); return problemsOf(entry, info, 1000, html).join(' | '); };
  assert.match(broken((i) => { i.pages = 0; }), /no pages/);
  assert.match(broken((i) => { i.title = 'Untitled'; }), /is titled "Untitled"/);
  assert.match(broken((i) => { i.tagged = false; }), /not tagged/);
  assert.match(broken((i) => { i.outline = 0; }), /no bookmarks/);
  assert.match(broken((i) => { i.fonts = new Set(['Times']); }), /does not embed Source Serif/);
  assert.match(broken((i) => { i.gurmukhi.lettersElsewhere = ['page 1, in DejaVuSans']; }), /Gurmukhi outside Sant Lipi \(page 1, in DejaVuSans\)/);
  assert.match(broken((i) => { i.strayCitations = [2]; }), /page 2 carries an Ang citation with no Gurmukhi/);
  assert.match(broken((i) => { i.links.push('http://127.0.0.1:4361/glossary/'); }), /links to the machine that built it/);
  assert.match(problemsOf(entry, good(), FILE_BUDGET + 1, html).join(), /budget/);
});

test('isolated signs set elsewhere are allowed; a page with no sections needs no bookmarks', () => {
  const info = good();
  info.gurmukhi.signsElsewhere = 4;
  info.outline = 0;
  info.links = ['https://docs.gurbanisoul.com/x/'];              // this page links to nothing local
  assert.deepEqual(problemsOf(entry, info, 1000, '<div class="sl-markdown-content"><p>No sections.</p></div>'), []);
});
