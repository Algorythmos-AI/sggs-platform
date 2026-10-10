// shots.mjs — a screenshot matrix of the Knowledge Base, for a visual review. Never part of CI.
//
// Every route × width × theme as a full-page PNG, taken headless with Reduce Motion on (so no
// shot catches a transition half way). The site must already be served: `npm run build:deploy`,
// then `cd ../webapp && python3 serve.py`.
//   npm run shots -- [--out DIR] [--base URL] [--routes /a,/b] [--widths 375,1280] [--browser webkit]
//   --out      where the PNGs go (default: a new directory under the system temp dir — never
//              inside the repository; its path is printed at the end)
//   --base     the site to shoot (default http://localhost:7777)
//   --routes   comma-separated paths, query strings allowed (default: ROUTES below)
//   --widths   comma-separated viewport widths (default: WIDTHS below)
//   --browser  chromium (default) or webkit — the engine an iPhone uses
import { chromium, webkit } from '@playwright/test';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const ROUTES = ['/search', '/reader?ang=712', '/nitnem', '/browse', '/themes', '/raag-clock'];
const WIDTHS = [375, 390, 768, 1280];
const THEMES = ['light', 'dark'];
// A viewport height per width (the shot is the full page; this only sets the fold).
const HEIGHT = { 375: 812, 390: 844, 768: 1024, 1280: 800 };

const { values: opt } = parseArgs({ options: {
  out: { type: 'string' }, base: { type: 'string', default: 'http://localhost:7777' },
  routes: { type: 'string' }, widths: { type: 'string' }, browser: { type: 'string', default: 'chromium' },
} });
const base = opt.base.replace(/\/+$/, '');
const routes = opt.routes ? opt.routes.split(',').map((r) => r.trim()).filter(Boolean) : ROUTES;
const widths = opt.widths ? opt.widths.split(',').map(Number).filter((w) => w > 0) : WIDTHS;
const engine = { chromium, webkit }[opt.browser];
if (!engine) { console.error(`--browser must be chromium or webkit, not "${opt.browser}"`); process.exit(2); }

try { await fetch(base + '/api/health'); } catch {
  console.error(`Nothing is serving ${base} — start it first: cd ../webapp && python3 serve.py`);
  process.exit(1);
}

const out = opt.out ? resolve(opt.out) : mkdtempSync(join(tmpdir(), 'sggs-shots-'));
mkdirSync(out, { recursive: true });
// "/reader?ang=712" → "reader-ang-712"
const slug = (route) => route.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'home';

const browser = await engine.launch();
let failed = 0;
for (const width of widths) {
  for (const theme of THEMES) {
    const phone = width < 500;
    const context = await browser.newContext({
      viewport: { width, height: HEIGHT[width] ?? 900 },
      isMobile: phone, hasTouch: phone, deviceScaleFactor: phone ? 2 : 1,
      colorScheme: theme, reducedMotion: 'reduce',
    });
    // The stored choice the theme toggle writes; read by the inline pre-paint script.
    await context.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch (e) {} }, theme);
    const page = await context.newPage();
    for (const route of routes) {
      const file = `${slug(route)}--${width}--${theme}.png`;
      try {
        await page.goto(base + route, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
        }));
        await page.screenshot({ path: join(out, file), fullPage: true });
        console.log(`  ${file}` + (scrollWidth > clientWidth ? `   ← scrolls sideways (${scrollWidth} > ${clientWidth})` : ''));
      } catch (e) {
        failed++;
        console.error(`  ${file}   FAILED: ${String(e.message || e).split('\n')[0]}`);
      }
    }
    await context.close();
  }
}
await browser.close();

const total = routes.length * widths.length * THEMES.length;
console.log(`shots: ${total - failed} of ${total} (${routes.length} routes × ${widths.length} widths × ${THEMES.length} themes, ${opt.browser}) → ${out}`);
process.exit(failed ? 1 : 0);
