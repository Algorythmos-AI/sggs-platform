import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// The Knowledge Base's colour themes (html[data-accent]) and paper tone (html[data-tone]): a
// stored choice is on the page before first paint and survives a reload; a value we do not know,
// or blocked storage, falls back to the stylesheet's defaults; a change made in another tab
// arrives here; and the browser chrome follows. That every theme keeps its text readable, on every
// page, is kb-contrast.spec.ts. The themes are generated from docs/brand/web-themes.json.

const here = dirname(fileURLToPath(import.meta.url));
const KB = JSON.parse(readFileSync(resolve(here, '../src/generated/kb-themes.json'), 'utf8')) as {
  default: string;
  themes: { id: string; name: string; swatch: { light: string[]; dark: string[] }; chrome: { light: string; dark: string } }[];
};
const token = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
const ready = (page: Page) => expect(page.locator('#ver')).not.toBeEmpty({ timeout: 15_000 });

test('a stored colour theme and paper tone are on the page and survive a reload', async ({ page }) => {
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

// The proof that it is BEFORE paint: with every script file refused, only the inline script in the
// <head> can have done it. (Take that script out and this fails; the test above would not.)
test('the stored appearance, theme, tone and browser-chrome colour are set by the inline boot script alone', async ({ page }) => {
  await page.route(/\/_astro\/.*\.js(\?.*)?$/, (r) => r.abort());
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'dark'); localStorage.setItem('sggs_accent', 'azur'); localStorage.setItem('sggs_reader_tone', 'warm');
  });
  await page.goto('/search', { waitUntil: 'domcontentloaded' });
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(html).toHaveAttribute('data-accent', 'azur');
  await expect(html).toHaveAttribute('data-tone', 'warm');
  const azur = KB.themes.find((t) => t.id === 'azur')!;
  // the header's colour, by night, in this theme: no flash of the default's cream on the way in
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', azur.chrome.dark);
  expect((await token(page, '--chrome')).toUpperCase()).toBe(azur.chrome.dark);
  expect(await page.locator('#ver').textContent(), 'no module script ran').toBe('');
});

test('with nothing stored, the browser chrome is the default theme\'s for the system appearance', async ({ page }) => {
  await page.route(/\/_astro\/.*\.js(\?.*)?$/, (r) => r.abort());
  const def = KB.themes.find((t) => t.id === KB.default)!;
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/search', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', def.chrome[scheme]);
  }
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
