import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// The Knowledge Base's colour themes (html[data-accent]) and paper tone (html[data-tone]): a
// stored choice is on the page before first paint and survives a reload; a value we do not know,
// or blocked storage, falls back to the stylesheet's defaults; a change made in another tab
// arrives here; the browser chrome follows; and every theme, in light and dark, keeps its text
// readable. The themes are generated from docs/brand/web-themes.json.

const here = dirname(fileURLToPath(import.meta.url));
const KB = JSON.parse(readFileSync(resolve(here, '../src/generated/kb-themes.json'), 'utf8')) as {
  default: string; themes: { id: string; name: string; swatch: { light: string[]; dark: string[] } }[];
};
const token = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
const ready = (page: Page) => expect(page.locator('#ver')).not.toBeEmpty({ timeout: 15_000 });

test('a stored colour theme and paper tone are applied before paint and survive a reload', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'light'); localStorage.setItem('sggs_accent', 'azur'); localStorage.setItem('sggs_reader_tone', 'warm');
  });
  await page.goto('/search');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-accent', 'azur');
  await expect(html).toHaveAttribute('data-tone', 'warm');
  const azur = KB.themes.find((t) => t.id === 'azur')!;
  expect((await token(page, '--accent-fill')).toUpperCase()).toBe(azur.swatch.light[0]);
  expect((await token(page, '--paper')).toUpperCase()).toBe('#FDF6E3');
  await page.reload();
  await ready(page);
  await expect(html).toHaveAttribute('data-accent', 'azur');
  await expect(html).toHaveAttribute('data-tone', 'warm');
});

test('a theme name we do not know is ignored, and the default theme needs no attribute', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('theme', 'light'); localStorage.setItem('sggs_accent', 'no-such-theme'); });
  await page.goto('/search');
  await ready(page);
  expect(await page.locator('html').getAttribute('data-accent')).toBeNull();
  const def = KB.themes.find((t) => t.id === KB.default)!;
  expect((await token(page, '--accent-fill')).toUpperCase()).toBe(def.swatch.light[0]);
});

test('with browser storage blocked the page still renders in its default colours', async ({ page }) => {
  await page.addInitScript(() => {
    const blocked = () => { throw new DOMException('blocked', 'SecurityError'); };
    Storage.prototype.getItem = blocked; Storage.prototype.setItem = blocked;
  });
  await page.goto('/reader?ang=1');
  await expect(page.locator('#angOut .sline').first()).toBeVisible({ timeout: 15_000 });
  for (const name of ['--ink', '--canvas', '--paper', '--accent-text', '--accent-fill', '--on-accent'])
    expect(await token(page, name), name).toMatch(/^#[0-9A-Fa-f]{6}$/);
  expect(await page.locator('html').getAttribute('data-accent')).toBeNull();
  await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/);
});

test('a theme chosen in another tab arrives here, and the browser chrome follows it', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.goto('/search');
  await ready(page);
  const meta = page.locator('meta[name="theme-color"]');
  await expect(meta).toHaveAttribute('content', await token(page, '--chrome'));
  const before = await token(page, '--chrome');
  await page.evaluate(() => {
    (window as any).__changes = 0;
    document.addEventListener('themechange', () => { (window as any).__changes++; });
    localStorage.setItem('sggs_accent', 'glicine');
    window.dispatchEvent(new StorageEvent('storage', { key: 'sggs_accent', newValue: 'glicine' }));
  });
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'glicine');
  const after = await token(page, '--chrome');
  expect(after).not.toBe(before);
  await expect(meta).toHaveAttribute('content', after);
  expect(await page.evaluate(() => (window as any).__changes)).toBeGreaterThan(0);
});

// Colour does not depend on the engine, so the per-theme proof runs once, on the desktop project.
for (const t of KB.themes) {
  for (const mode of ['light', 'dark'] as const) {
    test(`${t.name} (${mode}): its tokens are live and the Reader's text passes contrast`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'colour is engine-independent; proven once');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(([m, id]) => { localStorage.setItem('theme', m); localStorage.setItem('sggs_accent', id); }, [mode, t.id]);
      await page.goto('/reader?ang=712');
      await expect(page.locator('#angCtx .timechip')).toBeVisible({ timeout: 15_000 });
      await page.evaluate(() => document.fonts.ready);
      expect((await token(page, '--accent-fill')).toUpperCase()).toBe(t.swatch[mode][0]);
      const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
      expect(results.violations.flatMap((v) => v.nodes.map((n) => String(n.target))), `contrast on the Reader in ${t.name} (${mode})`).toEqual([]);
    });
  }
}
