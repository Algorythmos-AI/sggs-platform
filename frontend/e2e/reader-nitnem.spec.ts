import { test, expect, type Page } from '@playwright/test';

// Reader and Nitnem regressions: a superseded Ang never paints over the one that replaced it,
// an Ang already on its way is not fetched twice, a deep link lands on its verse with the
// toolbar still showing, a Nitnem place survives reopening, and the text size is the
// stylesheet's until the reader chooses one.

const rendered = (page: Page) =>
  expect(page.locator('#angOut .sline').first()).toBeVisible({ timeout: 15_000 });
const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('a late failure of a superseded Ang never replaces the Ang on screen', async ({ page }) => {
  await page.route('**/api/ang/900', async (route) => {
    await pause(1200);
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"late failure"}' }).catch(() => {});
  });
  await page.goto('/reader?ang=5');
  await rendered(page);
  await page.evaluate(() => { (window as any).ang(900); (window as any).ang(901); });
  await expect(page).toHaveURL(/ang=901/, { timeout: 15_000 });
  await rendered(page);
  await page.waitForTimeout(1600);                         // past the moment Ang 900 fails
  await expect(page.locator('#angIn')).toHaveValue('901');
  await expect(page.locator('#angOut .sline').first()).toBeVisible();
  await expect(page.locator('#angOut')).not.toContainText('could not be loaded');
});

test('an Ang that is already being prefetched is fetched once', async ({ page }) => {
  let hits = 0;
  await page.route('**/api/ang/21', async (route) => { hits++; await pause(700); await route.continue(); });
  await page.goto('/reader?ang=20');
  await rendered(page);                                    // rendering Ang 20 starts the prefetch of 21
  await expect.poll(() => hits).toBe(1);
  await page.evaluate(() => (window as any).step(1));
  await expect(page).toHaveURL(/ang=21/, { timeout: 15_000 });
  await rendered(page);
  expect(hits).toBe(1);
});

test('a deep link lands on its verse and leaves the toolbar showing', async ({ page }) => {
  await page.goto('/reader?ang=712&line=30730');
  const line = page.locator('#angOut .sline[data-line-id="30730"]');
  await expect(line).toBeInViewport({ timeout: 15_000 });
  await page.waitForTimeout(1500);                         // longer than any landing guard
  await expect(page.locator('body')).not.toHaveClass(/chrome-hidden/);
  await expect(line).toBeInViewport();
});

test('the Nitnem place stays on the same line across reopens', async ({ page }) => {
  await page.goto('/nitnem?bani=japji');
  const lines = page.locator('#baniOut [data-seq]');
  await expect(lines.first()).toBeVisible({ timeout: 15_000 });
  const seq = await lines.nth(30).getAttribute('data-seq');
  await page.evaluate((s) => localStorage.setItem('sggs_bani_pos_japji', s as string), seq);
  for (let i = 0; i < 3; i++) {
    await page.goto('/nitnem?bani=japji');
    await expect(page.locator(`#baniOut [data-seq="${seq}"]`)).toBeInViewport({ timeout: 15_000 });
    await page.waitForTimeout(900);                        // the debounced save has run
    expect(await stored(page, 'sggs_bani_pos_japji')).toBe(seq);
  }
});

test('the text size is the stylesheet default until the reader chooses one', async ({ page }) => {
  const inline = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--gsize'));
  await page.goto('/reader?ang=1');
  await rendered(page);
  expect(await inline()).toBe('');
  expect(await stored(page, 'gsize')).toBeNull();
  await page.evaluate(() => (window as any).fontSize(1));
  expect(await inline()).toBe('24px');
  expect(await stored(page, 'gsize')).toBe('24');
  await page.reload();
  await rendered(page);
  expect(await inline()).toBe('24px');
});

test('the toolbar still hides on a scroll the reader makes, and returns on the way up', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'the mouse wheel is a desktop input');
  await page.goto('/reader?ang=712');
  await rendered(page);
  await page.mouse.move(400, 400);
  await page.mouse.wheel(0, 600);
  await expect(page.locator('body')).toHaveClass(/chrome-hidden/);
  await page.mouse.wheel(0, -200);
  await expect(page.locator('body')).not.toHaveClass(/chrome-hidden/);
});
