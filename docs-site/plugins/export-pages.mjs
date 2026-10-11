// Which pages are exported as Markdown, and the export of each — the one place the /md/ routes,
// /md-manifest.json, /llms.txt and the tests all read, so they can never disagree about the set.
// Every published page is exported (the home page too); the 404 page and the generated API
// reference have no Markdown source and are not.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { REPO_ROOT, loadSources, originOf, sitePathForId, idForRepoPath } from './paths.mjs';
import { readPages } from './nav.mjs';
import { loadGlossary } from './remark-terms.mjs';
import { commitDates } from './git-dates.mjs';
import { exportPage } from './portable-md.mjs';

export const SITE_ORIGIN = 'https://docs.gurbanisoul.com';
const HOME = 'docs/README.md';

/** Every exported page, home first: [{ id, repoPath, source }]. Throws when a sibling's docs are not installed. */
export function listExportPages({ root = REPO_ROOT, sources = loadSources() } = {}) {
  const { pages, missingSources } = readPages({ root, sources, warn: () => {} });
  if (missingSources.size) {
    throw new Error(`export: ${[...missingSources].join(', ')} docs are not installed — run python3 tools/fetch_sibling_docs.py (the Markdown export covers every published page or none)`);
  }
  const home = { id: idForRepoPath(HOME, sources), repoPath: HOME, source: null, isIndex: true };
  return [home, ...[...pages.values()].map(({ id, repoPath, source, isIndex }) => ({ id, repoPath, source, isIndex: !!isIndex }))];
}

const day = (date) => (date ? date.toISOString().slice(0, 10) : null);

let shared = null;
const context = (options) => (shared ??= {
  sources: options.sources ?? loadSources(),
  glossary: options.glossary ?? loadGlossary(),
  dates: options.dates ?? commitDates(),
});

/**
 * One page, read from disk and exported.
 * @returns {{ id, url, mdPath, title, description, updated, minutes, words, markdown, source, exported, body, edits }}
 */
export function exportOne(page, options = {}) {
  const { root = REPO_ROOT, origin = SITE_ORIGIN, commit = process.env.PUBLIC_DOCS_COMMIT } = options;
  const { sources, glossary, dates } = options.sources && options.glossary && options.dates ? options : context(options);
  const bytes = readFileSync(path.join(root, page.repoPath));
  const source = bytes.toString('utf8');
  if (!Buffer.from(source, 'utf8').equals(bytes)) throw new Error(`${page.repoPath}: not valid UTF-8`);
  const fm = parseFrontmatter(source).frontmatter ?? {};
  const o = originOf(page.repoPath, sources);
  const pinned = o?.kind === 'sibling' ? { repository: o.repository, commit: o.commit, rel: o.rel } : null;
  const dated = pinned ? 'docs-site/sources.lock.json' : page.repoPath;
  const url = origin + sitePathForId(page.id);
  const title = String(fm.title ?? page.id);
  const description = fm.description ? String(fm.description) : '';
  const updated = day(dates.get(dated));
  const out = exportPage(source, {
    repoRel: page.repoPath, title, description, origin, pageUrl: url, updated, pinned, sources, glossary, commit,
    verified: fm.verified?.commit ? { commit: String(fm.verified.commit), date: String(fm.verified.date) } : null,
  });
  return { id: page.id, url, mdPath: `/md/${page.id}.md`, title, description, updated, source, ...out };
}

/** What /md-manifest.json lists for a page (no bodies). */
export const manifestEntry = (p) => ({
  id: p.id, title: p.title, description: p.description, url: p.url, markdown: SITE_ORIGIN + p.mdPath,
  updated: p.updated, words: p.words, readingMinutes: p.minutes,
});

export function _resetForTests() { shared = null; ids = null; facts = null; }

/**
 * /llms.txt (llmstxt.org): what this site is and one line per page, grouped as the sidebar groups
 * them, each linking to the page's Markdown. `links` is sidebarLinks(SIDEBAR): [{ slug, trail }].
 */
export function llmsText(entries, links) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const groups = new Map();
  const placed = new Set();
  for (const link of links) {
    const entry = byId.get(link.slug);
    if (!entry) continue;                                  // the generated API reference: no Markdown
    const group = link.trail[0] ?? 'Reference';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(entry);
    placed.add(entry.id);
  }
  const line = (e) => `- [${e.title}](${e.markdown})${e.description ? `: ${e.description}` : ''}`;
  const home = byId.get('index');
  const out = [
    '# Sri Guru Granth Sahib Ji — Knowledge Base wiki',
    '',
    '> The engineering wiki of the Knowledge Base and the Gurbani Soul app: how the scripture corpus is built and proven, the search and verification engines, the API, the iOS app, and how it all ships.',
    '',
    'Sri Guru Granth Sahib Ji is quoted here verbatim, cited by Ang, and never altered. Quote Gurbani only as it is printed on a page, with its Ang; do not generate, translate or transliterate scripture.',
    '',
    'Each link is a page as Markdown. The same page for people is at the address given at the top of the file.',
    '',
  ];
  if (home) out.push('## Start', '', line(home), '');
  for (const [group, list] of groups) out.push(`## ${group}`, '', ...list.map(line), '');
  const rest = entries.filter((e) => e.id !== 'index' && !placed.has(e.id));
  if (rest.length) throw new Error(`llms.txt: exported pages missing from the sidebar: ${rest.map((e) => e.id).join(', ')}`);
  return out.join('\n');
}

let ids = null;
/** The ids of every exported page (memoised for the build): which pages have a /md/<id>.md. */
export function exportedIds() {
  return (ids ??= new Set(listExportPages().map((p) => p.id)));
}

/** Under this many words a reading time is noise, not information. */
export const READING_MIN_WORDS = 150;

let facts = null;
/**
 * What the page chrome needs to know about each exported page (memoised for the build):
 * id -> { minutes, words, isIndex }. `isIndex` is a section's overview page (and the home page).
 */
export function pageFacts() {
  return (facts ??= new Map(listExportPages().map((p) => {
    const e = exportOne(p);
    return [p.id, { minutes: e.minutes, words: e.words, isIndex: p.isIndex }];
  })));
}

/** "4 min read" for a page, or null where it would not help: overviews, short pages, pages with no export. */
export function readingLabel(id) {
  const f = pageFacts().get(id);
  if (!f || f.isIndex || f.words < READING_MIN_WORDS) return null;
  return `${f.minutes} min read`;
}
