import { test, expect, type Page } from '@playwright/test';

// The Name is shown as "Waheguru", the widely used spelling, wherever the site names the theme;
// its slug stays `vahiguru` in links and the API. Every common spelling finds the same lines, in
// the search and in theme search (the API half is webapp/tests/test_waheguru_spellings.py).

const SPELLINGS = ['waheguru', 'Waheguru', 'vaheguru', 'Vaheguru', 'vahiguru', 'wahiguru'];
const ready = (page: Page) => expect(page.locator('#ver')).not.toBeEmpty({ timeout: 15_000 });
async function open(page: Page, url: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url);
  await ready(page);
}
async function cards(page: Page) {
  await expect(page.locator('#results .card').first()).toBeVisible({ timeout: 15_000 });
  return page.locator('#results .card .ang').allInnerTexts();
}

test('the Themes page names the theme "Waheguru" and opens it by its slug', async ({ page }) => {
  await open(page, '/themes');
  const tile = page.locator('.theme-tile').filter({ has: page.locator('.n', { hasText: /^Waheguru$/ }) });
  await expect(tile).toHaveCount(1);
  await expect(page.locator('.theme-tile .n', { hasText: /^Vahiguru$/ })).toHaveCount(0);
  await tile.click();
  await expect(page).toHaveURL(/\/search\?q=vahiguru&mode=theme/);
  await expect(page.locator('.themedesc b')).toHaveText('Waheguru');
});

test('theme search opens the same theme for every spelling', async ({ page }) => {
  await open(page, '/search?q=vahiguru&mode=theme');
  const want = await cards(page);
  for (const q of SPELLINGS) {
    await open(page, `/search?q=${encodeURIComponent(q)}&mode=theme`);
    await expect(page.locator('.themedesc b'), q).toHaveText('Waheguru');
    expect(await cards(page), q).toEqual(want);
  }
});

test('every spelling finds the same lines in the search', async ({ page }) => {
  await open(page, '/search?q=waheguru');
  const want = await cards(page);
  expect(want.length).toBeGreaterThan(0);
  for (const q of SPELLINGS) {
    await open(page, `/search?q=${encodeURIComponent(q)}`);
    expect(await cards(page), q).toEqual(want);
  }
});

test('the palette finds the theme under every spelling', async ({ page }) => {
  await open(page, '/library');
  await page.locator('#paletteBtn').click();
  const q = page.locator('#paletteQ');
  const theme = page.locator('#paletteList .pal-item').filter({ hasText: 'Theme' }).filter({ hasText: 'Waheguru' });
  for (const typed of ['waheguru', 'Waheguru', 'vaheguru', 'vahiguru', 'wahiguru', 'wahe']) {
    await q.fill(typed);
    await expect(theme.first(), typed).toHaveAttribute('href', '/search?q=vahiguru&mode=theme');
  }
});
