import { test, expect, type Page } from '@playwright/test';

// Shell faults fixed before the redesign: the closed drawer is out of the Tab order and gives
// focus back, phone controls never trigger iOS zoom, the search box takes the cursor only on a
// desktop, the browser chrome follows the page theme, the Raag Clock catches up when a page comes
// back, the theme network never traps scrolling, errors speak to the visitor, theme links go
// straight to Search, and every page carries its icons.

const mobile = (page: Page) => (page.viewportSize()?.width ?? 1280) <= 840;
// "Saved" opens the drawer: in the top bar on a wide screen, in the tab bar on a phone
const saved = (page: Page) => page.locator('[data-open-saved]:visible');

test('the closed drawer is inert, and closing it returns focus to the button that opened it', async ({ page }) => {
  await page.goto('/search');
  const drawer = page.locator('#trailDrawer');
  await expect(drawer).toHaveAttribute('inert', '');
  if (!mobile(page)) {                                     // Tab from the button must skip the closed drawer
    await saved(page).focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('#trailDrawer'))).toBe(false);
  }
  await saved(page).click();
  await expect(drawer).toHaveClass(/\bon\b/);
  await expect(drawer).not.toHaveAttribute('inert', '');
  await expect(page.locator('#trailClose')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveAttribute('inert', '');
  await expect(saved(page)).toBeFocused();
});

for (const path of ['/search', '/reader?ang=1', '/nitnem', '/analytics', '/constellation', '/raag-clock']) {
  test(`phone controls on ${path} are at least 16px, so iOS never zooms on focus`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'a phone rule');
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const small = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input, select, textarea'))
        .filter((el) => (el as HTMLElement).offsetParent !== null && (el as HTMLInputElement).type !== 'range')
        .map((el) => ({ id: el.id || el.className, px: parseFloat(getComputedStyle(el).fontSize) }))
        .filter((x) => x.px < 16));
    expect(small).toEqual([]);
  });
}

test('the search box takes the cursor on a desktop and leaves the keyboard down on a phone', async ({ page }) => {
  await page.goto('/search');
  await expect(page.locator('#ver')).not.toBeEmpty({ timeout: 15_000 });   // the shell's scripts have run
  if (mobile(page)) await expect(page.locator('#q')).not.toBeFocused();
  else await expect(page.locator('#q')).toBeFocused();
});

for (const theme of ['light', 'dark'] as const) {
  test(`with the page set to ${theme} under the opposite OS setting, browser chrome and native controls follow the page`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme === 'dark' ? 'light' : 'dark' });
    await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
    await page.goto('/search');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
    const want = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--chrome').trim());
    expect(want).toMatch(/^#[0-9a-f]{6}$/i);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', want);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(theme);
  });
}

test.describe('the Raag Clock', () => {
  test.use({ timezoneId: 'Asia/Kolkata' });
  test('shows the current pahar at once when the page comes back from the back/forward cache', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-01-15T06:30:00+05:30') });
    await page.goto('/raag-clock');
    const now = page.locator('#nowBody .now-pahar b');
    await expect(now).toBeVisible({ timeout: 15_000 });
    const morning = await now.textContent();
    await page.clock.setFixedTime(new Date('2026-01-15T21:30:00+05:30'));
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await expect(now).not.toHaveText(morning as string);
  });
});

test('a plain wheel over the theme network scrolls the page instead of zooming the chart', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'the mouse wheel is a desktop input');
  await page.goto('/analytics');
  const svg = page.locator('#network svg');
  await expect(svg).toBeVisible({ timeout: 20_000 });
  await svg.scrollIntoViewIfNeeded();
  const box = (await svg.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 200));
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 500);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
});

test('a failed load speaks to the visitor, not to the developer', async ({ page }) => {
  await page.route('**/api/ang/**', (route) => route.abort());
  await page.goto('/reader?ang=7');
  await expect(page.locator('#angOut .load-fail')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('body')).not.toContainText('serve.py');
});

test('a theme tile opens Search directly, without passing through the home page', async ({ page }) => {
  const visited: string[] = [];
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) visited.push(new URL(f.url()).pathname); });
  await page.goto('/themes');
  const tile = page.locator('.tile[data-concept]').first();
  await expect(tile).toBeVisible({ timeout: 15_000 });
  await tile.click();
  await expect(page).toHaveURL(/\/search\?q=.+&mode=theme/, { timeout: 15_000 });
  expect(visited).not.toContain('/');
});

test('Knowledge Base pages carry a favicon and a home-screen icon that exist', async ({ page, request }) => {
  await page.goto('/reader');
  for (const rel of ['icon', 'apple-touch-icon']) {
    const href = await page.locator(`link[rel="${rel}"]`).first().getAttribute('href');
    expect(href, rel).toBeTruthy();
    expect((await request.get(href as string)).status(), href as string).toBe(200);
  }
});
