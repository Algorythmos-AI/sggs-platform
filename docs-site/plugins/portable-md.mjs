// A page as portable Markdown: what /md/<id>.md serves, and what "Copy page" puts on the clipboard.
//
// The source Markdown is written for two renderers (GitHub and this site), so it carries things
// only this site understands: `<!-- sggs:… -->` widgets, `[[Term]]` glossary links, relative `.md`
// links, code excerpts that are filled in at build. The export resolves those — and changes
// nothing else. It never re-serialises Markdown: the page is parsed only to learn POSITIONS, a list
// of {start, end, text} edits is made against the original text, and every other character passes
// through untouched (no Unicode normalisation, no line-ending or whitespace changes).
//
// Scripture rule, held mechanically: every run of Gurmukhi in a page is protected. An edit that
// would touch one fails the build; a quotation that contains Gurmukhi is frozen whole (a link inside
// it stays as written); and verifyExport() proves, for every page at every build, that each run is
// in the export, in order, character for character.
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { toString } from 'mdast-util-to-string';
import { parseWidget, FALLBACK } from './remark-widgets.mjs';
import { excerptNodes, resolveTarget } from './remark-code-excerpt.mjs';
import { rewriteLink } from './remark-repo-links.mjs';

/** Gurmukhi (U+0A00–0A7F) and the dandas (U+0964, U+0965), joined by spaces and ZWJ/ZWNJ inside a run. */
const G = '\\u0A00-\\u0A7F\\u0964\\u0965';
const RUN = new RegExp(`[${G}](?:[${G}\\u200C\\u200D ]*[${G}])?`, 'g');
const HAS_GURMUKHI = new RegExp(`[${G}]`);
/** `[[Term]]` or `[[Term|shown]]` as written; in a table cell the bar is escaped (`\|`). */
const SRC_TERM = /\[\[((?:\\\||[^\[\]\n]){1,62})\]\]/g;
const SITE_TERM = /\[\[([^\[\]\n]{1,60})\]\]/g;          // remark-terms.mjs, on the parsed text
const POSTER = /(?:^|\/)diagrams\/posters\/([^/]+\.svg)$/;
const WORDS_PER_MINUTE = 220;

/** Every protected run in `text`: [{ start, end }] (end exclusive), in order. */
export function protectedRuns(text) {
  return [...text.matchAll(RUN)].map((m) => ({ start: m.index, end: m.index + m[0].length }));
}

/** Where the body starts: after a byte-order mark and the `---` frontmatter block, if any. */
export function splitFrontmatter(source) {
  const bom = source.startsWith('﻿') ? 1 : 0;
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(source.slice(bom));
  if (!m) return { frontmatter: '', bodyStart: bom };
  return { frontmatter: m[1], bodyStart: bom + m[0].length };
}

/** Apply sorted, non-overlapping edits to `text`. */
export function applyEdits(text, edits) {
  let out = '', at = 0;
  for (const e of edits) {
    out += text.slice(at, e.start) + e.text;
    at = e.end;
  }
  return out + text.slice(at);
}

/**
 * Prove an export carries its scripture: each protected run of `body` is in `out` at the offset the
 * edits predict, unchanged; the runs of `out` outside inserted text are exactly the body's, in order;
 * and undoing the edits gives the body back. Throws with the first difference.
 */
export function verifyExport(body, edits, out, where = 'page') {
  let shift = 0, i = 0;
  const inserted = [];                                   // ranges of `out` that are new text
  const sorted = edits;
  for (const e of sorted) {
    if (e.text) inserted.push({ start: e.start + shift, end: e.start + shift + e.text.length });
    shift += e.text.length - (e.end - e.start);
  }
  shift = 0;
  const runs = protectedRuns(body);
  for (const r of runs) {
    while (i < sorted.length && sorted[i].end <= r.start) { shift += sorted[i].text.length - (sorted[i].end - sorted[i].start); i++; }
    if (i < sorted.length && sorted[i].start < r.end) throw new Error(`${where}: an edit touches scripture at offset ${r.start} (${sorted[i].kind})`);
    const want = body.slice(r.start, r.end);
    if (out.slice(r.start + shift, r.end + shift) !== want) throw new Error(`${where}: a Gurmukhi run moved or changed at offset ${r.start}`);
  }
  const outside = (r) => !inserted.some((x) => r.start >= x.start && r.end <= x.end);
  const kept = protectedRuns(out).filter(outside).map((r) => out.slice(r.start, r.end));
  const want = runs.map((r) => body.slice(r.start, r.end));
  if (kept.length !== want.length || kept.some((s, k) => s !== want[k])) {
    throw new Error(`${where}: the export has ${kept.length} Gurmukhi run(s) outside inserted text, the source has ${want.length}, or they differ`);
  }
  let undone = '', at = 0, delta = 0;
  for (const e of sorted) {
    undone += out.slice(at, e.start + delta) + body.slice(e.start, e.end);
    at = e.start + delta + e.text.length;
    delta += e.text.length - (e.end - e.start);
  }
  undone += out.slice(at);
  if (undone !== body) throw new Error(`${where}: undoing the edits does not give the source back`);
}

/** The end of an inline link or image destination that starts at `from` (after `](` and spaces). */
function destination(text, from, where) {
  if (text[from] === '<') {
    const close = text.indexOf('>', from);
    if (close === -1 || /[\n<]/.test(text.slice(from + 1, close))) throw new Error(`${where}: unsupported link destination at offset ${from}`);
    return { start: from, end: close + 1, raw: text.slice(from + 1, close) };
  }
  let depth = 0, j = from;
  for (; j < text.length; j++) {
    const ch = text[j];
    if (ch === '\\' && j + 1 < text.length) { j++; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') { if (depth === 0) break; depth--; }
    else if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') break;
  }
  return { start: from, end: j, raw: text.slice(from, j) };
}

/** Where a link or image's destination sits in the body, or throws for a form the export cannot edit. */
function destinationOf(node, body, where) {
  const last = node.children?.[node.children.length - 1];
  let p = last ? last.position.end.offset : node.position.start.offset + (node.type === 'image' ? 2 : 1);
  if (node.type === 'image') {                            // ![alt](url): alt is not a child node
    p = node.position.start.offset + 2;
    let depth = 0;
    for (; p < node.position.end.offset; p++) {
      if (body[p] === '\\') { p++; continue; }
      if (body[p] === '[') depth++;
      else if (body[p] === ']') { if (depth === 0) break; depth--; }
    }
  }
  if (body[p] !== ']' || body[p + 1] !== '(') throw new Error(`${where}: only inline links and images can be exported (found another form at offset ${node.position.start.offset})`);
  let d = p + 2;
  while (d < body.length && /[ \t\r\n]/.test(body[d])) d++;
  const dest = destination(body, d, where);
  if (dest.raw !== node.url) throw new Error(`${where}: link destination "${dest.raw}" uses escapes the export does not rewrite`);
  return dest;
}

const longestBackticks = (s) => Math.max(0, ...[...s.matchAll(/`+/g)].map((m) => m[0].length));

/** The Markdown that stands for one `<!-- sggs:code … -->`: the real excerpt, and where it was read. */
function excerptMarkdown(attrs, { sources, commit, where }) {
  const [code] = excerptNodes(attrs, { sources, commit, where });
  const first = Number(/startLineNumber=(\d+)/.exec(code.meta)[1]);
  const last = first + code.value.split('\n').length - 1;
  const t = resolveTarget(attrs, sources, commit);
  const fence = '`'.repeat(Math.max(3, longestBackticks(code.value) + 1));
  return `${fence}${code.lang}\n${code.value}\n${fence}\n\n*\`${t.display}\`, lines ${first}–${last}, read at \`${t.sha.slice(0, 7)}\`: <${t.url(first, last)}>*`;
}

/**
 * The edits that turn a page's body into portable Markdown.
 * @returns {{ edits: {start:number,end:number,text:string,kind:string}[], words: number, left: number }}
 *   `left` counts edits skipped because they fell inside a frozen quotation.
 */
export function planEdits(body, { repoRel, title, origin, pageUrl, sources, glossary, commit, where = repoRel }) {
  const tree = fromMarkdown(body, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
  const src = (n) => body.slice(n.position.start.offset, n.position.end.offset);
  const edits = [];
  const frozen = [];
  let words = 0, left = 0;

  const add = (start, end, text, kind) => {
    if (frozen.some((f) => start >= f.start && end <= f.end)) { left++; return; }
    edits.push({ start, end, text, kind });
  };
  const count = (text) => text.split(/\s+/).filter(Boolean).length;
  const eol = (at) => (body.startsWith('\r\n', at) ? at + 2 : body[at] === '\n' ? at + 1 : at);

  // the body's `# Title` repeats the frontmatter title (docs_check requires it); the export's header carries it
  const h1 = tree.children.find((n) => n.type === 'heading' && n.depth === 1);
  if (h1 && title && toString(h1).trim() === String(title).trim() && !HAS_GURMUKHI.test(src(h1))) {
    let end = eol(h1.position.end.offset);
    while (end < body.length && (body[end] === '\n' || body.startsWith('\r\n', end))) end = eol(end);
    add(h1.position.start.offset, end, '', 'title');
  }

  const walk = (node, parent, index) => {
    if (node.type === 'blockquote' && HAS_GURMUKHI.test(src(node))) frozen.push({ start: node.position.start.offset, end: node.position.end.offset });
    if (node.type === 'text') {
      words += count(node.value);
      if (node.value.includes('[[') && parent.type !== 'link') terms(node);
      return;
    }
    if (node.type === 'html') { widget(node, parent, index); return; }
    // code and tables are read too (a runbook is mostly both); a diagram's source is not
    if (node.type === 'code') { if (node.lang !== 'mermaid') words += count(node.value); return; }
    if (node.type === 'inlineCode') { words += count(node.value); return; }
    if (node.type === 'link' || node.type === 'image' || node.type === 'definition') link(node);
    (node.children ?? []).forEach((c, i) => walk(c, node, i));
  };

  const terms = (node) => {
    const base = node.position.start.offset;
    const text = src(node);
    let found = 0;
    for (const m of text.matchAll(SRC_TERM)) {
      found++;
      const raw = m[1];
      const bar = raw.search(/\\?\|/);
      const name = (bar === -1 ? raw : raw.slice(0, bar)).trim();
      if (!glossary[name]) throw new Error(`${where}: [[${name}]] is not a glossary term (docs/glossary.md)`);
      const open = base + m.index, close = open + m[0].length;
      if (bar === -1) {
        const lead = raw.length - raw.trimStart().length, trail = raw.length - raw.trimEnd().length;
        add(open, open + 2 + lead, '', 'term');
        add(close - 2 - trail, close, '', 'term');
      } else {
        const barLength = raw[bar] === '\\' ? 2 : 1;
        const shown = raw.slice(bar + barLength);
        if (/\\?\|/.test(shown)) throw new Error(`${where}: [[${raw}]] has more than one "|"`);
        const lead = shown.length - shown.trimStart().length, trail = shown.length - shown.trimEnd().length;
        add(open, open + 2 + bar + barLength + lead, '', 'term');
        add(close - 2 - trail, close, '', 'term');
      }
    }
    // the site finds terms in the parsed text; if the two counts differ, an offset would be wrong
    const site = [...node.value.matchAll(SITE_TERM)].length;
    if (site !== found) throw new Error(`${where}: found ${found} [[term]] in the source of a text run where the site finds ${site}`);
  };

  const widget = (node, parent, index) => {
    const w = parseWidget(node.value);
    if (!w) return;
    const start = node.position.start.offset, end = node.position.end.offset;
    if (w.name === 'code') {
      if (node.position.start.column !== 1) throw new Error(`${where}: <!-- sggs:code --> must start its line (line ${node.position.start.line})`);
      add(start, end, excerptMarkdown(w.attrs, { sources, commit, where }), 'excerpt');
      return;
    }
    const next = parent?.children?.[index + 1];
    const explained = next?.type === 'paragraph' && FALLBACK.test(toString(next).trim());
    // a list of cards and a quiz are already readable text; anything else is live only on the page
    const note = explained || w.name === 'cards' || w.name === 'quiz' ? '' : `*On the wiki this part is live (${w.name}): <${pageUrl}>*`;
    add(start, note ? end : eol(end), note, 'widget');
  };

  const link = (node) => {
    if (node.type === 'image') {
      const poster = POSTER.exec(node.url);
      if (!poster) {
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(node.url)) return;
        throw new Error(`${where}: image "${node.url}" is not a poster; the export has no rule for it`);
      }
      const d = destinationOf(node, body, where);
      add(d.start, d.end, `${origin}/posters/${poster[1]}`, 'image');
      return;
    }
    let to = rewriteLink(node.url, repoRel, sources);
    if (to.startsWith('/')) to = origin + to;
    if (to === node.url) return;
    if (node.type === 'definition') throw new Error(`${where}: a reference-style link definition needs rewriting ("${node.url}"); write it inline`);
    if (frozen.some((f) => node.position.start.offset >= f.start && node.position.end.offset <= f.end)) { left++; return; }
    const d = destinationOf(node, body, where);
    add(d.start, d.end, /[\s()<>]/.test(to) ? `<${to}>` : to, 'link');
  };

  tree.children.forEach((c, i) => walk(c, tree, i));

  edits.sort((a, b) => a.start - b.start || a.end - b.end);
  for (let k = 1; k < edits.length; k++) {
    if (edits[k].start < edits[k - 1].end) throw new Error(`${where}: two edits overlap at offset ${edits[k].start} (${edits[k - 1].kind}, ${edits[k].kind})`);
  }
  const runs = protectedRuns(body);
  for (const e of edits) {
    const hit = runs.find((r) => e.start < r.end && e.end > r.start);
    if (hit) throw new Error(`${where}: a ${e.kind} edit would touch scripture at offset ${hit.start}; the export never rewrites Gurmukhi`);
  }
  return { edits, words, left };
}

/** Minutes to read `words` of prose (at least one). */
export const readingMinutes = (words) => Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));

/** The lines that open every export: what the page is, where it lives, how current it is. */
export function exportHeader({ title, description, pageUrl, updated, verified, pinned }) {
  const lines = [`# ${title}`, ''];
  if (description) lines.push(description, '');
  lines.push(`- Page: <${pageUrl}>`);
  if (updated) lines.push(`- Updated: ${updated}`);
  if (verified) lines.push(`- Verified against: \`${verified.commit.slice(0, 7)}\` on ${verified.date}`);
  if (pinned) lines.push(`- Pinned copy of \`${pinned.repository}\` \`${pinned.rel}\` at \`${pinned.commit.slice(0, 7)}\`; the canonical file is <https://github.com/${pinned.repository}/blob/${pinned.commit}/${pinned.rel}>`);
  lines.push('- From the Sri Guru Granth Sahib Ji — Knowledge Base wiki. Sri Guru Granth Sahib Ji is quoted verbatim, cited by Ang, and never altered.');
  lines.push('', '---', '', '');
  return lines.join('\n');
}

/**
 * One page as portable Markdown.
 * @param {string} source  the file as read from disk (utf8)
 * @returns {{ markdown: string, body: string, exported: string, edits: object[], words: number, minutes: number, left: number }}
 */
export function exportPage(source, ctx) {
  const where = ctx.where ?? ctx.repoRel;
  if (!source.isWellFormed()) throw new Error(`${where}: the file is not well-formed Unicode`);
  const { bodyStart } = splitFrontmatter(source);
  const body = source.slice(bodyStart);
  const { edits, words, left } = planEdits(body, { ...ctx, where });
  const exported = applyEdits(body, edits);
  verifyExport(body, edits, exported, where);
  const header = exportHeader(ctx);
  return { markdown: header + exported.replace(/^(?:\r?\n)+/, ''), body, exported, edits, words, minutes: readingMinutes(words), left };
}
