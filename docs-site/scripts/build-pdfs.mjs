// A PDF of every exported page, made from the built site with the print stylesheet — what
// "Download PDF" in the page menu serves (/pdf/<id>.pdf).
//
// Run by the Astro build itself (astro.config.mjs, when DOCS_PDF=1), not as a step after it: the
// deploy jobs run their own `vercel build`, and only what the build writes into dist/ is deployed.
//
// Each page is opened at its PUBLISHED address (https://docs.gurbanisoul.com/…) with every request
// answered from dist/ on disk. So the links inside a PDF point at the real site, never at a local
// port; nothing is fetched from the network; and the build cannot call production — a request that
// is not a file in dist/ (the live API the widgets ask for, anything on another host) is refused.
// The page prepares itself exactly as it does for the browser's Print (src/widgets/print.ts).
//
// Fail closed: a page that cannot be rendered fails the build. There is no cache yet — every page
// embeds the commit, so a cache keyed on the page would never hit; measure first.
//   node scripts/build-pdfs.mjs [dist]        (the build must already be in dist/)
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { types } from './serve-dist.mjs';

export const ORIGIN = 'https://docs.gurbanisoul.com';
const WORKERS = 4;
const PAGE_TIMEOUT = 60_000;

/** The file in dist/ that answers a path of the site, or null. */
export function fileFor(dist, pathname) {
  let file = path.join(dist, decodeURIComponent(pathname));
  if (!file.startsWith(dist)) return null;
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
  return existsSync(file) && statSync(file).isFile() ? file : null;
}

/** /pdf/<id>.pdf for an exported page id. */
export const pdfPathFor = (id) => `/pdf/${id}.pdf`;

async function render(context, dist, entry) {
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`script error: ${e.message}`));
  try {
    const url = new URL(entry.url);
    const response = await page.goto(ORIGIN + url.pathname, { waitUntil: 'load', timeout: PAGE_TIMEOUT });
    if (response?.status() !== 200) throw new Error(`answered ${response?.status()}`);
    await page.emulateMedia({ media: 'print', colorScheme: 'light' });
    await page.evaluate(async () => {
      await customElements.whenDefined('sggs-page-actions').catch(() => {});
      if (!window.sggsPrint) throw new Error('the print preparation (src/widgets/print.ts) did not load');
      window.sggsPrint.prepare(null);                     // no "Printed on": the same page gives the same PDF
      for (const img of document.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager';
      await Promise.all([...document.images].map((img) => (img.complete ? null : img.decode().catch(() => null))));
      await document.fonts.ready;
    });
    if (problems.length) throw new Error(problems.join('; '));
    const bytes = await page.pdf({ format: 'A4', printBackground: true, tagged: true, outline: true, timeout: PAGE_TIMEOUT });
    const out = path.join(dist, pdfPathFor(entry.id));
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, bytes);
    return bytes.length;
  } finally {
    await page.close();
  }
}

/** Build every PDF into <dist>/pdf/. Returns { count, bytes, ms }. Throws on the first page that fails. */
export async function buildPdfs(dist = 'dist', { log = console.log } = {}) {
  dist = path.resolve(dist);
  const manifest = path.join(dist, 'md-manifest.json');
  if (!existsSync(manifest)) throw new Error(`build-pdfs: ${manifest} is missing — the site must be built first`);
  const pages = JSON.parse(readFileSync(manifest, 'utf8')).pages;
  const started = Date.now();
  const browser = await chromium.launch();
  let bytes = 0;
  try {
    const context = await browser.newContext({ colorScheme: 'light', reducedMotion: 'reduce', locale: 'en-GB', timezoneId: 'UTC' });
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      const file = url.origin === ORIGIN ? fileFor(dist, url.pathname) : null;
      if (!file) return route.abort();                    // the live API, another host, a missing file: refused
      return route.fulfill({ status: 200, contentType: types[path.extname(file)] ?? 'application/octet-stream', body: readFileSync(file) });
    });
    const queue = [...pages];
    const failures = [];
    await Promise.all(Array.from({ length: WORKERS }, async () => {
      for (let entry = queue.shift(); entry; entry = queue.shift()) {
        // read the size first: `bytes += await …` would add to a stale total when workers overlap
        try { const size = await render(context, dist, entry); bytes += size; }
        catch (e) { failures.push(`${entry.id}: ${e.message}`); }
      }
    }));
    if (failures.length) throw new Error(`build-pdfs: ${failures.length} page(s) could not be rendered:\n  ${failures.slice(0, 12).join('\n  ')}`);
  } finally {
    await browser.close();
  }
  const ms = Date.now() - started;
  log(`build-pdfs: ${pages.length} PDFs, ${(bytes / 1048576).toFixed(1)} MB, in ${(ms / 1000).toFixed(0)} s`);
  return { count: pages.length, bytes, ms };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  buildPdfs(process.argv[2] ?? 'dist').catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
}
