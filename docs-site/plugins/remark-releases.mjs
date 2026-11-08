// <!-- sggs:releases --> becomes the release timeline, read at build from CHANGELOG.md:
// every `## [X.Y.Z] — date — title` section (the Keep-a-Changelog part), with how many Added /
// Changed / Fixed bullets it has and a link to the GitHub release. The older prose sections are
// listed by heading. <sggs-releases> adds a filter box on the site.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { visit } from 'unist-util-visit';
import { REPO_ROOT, PLATFORM_REPO } from './paths.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export function parseChangelog(text) {
  const out = [];
  let cur = null;
  for (const line of text.split('\n')) {
    let m = /^## \[(\d+\.\d+\.\d+)\]\s*—\s*(\d{4}-\d{2}-\d{2})(?:\s*—\s*(.+))?$/.exec(line);
    if (m) { cur = { version: m[1], date: m[2], title: (m[3] ?? '').trim(), kinds: {}, legacy: false }; out.push(cur); continue; }
    m = /^## (?:v|iOS )(\S.*?)\s*—\s*(\d{4}-\d{2}-\d{2})\s*—\s*(.+)$/.exec(line);
    if (m) { cur = { version: m[1], date: m[2], title: m[3].trim(), kinds: {}, legacy: true }; out.push(cur); continue; }
    if (/^## /.test(line)) { cur = null; continue; }
    if (!cur) continue;
    const k = /^### (\w+)/.exec(line);
    if (k) { cur._kind = k[1]; cur.kinds[k[1]] ??= 0; continue; }
    if (/^- /.test(line) && cur._kind) {
      cur.kinds[cur._kind]++;
      // no intro paragraph: the first entry's bold lead names the release
      if (!cur.title && !cur._lead) cur._lead = /^- \*\*(.+?)\*\*/.exec(line)?.[1] ?? '';
      continue;
    }
    // Since 1.4.1 a release's summary is the paragraph under its heading, not the heading's third
    // part: collect it (hard-wrapped lines included) until the first blank line or ### heading.
    if (!cur.title && !cur._kind && !cur._paraDone) {
      if (line.trim()) cur._para = `${cur._para ?? ''} ${line.trim()}`;
      else if (cur._para) cur._paraDone = true;
    }
  }
  for (const r of out) {
    if (!r.title) r.title = firstSentence(plain(r._para ?? '')) || plain(r._lead ?? '').replace(/[.:]$/, '');
    delete r._kind; delete r._para; delete r._paraDone; delete r._lead;
  }
  return out;
}

/** Markdown inline marks out: `**x**`, `*x*`, `` `x` ``, `[x](y)` -> x. */
function plain(s) {
  return s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*?([^*]+)\*\*?/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\s+/g, ' ').trim();
}

/** The paragraph's first sentence: up to the first full stop that ends a sentence. */
function firstSentence(s) {
  const m = /^(.+?[.!?])(?:\s|$)/.exec(s);
  return (m ? m[1] : s).replace(/[.]$/, '');
}

export function releasesHtml(releases, limit = 0) {
  const shown = limit > 0 ? releases.slice(0, limit) : releases;
  return `<sggs-releases${limit > 0 ? ` limit="${limit}"` : ''}><ol class="releases">${shown.map((r) => {
    const tag = r.legacy ? '' : `https://github.com/${PLATFORM_REPO}/releases/tag/v${r.version}`;
    const kinds = Object.entries(r.kinds).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(' · ');
    const text = `${r.version} ${r.date} ${r.title}`.toLowerCase();
    return `<li class="release" data-text="${esc(text)}"><span class="release__v">${tag ? `<a href="${esc(tag)}">v${esc(r.version)}</a>` : esc(r.version)}</span><span class="release__d">${esc(r.date)}</span><span class="release__t">${esc(r.title || '—')}${kinds ? ` <span class="release__k">· ${esc(kinds)}</span>` : ''}</span></li>`;
  }).join('')}</ol></sggs-releases>`;
}

export function remarkReleases(options = {}) {
  const file = options.file ?? path.join(REPO_ROOT, 'CHANGELOG.md');
  return (tree) => {
    visit(tree, 'html', (node) => {
      const m = /^<sggs-releases\b([^>]*)>\s*<\/sggs-releases>$/.exec(node.value.trim());
      if (!m) return;
      const limit = Number(/\blimit="(\d+)"/.exec(m[1])?.[1] ?? 0);
      node.value = releasesHtml(parseChangelog(readFileSync(file, 'utf8')), limit);
    });
  };
}
