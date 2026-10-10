import { test, expect, type Page } from '@playwright/test';

// The Knowledge Base home (/library): search and the doors work as plain HTML, the current pahar
// is shown as metadata with its caveat, the places last read are offered back, and the Reader
// remembers an Ang only when a page was turned — never because an Ang was looked up.

const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);
const rendered = (page: Page) => expect(page.locator('#angOut .sline').first()).toBeVisible({ timeout: 15_000 });

test('the home page offers a door to every tool, and Home in the navigation is current', async ({ page }) => {
  await page.goto('/library');
  const doors = page.locator('nav.doors a.door');
  await expect(doors).toHaveCount(9);
  const hrefs = await doors.evaluateAll((els) => els.map((a) => a.getAttribute('href')));
  expect(hrefs).toEqual(['/reader', '/nitnem', '/browse', '/themes', '/constellation', '/trail', '/lineage', '/analytics', '/raag-clock']);
  await expect(page.locator('nav.site a[aria-current="page"]')).toHaveAttribute('href', '/library');
});

test('searching from the home page lands on Search with results', async ({ page }) => {
  await page.goto('/library');
  await page.locator('#hubQ').fill('waheguru');
  await page.locator('#hubQ').press('Enter');
  await expect(page).toHaveURL(/\/search\?q=waheguru/);
  await expect(page.locator('#results .card').first()).toBeVisible({ timeout: 15_000 });
});

test.describe('the current pahar', () => {
  test.use({ timezoneId: 'UTC' });
  test('is shown with its caveat, and its raags as Gurmukhi labels that open the Reader', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-01-15T07:30:00Z'));
    await page.goto('/library');
    const now = page.locator('#hubNow');
    await expect(now.locator('.hub-eyebrow b')).toContainText('pahar', { timeout: 15_000 });
    await expect(now).toContainText('traditional timing, sources differ');
    const chip = now.locator('.now-chip').first();
    await expect(chip).toHaveAttribute('lang', 'pa');
    await expect(chip).toHaveClass(/\bgm\b/);
    await chip.dispatchEvent('click');
    await expect(page).toHaveURL(/\/reader\?ang=\d+&raag=/);
  });
});

test('the Hukam-style random button on the home page opens a composition', async ({ page }) => {
  await page.goto('/library');
  const btn = page.locator('.hub-random');
  await expect(btn).toHaveText('✦ Hukam-style random');
  await btn.click();
  await expect(page.locator('#panel')).toHaveClass(/\bon\b/, { timeout: 15_000 });
  await expect(page.locator('#pbody .sline').first()).toBeVisible({ timeout: 15_000 });
});

test('nothing is offered to continue until something was read, then the place is offered back', async ({ page }) => {
  await page.goto('/library');
  await expect(page.locator('#ver')).not.toBeEmpty({ timeout: 15_000 });
  await expect(page.locator('#hubContinue .hub-cont')).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('sggs_last_ang', '712'));
  await page.reload();
  const cont = page.locator('#hubContinue .hub-cont').first();
  await expect(cont).toContainText('Ang 712');
  await expect(cont).toHaveAttribute('href', '/reader?ang=712');
});

test('the Reader remembers the Ang after a page turn, not after a lookup, and resumes there', async ({ page }) => {
  await page.goto('/reader?ang=5');
  await rendered(page);
  expect(await stored(page, 'sggs_last_ang')).toBeNull();              // opening an Ang is a lookup
  await page.evaluate(() => (window as any).step(1));
  await expect(page).toHaveURL(/ang=6/, { timeout: 15_000 });
  expect(await stored(page, 'sggs_last_ang')).toBe('6');                // a page turn is reading
  await page.goto('/reader?ang=900');
  await rendered(page);
  expect(await stored(page, 'sggs_last_ang')).toBe('6');                // a lookup leaves the place alone
  await page.evaluate(() => (window as any).ang(300));
  await expect(page).toHaveURL(/ang=300/, { timeout: 15_000 });
  expect(await stored(page, 'sggs_last_ang')).toBe('6');                // so does a jump by number
  await page.goto('/reader');
  await expect(page.locator('#angIn')).toHaveValue('6', { timeout: 15_000 });
});

test('an installed copy opens on the Knowledge Base home', async ({ request }) => {
  const manifest = await (await request.get('/site.webmanifest')).json();
  expect(manifest.start_url).toBe('/library');
  expect(manifest.id).toBe('/');
});
