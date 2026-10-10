import { test, expect, type Page } from '@playwright/test';

// Moving between Knowledge Base pages: the browser's cross-document view transition holds the top
// bar and the phone tab bar and cross-fades the page under them — only with motion allowed, and
// never holding a bar while something is open over the page. Navigation links are prefetched on
// hover (a wide screen) or at the touch (the phone tab bar). A page brought back by Back/Forward is
// brought up to date. There is no client router: every assertion here is about a real page load.

const mobile = (page: Page) => (page.viewportSize()?.width ?? 1280) <= 840;
const ready = (page: Page) => expect(page.locator('#ver')).not.toBeEmpty({ timeout: 15_000 });
const place = (page: Page, id: string) => page.locator(`${mobile(page) ? '.kb-tabs' : '.kb-places'} a[data-place="${id}"]`);
const heldName = (page: Page, sel: string) =>
  page.evaluate((s) => getComputedStyle(document.querySelector(s)!).getPropertyValue('view-transition-name').trim(), sel);
// what the incoming page saw: a view transition, none, or a browser that has no such event
const revealed = (page: Page) => page.evaluate(() => (window as any).__reveal as string | undefined);
const record = (page: Page) => page.addInitScript(() => {
  addEventListener('pagereveal', (e: any) => { (window as any).__reveal = e.viewTransition ? 'transition' : 'plain'; });
});

test('one place to another is a view transition that holds the bars', async ({ page }, testInfo) => {
  await record(page);
  await page.goto('/search');
  await ready(page);
  expect(await heldName(page, '.kb-chrome')).toBe('kb-chrome');
  if (mobile(page)) expect(await heldName(page, '.kb-tabs')).toBe('kb-tabs');
  await place(page, 'read').click();
  await page.waitForURL(/\/reader/);
  await ready(page);                                        // a real page: its own scripts ran
  await expect(page.locator('#angOut .sline').first()).toBeVisible({ timeout: 15_000 });
  // Chromium has cross-document view transitions; an engine without them simply navigates
  if (testInfo.project.name === 'desktop') expect(await revealed(page)).toBe('transition');
  await expect(place(page, 'read')).toHaveAttribute('aria-current', /page|true/);
});

test('with reduced motion there is no transition and no bar is held', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await record(page);
  await page.goto('/search');
  await ready(page);
  expect(await heldName(page, '.kb-chrome')).toBe('none');
  await place(page, 'read').click();
  await page.waitForURL(/\/reader/);
  await ready(page);
  if (testInfo.project.name === 'desktop') expect(await revealed(page)).toBe('plain');
});

test('while something is open over the page the bars are not held, and its links still navigate', async ({ page }) => {
  await page.goto('/search?q=sochai+soch+na+hovee');
  const card = page.locator('#results .card').first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();
  await expect(page.locator('#panel')).toHaveClass(/\bon\b/);
  await expect(page.locator('html')).toHaveClass(/overlay-open/);
  expect(await heldName(page, '.kb-chrome')).toBe('none');
  const open = page.locator('#pbody [data-go-ang]');
  await expect(open).toBeVisible({ timeout: 15_000 });
  await open.click();
  await page.waitForURL(/\/reader\?ang=\d+/);
  await expect(page.locator('#angOut .sline').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('html')).not.toHaveClass(/overlay-open/);
  expect(await heldName(page, '.kb-chrome')).toBe('kb-chrome');
});

test('a navigation link is fetched ahead: on hover on a wide screen, at the touch in the phone tab bar', async ({ page }) => {
  await page.goto('/search');
  await ready(page);
  if (mobile(page)) {
    // the strategy is declared; the touch itself navigates
    for (const a of await page.locator('.kb-tabs a').all()) await expect(a).toHaveAttribute('data-astro-prefetch', 'tap');
    return;
  }
  const ahead = page.waitForRequest((r) => new URL(r.url()).pathname === '/reader', { timeout: 10_000 });
  await place(page, 'read').hover();
  await ahead;                                              // before any click
  expect(new URL(page.url()).pathname).toBe('/search');
});

test('a page brought back by Back or Forward takes up what was chosen since', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => { if (!localStorage.getItem('theme')) localStorage.setItem('theme', 'light'); });
  await page.goto('/reader?ang=1');
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('[data-saved-count]:visible')).toHaveCount(0);
  // … on another page the reader chose dark and a larger text, and pinned a verse; then pressed Back
  await page.evaluate(() => {
    localStorage.setItem('theme', 'dark'); localStorage.setItem('gsize', '26');
    localStorage.setItem('sggs_pins', JSON.stringify([{ line_id: 30729, ang: 712, comp_id: 2610, gm: 'x', ts: Date.now() }]));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--gsize'))).toBe('26px');
  const chrome = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--chrome').trim());
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', chrome);
  await expect(page.locator('#themeBtn')).toHaveText('☾');
  await expect(page.locator('[data-saved-count]:visible')).toHaveText('1');
});
