import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockApi } from './helpers';

// The page menu: "Copy page" and its panel (src/components/PageActions.astro, src/widgets/page-actions.ts).
const PAGE = '/api/quickstart/';
const ready = async (page: Page, path = PAGE) => {
  await mockApi(page);
  await page.goto(path);
  await expect(page.locator('sggs-page-actions[data-ready]')).toBeVisible();
  return page.locator('sggs-page-actions');
};
const axe = (page: Page) => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();

test.describe('the page menu', () => {
  test('one click copies the page as Markdown, says so, and moves nothing', async ({ page, context, request }, testInfo) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const menu = await ready(page);
    const copy = menu.locator('.pa__primary');
    await expect(copy).toHaveText('Copy page');
    const before = await copy.boundingBox();
    await copy.click();
    await expect(copy).toHaveText('Copied');
    await expect(menu.locator('.pa__status')).toHaveText('Page copied as Markdown');
    expect((await copy.boundingBox())!.width, 'the button keeps its width').toBeGreaterThanOrEqual(before!.width - 0.5);
    const want = await (await request.get('/md/api/quickstart.md')).text();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(want);
    expect(want.startsWith('# Quickstart')).toBe(true);
    await expect(copy).toHaveText('Copy page', { timeout: 4000 });
    testInfo.annotations.push({ type: 'copied', description: `${want.length} characters` });
  });

  test('the panel: copy the link, view the Markdown, the two assistants, and what they are told', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const menu = await ready(page);
    const toggle = menu.locator('summary');
    await expect(toggle).toHaveAccessibleName('More page actions');
    await toggle.click();
    await expect(menu.locator('.pa__panel')).toBeVisible();
    await expect(menu.locator('ul[aria-label="Copy"] .pa__label')).toHaveText(['Copy page as Markdown', 'Copy link']);
    await expect(menu.locator('ul[aria-label="Open"] .pa__label')).toHaveText(['View as Markdown', 'Ask ChatGPT', 'Ask Claude']);

    await menu.getByRole('button', { name: 'Copy link' }).click();
    await expect(menu.locator('.pa__status')).toHaveText('Link copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());

    const view = menu.getByRole('link', { name: /View as Markdown/ });
    await expect(view).toHaveAttribute('href', '/md/api/quickstart.md');
    for (const [name, start] of [['Ask ChatGPT', 'https://chatgpt.com/?hints=search&q='], ['Ask Claude', 'https://claude.ai/new?q=']] as const) {
      const link = menu.getByRole('link', { name: new RegExp(name) });
      const href = (await link.getAttribute('href'))!;
      expect(href.startsWith(start)).toBe(true);
      expect(href.length).toBeLessThanOrEqual(2000);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      const prompt = decodeURIComponent(href.slice(href.indexOf('q=') + 2));
      // always the published page: an assistant cannot open a preview behind a sign-in
      expect(prompt).toContain('Read this page before you answer: https://docs.gurbanisoul.com/md/api/quickstart.md');
      expect(prompt).toContain('Never quote, translate or transliterate Gurbani from memory');
      expect(prompt).toContain('"— Sri Guru Granth Sahib Ji · Ang N"');
    }
    await expect(menu.locator('.pa__note').first()).toContainText('third-party services');
    await expect(menu.locator('.pa__note--preview')).toBeVisible();          // this is not the production host
  });

  test('keyboard: Tab reaches it, Enter opens, Escape closes and gives focus back', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'a hardware keyboard');
    const menu = await ready(page);
    const toggle = menu.locator('summary');
    await menu.locator('.pa__primary').focus();
    await page.keyboard.press('Tab');
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(menu.locator('details')).toHaveAttribute('open', '');
    await page.keyboard.press('Tab');
    await expect(menu.getByRole('button', { name: 'Copy page as Markdown' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu.locator('details')).not.toHaveAttribute('open', '');
    await expect(toggle).toBeFocused();
    // a click outside closes it too
    await toggle.click();
    await page.locator('h1#_top').click();
    await expect(menu.locator('details')).not.toHaveAttribute('open', '');
  });

  test('no accessibility violations with the panel open, in both schemes', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      // reduced motion: the panel's 120ms fade must not be measured half-way through
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      const menu = await ready(page);
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), scheme);
      await menu.locator('summary').click();
      await expect(menu.locator('.pa__panel')).toBeVisible();
      expect(await page.evaluate(() => getComputedStyle(document.body).colorScheme || document.documentElement.dataset.theme)).toBeTruthy();
      const results = await axe(page);
      expect(results.violations, `${scheme}: ${JSON.stringify(results.violations, null, 1)}`).toEqual([]);
    }
  });

  test('a finger gets 44px targets, and nothing scrolls sideways, even at 320px', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'a touch screen');
    const menu = await ready(page);
    await menu.locator('summary').click();
    const heights = await menu.locator('.pa__btn:visible, .pa__item:visible').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));   // a fractional device scale gives 43.99997
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
    await expect(menu.getByRole('button', { name: 'Print' })).toHaveCount(0);  // printing from a phone is the PDF's job
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 800 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${width}px`).toBeLessThanOrEqual(0);
    }
  });

  test('when the Markdown cannot be loaded it says so, and the next click tries again', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const menu = await ready(page);
    let fail = true;
    await page.route('**/md/**', (route) => (fail ? route.abort() : route.fallback()));
    const copy = menu.locator('.pa__primary');
    await copy.click();
    await expect(menu.locator('.pa__status')).toHaveText("Couldn't load the page's Markdown. Check your connection and try again.");
    await expect(copy).toHaveText('Copy page');
    fail = false;
    await copy.click();
    await expect(menu.locator('.pa__status')).toHaveText('Page copied as Markdown');
  });

  test('when the clipboard refuses, it says how to copy by hand and goes nowhere', async ({ page }) => {
    await page.addInitScript(() => {
      const refuse = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
      Object.defineProperty(navigator, 'clipboard', { value: { write: refuse, writeText: refuse }, configurable: true });
    });
    const menu = await ready(page);
    await menu.locator('.pa__primary').click();
    await expect(menu.locator('.pa__status')).toHaveText("Couldn't copy. Open the Markdown and copy it from there.");
    expect(new URL(page.url()).pathname).toBe(PAGE);
  });

  test('without JavaScript the links still work and nothing dead is shown', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'once');
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL: testInfo.project.use.baseURL });
    const page = await context.newPage();
    await page.goto(PAGE);
    const menu = page.locator('sggs-page-actions');
    await expect(menu.locator('button:visible')).toHaveCount(0);
    await expect(menu.locator('summary')).toHaveText('Page actions');
    await menu.locator('summary').click();
    await expect(menu.getByRole('link', { name: /View as Markdown/ })).toBeVisible();
    await expect(menu.getByRole('link', { name: /Ask Claude/ })).toBeVisible();
    await context.close();
  });

  test('where it is, and where it is not: every page, the reference, the home page, never the 404', async ({ page }) => {
    let menu = await ready(page, '/');
    await expect(menu.locator('.pa__primary')).toHaveText('Copy page');
    menu = await ready(page, '/api/reference/');
    await expect(menu.locator('.pa__primary')).toHaveText('Copy link');           // no Markdown source to copy
    await menu.locator('summary').click();
    await expect(menu.getByRole('link', { name: /Open OpenAPI JSON/ })).toBeVisible();
    await expect(menu.getByRole('link', { name: /View as Markdown/ })).toHaveCount(0);
    const prompt = decodeURIComponent((await menu.getByRole('link', { name: /Ask Claude/ }).getAttribute('href'))!);
    expect(prompt).toContain('https://docs.gurbanisoul.com/api/reference/');
    await mockApi(page);
    await page.goto('/no-such-page/');
    await expect(page.locator('sggs-page-actions')).toHaveCount(0);
  });

  test('it is chrome, not content: kept out of search, and the title area says how long the page takes', async ({ page }) => {
    const menu = await ready(page);
    await expect(menu).toHaveAttribute('data-pagefind-ignore', '');
    const read = page.locator('.page-meta__read');
    await expect(read).toHaveText(/^\d+ min read$/);
    await expect(read).toHaveAttribute('data-pagefind-ignore', '');
    await page.goto('/api/');                                                    // a section's overview: no reading time
    await expect(page.locator('.page-meta__read')).toHaveCount(0);
    expect(await page.locator('meta[name="sggs-docs-features"]').getAttribute('content')).toContain('actions1');
  });
});
