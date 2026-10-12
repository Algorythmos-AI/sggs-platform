import { test, expect, type Page } from '@playwright/test';
import { mockApi } from './helpers';

// The section tabs (src/components/Header.astro, plugins/tabs.mjs) and Gurmukhi marked as Punjabi
// (plugins/rehype-lang-pa.mjs).
const open = async (page: Page, path: string) => { await mockApi(page); await page.goto(path); await page.evaluate(() => document.fonts.ready); };
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('section tabs', () => {
  test('on a wide screen: five tabs under the header, the page\'s section lit', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'the tabs are a wide-screen row');
    await open(page, '/data/data-dictionary/');
    const tabs = page.locator('nav.tabs a');
    await expect(tabs).toHaveText(['Get started', 'Scripture', 'Platform', 'API', 'Operate']);
    await expect(page.locator('nav.tabs a[aria-current]')).toHaveText('Platform');
    // inside the fixed header, and the page starts below it: nothing is covered
    const header = (await page.locator('header.header').boundingBox())!;
    const row = (await page.locator('nav.tabs').boundingBox())!;
    expect(row.y + row.height).toBeLessThanOrEqual(header.y + header.height + 1);
    expect(Math.round(row.height)).toBeGreaterThanOrEqual(44);
    expect((await page.locator('h1#_top').boundingBox())!.y).toBeGreaterThan(header.height);
    expect((await page.locator('nav.sidebar .sidebar-pane').boundingBox())!.y).toBeGreaterThanOrEqual(Math.floor(header.height));
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    expect((await page.locator('meta[name="sggs-docs-features"]').getAttribute('content'))!).toContain('tabs1');
  });

  test('a tab opens its section, and lights there; a page outside the five lights none', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'the tabs are a wide-screen row');
    await open(page, '/glossary/');
    await expect(page.locator('nav.tabs a[aria-current]')).toHaveCount(0);
    await page.locator('nav.tabs a', { hasText: 'Operate' }).click();
    await expect(page).toHaveURL(/\/process\/$/);
    await expect(page.locator('nav.tabs a[aria-current]')).toHaveText('Operate');
    // a heading reached by its link is not hidden under the taller header
    await open(page, '/process/release/#versioning');
    const header = (await page.locator('header.header').boundingBox())!;
    expect((await page.locator('#versioning').boundingBox())!.y).toBeGreaterThanOrEqual(header.height - 1);
  });

  test('on a phone: no tab row, and the header is its usual height', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'phone only');
    await open(page, '/data/data-dictionary/');
    await expect(page.locator('nav.tabs')).toBeHidden();
    expect((await page.locator('header.header').boundingBox())!.height).toBeLessThanOrEqual(64);
    expect(await sideways(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('Gurmukhi is marked as Punjabi', () => {
  test('in prose and tables it is lang="pa", ink-coloured, and the text is what the Markdown says', async ({ page, request }) => {
    await open(page, '/scripture/what-sggs-is/');
    const marked = page.locator('.sl-markdown-content [lang="pa"]');
    expect(await marked.count()).toBeGreaterThan(0);
    const md = await (await request.get('/md/scripture/what-sggs-is.md')).text();
    // a glossary card's definition comes from the glossary page, not this one
    for (const run of await page.locator('.sl-markdown-content [lang="pa"]:not(.term__card *)').allTextContents()) {
      expect(/[\u0A00-\u0A7F]/.test(run)).toBe(true);
      expect(md.includes(run)).toBe(true);
    }
    // nothing Gurmukhi is left outside a marked element (drawings and code blocks aside)
    const loose = await page.locator('.sl-markdown-content').evaluate((root) => {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n = 0;
      for (let t = w.nextNode(); t; t = w.nextNode()) {
        const el = t.parentElement!;
        if (/[\u0A00-\u0A7F]/.test(t.nodeValue ?? '') && !el.closest('[lang="pa"], pre, svg')) n++;
      }
      return n;
    });
    expect(loose).toBe(0);
    const ink = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sgs-ink').trim());
    const probe = await marked.first().evaluate((e, c) => { const d = document.createElement('i'); d.style.color = c; e.append(d); const v = [getComputedStyle(e).color, getComputedStyle(d).color]; d.remove(); return v; }, ink);
    expect(probe[0]).toBe(probe[1]);
  });
});
