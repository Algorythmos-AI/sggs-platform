import { test, expect, type Page } from '@playwright/test';

// The Nitnem home, in step with the app: the time of day decides what is brought forward (never
// what is shown — every bani is always listed), the day is drawn as an arc, a ring shows how far
// this browser's place is through a bani, and one action opens the bani to read now.

test.use({ timezoneId: 'UTC', locale: 'en-US' });
async function open(page: Page, at: string, seed: Record<string, string> = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed);
  await page.clock.setFixedTime(new Date(at));
  await page.goto('/nitnem');
  await expect(page.locator('#nitnemList .bani-tile').first()).toBeVisible({ timeout: 15_000 });
}
const sections = (page: Page) => page.locator('#nitnemList .sect').allTextContents();

for (const [at, band, first, go] of [
  ['2026-01-15T04:30:00Z', 'Amrit Vela', 'Morning', 'Read Japji Sahib'],
  ['2026-01-15T12:00:00Z', 'Morning banis', 'Morning', 'Read Japji Sahib'],
  ['2026-01-15T18:00:00Z', 'Evening', 'Evening', 'Read Rehras Sahib'],
  ['2026-01-15T23:00:00Z', 'Night', 'Night', 'Read Kirtan Sohila'],
  ['2026-01-15T02:00:00Z', 'Night', 'Night', 'Read Kirtan Sohila'],          // the night runs on to 3 AM
] as const) {
  test(`at ${at.slice(11, 16)} the hero is "${band}" and ${first} comes first`, async ({ page }) => {
    await open(page, at);
    await expect(page.locator('.nit-band')).toHaveText(band);
    await expect(page.locator('.nit-go')).toHaveText(go);
    const s = await sections(page);
    expect(s[0]).toBe(first);
    expect([...s].sort(), 'the clock orders the list; nothing is hidden').toEqual(['Ceremony', 'Evening', 'Morning', 'Night', 'Popular'].filter((x) => s.includes(x)).sort());
    expect(s).toEqual(expect.arrayContaining(['Morning', 'Evening', 'Night']));
    await expect(page.locator('.dayarc .da-seg.on')).toHaveCount(1);
    await expect(page.locator('.dayarc')).toHaveAttribute('aria-label', new RegExp('^' + band));
  });
}

test('a place kept in a bani shows as a ring and a percentage, and the action continues it', async ({ page }) => {
  await open(page, '2026-01-15T04:30:00Z', { sggs_bani_pos_japji: '190' });
  const japji = page.locator('.bani-tile[data-key="japji"]');
  await expect(japji.locator('.pring-fg')).toHaveCount(1);
  await expect(japji).toHaveAttribute('aria-label', /Japji Sahib, \d+ percent read/);
  await expect(japji.locator('.bani-meta')).toContainText('% read');
  await expect(page.locator('.bani-tile[data-key="anand"] .pring-fg')).toHaveCount(0);
  await expect(page.locator('.nit-go')).toHaveText('Continue Japji Sahib');
  await page.locator('.nit-go').click();
  await expect(page.locator('#baniOut .sline').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#baniHead')).toContainText('Japji Sahib');
});

test('Hukam opens from the Nitnem home, and a bani row is a real button a finger can hit', async ({ page }) => {
  await open(page, '2026-01-15T12:00:00Z');
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, iw: innerWidth,
    small: Array.from(document.querySelectorAll('#nitnemList button, #nitnemList select')).map((el) => el.getBoundingClientRect()).filter((b) => b.height < 39.5).length,
    tags: Array.from(new Set(Array.from(document.querySelectorAll('.bani-tile')).map((el) => el.tagName))),
  }));
  expect(m.sw).toBeLessThanOrEqual(m.iw);
  expect(m.small).toBe(0);
  expect(m.tags).toEqual(['BUTTON']);
  await page.locator('#nitnemList .nit-card[data-random]').click();
  await expect(page.locator('#panel')).toHaveClass(/\bon\b/);
});
