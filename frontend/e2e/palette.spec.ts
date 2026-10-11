import { test, expect, type Page } from '@playwright/test';

// Jump anywhere: ⌘K / Ctrl+K, "/" or the bar's button opens a box that knows the Angs, the raags,
// the sections, the banis, the contributors, the themes and the pages. It matches names the site
// already has, hands anything else to the real search, and is loaded only when first asked for.

const mobile = (page: Page) => (page.viewportSize()?.width ?? 1280) <= 840;
const pal = (page: Page) => page.locator('#palette');
const items = (page: Page) => page.locator('#paletteList .pal-item');
async function open(page: Page, url = '/library') {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url);
  await expect(page.locator('#ver')).not.toBeEmpty({ timeout: 15_000 });
}
async function summon(page: Page) {
  await page.locator('#paletteBtn').click();
  await expect(pal(page)).toHaveClass(/\bon\b/);
  await expect(page.locator('#paletteQ')).toBeFocused();
}

test('the palette is not loaded until it is asked for; the bar button opens it with the pages listed', async ({ page }) => {
  const scripts: string[] = [];
  page.on('request', (r) => { if (/\/_astro\/palette\..*\.js/.test(r.url())) scripts.push(r.url()); });
  await open(page);
  expect(scripts, 'nothing fetched before it is asked for').toEqual([]);
  await expect(pal(page)).toHaveAttribute('inert', '');
  await summon(page);
  expect(scripts).toHaveLength(1);
  await expect(items(page).filter({ hasText: 'Raag Clock' })).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(pal(page)).toHaveAttribute('inert', '');
  await expect(page.locator('#paletteBtn')).toBeFocused();
});

test('the keyboard opens it: Ctrl+K from anywhere, "/" only when not typing', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'a keyboard rule');
  await open(page, '/search');
  await page.locator('#q').focus();
  await page.keyboard.type('a/b');                                   // a slash typed into a box is a slash
  await expect(page.locator('#q')).toHaveValue('a/b');
  await expect(pal(page)).not.toHaveClass(/\bon\b/);
  await page.keyboard.press('Control+k');
  await expect(pal(page)).toHaveClass(/\bon\b/);
  await page.keyboard.press('Escape');
  await page.locator('#q').blur();
  await page.keyboard.press('/');
  await expect(pal(page)).toHaveClass(/\bon\b/);
  await expect(page.locator('#paletteQ')).toHaveValue('');
});

test('a number goes to that Ang; an impossible number does not offer one', async ({ page }) => {
  await open(page);
  await summon(page);
  await page.locator('#paletteQ').fill('712');
  await expect(items(page).first()).toContainText('Go to Ang 712');
  await expect(items(page).first()).toContainText('todee');
  await page.locator('#paletteQ').fill('2000');
  await expect(items(page).filter({ hasText: 'Go to Ang' })).toHaveCount(0);
  await page.locator('#paletteQ').fill('712');
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/reader\?ang=712$/);
  await expect(page.locator('#angOut .sline').first()).toBeVisible({ timeout: 15_000 });
});

test('names are found as the site has them: a raag, a bani, a theme, a contributor, a page', async ({ page }) => {
  await open(page);
  await summon(page);
  const q = page.locator('#paletteQ');
  await q.fill('todee');
  await expect(items(page).first()).toContainText('Raag');
  await expect(items(page).first()).toHaveAttribute('href', /\/reader\?ang=711&raag=/);
  await q.fill('japji');
  await expect(items(page).filter({ hasText: 'Bani' }).first()).toHaveAttribute('href', '/nitnem?bani=japji');
  await q.fill('hukam');
  await expect(items(page).filter({ hasText: 'Theme' }).first()).toHaveAttribute('href', '/search?q=hukam&mode=theme');
  await q.fill('kabir');
  await expect(items(page).filter({ hasText: 'Contributor' }).first()).toContainText('Kabir');
  await q.fill('clock');
  await expect(items(page).first()).toHaveAttribute('href', '/raag-clock');
  // a Gurmukhi name is shown in the scripture face, in ink, and found by its own letters
  await q.fill('ਟੋਡੀ');
  await expect(items(page).first().locator('.gm[lang="pa"]')).toHaveText('ਟੋਡੀ');
});

test('anything it does not know goes to the real search; the arrows choose', async ({ page }) => {
  await open(page);
  await summon(page);
  await page.locator('#paletteQ').fill('sochai soch');
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first()).toHaveAttribute('href', '/search?q=sochai%20soch');
  await page.locator('#paletteQ').fill('raag');
  await expect(items(page).first()).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(items(page).nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#paletteQ')).toHaveAttribute('aria-activedescendant', 'pal-1');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');                              // wraps to the last: the search
  await expect(items(page).last()).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/search\?q=raag$/);
});

test('with a place kept in the Reader, an empty box offers to continue there; in the Reader, arrows do not turn the Ang', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sggs_last_ang', '901'));
  await open(page, '/reader?ang=5');
  await expect(page.locator('#angOut .sline').first()).toBeVisible({ timeout: 15_000 });
  await summon(page);
  await expect(items(page).first()).toContainText('Ang 901');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(300);
  expect(new URL(page.url()).searchParams.get('ang')).toBe('5');
  await items(page).first().click();
  await page.waitForURL(/\/reader\?ang=901$/);
  await expect(pal(page)).not.toHaveClass(/\bon\b/);
});

test('the palette stays inside the screen and the bar still fits a phone', async ({ page }) => {
  await open(page, '/reader?ang=712');
  const bar = await page.evaluate(() => {
    const b = document.getElementById('paletteBtn')!.getBoundingClientRect();
    return { w: b.width, h: b.height, right: b.right, iw: innerWidth, sw: document.documentElement.scrollWidth };
  });
  expect(bar.sw).toBeLessThanOrEqual(bar.iw);
  expect(bar.h).toBeGreaterThanOrEqual(39.5);
  if (mobile(page)) expect(bar.w).toBeGreaterThanOrEqual(43.5);
  await summon(page);
  await page.locator('#paletteQ').fill('a');
  const m = await page.evaluate(() => { const r = document.getElementById('palette')!.getBoundingClientRect(); return { left: r.left, right: r.right, bottom: r.bottom, iw: innerWidth, ih: innerHeight, sw: document.documentElement.scrollWidth, fs: parseFloat(getComputedStyle(document.getElementById('paletteQ')!).fontSize) }; });
  expect(m.left).toBeGreaterThanOrEqual(0);
  expect(m.right).toBeLessThanOrEqual(m.iw + 0.5);
  expect(m.bottom).toBeLessThanOrEqual(m.ih + 0.5);
  expect(m.sw).toBeLessThanOrEqual(m.iw);
  expect(m.fs).toBeGreaterThanOrEqual(16);
});
