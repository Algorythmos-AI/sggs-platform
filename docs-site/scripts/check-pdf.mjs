// The pre-built PDFs, held to what they promise (scripts/build-pdfs.mjs makes them):
//   • one PDF for every exported page, and no stray ones; each opens, has pages, and is titled;
//   • tagged for assistive technology, with bookmarks where the page has sections;
//   • the brand serif is embedded, and EVERY run of Gurmukhi that contains a letter is set in
//     Sant Lipi — a missing or substituted Gurmukhi font fails here, not in a reader's hands.
//     (A vowel sign shown alone on a dotted circle cannot use a range-limited web font; those
//     runs, which only appear where the script itself is being explained, are counted and allowed.)
//   • a quotation's "— Sri Guru Granth Sahib Ji · Ang N" line is on the same sheet as its Gurmukhi;
//   • no link leads to the machine that built it; and the files stay within their size budget.
// A PDF cannot be proven byte-exact for Gurmukhi (shaping reorders glyphs inside the file); the
// verbatim export is the Markdown (plugins/portable-md.mjs). This gate proves font, presence and place.
//
// A build made without DOCS_PDF=1 has no PDFs and announces no "pdf1": then there is nothing to check.
//   node scripts/check-pdf.mjs [dist]
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const dist = path.resolve(process.argv[2] ?? 'dist');
export const FILE_BUDGET = 3 * 1024 * 1024;
export const TOTAL_BUDGET = 75 * 1024 * 1024;
const GURMUKHI = /[਀-੿।॥]/;
// consonants, independent vowels, the letters with nukta, iri/ura/ik-onkar: a run with any of these is a word
const LETTER = /[ਅ-ਹਖ਼-ਫ਼ੲ-ੴ]/;
const CITATION = /— Sri Guru Granth Sahib Ji · Ang \d+/;
const LOCAL = /^(?:https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/|$)|file:|about:)/i;

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const f = path.join(dir, name);
    if (statSync(f).isDirectory()) walk(f, out); else if (f.endsWith('.pdf')) out.push(f);
  }
  return out;
};

/** What one PDF holds: { pages, title, tagged, outline, fonts:Set, links:[], gurmukhi:{runs, sant, signsElsewhere, lettersElsewhere:[]}, strayCitations:[] }. */
export async function inspect(file) {
  const task = getDocument({ data: new Uint8Array(readFileSync(file)), disableFontFace: true, fontExtraProperties: true, verbosity: 0 });
  const doc = await task.promise;
  try {
    const meta = await doc.getMetadata();
    const outline = await doc.getOutline();
    // tagged = the first page has a structure tree with content (the reader's MarkInfo comes back
    // empty for these files even though they carry /Marked true, so the tree itself is the evidence)
    const tree = await (await doc.getPage(1)).getStructTree();
    const out = { pages: doc.numPages, title: meta.info?.Title ?? '', tagged: (tree?.children?.length ?? 0) > 0, outline: outline?.length ?? 0, fonts: new Set(), links: [],
      gurmukhi: { runs: 0, sant: 0, signsElsewhere: 0, lettersElsewhere: [] }, strayCitations: [] };
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      await page.getOperatorList();                              // loads the fonts the page uses
      const text = await page.getTextContent();
      let pageHasGurmukhi = false;
      for (const item of text.items) {
        let font = item.fontName;
        try { font = page.commonObjs.get(item.fontName)?.name ?? font; } catch { /* not loaded: keep the id */ }
        font = String(font).replace(/^[A-Z]{6}\+/, '');
        out.fonts.add(font.replace(/[-_].*$/, ''));
        if (!GURMUKHI.test(item.str)) continue;
        pageHasGurmukhi = true;
        out.gurmukhi.runs++;
        if (/Sant ?Lipi/i.test(font)) out.gurmukhi.sant++;
        else if (LETTER.test(item.str)) out.gurmukhi.lettersElsewhere.push(`page ${n}, in ${font}`);
        else out.gurmukhi.signsElsewhere++;
      }
      const flat = text.items.map((i) => i.str).join(' ');
      if (CITATION.test(flat) && !pageHasGurmukhi) out.strayCitations.push(n);
      for (const a of await page.getAnnotations()) if (a.url) out.links.push(a.url);
    }
    return out;
  } finally {
    await task.destroy();
  }
}

/** The problems with one inspected PDF, as sentences. `html` is the page it was made from. */
export function problemsOf(entry, info, size, html) {
  const p = [];
  if (info.pages < 1) p.push('has no pages');
  if (!info.title.startsWith(entry.title)) p.push(`is titled "${info.title}", not "${entry.title} …"`);
  if (!info.tagged) p.push('is not tagged (no structure for a screen reader)');
  if (/<h2[\s>]/.test(html.slice(html.indexOf('sl-markdown-content'))) && info.outline < 1) p.push('has no bookmarks though the page has sections');
  if (![...info.fonts].some((f) => /SourceSerif/i.test(f))) p.push(`does not embed Source Serif (fonts: ${[...info.fonts].join(', ')})`);
  for (const where of info.gurmukhi.lettersElsewhere.slice(0, 3)) p.push(`sets Gurmukhi outside Sant Lipi (${where})`);
  if (info.gurmukhi.lettersElsewhere.length > 3) p.push(`… and ${info.gurmukhi.lettersElsewhere.length - 3} more Gurmukhi runs outside Sant Lipi`);
  for (const n of info.strayCitations) p.push(`page ${n} carries an Ang citation with no Gurmukhi on the sheet (a quotation was split)`);
  // a page may itself link to a local address (the set-up instructions do); only a link the page did not write is a leak
  const authored = new Set([...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => { try { return new URL(m[1].replace(/&amp;/g, '&')).href; } catch { return m[1]; } }));
  for (const url of info.links) if (LOCAL.test(url) && !authored.has(url)) p.push(`links to the machine that built it: ${url}`);
  if (size > FILE_BUDGET) p.push(`is ${(size / 1048576).toFixed(1)} MB (budget ${(FILE_BUDGET / 1048576).toFixed(0)} MB)`);
  return p;
}

async function main() {
  const home = path.join(dist, 'index.html');
  const announced = existsSync(home) && /name="sggs-docs-features" content="[^"]*\bpdf1\b/.test(readFileSync(home, 'utf8'));
  const dir = path.join(dist, 'pdf');
  if (!announced && !existsSync(dir)) { console.log('check-pdf: this build has no PDFs (DOCS_PDF is not 1) — nothing to check'); return 0; }
  const problems = [];
  if (!announced) problems.push('dist/pdf exists but the build does not announce "pdf1"');
  if (!existsSync(dir)) { console.log('::error::check-pdf: the build announces "pdf1" but dist/pdf is missing'); return 1; }
  const { pages } = JSON.parse(readFileSync(path.join(dist, 'md-manifest.json'), 'utf8'));
  const expected = new Map(pages.map((e) => [path.join(dir, `${e.id}.pdf`), e]));
  const found = walk(dir);
  for (const f of found) if (!expected.has(f)) problems.push(`${path.relative(dist, f)}: no exported page has this PDF`);
  let total = 0, runs = 0, signs = 0;
  const fonts = new Set();
  for (const [file, entry] of expected) {
    const rel = path.relative(dist, file);
    if (!existsSync(file)) { problems.push(`${rel}: missing`); continue; }
    if (entry.pdf !== `https://docs.gurbanisoul.com/${rel}`) problems.push(`${rel}: the manifest does not list it (pdf: ${entry.pdf})`);
    const size = statSync(file).size;
    total += size;
    const html = readFileSync(path.join(dist, entry.id === 'index' ? '' : entry.id, 'index.html'), 'utf8');
    let info;
    try { info = await inspect(file); } catch (e) { problems.push(`${rel}: cannot be read (${e.message})`); continue; }
    runs += info.gurmukhi.sant; signs += info.gurmukhi.signsElsewhere;
    for (const f of info.fonts) fonts.add(f);
    for (const p of problemsOf(entry, info, size, html)) problems.push(`${rel}: ${p}`);
  }
  if (total > TOTAL_BUDGET) problems.push(`the PDFs are ${(total / 1048576).toFixed(0)} MB together (budget ${(TOTAL_BUDGET / 1048576).toFixed(0)} MB)`);
  if (problems.length) {
    console.log(`check-pdf: ${problems.length} problem(s):`);
    for (const p of problems.slice(0, 40)) console.log(`::error::check-pdf: ${p}`);
    return 1;
  }
  console.log(`check-pdf: ${expected.size} PDFs, ${(total / 1048576).toFixed(0)} MB — tagged, titled, bookmarked; ${runs} Gurmukhi runs in Sant Lipi (${signs} isolated signs elsewhere); every Ang citation on its quotation's sheet`);
  console.log(`check-pdf: fonts embedded: ${[...fonts].sort().join(', ')}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) process.exit(await main());
