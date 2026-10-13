import { test, expect, type Page } from '@playwright/test';
import { mockApi } from './helpers';

// The wiki on paper (src/styles/print.css, src/widgets/print.ts). Tested as a dark-theme reader
// printing — dark is this site's default selector, so it is the case that goes wrong.
const open = async (page: Page, path: string) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await mockApi(page);
  await page.goto(path);
  await page.waitForFunction(() => !!window.sggsPrint);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
};
declare global { interface Window { sggsPrint?: { prepare: (d?: Date | null) => void; restore: () => void } } }
const rgb = (page: Page, selector: string, prop: string) => page.locator(selector).first().evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop);

test.describe('printing a page', () => {
  test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'paper has one width'); });

  test('only the article prints, on white, with its address and a colophon', async ({ page }) => {
    await open(page, '/onboarding/run-it-locally/');
    for (const gone of ['header.header', 'nav.sidebar', '.right-sidebar-container', 'sggs-page-actions', '.pagination-links', 'nav.site-footer', '.edit-link']) {
      await expect(page.locator(gone).first(), gone).toBeHidden();
    }
    await expect(page.locator('h1#_top')).toBeVisible();
    expect(await rgb(page, 'body', 'background-color')).toBe('rgb(255, 255, 255)');
    expect(await rgb(page, 'h1#_top', 'color')).toBe('rgb(32, 26, 18)');               // ink, though the reader's theme is dark
    await expect(page.locator('.print-provenance')).toBeVisible();
    await expect(page.locator('.print-provenance')).toContainText('https://docs.gurbanisoul.com/onboarding/run-it-locally/');
    await expect(page.locator('.print-colophon')).toContainText('This copy may be out of date; the page is at https://docs.gurbanisoul.com/onboarding/run-it-locally/');
    expect(await page.locator('meta[name="sggs-docs-features"]').getAttribute('content')).toContain('print1');
  });

  test('on screen none of the paper furniture shows', async ({ page }) => {
    await mockApi(page);
    await page.goto('/onboarding/run-it-locally/');
    await expect(page.locator('.print-provenance')).toBeHidden();
    await expect(page.locator('.print-colophon')).toBeHidden();
    await expect(page.locator('.print-links')).toHaveCount(0);
  });

  test('external addresses are listed once at the end, numbered in the text, and removed afterwards', async ({ page }) => {
    await open(page, '/ios/release-status/');
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(theme).toBe('dark');
    await page.evaluate(() => window.sggsPrint!.prepare(new Date(Date.UTC(2026, 9, 11))));
    const refs = page.locator('.sl-markdown-content sup.print-ref');
    const items = page.locator('.print-links li');
    expect(await items.count()).toBeGreaterThan(0);
    const urls = await items.allTextContents();
    expect(new Set(urls).size, 'each address once').toBe(urls.length);
    for (const u of urls) expect(u).toMatch(/^https?:\/\//);
    expect(urls.every((u) => !u.startsWith('http://127.0.0.1'))).toBe(true);           // internal links are not listed
    const numbers = (await refs.allTextContents()).map(Number);
    expect(Math.max(...numbers)).toBe(urls.length);
    expect(await page.evaluate(() => document.documentElement.dataset.theme), 'code blocks print in their light colours').toBe('light');
    await expect(page.locator('.print-colophon__printed')).toHaveText('Printed 11 October 2026.');

    await page.evaluate(() => window.sggsPrint!.restore());
    await expect(refs).toHaveCount(0);
    await expect(page.locator('.print-links')).toHaveCount(0);
    await expect(page.locator('.print-colophon__printed')).toHaveText('');
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
  });

  test('a quotation and its Ang stay on one sheet; Gurmukhi is ink', async ({ page }) => {
    await open(page, '/scripture/what-sggs-is/');
    const quote = page.locator('.sl-markdown-content blockquote').first();
    expect(await quote.evaluate((e) => getComputedStyle(e).breakInside)).toBe('avoid');
    await expect(quote).toContainText('— Sri Guru Granth Sahib Ji · Ang 1');
    expect(await rgb(page, '.sl-markdown-content blockquote', 'color')).toBe('rgb(32, 26, 18)');
  });

  test('a diagram prints its light drawing; a poster fits one sheet with its steps listed; a live widget says what it is', async ({ page }) => {
    await open(page, '/architecture/overview/');
    await expect(page.locator('.diagram .mmd--light').first()).toBeVisible();
    await expect(page.locator('.diagram .mmd--dark').first()).toBeHidden();
    const svg = page.locator('.poster__canvas svg').first();
    const mm = (await svg.boundingBox())!.height * 25.4 / 96;
    expect(mm, 'the poster fits an A4 sheet').toBeLessThanOrEqual(206);
    await expect(page.locator('.poster__print-steps').first()).toBeVisible();
    expect(await page.locator('.poster__print-steps').first().locator('li').count()).toBeGreaterThan(2);
    await expect(page.locator('.wt__bar').first()).toBeHidden();

    await open(page, '/architecture/search-waterfall/');
    const widget = page.locator('sggs-waterfall').first();
    expect(await widget.evaluate((e) => getComputedStyle(e, '::before').content)).toContain('Interactive on the web');
  });

  test('tables are tables again, with a header for every sheet; code wraps', async ({ page }) => {
    await open(page, '/data/data-dictionary/');
    const table = page.locator('.sl-markdown-content table').first();
    expect(await table.evaluate((e) => getComputedStyle(e).display)).toBe('table');
    expect(await table.locator('thead').evaluate((e) => getComputedStyle(e).display)).toBe('table-header-group');
    await open(page, '/onboarding/run-it-locally/');
    expect(await page.locator('.sl-markdown-content pre').first().evaluate((e) => getComputedStyle(e).whiteSpace)).toBe('pre-wrap');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
