import { test, expect, type Page } from '@playwright/test';

// Search, in step with the app: results arrive as you type (after a pause, never per keystroke),
// an empty box shows what the chosen mode takes, the modes are real radio buttons, and a
// quotation is checked only when the reader presses Enter.

const ready = (page: Page) => expect(page.locator('#ver')).not.toBeEmpty({ timeout: 15_000 });
async function open(page: Page, url = '/search') {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url);
  await ready(page);
}

test('before anything is typed, the page says what the mode takes; it changes with the mode', async ({ page }) => {
  await open(page);
  const idle = page.locator('#searchIdle');
  await expect(idle.locator('h2')).toHaveText('Search the Granth');
  await page.locator('#modes [data-m="first"]').click();
  await expect(idle.locator('h2')).toHaveText('First letters');
  await expect(page.locator('#modes [data-m="first"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#modes [data-m="auto"]')).toHaveAttribute('aria-checked', 'false');
  await page.locator('#modes [data-m="verify"]').click();
  await expect(idle.locator('h2')).toHaveText('Verify a quotation');
  expect(await page.locator('#modes button').evaluateAll((els) => els.every((el) => el.tagName === 'BUTTON' && el.getAttribute('role') === 'radio'))).toBe(true);
});

test('results arrive as you type, with one request for a burst of keystrokes; clearing returns to the idle page', async ({ page }) => {
  await open(page);
  const asked: string[] = [];
  page.on('request', (r) => { if (r.url().includes('/api/search')) asked.push(new URL(r.url()).searchParams.get('q') || ''); });
  await page.locator('#q').pressSequentially('waheguru', { delay: 25 });
  await expect(page.locator('#results .card').first()).toBeVisible({ timeout: 15_000 });
  expect(asked, 'one search for the word, not one per letter').toEqual(['waheguru']);
  await expect(page.locator('#searchIdle')).toBeHidden();
  expect(new URL(page.url()).searchParams.get('q')).toBe('waheguru');
  await expect(page.locator('#qClear')).toBeVisible();
  await page.locator('#qClear').click();
  await expect(page.locator('#results .card')).toHaveCount(0);
  await expect(page.locator('#searchIdle')).toBeVisible();
  await expect(page.locator('#q')).toBeFocused();
  expect(new URL(page.url()).searchParams.get('q')).toBeNull();
});

test('a search still in flight never lands on a cleared page', async ({ page }) => {
  await open(page);
  await page.route('**/api/search*', async (route) => { await new Promise((r) => setTimeout(r, 700)); await route.continue().catch(() => {}); });
  await page.locator('#q').fill('waheguru');
  await page.waitForTimeout(450);                                   // the pause has passed: the search is out
  await page.locator('#q').fill('');
  await page.waitForTimeout(1200);
  await expect(page.locator('#results .card')).toHaveCount(0);
  await expect(page.locator('#searchIdle')).toBeVisible();
});

test('a quotation is checked on Enter, not while it is being typed', async ({ page }) => {
  await open(page);
  let verifies = 0;
  page.on('request', (r) => { if (r.url().includes('/api/verify')) verifies++; });
  await page.locator('#modes [data-m="verify"]').click();
  await page.locator('#q').pressSequentially('sochai soch na hovee', { delay: 10 });
  await page.waitForTimeout(600);
  expect(verifies).toBe(0);
  await page.locator('#q').press('Enter');
  await expect(page.locator('#results .verdict')).toBeVisible({ timeout: 15_000 });
  expect(verifies).toBe(1);
});

test('on a phone the modes are one row that scrolls inside itself, each a finger tall', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'a phone rule');
  await open(page);
  const m = await page.evaluate(() => {
    const row = document.getElementById('modes')!, bs = Array.from(row.querySelectorAll('button')).map((b) => b.getBoundingClientRect());
    return { sw: document.documentElement.scrollWidth, iw: innerWidth, oneRow: new Set(bs.map((b) => Math.round(b.top))).size, minH: Math.min(...bs.map((b) => b.height)), scrolls: row.scrollWidth > row.clientWidth };
  });
  expect(m.sw).toBeLessThanOrEqual(m.iw);
  expect(m.oneRow).toBe(1);
  expect(m.scrolls).toBe(true);
  expect(m.minH).toBeGreaterThanOrEqual(43.5);
});
