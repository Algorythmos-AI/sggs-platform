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

test('turning pages quickly still keeps the last one, and a jump to the next number is a lookup', async ({ page }) => {
  await page.goto('/reader?ang=5');
  await rendered(page);
  // three turns before any of them has drawn: Angs 6 and 7 are skipped, and 8 must be kept
  await page.evaluate(() => { const w = window as any; w.step(1); w.step(1); w.step(1); });
  await expect(page).toHaveURL(/ang=8/, { timeout: 15_000 });
  await expect(page.locator('#angIn')).toHaveValue('8');
  await expect.poll(() => stored(page, 'sggs_last_ang'), { timeout: 15_000 }).toBe('8');
  await page.evaluate(() => (window as any).ang(9));                    // the number box, one Ang on
  await expect(page).toHaveURL(/ang=9/, { timeout: 15_000 });
  await rendered(page);
  expect(await stored(page, 'sggs_last_ang')).toBe('8');                // still a lookup
  await page.locator('#angOut .endnav button').last().click();          // "Ang 10 ›" at the foot is a turn
  await expect(page).toHaveURL(/ang=10/, { timeout: 15_000 });
  await expect.poll(() => stored(page, 'sggs_last_ang'), { timeout: 15_000 }).toBe('10');
});

test('a stored Ang that is not exactly 1–1430 is ignored, on the home page and in the Reader', async ({ page }) => {
  await page.goto('/library');
  await expect(page.locator('#ver')).not.toBeEmpty({ timeout: 15_000 });
  for (const bad of ['12abc', '1431', '0', '-3', '7e2', '12.9', ' 12', '0x1F', '99999999999', '']) {
    await page.evaluate((v) => localStorage.setItem('sggs_last_ang', v), bad);
    await page.reload();
    await expect(page.locator('nav.doors .door').first()).toBeVisible();
    await expect(page.locator('#ver')).not.toBeEmpty({ timeout: 15_000 });
    await expect(page.locator('#hubContinue .hub-cont'), `stored ${JSON.stringify(bad)}`).toHaveCount(0);
  }
  await page.evaluate(() => localStorage.setItem('sggs_last_ang', '12abc'));
  await page.goto('/reader');
  await expect(page.locator('#angIn'), 'the Reader opens Ang 1, not a guess at 12').toHaveValue('1', { timeout: 15_000 });
  await rendered(page);
  await page.evaluate(() => localStorage.setItem('sggs_last_ang', '1430'));   // the last Ang is a real place
  await page.goto('/library');
  await expect(page.locator('#hubContinue .hub-cont').first()).toContainText('Ang 1430');
});

test('coming back to the home page shows the place as it is now', async ({ page }) => {
  await page.addInitScript(() => { if (!localStorage.getItem('sggs_last_ang')) localStorage.setItem('sggs_last_ang', '712'); });
  await page.goto('/library');
  const cont = page.locator('#hubContinue .hub-cont').first();
  await expect(cont).toContainText('Ang 712');
  // the reader went on to Ang 715 elsewhere; returning to this tab must not offer 712 again
  await page.evaluate(() => { localStorage.setItem('sggs_last_ang', '715'); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(cont).toContainText('Ang 715');
  await expect(cont).toHaveAttribute('href', '/reader?ang=715');
  // and a page restored from the back/forward cache is drawn again too
  await page.evaluate(() => {
    localStorage.setItem('sggs_last_ang', '716');
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(cont).toContainText('Ang 716');
});

test.describe('touch targets on the home page', () => {
  test.use({ timezoneId: 'UTC', viewport: { width: 375, height: 812 } });
  test('the Raag Clock link beside the raags is at least 44px tall', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-01-15T07:30:00Z'));
    await page.goto('/library');
    const more = page.locator('#hubNow .hub-more');
    await expect(more).toBeVisible({ timeout: 15_000 });
    expect((await more.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });
});

test('an installed copy opens on the Knowledge Base home', async ({ request }) => {
  const manifest = await (await request.get('/site.webmanifest')).json();
  expect(manifest.start_url).toBe('/library');
  expect(manifest.id).toBe('/');
});
