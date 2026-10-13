import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// The display sheet (#displaySheet, opened by "Aa" in the top bar on every screen) and the one
// overlay stack under it, the composition panel and Saved: a choice applies at once and is kept;
// the sheet shows what is in force; closed it is inert; and while anything is open over the page,
// Escape closes the top one only, Tab stays inside it, and the Reader's arrow keys do nothing.

const here = dirname(fileURLToPath(import.meta.url));
const KB = JSON.parse(readFileSync(resolve(here, '../src/generated/kb-themes.json'), 'utf8')) as {
  default: string;
  themes: { id: string; name: string; evokes: string; swatch: { light: string[]; dark: string[] }; chrome: { light: string; dark: string } }[];
};
const theme = (id: string) => KB.themes.find((t) => t.id === id)!;
const token = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);
const ready = (page: Page) => expect(page.locator('#ver')).not.toBeEmpty({ timeout: 15_000 });
const sheet = (page: Page) => page.locator('#displaySheet');
const choice = (page: Page, name: string, value: string) => page.locator(`#displaySheet label:has(input[name="${name}"][value="${value}"])`);
const radio = (page: Page, name: string, value: string) => page.locator(`#displaySheet input[name="${name}"][value="${value}"]`);
async function openSheet(page: Page) {
  await page.locator('#displayBtn').click();
  await expect(sheet(page)).toHaveClass(/\bon\b/);
}
const start = async (page: Page, url = '/search', mode: 'light' | 'dark' = 'light') => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((m) => { if (!localStorage.getItem('theme')) localStorage.setItem('theme', m); }, mode);
  await page.goto(url);
  await ready(page);
};

test('closed, the sheet is inert; it opens from the top bar, and Escape or a tap outside closes it and gives focus back', async ({ page }) => {
  await start(page);
  const btn = page.locator('#displayBtn');
  await expect(btn).toBeVisible();
  await expect(sheet(page)).toHaveAttribute('inert', '');
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await openSheet(page);
  await expect(sheet(page)).not.toHaveAttribute('inert', '');
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#displayClose')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveAttribute('inert', '');
  await expect(btn).toBeFocused();
  await openSheet(page);
  await page.mouse.click(8, 8);                       // the scrim: anywhere that is not the sheet
  await expect(sheet(page)).not.toHaveClass(/\bon\b/);
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
});

test('the open sheet stays inside the screen, and every control in it is at least 44px', async ({ page }) => {
  await start(page, '/reader?ang=1');
  await openSheet(page);
  const m = await page.evaluate(() => {
    const s = document.getElementById('displaySheet')!, r = s.getBoundingClientRect();
    const small = Array.from(s.querySelectorAll('button, label')).map((el) => ({ el, b: el.getBoundingClientRect() }))
      .filter(({ b }) => b.width < 43.5 || b.height < 43.5)
      .map(({ el, b }) => `${el.id || el.textContent!.trim()} ${Math.round(b.width)}×${Math.round(b.height)}`);
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, iw: innerWidth, ih: innerHeight, sw: document.documentElement.scrollWidth, small };
  });
  expect(m.left).toBeGreaterThanOrEqual(0);
  expect(m.right).toBeLessThanOrEqual(m.iw + 0.5);
  expect(m.top).toBeGreaterThanOrEqual(0);
  expect(m.bottom).toBeLessThanOrEqual(m.ih + 0.5);
  expect(m.sw, 'no sideways scroll with the sheet open').toBeLessThanOrEqual(m.iw);
  expect(m.small).toEqual([]);
  // all thirteen themes, in their three collections
  await expect(page.locator('#displaySheet input[name="kbAccent"]')).toHaveCount(KB.themes.length);
  await expect(page.locator('#displaySheet .ds-coll')).toHaveCount(3);
});

test('a colour theme applies at once, is kept, and the browser chrome follows; the default needs no attribute', async ({ page }) => {
  await start(page, '/reader?ang=1');
  await openSheet(page);
  await expect(radio(page, 'kbAccent', KB.default)).toBeChecked();
  await choice(page, 'kbAccent', 'lavande').click();
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-accent', 'lavande');
  expect((await token(page, '--accent-fill')).toUpperCase()).toBe(theme('lavande').swatch.light[0]);
  expect(await stored(page, 'sggs_accent')).toBe('lavande');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', await token(page, '--chrome'));
  await expect(page.locator('#dsEvokes')).toHaveText(`Lavande — ${theme('lavande').evokes}`);
  await expect(sheet(page), 'choosing does not close the sheet').toHaveClass(/\bon\b/);
  await page.reload();
  await ready(page);
  await expect(html).toHaveAttribute('data-accent', 'lavande');
  await openSheet(page);
  await expect(radio(page, 'kbAccent', 'lavande')).toBeChecked();
  await choice(page, 'kbAccent', KB.default).click();
  expect(await html.getAttribute('data-accent')).toBeNull();
  expect(await stored(page, 'sggs_accent')).toBe(KB.default);
});

test('appearance and paper tone follow the sheet, and the sheet follows the theme button', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await start(page, '/reader?ang=1');
  const html = page.locator('html');
  await openSheet(page);
  await expect(radio(page, 'kbTheme', 'light')).toBeChecked();
  await choice(page, 'kbTheme', 'dark').click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  expect(await stored(page, 'theme')).toBe('dark');
  await expect(page.locator('#themeBtn')).toHaveText('☾');
  await expect(page.locator('#displaySheet .ds-tone'), 'the paper tone is a daytime choice').toBeHidden();
  await choice(page, 'kbTheme', 'system').click();
  await expect(html).toHaveAttribute('data-theme', 'light');             // the system is light here
  expect(await stored(page, 'theme')).toBe('system');
  await expect(page.locator('#displaySheet .ds-tone')).toBeVisible();
  await choice(page, 'kbTone', 'warm').click();
  await expect(html).toHaveAttribute('data-tone', 'warm');
  expect((await token(page, '--paper')).toUpperCase()).toBe('#FDF6E3');
  expect(await stored(page, 'sggs_reader_tone')).toBe('warm');
  await choice(page, 'kbTone', 'paper').click();
  expect(await html.getAttribute('data-tone')).toBeNull();
  await page.keyboard.press('Escape');
  await page.locator('#themeBtn').click();                                // system → light
  await page.locator('#themeBtn').click();                                // light → dark
  await openSheet(page);
  await expect(radio(page, 'kbTheme', 'dark')).toBeChecked();
});

test('the text size steps from the sheet, is kept, and stops at its limits without losing focus', async ({ page }) => {
  await start(page, '/reader?ang=1');
  await openSheet(page);
  const val = page.locator('#dsSizeVal'), up = page.locator('#dsSizeUp'), down = page.locator('#dsSizeDown');
  await expect(val).toHaveText('22 px');
  expect(await stored(page, 'gsize'), 'nothing is stored until a size is chosen').toBeNull();
  await up.click();
  await expect(val).toHaveText('24 px');
  expect(await stored(page, 'gsize')).toBe('24');
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--gsize'))).toBe('24px');
  const px = await page.locator('#angOut .sline .g').first().evaluate((el) => getComputedStyle(el).fontSize);
  expect(px).toBe('24px');
  for (let i = 0; i < 4; i++) await down.click();
  await expect(val).toHaveText('16 px');
  await expect(down).toHaveAttribute('aria-disabled', 'true');
  await down.click({ force: true });                                      // at the limit: nothing happens
  await expect(val).toHaveText('16 px');
  expect(await stored(page, 'gsize')).toBe('16');
  // never the `disabled` attribute: a control that disables itself under the finger drops focus out of the sheet
  expect(await down.getAttribute('disabled')).toBeNull();
  await down.focus();
  await expect(down).toBeFocused();
});

test('the saroop switch lives in the sheet, once, and still only changes how the text is drawn', async ({ page }) => {
  await start(page, '/reader?ang=1');
  await expect(page.locator('#saroopBtn')).toHaveCount(1);
  await expect(page.locator('.kb-chrome #saroopBtn')).toHaveCount(0);
  const html = page.locator('html'), sw = page.locator('#saroopBtn');
  await expect(html).toHaveClass(/saroop-on/);                            // on unless the reader turned it off
  const before = await page.locator('#angOut .sline[data-line-id]').first().getAttribute('data-gm');
  await openSheet(page);
  await expect(sw).toHaveAttribute('aria-pressed', 'true');
  await sw.click();
  await expect(html).not.toHaveClass(/saroop-on/);
  await expect(sw).toHaveAttribute('aria-pressed', 'false');
  expect(await stored(page, 'sggs_saroop')).toBe('0');
  expect(await page.locator('#angOut .sline[data-line-id]').first().getAttribute('data-gm'), 'the verbatim text is untouched').toBe(before);
});

test('Tab stays inside the open sheet', async ({ page }) => {
  await start(page);
  await openSheet(page);
  await expect(page.locator('#displayClose')).toBeFocused();              // the sheet has taken focus: only then is it ours to move
  await page.locator('#saroopBtn').focus();                               // the last control
  await page.keyboard.press('Tab');
  await expect(page.locator('#displayClose')).toBeFocused();              // … wraps to the first
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#saroopBtn')).toBeFocused();
});

test.describe('over the Reader', () => {
  const ang = (page: Page) => page.evaluate(() => new URLSearchParams(location.search).get('ang'));
  const loaded = (page: Page) => expect(page.locator('#angOut .sline').first()).toBeVisible({ timeout: 15_000 });

  test('with the sheet open, arrow keys choose a theme and never turn the Ang; closed, they turn it again', async ({ page }) => {
    await start(page, '/reader?ang=5');
    await loaded(page);
    await openSheet(page);
    await page.keyboard.press('ArrowRight');                              // focus is on the close button
    await radio(page, 'kbAccent', KB.default).focus();
    await page.keyboard.press('ArrowRight');                              // the next theme in the group
    await expect(page.locator('html')).toHaveAttribute('data-accent', KB.themes[1].id);
    await page.waitForTimeout(300);
    expect(await ang(page)).toBe('5');
    await page.keyboard.press('Escape');
    await expect(sheet(page)).not.toHaveClass(/\bon\b/);
    expect(await ang(page)).toBe('5');
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => ang(page)).toBe('6');
  });

  test('one Escape closes one thing: Saved first, then Sehaj reading mode', async ({ page }) => {
    await start(page, '/reader?ang=5');
    await loaded(page);
    await page.evaluate(() => (window as any).sehaj());
    await expect(page.locator('body')).toHaveClass(/focus-mode/);
    await page.evaluate(() => (window as any).openStudyTrail());
    await expect(page.locator('#trailDrawer')).toHaveClass(/\bon\b/);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    await expect(page.locator('#trailDrawer')).not.toHaveClass(/\bon\b/);
    await expect(page.locator('body'), 'Sehaj is still on').toHaveClass(/focus-mode/);
    expect(await ang(page)).toBe('5');
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/focus-mode/);
  });

  test('a composition opened twice keeps its first opener, and closing returns focus there', async ({ page }) => {
    await start(page, '/search?q=sochai+soch+na+hovee');
    const card = page.locator('#results .card').first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#panel')).toHaveClass(/\bon\b/);
    await expect(page.locator('#pbody .sline').first()).toBeVisible({ timeout: 15_000 });
    // focus is in the dialog: on its close button, then on the verse that was asked for
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('#panel'))).toBe(true);
    await page.evaluate(() => (window as any).openPanel());              // as "Another ↻" does, from inside
    await page.locator('#panel .x').focus();
    await page.keyboard.press('Shift+Tab');                               // from the first control: wraps, stays inside
    expect(await page.evaluate(() => !!document.activeElement?.closest('#panel'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('#panel')).not.toHaveClass(/\bon\b/);
    await expect(card).toBeFocused();
  });

  test('a composition that arrives late never replaces the one asked for after it', async ({ page }) => {
    await start(page, '/search');
    let slow = true;                                                      // the first request is the slow one
    await page.route('**/api/shabad/*', async (route) => {
      if (slow) { slow = false; await new Promise((r) => setTimeout(r, 900)); }
      await route.continue().catch(() => {});
    });
    const want = (await (await page.request.get('/api/shabad/200')).json()).lines[0].ang;
    await page.evaluate(() => { (window as any).shabad(100); });
    await expect(page.locator('#panel')).toHaveClass(/\bon\b/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#panel')).not.toHaveClass(/\bon\b/);
    await page.evaluate(() => { (window as any).shabad(200); });
    await expect(page.locator('#ptitle')).toHaveText(`Composition · Ang ${want}`, { timeout: 15_000 });
    await page.waitForTimeout(1200);                                      // the slow one has landed by now
    await expect(page.locator('#ptitle')).toHaveText(`Composition · Ang ${want}`);
  });
});
