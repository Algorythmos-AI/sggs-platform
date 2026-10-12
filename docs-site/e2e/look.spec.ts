import { test, expect, type Page } from '@playwright/test';
import { mockApi } from './helpers';

// The reading layout (src/styles/look.css, src/components/PageTitle.astro): measured, not eyeballed.
const ARCHETYPES = ['/onboarding/run-it-locally/', '/scripture/what-sggs-is/', '/architecture/search-waterfall/', '/data/data-dictionary/', '/api/quickstart/', '/process/release/', '/api/reference/'];
const open = async (page: Page, path: string) => { await mockApi(page); await page.goto(path); await page.evaluate(() => document.fonts.ready); };
const style = (page: Page, selector: string, prop: string, pseudo?: string) =>
  page.locator(selector).first().evaluate((e, [p, ps]) => getComputedStyle(e, ps || undefined).getPropertyValue(p), [prop, pseudo ?? ''] as const);
const px = (v: string) => parseFloat(v);

test.describe('the reading layout', () => {
  test('type and measure: a comfortable body, a title that leads, about 70 characters to the line', async ({ page }, testInfo) => {
    const phone = testInfo.project.name === 'mobile';
    await open(page, '/scripture/what-sggs-is/');
    expect(px(await style(page, '.sl-markdown-content p', 'font-size'))).toBe(phone ? 16 : 17);
    const h1 = px(await style(page, 'h1#_top', 'font-size'));
    expect(h1).toBeGreaterThanOrEqual(phone ? 30 : 40);
    expect(h1).toBeGreaterThan(px(await style(page, '.sl-markdown-content h2', 'font-size')));
    if (!phone) expect((await page.locator('.sl-markdown-content p').first().boundingBox())!.width).toBeLessThanOrEqual(44 * 16 + 1);
    // the header's site title keeps its size: content headings must not shrink it
    expect(px(await style(page, '.site-title', 'font-size'))).toBeGreaterThanOrEqual(18);
    expect((await page.locator('meta[name="sggs-docs-features"]').getAttribute('content'))!).toContain('look2');
  });

  test('the title block: a section link, how long to read, and the page in a sentence', async ({ page }) => {
    await open(page, '/api/quickstart/');
    const crumb = page.locator('.page-eyebrow a');
    await expect(crumb).toHaveText('API');
    await expect(crumb).toHaveAttribute('href', '/api/');
    await expect(page.locator('.page-meta__read')).toHaveText(/^\d+ min read$/);
    const summary = page.locator('.page-summary');
    await expect(summary).toContainText('Your first calls to the API');
    await expect(summary).toHaveAttribute('data-pagefind-ignore', '');
    await page.goto('/api/');                                   // the overview does not link to itself
    await expect(page.locator('.page-eyebrow a')).toHaveCount(0);
    await expect(page.locator('.page-eyebrow')).toContainText('API');
    await page.goto('/data/answer-protocol/');                   // a pinned page: its description is its first paragraph
    await expect(page.locator('.page-summary')).toHaveCount(0);
  });

  test('a callout and a quotation can never be mistaken for each other; Gurmukhi is Sant Lipi, in ink', async ({ page }) => {
    for (const theme of ['light', 'dark'] as const) {
      await open(page, '/scripture/what-sggs-is/');
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      const inkColour = await style(page, 'h1#_top', 'color');
      const callout = await style(page, '.starlight-aside', 'background-color');
      const pageBg = await style(page, 'body', 'background-color');
      expect(callout, `${theme}: a callout is tinted`).not.toBe(pageBg);
      expect(callout).not.toBe('rgba(0, 0, 0, 0)');
      expect(px(await style(page, '.starlight-aside', 'border-inline-start-width'))).toBe(4);
      expect(await style(page, '.starlight-aside', 'color'), `${theme}: callout text is ink`).toBe(inkColour);
      expect(await style(page, '.sl-markdown-content blockquote', 'background-color'), `${theme}: a quotation is never tinted`).toBe('rgba(0, 0, 0, 0)');
      expect(px(await style(page, '.sl-markdown-content blockquote', 'border-inline-start-width'))).toBe(2);
      expect(await style(page, '.sl-markdown-content blockquote', 'color')).toBe(inkColour);
      expect(await style(page, '.sl-markdown-content blockquote', 'border-radius')).toBe('0px');
      expect((await style(page, '.sl-markdown-content blockquote', 'font-family')).startsWith('"Sant Lipi"')).toBe(true);
    }
  });

  test('a procedure reads as steps: numbered circles down a line', async ({ page }) => {
    await open(page, '/process/release/');
    const list = page.locator('sggs-steps + ol');
    await expect(list).toHaveCount(1);
    expect(await list.evaluate((e) => getComputedStyle(e).listStyleType)).toBe('none');
    expect(await style(page, 'sggs-steps + ol > li', 'content', '::before')).toContain('counter(step)');
    expect(await style(page, 'sggs-steps + ol > li', 'border-radius', '::before')).toBe('50%');
    expect(await list.locator('> li').count()).toBeGreaterThanOrEqual(3);
    await open(page, '/scripture/structure/');                  // an ordinary list is left alone
    await expect(page.locator('sggs-steps')).toHaveCount(0);
  });

  test('where you are is marked quietly, in ink', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the sidebar and the contents column are on screen');
    await open(page, '/scripture/what-sggs-is/');
    const ink = await style(page, 'h1#_top', 'color');
    expect(await style(page, 'nav.sidebar a[aria-current="page"]', 'color')).toBe(ink);
    expect(await style(page, 'nav.sidebar a[aria-current="page"]', 'box-shadow')).toContain('inset');
    expect(await style(page, 'starlight-toc a[aria-current="true"]', 'color')).toBe(ink);
  });

  test('nothing scrolls sideways: at this width, at 320px, and in forced colours', async ({ page }) => {
    for (const path of ARCHETYPES) {
      await open(page, path);
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(await overflow(), path).toBeLessThanOrEqual(0);
      const size = page.viewportSize()!;
      await page.setViewportSize({ width: 320, height: 800 });
      expect(await overflow(), `${path} at 320px`).toBeLessThanOrEqual(0);
      await page.setViewportSize(size);
    }
    await page.emulateMedia({ forcedColors: 'active' });
    await open(page, '/process/release/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await expect(page.locator('.starlight-aside, sggs-steps + ol').first()).toBeVisible();
  });
  // 1280px at 200% zoom is a 640px viewport; 400% is 320px (WCAG 1.4.10, Reflow)
  for (const width of [640, 320]) {
    test(`zoomed in (a ${width}px viewport): nothing scrolls sideways, and the page menu still opens`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'mobile', 'sets its own viewport');
      await page.setViewportSize({ width, height: 700 });
      for (const path of ARCHETYPES) {
        await open(page, path);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), path).toBeLessThanOrEqual(0);
      }
      await open(page, '/process/release/');
      await page.locator('sggs-page-actions summary').click();
      const panel = (await page.locator('sggs-page-actions .pa__panel').boundingBox())!;
      expect(panel.x).toBeGreaterThanOrEqual(0);
      expect(panel.x + panel.width).toBeLessThanOrEqual(width + 1);
    });
  }

  test('the header and the title block do not move once they are drawn', async ({ page }) => {
    await mockApi(page);
    // only shifts of something in the header or the title panel count: a live widget further down
    // fills in when the API answers, which is its own matter
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      type Shift = { value: number; hadRecentInput: boolean; sources: { node: Node | null }[] };
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as Shift[]) {
          const top = e.sources.some((s) => { const el = s.node instanceof Element ? s.node : s.node?.parentElement; return !!el?.closest('header.header, main > .content-panel:first-child'); });
          if (!e.hadRecentInput && top) w.__cls += e.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    for (const path of ['/scripture/what-sggs-is/', '/process/release/', '/data/data-dictionary/']) {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);
      expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls), path).toBeLessThanOrEqual(0.02);
    }
  });

  test('a wide table on a phone shows there is more to the side', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'phone only');
    await open(page, '/data/data-dictionary/');
    const table = page.locator('.sl-markdown-content table').first();
    expect(await table.evaluate((e) => getComputedStyle(e).backgroundAttachment)).toContain('local');
    await expect(table).toHaveAttribute('role', 'region');
    await expect(table).toHaveAttribute('aria-label', 'Scrollable table');
  });
});
