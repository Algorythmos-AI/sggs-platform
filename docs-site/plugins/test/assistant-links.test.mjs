// The outbound assistant links: what the instruction says, and that a link always fits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { assistantPrompt, assistantLinks, PROMPT_MAX, URL_MAX } from '../assistant-links.mjs';
import { listExportPages, exportOne, manifestEntry } from '../export-pages.mjs';

const page = { url: 'https://docs.gurbanisoul.com/md/api/quickstart.md', title: 'Quickstart' };

test('the instruction names the page, holds the scripture rule and stands on its own', () => {
  const p = assistantPrompt(page);
  assert.ok(p.startsWith(`Read this page before you answer: ${page.url}\n`));
  assert.match(p, /Answer only from that page\. If you cannot open it, say so and stop\./);
  assert.match(p, /Never quote, translate or transliterate Gurbani from memory/);
  assert.match(p, /"— Sri Guru Granth Sahib Ji · Ang N"/);
  assert.ok(p.endsWith('then ask for my question.'), 'valid when an assistant sends it at once');
  assert.ok(p.length <= PROMPT_MAX, `${p.length} characters`);
});

test('the links carry the encoded instruction to each service', () => {
  const { chatgpt, claude } = assistantLinks(page);
  assert.ok(chatgpt.startsWith('https://chatgpt.com/?hints=search&q='));
  assert.ok(claude.startsWith('https://claude.ai/new?q='));
  assert.equal(decodeURIComponent(claude.split('?q=')[1]), assistantPrompt(page));
  assert.equal(decodeURIComponent(chatgpt.split('&q=')[1]), assistantPrompt(page));
  assert.doesNotMatch(claude, /[\s"<>]/, 'nothing left unencoded');
});

test('a title that would make a link too long is dropped, never truncated mid-word', () => {
  const long = { url: page.url, title: 'A very long title '.repeat(120) };
  const { claude } = assistantLinks(long);
  assert.ok(claude.length <= URL_MAX);
  assert.match(decodeURIComponent(claude), /It is a page of the Sri Guru Granth Sahib Ji — Knowledge Base wiki\./);
  assert.throws(() => assistantLinks({ url: 'https://x/' + 'a'.repeat(URL_MAX), title: '' }), /characters/);
});

test('every published page: the instruction and both links fit', () => {
  for (const p of listExportPages()) {
    const e = manifestEntry(exportOne(p));
    const prompt = assistantPrompt({ url: e.markdown, title: e.title });
    const links = assistantLinks({ url: e.markdown, title: e.title });
    assert.ok(links.chatgpt.length <= URL_MAX && links.claude.length <= URL_MAX, e.id);
    if (decodeURIComponent(links.claude).includes(`"${e.title}"`)) assert.ok(prompt.length <= PROMPT_MAX + 120, `${e.id}: ${prompt.length}`);
  }
});
