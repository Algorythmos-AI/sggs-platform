import { test, expect, type Page } from '@playwright/test';

// A verse's actions, in one sheet, wherever a verse appears. What is pinned, copied or shared is
// the verbatim line from the API, with its citation — never the painted glyphs (the traditional
// saroop draws the subjoined yayya as the yakash sign U+0A75, which must not leave the page).

const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);
const sheet = (page: Page) => page.locator('#verseSheet');
async function reader(page: Page, ang: number) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/reader?ang=${ang}`);
  await expect(page.locator('#angOut .sline').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#ver')).not.toBeEmpty({ timeout: 15_000 });
}
// the first verse of the Ang, as the API has it
async function firstLine(page: Page, ang: number) {
  const d = await (await page.request.get(`/api/ang/${ang}`)).json();
  return d.lines.find((l: any) => !l.is_header);
}

test('the button on a verse opens its actions, showing the verse verbatim with its citation', async ({ page }) => {
  await reader(page, 1400);                                         // an Ang the traditional saroop repaints
  const line = await firstLine(page, 1400);
  const btn = page.locator(`#angOut .pin-btn[data-id="${line.id}"]`);
  await expect(btn).toHaveAttribute('aria-label', 'Verse actions');
  await btn.click();
  await expect(sheet(page)).toHaveClass(/\bon\b/);
  await expect(page.locator('#vsCite')).toHaveText('Sri Guru Granth Sahib Ji · Ang 1400');
  // the sheet shows the line; mapped back from the display layer, it is the API's, byte for byte
  const shown = (await page.locator('#vsText').textContent()) || '';
  expect(shown.replace(/ੵ/g, '੍ਯ੍ਯ')).toBe(line.gurmukhi);
  await expect(page.locator('#vsRelated')).toHaveAttribute('href', `/trail?line_id=${line.id}`);
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveAttribute('inert', '');
  await expect(btn).toBeFocused();
});

test('Pin keeps the verbatim line and marks the verse; Unpin removes it', async ({ page }) => {
  await reader(page, 1400);
  const line = await firstLine(page, 1400);
  const btn = page.locator(`#angOut .pin-btn[data-id="${line.id}"]`);
  await btn.click();
  await expect(page.locator('#vsPin')).toHaveText('Pin verse');
  await page.locator('#vsPin').click();
  await expect(page.locator('#vsPin')).toHaveText('Unpin');
  const pins = JSON.parse((await stored(page, 'sggs_pins')) as string);
  expect(pins).toHaveLength(1);
  expect(pins[0].gm, 'what is kept is the API line, byte for byte').toBe(line.gurmukhi);
  expect(pins[0].ang).toBe(1400);
  await expect(btn).toHaveClass(/pinned/);
  await expect(btn).toHaveAttribute('aria-label', 'Verse actions (pinned)');
  await expect(page.locator('[data-saved-count]:visible')).toHaveText('1');
  await page.locator('#vsPin').click();
  expect(JSON.parse((await stored(page, 'sggs_pins')) as string)).toHaveLength(0);
  await expect(btn).not.toHaveClass(/pinned/);
});

test('Copy puts the verbatim line and its Ang on the clipboard, with no display-only selectors', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'clipboard permissions are a Chromium grant');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await reader(page, 1400);
  const line = await firstLine(page, 1400);
  await page.locator(`#angOut .pin-btn[data-id="${line.id}"]`).click();
  await page.locator('#vsCopy').click();
  await expect(sheet(page)).not.toHaveClass(/\bon\b/);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toBe(`${line.gurmukhi}\n— Sri Guru Granth Sahib Ji · Ang 1400`);
  expect(/[︀-️]/.test(clip)).toBe(false);
});

test('Share hands over the same text and a link that lands on the verse', async ({ page }) => {
  await page.addInitScript(() => { (navigator as any).share = (d: any) => { (window as any).__shared = d; return Promise.resolve(); }; });
  await reader(page, 712);
  const line = await firstLine(page, 712);
  await page.locator(`#angOut .pin-btn[data-id="${line.id}"]`).click();
  await expect(page.locator('#vsShare')).toBeVisible();
  await page.locator('#vsShare').click();
  const shared = await page.evaluate(() => (window as any).__shared);
  expect(shared.text).toBe(`${line.gurmukhi}\n— Sri Guru Granth Sahib Ji · Ang 712`);
  expect(new URL(shared.url).pathname + new URL(shared.url).search).toBe(`/reader?ang=712&line=${line.id}`);
});

test('from a search result: the card under the button does not open, and the actions lead on', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/search?q=sochai+soch+na+hovee');
  const card = page.locator('#results .card').first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.locator('.pin-btn').click();
  await expect(sheet(page)).toHaveClass(/\bon\b/);
  await expect(page.locator('#panel'), 'the card did not take the click').not.toHaveClass(/\bon\b/);
  await page.locator('#vsComp').click();
  await expect(sheet(page)).not.toHaveClass(/\bon\b/);
  await expect(page.locator('#panel')).toHaveClass(/\bon\b/);
  await expect(page.locator('#pbody .sline').first()).toBeVisible({ timeout: 15_000 });
  // inside the composition, a verse has its actions too — without "Open the composition"
  await page.locator('#pbody .pin-btn').first().click();
  await expect(sheet(page)).toHaveClass(/\bon\b/);
  await expect(page.locator('#vsComp')).toBeHidden();
  await page.keyboard.press('Escape');                              // closes the actions only
  await expect(page.locator('#panel')).toHaveClass(/\bon\b/);
  await page.locator('#pbody .pin-btn').first().click();
  await page.locator('#vsOpen').click();
  await page.waitForURL(/\/reader\?ang=\d+&line=\d+/);
});

test('the sheet stays inside the screen and every action is a finger tall', async ({ page }) => {
  await reader(page, 712);
  await page.locator('#angOut .pin-btn').first().click();
  const m = await page.evaluate(() => {
    const s = document.getElementById('verseSheet')!.getBoundingClientRect();
    const hs = Array.from(document.querySelectorAll('#verseSheet .vs-acts > *, #vsClose')).filter((el) => (el as HTMLElement).offsetParent !== null).map((el) => el.getBoundingClientRect().height);
    return { left: s.left, right: s.right, bottom: s.bottom, iw: innerWidth, ih: innerHeight, sw: document.documentElement.scrollWidth, minH: Math.min(...hs) };
  });
  expect(m.left).toBeGreaterThanOrEqual(0);
  expect(m.right).toBeLessThanOrEqual(m.iw + 0.5);
  expect(m.bottom).toBeLessThanOrEqual(m.ih + 0.5);
  expect(m.sw).toBeLessThanOrEqual(m.iw);
  expect(m.minH).toBeGreaterThanOrEqual(43.5);
});

test('a verse shows its themes, each leading to every verse that carries it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/trail?line_id=30729');
  const btn = page.locator('#trailNow .pin-btn');
  await expect(btn).toBeVisible({ timeout: 15_000 });
  const tags = (await (await page.request.get('/api/line_concepts?ids=30729')).json()).concepts['30729'];
  await btn.click();
  const t = page.locator('#vsThemes a');
  await expect(t).toHaveCount(tags.length);
  await expect(t.first()).toHaveAttribute('href', `/search?q=${encodeURIComponent(tags[0])}&mode=theme`);
});

// The themes are an optional extra: a server without the Insights context (SGGS_MODULES=reader)
// answers 404, and a dropped connection fails — neither may raise an error toast.
for (const fail of ['404', 'network'] as const) {
  test(`a verse whose themes cannot load opens quietly (${fail})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/line_concepts**', (r) => fail === '404'
      ? r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not in this module"}' })
      : r.abort());
    await page.goto('/trail?line_id=30729');
    const btn = page.locator('#trailNow .pin-btn');
    await expect(btn).toBeVisible({ timeout: 15_000 });
    await btn.click();
    await expect(sheet(page)).toHaveClass(/(^|\s)on(\s|$)/);
    await page.waitForTimeout(400);
    await expect(page.locator('#vsThemes')).toBeHidden();
    await expect(page.locator('#toast')).not.toHaveClass(/(^|\s)on(\s|$)/);
  });
}

test('on a phone the composition rises as a sheet from the bottom edge', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'a phone layout');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/search?q=sochai+soch+na+hovee');
  await page.locator('#results .card').first().click();
  await expect(page.locator('#pbody .sline').first()).toBeVisible({ timeout: 15_000 });
  const m = await page.evaluate(() => { const r = document.querySelector('#panel .inner')!.getBoundingClientRect(); return { left: r.left, right: r.right, iw: innerWidth, sw: document.documentElement.scrollWidth, radius: getComputedStyle(document.querySelector('#panel .inner')!).borderBottomLeftRadius }; });
  expect(m.left).toBe(0); expect(Math.round(m.right)).toBe(m.iw); expect(m.radius).toBe('0px'); expect(m.sw).toBeLessThanOrEqual(m.iw);
});
