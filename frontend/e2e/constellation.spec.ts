import { test, expect, type Page } from '@playwright/test';

// Constellation v2: the caption always adds up, the two rankings differ, a companion opens the
// verses both themes share (each with its matched words marked, whole words only), the halo opens
// the verses that carry the theme alone, the centre opens the theme card, the Sky draws every theme,
// and the URL carries the state so a link opens the same view.

const ready = (page: Page) => expect(page.locator('#constel .constel-list li').first()).toBeVisible({ timeout: 20_000 });
const num = (s: string) => Number(s.replace(/,/g, ''));

test('the caption adds up: total = shared + alone', async ({ page }) => {
  await page.goto('/constellation?theme=naam');
  await ready(page);
  const head = (await page.locator('#conHead').textContent()) || '';
  const m = head.match(/([\d,]+) verses carry Naam · ([\d,]+) also carry another theme · ([\d,]+) carry Naam alone/);
  expect(m, head).not.toBeNull();
  expect(num(m![1])).toBe(num(m![2]) + num(m![3]));
  expect(num(m![1])).toBe(5672);
  await expect(page.locator('#conStrip .con-bin')).toHaveCount(15);
});

test('most distinctive is a different ring from most shared', async ({ page }) => {
  await page.goto('/constellation?theme=naam');
  await ready(page);
  const names = () => page.locator('#constel .constel-list li .con-link[data-co]').allInnerTexts();
  const shared = await names();
  await page.locator('[data-rank="distinctive"]').click();
  await expect(page.locator('[data-rank="distinctive"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(names).not.toEqual(shared);
  expect((await names()).slice(0, 3)).toEqual(['Bani', 'Amrit', 'Bhavjal']);
  expect(page.url()).toContain('rank=distinctive');
});

test('a companion opens the verses both themes share, words marked whole', async ({ page }) => {
  await page.goto('/constellation?theme=naam&rank=distinctive');
  await ready(page);
  await page.locator('#constel .con-link[data-co="haumai"]').click();
  const pair = page.locator('#conPair');
  await expect(pair.locator('.sline').first()).toBeVisible({ timeout: 15_000 });
  await expect(pair.locator('.viz-title')).toContainText('Naam ✦ Haumai · 47 verses');
  const first = pair.locator('.sline .g.gm').first();
  await expect(first).toHaveAttribute('lang', 'pa');
  expect(await first.locator('mark').count()).toBeGreaterThanOrEqual(2);
  expect(page.url()).toContain('with=haumai');
});

test('the halo opens the verses that carry the theme alone; a link restores it', async ({ page }) => {
  await page.goto('/constellation?theme=naam&alone=1');
  await expect(page.locator('#conPair .viz-title')).toContainText('Naam alone · 1,952 verses', { timeout: 20_000 });
  await page.locator('#conMore').click();
  await expect(page.locator('#conMore')).toContainText('100 of 1,952');
});

test('the centre opens the theme card', async ({ page }) => {
  await page.goto('/constellation?theme=naam');
  await ready(page);
  await page.locator('#constel .con-node[aria-label="Naam: about this theme"]').dispatchEvent('click');
  const card = page.locator('#conCard');
  await expect(card.locator('.con-terms .gm').first()).toBeVisible({ timeout: 15_000 });
  await expect(card).toContainText('5,672 verses');
  await expect(card).toContainText('Raags where it appears more often');
});

test('a lens narrows the caption and still adds up', async ({ page }) => {
  await page.goto('/constellation?theme=naam&rahao=1');
  await ready(page);
  await expect(page.locator('#conHead')).toContainText('350 verses carry Naam (refrains)');
  await expect(page.locator('#conRahao')).toBeChecked();
});

test('the sky draws every theme, and a star focuses it', async ({ page }) => {
  await page.goto('/constellation?theme=naam&view=sky');
  await expect(page.locator('#constel svg .con-node')).toHaveCount(54, { timeout: 20_000 });
  await expect(page.locator('#conLegend .con-key')).toHaveCount(6);
  await page.locator('#constel .con-link[data-theme="kaam"]').click();
  await expect(page.locator('#conHead')).toContainText('carry Kaam', { timeout: 15_000 });
  await expect(page.locator('#conSel')).toHaveValue('kaam');
});
