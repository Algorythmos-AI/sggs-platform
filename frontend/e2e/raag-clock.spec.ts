import { test, expect, type Page } from '@playwright/test';

// The Raag Clock: one face for the reader's own time and the eight watches, as in the app. The
// ring follows the mode (fixed hours, or the sun's with a stored place), the hands follow the
// clock, the lists carry the same content as the face, and a location is asked for only by a
// button. Ring and hands share ONE 12-hour scale: the ring shows the half of the day the hour
// hand is in, and a watch starts where the hour hand points at its first minute. Time is pinned
// and the zone is UTC, so every run draws the same face.

test.use({ timezoneId: 'UTC', locale: 'en-US' });
const AMRITSAR = JSON.stringify({ lat: 31.63, lon: 74.87 });
const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);
const turnOf = (page: Page, id: string) =>
  page.locator(`#${id}`).evaluate((el) => parseFloat((el.getAttribute('transform') || '').replace('rotate(', '')));
const labels = (page: Page) => page.locator('.raagdial .hourmark').allTextContents();
/** where a watch's arc begins, as degrees clockwise from 12 (the first point of its outer edge) */
const arcStartDeg = (page: Page, p: number) => page.locator(`.raagdial .arc[data-pahar="${p}"]`).evaluate((el) => {
  const [x, y] = (el.getAttribute('d') || '').slice(1).split(/[ A]/)[0].split(',').map(Number);
  const d = ((Math.atan2(y - 400, x - 400) * 180 / Math.PI + 90) % 360 + 360) % 360;
  return d > 359.5 ? d - 360 : d;
});
async function open(page: Page, at: string, seed: Record<string, string> = {}, motion: 'reduce' | 'no-preference' = 'reduce') {
  await page.emulateMedia({ reducedMotion: motion });
  await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, seed);
  await page.clock.setFixedTime(new Date(at));
  await page.goto('/raag-clock');
  // the face holds the watches of this half of the day; the list holds all eight
  await expect(page.locator('#clockWrap svg .wedge.is-now')).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator('#watchList .watch')).toHaveCount(8);
}

test('the face shows the time and the watch it is: fixed hours', async ({ page }) => {
  await open(page, '2026-01-15T19:30:00Z');                              // 7:30 PM: the 1st pahar of night
  await expect(page.locator('#nowBody .now-pahar b')).toHaveText('1st pahar of night');
  await expect(page.locator('#nowBody .now-range')).toHaveText('6–9 PM');
  await expect(page.locator('#clockReadout')).toHaveText('7:30 PM·1st pahar of night');
  await expect(page.locator('#nowNext')).toContainText('2nd pahar of night in 1 h 30 min');
  await expect(page.locator('.raagdial .wedge.is-now')).toHaveCount(1);
  await expect(page.locator('.raagdial .wedge.is-now')).toHaveAttribute('data-wedge', '5');
  await expect(page.locator('#watchList .watch[aria-current="time"]')).toHaveAttribute('data-pahar', '5');
  // the hands are the clock's: 7:30 → hour hand 225°, minute hand 180°; the hour hand is the one
  // "now" mark (the ring has no pointer of its own)
  expect(await turnOf(page, 'handHour')).toBeCloseTo(225, 1);
  expect(await turnOf(page, 'handMinute')).toBeCloseTo(180, 1);
  await expect(page.locator('#nowHand')).toHaveCount(0);
  // one 12-hour scale: the afternoon half, labelled on the dial's own 12 · 3 · 6 · 9, and the lit
  // watch (6–9 PM) starts at the 6, where the hour hand points at 6 PM
  await expect(page.locator('.raagdial')).toHaveAttribute('data-half', 'pm');
  expect(await labels(page)).toEqual(['PM', '3 PM', '6 PM', '9 PM']);
  expect(await arcStartDeg(page, 5)).toBeCloseTo(180, 0);
  await expect(page.locator('#clockWrap')).toHaveAttribute('aria-label', /showing 12 PM to 12 AM/);
  await expect(page.locator('.raagdial .wedge')).toHaveCount(4);                 // P3–P6
  // a bead for each raag of a watch, and none in the silent one
  const beads = (p: number) => page.locator(`.raagdial .wedge[data-wedge="${p}"] .bead`).count();
  expect(await beads(7)).toBe(0);
  const label = await page.locator('.raagdial .arc[data-pahar="5"]').getAttribute('aria-label');
  expect(await beads(5)).toBeGreaterThanOrEqual(Number(/(\d+) raags?:/.exec(label || '')?.[1]));
  await expect(page.locator('.raagdial .sunmark')).toHaveCount(0);
});

test('in the morning the ring shows 12 AM–12 PM, and it turns to PM as the hour hand passes noon', async ({ page }) => {
  await open(page, '2026-01-15T08:18:00Z');                              // 8:18 AM: the 1st pahar of day
  await expect(page.locator('.raagdial')).toHaveAttribute('data-half', 'am');
  expect(await labels(page)).toEqual(['AM', '3 AM', '6 AM', '9 AM']);
  await expect(page.locator('.raagdial .wedge.is-now')).toHaveAttribute('data-wedge', '1');
  expect(await turnOf(page, 'handHour')).toBeCloseTo(249, 1);           // 8:18 on a 12-hour face
  expect(await arcStartDeg(page, 1)).toBeCloseTo(180, 0);                // 6 AM is at the 6, never beside the 9
  expect(await arcStartDeg(page, 2)).toBeCloseTo(270, 0);                // 9 AM at the 9
  await expect(page.locator('.raagdial .wedge')).toHaveCount(4);         // P7, P8, P1, P2
  await page.clock.setFixedTime(new Date('2026-01-15T12:01:00Z'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('.raagdial')).toHaveAttribute('data-half', 'pm');
  expect(await labels(page)).toEqual(['PM', '3 PM', '6 PM', '9 PM']);
  await expect(page.locator('.raagdial .wedge.is-now')).toHaveAttribute('data-wedge', '3');
});

test('the words and the face change with the minute, without a reload', async ({ page }) => {
  await open(page, '2026-01-15T20:58:00Z');
  await expect(page.locator('#nowBody .now-pahar b')).toHaveText('1st pahar of night');
  await page.clock.setFixedTime(new Date('2026-01-15T21:02:00Z'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('#nowBody .now-pahar b')).toHaveText('2nd pahar of night');
  await expect(page.locator('.raagdial .wedge.is-now')).toHaveAttribute('data-wedge', '6');
  await expect(page.locator('#clockReadout')).toHaveText('9:02 PM·2nd pahar of night');
});

test('a watch chosen from the list fills the panel and is marked on the face', async ({ page }) => {
  await open(page, '2026-01-15T19:30:00Z');
  await expect(page.locator('#clockDetail .det-title')).toHaveText('1st pahar of night');      // the watch now, to begin with
  const sixth = page.locator('#watchList .watch[data-pahar="6"]');
  await sixth.click();
  await expect(sixth).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#clockDetail .det-title')).toHaveText('2nd pahar of night');
  await expect(page.locator('.raagdial .arc[data-pahar="6"]')).toHaveClass(/arc-sel/);
  // a watch of the other half fills the panel from the list; the face keeps to the hour hand's half
  const second = page.locator('#watchList .watch[data-pahar="2"]');
  await second.click();
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#clockDetail .det-title')).toHaveText('2nd pahar of day');
  await expect(page.locator('.raagdial .arc[data-pahar="2"]')).toHaveCount(0);
  await expect(page.locator('#clockDetail .raagcard .rc-read').first()).toHaveText(/^Ang \d+ ›$/);
  await page.locator('#watchList .watch[data-pahar="7"]').click();
  await expect(page.locator('#clockDetail')).toContainText('The quiet hours');
  await page.locator('#seasonList .season').first().click();
  await expect(page.locator('#clockDetail .det-sub')).toContainText('seasonal raag');
  await expect(second).toHaveAttribute('aria-pressed', 'false');
});

test.describe('solar mode', () => {
  test.use({ timezoneId: 'Asia/Kolkata' });

  test('with a stored place the ring is the sun\'s: unequal watches, sunrise and sunset marked', async ({ page }) => {
    await open(page, '2026-06-21T06:30:00Z', { pahar_mode: 'solar', pahar_loc: AMRITSAR });   // noon in Amritsar, midsummer
    await expect(page.locator('#modeTgl [data-mode="solar"]')).toHaveAttribute('aria-checked', 'true');
    // noon: the afternoon half, so the face marks sunset; sunrise belongs to the morning half
    await expect(page.locator('.raagdial .sunmark')).toHaveCount(1);
    await expect(page.locator('.raagdial .sunmark title')).toHaveText(/^Sunset 7:/);
    await expect(page.locator('#nowBody .now-range')).toContainText('sunrise 5:');
    await expect(page.locator('#nowBody .now-range')).toContainText('sunset 7:');
    // a midsummer day watch is longer than three hours, a night watch shorter
    const long = await page.locator('#watchList .watch[data-pahar="1"] .watch-w').textContent();
    expect(long).toMatch(/^5:\d\d–8:\d\d AM$/);
    const afternoon = await page.locator('#watchList .watch[data-pahar="4"] .watch-w').textContent();
    expect(await page.locator('.raagdial .arc[data-pahar="4"]').getAttribute('aria-label')).toContain(afternoon as string);
    // the watch around noon is cut there: its arc ends on the 12 and the rest is the morning's
    await expect(page.locator('.raagdial .wedge.is-now')).toHaveAttribute('data-wedge', '2');
    expect(await arcStartDeg(page, 2)).toBeCloseTo(0, 0);
    await expect(page.locator('#solarBox')).toContainText('rounded to about 1 km');
    // the place is the reader's to remove
    await page.locator('#solarBox [data-solar="forget"]').click();
    expect(await stored(page, 'pahar_loc')).toBeNull();
    await expect(page.locator('.raagdial .sunmark')).toHaveCount(0);
    await expect(page.locator('#watchList .watch[data-pahar="1"] .watch-w')).toHaveText('6–9 AM');
    await expect(page.locator('#solarBox [data-solar="locate"]')).toBeVisible();
  });

  test('choosing Solar asks the browser for nothing; only "Use my location" does, and the place is rounded', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__asked = 0;
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
        getCurrentPosition: (ok: any) => { (window as any).__asked++; ok({ coords: { latitude: 31.633987, longitude: 74.872264 } }); },
      } });
    });
    await open(page, '2026-06-21T06:30:00Z');
    await page.locator('#modeTgl [data-mode="solar"]').click();
    expect(await stored(page, 'pahar_mode')).toBe('solar');
    expect(await page.evaluate(() => (window as any).__asked)).toBe(0);
    await expect(page.locator('#solarBox')).toContainText('showing the fixed clock');
    await expect(page.locator('.raagdial .sunmark')).toHaveCount(0);
    await page.locator('#solarBox [data-solar="locate"]').click();
    await expect(page.locator('.raagdial .sunmark')).toHaveCount(1);
    expect(await page.evaluate(() => (window as any).__asked)).toBe(1);
    expect(JSON.parse((await stored(page, 'pahar_loc')) as string)).toEqual({ lat: 31.63, lon: 74.87 });
  });

  test('coordinates typed by hand: out of range is refused with a reason, in range is kept', async ({ page }) => {
    await open(page, '2026-06-21T06:30:00Z', { pahar_mode: 'solar' });
    await page.locator('#solarBox [data-solar="manual"]').click();
    await expect(page.locator('#solarLat')).toBeFocused();
    await page.locator('#solarLat').fill('200');
    await page.locator('#solarLon').fill('74.87');
    await page.locator('#solarForm button[type="submit"]').click();
    await expect(page.locator('#solarErr')).toBeVisible();
    expect(await stored(page, 'pahar_loc')).toBeNull();
    await page.locator('#solarLat').fill('31.6339');
    await page.locator('#solarForm button[type="submit"]').click();
    expect(JSON.parse((await stored(page, 'pahar_loc')) as string)).toEqual({ lat: 31.63, lon: 74.87 });
    await expect(page.locator('.raagdial .sunmark')).toHaveCount(1);
  });
});

test('the second hand is there only with motion allowed', async ({ page }) => {
  await open(page, '2026-01-15T19:30:00Z');
  await expect(page.locator('#handSecond')).toHaveCount(0);
  await open(page, '2026-01-15T19:30:00Z', {}, 'no-preference');
  await expect(page.locator('#handSecond')).toHaveCount(1);
});

test('on a phone the face, the lists and the solar form stay inside the screen, and controls are a finger wide', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'a phone rule');
  await open(page, '2026-06-21T06:30:00Z', { pahar_mode: 'solar' });
  await page.locator('#solarBox [data-solar="manual"]').click();
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, iw: innerWidth,
    small: Array.from(document.querySelectorAll('#modeTgl button, #solarBox button, #solarBox input, #watchList .watch, #seasonList .season'))
      .map((el) => ({ el, b: el.getBoundingClientRect() })).filter(({ b }) => b.height < 35.5 || b.width < 43.5)
      .map(({ el, b }) => `${(el.textContent || el.id).trim().slice(0, 20)} ${Math.round(b.width)}×${Math.round(b.height)}`),
    inputs: Array.from(document.querySelectorAll('#solarBox input')).map((el) => parseFloat(getComputedStyle(el).fontSize)),
  }));
  expect(m.sw).toBeLessThanOrEqual(m.iw);
  expect(m.small).toEqual([]);
  expect(Math.min(...m.inputs)).toBeGreaterThanOrEqual(16);
});
