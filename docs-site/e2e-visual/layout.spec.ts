import { test, expect } from '@playwright/test';
import { mockApi } from '../e2e/helpers';

// One picture of the top of each kind of page, wide and phone, light and dark. It guards the
// reading layout — header, tabs, title block, type, callouts, steps, tables — against a change
// that no computed-style assertion would notice.
//
// Left out of the comparison (masked), because they change for reasons that are not the layout:
// the sidebar and "On this page" (a new page or heading), the dates under the title, and anything
// a live widget draws.
const PAGES: [string, string][] = [
  ['steps', '/onboarding/run-it-locally/'],
  ['tables', '/data/data-dictionary/'],
  ['poster', '/architecture/search-waterfall/'],
  ['quotations', '/scripture/what-sggs-is/'],
  ['code', '/api/quickstart/'],
  ['procedure', '/process/release/'],
];
const SIZES = { wide: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } } as const;
const MASKED = 'nav.sidebar, starlight-toc, mobile-starlight-toc, .page-meta, sggs-status, sggs-ang-explorer, sggs-waterfall, sggs-verify, sggs-api-try, sggs-progress';

for (const [name, path] of PAGES) {
  for (const [size, viewport] of Object.entries(SIZES)) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${name} · ${size} · ${scheme}`, async ({ browser }) => {
        const context = await browser.newContext({ viewport, colorScheme: scheme, reducedMotion: 'reduce', deviceScaleFactor: 1 });
        const page = await context.newPage();
        await mockApi(page);
        await page.goto(path);
        await page.evaluate((s) => { document.documentElement.dataset.theme = s; }, scheme);
        await page.evaluate(() => document.fonts.ready);
        await expect(page).toHaveScreenshot(`${name}-${size}-${scheme}.png`, { mask: [page.locator(MASKED)] });
        await context.close();
      });
    }
  }
}
