import { test, expect, type Page } from '@playwright/test';

// The Knowledge Base shell: a slim top bar with the five places (a tab bar on a phone), a second
// row for a place with several pages, and a footer in the page. What must hold: content starts
// near the top of a phone, nothing sits under the tab bar, the Reader's toolbar stays below the
// bar, the place you are in is marked, Sehaj always has a way out, and a page prints as paper.

const PHONE = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true };
const box = (page: Page, sel: string) => page.locator(sel).first().evaluate((el) => {
  const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height };
});
const ready = (page: Page) => expect(page.locator('#ver')).not.toBeEmpty({ timeout: 15_000 });

test.describe('on a 375px phone', () => {
  test.use(PHONE);

  for (const [path, first] of [['/library', '.hub-canopy'], ['/search', '.searchbar'], ['/reader?ang=712', '.toolbar'], ['/themes', 'main > section']] as const) {
    test(`${path}: content starts within 120px of the top`, async ({ page }) => {
      await page.goto(path);
      await ready(page);
      expect((await box(page, first)).top).toBeLessThanOrEqual(120);
    });
  }

  test('the tab bar shows the five places, marks the one you are in, and the wide-screen row is hidden', async ({ page }) => {
    await page.goto('/nitnem');
    await ready(page);
    const tabs = page.locator('.kb-tabs > *');
    await expect(tabs).toHaveCount(5);
    expect(await tabs.allInnerTexts()).toEqual(['Home', 'Read', 'Search', 'Explore', 'Saved']);
    await expect(page.locator('.kb-tabs [aria-current]')).toHaveCount(1);
    await expect(page.locator('.kb-tabs [data-place="read"]')).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('.kb-sub a[aria-current="page"]')).toHaveText('Nitnem');
    await expect(page.locator('.kb-places')).toBeHidden();
    await expect(page.locator('#themeBtn')).toBeVisible();
  });

  test('nothing in the footer is under the tab bar, and a toast clears it', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });     // the toast is measured at rest, not sliding in
    await page.goto('/browse');
    await ready(page);
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    const tabsTop = (await box(page, '.kb-tabs')).top;
    expect((await box(page, '.kb-foot a:last-of-type')).bottom).toBeLessThanOrEqual(tabsTop);
    await page.evaluate(() => { const t = document.getElementById('toast')!; t.textContent = 'test'; t.classList.add('on'); });
    expect((await box(page, '#toast')).bottom).toBeLessThanOrEqual(tabsTop);
  });

  test('the Reader toolbar stays below the bar when the page is scrolled', async ({ page }) => {
    await page.goto('/reader?ang=712');
    await expect(page.locator('#angOut .sline').first()).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => window.scrollTo({ top: 700, behavior: 'instant' }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(600);
    const chrome = await box(page, '.kb-chrome'), tool = await box(page, '.toolbar');
    expect(chrome.top).toBe(0);
    expect(tool.top).toBeGreaterThanOrEqual(chrome.bottom);
  });

  test('Sehaj hides the bars and always leaves a way out', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sehaj', '1'));
    await page.goto('/reader?ang=712');
    await expect(page.locator('#angOut .sline').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('body')).toHaveClass(/focus-mode/);
    await expect(page.locator('.kb-chrome')).toBeHidden();
    await expect(page.locator('.kb-tabs')).toBeHidden();
    await page.evaluate(() => window.scrollTo({ top: 2000, behavior: 'instant' }));
    const exit = page.locator('#sehajExit');
    await expect(exit).toBeInViewport();
    await exit.click();
    await expect(page.locator('body')).not.toHaveClass(/focus-mode/);
    await expect(page.locator('.kb-chrome')).toBeVisible();
    await expect(page.locator('.kb-tabs')).toBeVisible();
  });

  test('a pinned verse is counted on the Saved tab, which opens the drawer', async ({ page }) => {
    await page.goto('/reader?ang=712');
    await expect(page.locator('#angOut .pin-btn').first()).toBeAttached({ timeout: 15_000 });
    const count = page.locator('.kb-tabs [data-saved-count]');
    await expect(count).toBeHidden();
    await page.locator('#angOut .pin-btn').first().dispatchEvent('click');
    await page.locator('#vsPin').click();
    await page.keyboard.press('Escape');
    await expect(count).toHaveText('1');
    await page.locator('.kb-tabs [data-open-saved]').click();
    await expect(page.locator('#trailDrawer')).toHaveClass(/\bon\b/);
    await expect(page.locator('#tab-pinned .gm').first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('on a wide screen', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the places are in the top bar, the tab bar is gone, and the place and page are marked', async ({ page }) => {
    await page.goto('/constellation');
    await ready(page);
    await expect(page.locator('.kb-tabs')).toBeHidden();
    const places = page.locator('.kb-places > *');
    expect(await places.allInnerTexts()).toEqual(['Home', 'Read', 'Search', 'Explore', 'Saved']);
    await expect(page.locator('.kb-places [aria-current]')).toHaveCount(1);
    await expect(page.locator('.kb-places [data-place="explore"]')).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('.kb-sub a[aria-current="page"]')).toHaveText('Constellation');
    await expect(page.locator('#randomBtn')).toBeVisible();
    await expect(page.locator('h1.page-title')).toBeVisible();
  });

  test('every place is one click away, and Home is the mark', async ({ page }) => {
    await page.goto('/search');
    await ready(page);
    for (const [place, path] of [['read', '/reader'], ['explore', '/themes'], ['home', '/library'], ['search', '/search']] as const) {
      await page.locator(`.kb-places [data-place="${place}"]`).click();
      await expect(page).toHaveURL(new RegExp(path.replace('/', '\\/') + '(\\?|$)'));
      await expect(page.locator(`.kb-places [data-place="${place}"]`)).toHaveAttribute('aria-current', 'page');
    }
    await page.locator('.kb-brand').click();
    await expect(page).toHaveURL(/\/library$/);
  });
});

test('the page allows for the notch and the home indicator', async ({ page, request }) => {
  await page.goto('/search');
  expect(await page.locator('meta[name="viewport"]').getAttribute('content')).toContain('viewport-fit=cover');
  const href = await page.locator('link[rel="stylesheet"]').first().getAttribute('href');
  const css = await (await request.get(href as string)).text();
  for (const inset of ['safe-area-inset-top', 'safe-area-inset-bottom', 'safe-area-inset-left'])
    expect(css, inset).toContain(inset);
});

test('a page of scripture prints as paper: no bars, dark ink, whatever the theme', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.goto('/reader?ang=712');
  await expect(page.locator('#angOut .sline').first()).toBeVisible({ timeout: 15_000 });
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.kb-chrome')).toBeHidden();
  await expect(page.locator('.toolbar')).toBeHidden();
  expect(await page.locator('#angOut .sline .g').first().evaluate((el) => getComputedStyle(el).color)).toBe('rgb(0, 0, 0)');
});
