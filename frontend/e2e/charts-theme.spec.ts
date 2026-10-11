import { test, expect, type Page } from '@playwright/test';

// The drawings follow the theme without a reload, and a category keeps its colour whichever accent
// is chosen. A chart reads its colours from the stylesheet when it draws: before this it kept the
// colours of the theme it was first drawn in.

const token = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim().toLowerCase(), name);
// any CSS colour → "r,g,b", as the browser computes it
const rgb = (page: Page, css: string) => page.evaluate((c) => { const d = document.createElement('i'); d.style.color = c; document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v; }, css);
const fillOf = (page: Page, sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).fill);
const setTheme = (page: Page, mode: string, accent: string) => page.evaluate(([m, a]) => {
  const r = document.documentElement; r.setAttribute('data-theme', m); if (a) r.setAttribute('data-accent', a); else r.removeAttribute('data-accent');
}, [mode, accent]);

test.use({ timezoneId: 'UTC' });

test('Insights: the charts repaint when the appearance and the colour theme change, with no new requests', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'colour is engine-independent; proven once');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('theme', 'light'));
  await page.goto('/analytics');
  for (const sel of ['#network svg circle', '#chord svg path.res-ribbon', '#stream svg path', '#streamLegend span'])
    await expect(page.locator(sel).first()).toBeVisible({ timeout: 20_000 });
  const ink0 = await rgb(page, await token(page, '--ink'));
  expect(await fillOf(page, '#chord svg text')).toBe(ink0);
  expect(await fillOf(page, '#network svg .labels text')).toBe(ink0);
  const node0 = await fillOf(page, '#network svg circle');
  const stream0 = await fillOf(page, '#stream svg path');
  const calls: string[] = [];
  page.on('request', (r) => { if (r.url().includes('/api/')) calls.push(r.url()); });

  await setTheme(page, 'dark', 'azur');
  const ink1 = await rgb(page, await token(page, '--ink'));
  expect(ink1).not.toBe(ink0);
  await expect.poll(() => fillOf(page, '#chord svg text')).toBe(ink1);
  await expect.poll(() => fillOf(page, '#network svg .labels text')).toBe(ink1);
  await expect.poll(() => fillOf(page, '#network svg circle'), 'the network takes the new accent').not.toBe(node0);
  // a category colour is fixed: the stream's first theme is the same colour in every theme
  await expect(page.locator('#stream svg path').first()).toBeVisible();
  expect(await fillOf(page, '#stream svg path')).toBe(stream0);
  expect(stream0).toBe(await rgb(page, await token(page, '--viz-1')));
  expect(calls, 'a repaint asks the server for nothing').toEqual([]);
});

test('a contributor kind keeps its colour under every accent, and the kinds stay apart', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'colour is engine-independent; proven once');
  await page.addInitScript(() => localStorage.setItem('theme', 'light'));
  await page.goto('/lineage');
  await expect(page.locator('#timeline .tl-node').first()).toBeVisible({ timeout: 15_000 });
  const kinds = () => page.evaluate(() => ['guru', 'bhagat', 'bhatt', 'gursikh'].map((k) => {
    const el = document.querySelector(`#timeline .kind-${k} .tl-card`) as HTMLElement | null;
    return el ? getComputedStyle(el).borderLeftColor : '';
  }));
  const before = await kinds();
  expect(new Set(before.filter(Boolean)).size, 'four kinds, four colours').toBe(before.filter(Boolean).length);
  await setTheme(page, 'light', 'indigo');                          // the accent that used to match the Bhagats' blue
  const after = await kinds();
  expect(after).toEqual(before);
  expect(after[0]).not.toBe(after[1]);
});

test('the Constellation repaints with the theme', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'colour is engine-independent; proven once');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('theme', 'light'));
  await page.goto('/constellation');
  await expect(page.locator('#constel svg circle').first()).toBeVisible({ timeout: 20_000 });
  const centre = () => page.evaluate(() => Array.from(document.querySelectorAll('#constel svg circle')).map((c) => getComputedStyle(c).fill).pop());
  const fill0 = await centre();
  expect(fill0).toBe(await rgb(page, await token(page, '--accent-fill')));
  await setTheme(page, 'light', 'lavande');
  const want = await rgb(page, await token(page, '--accent-fill'));
  expect(want).not.toBe(fill0);
  await expect.poll(centre).toBe(want);
});
