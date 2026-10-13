import { test, expect, type Page } from '@playwright/test';

// The Reader's controls, in step with the app: the title and "Go to" open a sheet for going to an
// Ang; the page bar at the foot shows the place in the Granth and the Angs either side; reading
// options sit in a small panel; a sideways swipe turns the Ang. Nothing is fetched until Go.

const ang = (page: Page) => page.evaluate(() => new URLSearchParams(location.search).get('ang'));
const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);
async function open(page: Page, n = 712) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/reader?ang=${n}`);
  await expect(page.locator('#angOut .sline').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#ver')).not.toBeEmpty({ timeout: 15_000 });
}
const sheet = (page: Page) => page.locator('#jumpSheet');

test('the bar and the page bar say where the Reader is, and the page bar turns the Ang', async ({ page }) => {
  await open(page);
  await expect(page.locator('#angTitleN')).toHaveText('Ang 712');
  await expect(page.locator('#pageProgressT')).toHaveText('Ang 712 of 1430');
  await expect(page.locator('#prevAngN')).toHaveText('711');
  await expect(page.locator('#nextAngN')).toHaveText('713');
  const w = await page.locator('#pageProgressBar').evaluate((el) => (el as HTMLElement).style.width);
  expect(parseFloat(w)).toBeCloseTo((712 / 1430) * 100, 1);
  await page.locator('#nextAng').click();
  await expect.poll(() => ang(page)).toBe('713');
  await expect(page.locator('#angTitleN')).toHaveText('Ang 713');
  expect(await stored(page, 'sggs_last_ang'), 'a page turn is remembered').toBe('713');
  await page.locator('#prevAng').click();
  await expect.poll(() => ang(page)).toBe('712');
});

test('at the ends of the Granth the page bar stops', async ({ page }) => {
  await open(page, 1);
  await expect(page.locator('#prevAng')).toBeDisabled();
  await expect(page.locator('#prevAngN')).toHaveText('');
  await open(page, 1430);
  await expect(page.locator('#nextAng')).toBeDisabled();
});

test('the page bar never covers the foot of the Ang, and nothing scrolls sideways', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  const m = await page.evaluate(() => {
    const bar = document.getElementById('pageBar')!.getBoundingClientRect();
    const foot = document.querySelector('.kb-foot')!.getBoundingClientRect();
    const tabs = document.querySelector('.kb-tabs')!.getBoundingClientRect();
    return { barTop: bar.top, barBottom: bar.bottom, footBottom: foot.bottom, tabsTop: tabs.height ? tabs.top : innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth };
  });
  expect(m.footBottom, 'the footer ends above the page bar').toBeLessThanOrEqual(m.barTop + 1);
  expect(m.barBottom, 'the page bar sits above the tab bar').toBeLessThanOrEqual(m.tabsTop + 1);
  expect(m.sw).toBeLessThanOrEqual(m.iw);
});

test('from the title, the number is ready to be replaced; Go goes there and fetches nothing before', async ({ page }) => {
  await open(page);
  const asked: string[] = [];
  page.on('request', (r) => { const m = /\/api\/ang\/(\d+)/.exec(r.url()); if (m) asked.push(m[1]); });
  await page.locator('#angTitle').click();
  await expect(sheet(page)).toHaveClass(/\bon\b/);
  await expect(page.locator('#angIn')).toBeFocused();
  await expect(page.locator('#jumpWhere')).toContainText('Angs 711–718');
  await page.keyboard.type('89');                                  // the number was selected: typing replaces it
  await expect(page.locator('#angIn')).toHaveValue('89');
  await expect(page.locator('#jumpGo')).toHaveText('Go to Ang 89');
  await expect(page.locator('#jumpRange')).toHaveValue('89');
  await expect(page.locator('#jumpWhere')).toContainText('Angs 14–93');
  expect(asked, 'no Ang is fetched while choosing').toEqual([]);
  await page.keyboard.press('Enter');
  await expect(sheet(page)).not.toHaveClass(/\bon\b/);
  await expect.poll(() => ang(page)).toBe('89');
  await expect(page.locator('#angTitleN')).toHaveText('Ang 89');
  expect(await stored(page, 'sggs_last_ang'), 'going to an Ang is a lookup: the kept place does not move').toBeNull();
});

test('an impossible number disables Go and says why; the scrubber, the steppers and a raag all set it', async ({ page }) => {
  await open(page);
  await page.locator('#jumpBtn').click();
  await expect(sheet(page)).toHaveClass(/\bon\b/);
  await page.locator('#angIn').fill('2000');
  await expect(page.locator('#jumpErr')).toBeVisible();
  await expect(page.locator('#jumpGo')).toBeDisabled();
  await page.locator('#angIn').fill('');
  await expect(page.locator('#jumpGo')).toBeDisabled();
  await page.locator('#jumpRange').evaluate((el) => { (el as HTMLInputElement).value = '1000'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.locator('#angIn')).toHaveValue('1000');
  await expect(page.locator('#jumpErr')).toBeHidden();
  await page.locator('[data-jump-step="1"]').click();
  await page.locator('[data-jump-step="1"]').click();
  await page.locator('[data-jump-step="-1"]').click();
  await expect(page.locator('#jumpGo')).toHaveText('Go to Ang 1001');
  await expect(page.locator('#jumpTicks i')).toHaveCount(31);       // a tick where each raag begins
  await page.locator('#jumpRaag').selectOption({ index: 1 });      // the first raag
  await expect(page.locator('#angIn')).toHaveValue('14');
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveAttribute('inert', '');
  expect(await ang(page), 'closing goes nowhere').toBe('712');
  await expect(page.locator('#angIn'), 'the field says where the Reader is again').toHaveValue('712');
});

test('reading options: size, transliteration, timing and Sehaj, in one panel that closes on Escape', async ({ page }) => {
  await open(page);
  const btn = page.locator('#readerOptsBtn'), panel = page.locator('#readerOpts');
  await expect(panel).toHaveAttribute('inert', '');
  await btn.click();
  await expect(panel).toHaveClass(/\bon\b/);
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await panel.locator('.ro-step').last().click();
  expect(await stored(page, 'gsize')).toBe('24');
  await page.locator('#tglT').click();
  await expect(page.locator('body')).toHaveClass(/hide-t/);
  await expect(page.locator('#tglT')).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('ArrowRight');                          // the panel is open: the Ang must not turn
  await page.keyboard.press('Escape');
  await expect(panel).toHaveAttribute('inert', '');
  expect(await ang(page)).toBe('712');
  await btn.click();
  await page.locator('#sehajBtn').click();
  await expect(page.locator('body')).toHaveClass(/focus-mode/);
  await page.keyboard.press('Escape');                              // closes the panel only
  await expect(page.locator('body')).toHaveClass(/focus-mode/);
  await expect(page.locator('#pageBar')).toBeHidden();
  await expect(page.locator('#sehajExit')).toBeVisible();
});

test.describe('a sideways swipe', () => {
  // touch events are sent as a finger would send them; the rule under test is which swipes count
  const swipe = (page: Page, from: [number, number], to: [number, number], ms = 120, fingers = 1) => page.evaluate(async ([f, t, d, n]) => {
    // WebKit will not construct a Touch from script: an event carrying the same fields is what the page reads
    const zone = document.getElementById('angOut')!;
    const many = (x: number, y: number) => Array.from({ length: n as number }, (_, i) => ({ identifier: i, target: zone, clientX: x + i * 40, clientY: y }));
    const fire = (type: string, touches: object[], changed: object[]) => {
      const e = new Event(type, { bubbles: true });
      Object.defineProperty(e, 'touches', { value: touches }); Object.defineProperty(e, 'changedTouches', { value: changed });
      zone.dispatchEvent(e);
    };
    fire('touchstart', many(f[0], f[1]), many(f[0], f[1]));
    await new Promise((r) => setTimeout(r, d as number));
    fire('touchmove', many(t[0], t[1]), many(t[0], t[1]));
    fire('touchend', [], many(t[0], t[1]));
  }, [from, to, ms, fingers] as const);

  test('to the left brings the next Ang, to the right the one before', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'touch is a phone input');
    await open(page);
    await swipe(page, [300, 400], [120, 410]);
    await expect.poll(() => ang(page)).toBe('713');
    await swipe(page, [120, 400], [320, 395]);
    await expect.poll(() => ang(page)).toBe('712');
  });

  test('a scroll, a slow drag, an edge swipe, two fingers and a swipe under an open sheet turn nothing', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'touch is a phone input');
    await open(page);
    await swipe(page, [300, 300], [200, 520]);                      // mostly down: a scroll
    await swipe(page, [300, 400], [120, 400], 900);                 // slow: a drag, or a selection
    await swipe(page, [10, 400], [240, 400]);                       // from the edge: the browser's Back
    await swipe(page, [300, 400], [120, 400], 120, 2);              // two fingers: a pinch
    await page.locator('#jumpBtn').click();
    await expect(sheet(page)).toHaveClass(/\bon\b/);
    await swipe(page, [300, 400], [120, 400]);                      // something is open over the page
    await page.waitForTimeout(400);
    expect(await ang(page)).toBe('712');
  });
});

test('the Nitnem reader has the same bar: the way back at one end, reading options at the other', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/nitnem?bani=japji');
  await expect(page.locator('#baniOut .sline').first()).toBeVisible({ timeout: 15_000 });
  const m = await page.evaluate(() => {
    const r = (id: string) => document.getElementById(id)!.getBoundingClientRect();
    const bar = document.querySelector('#nitnemReader .toolbar')!.getBoundingClientRect(), back = r('nitnemBack'), opts = r('nitnemOptsBtn');
    return { backLeft: back.left - bar.left, optsRight: bar.right - opts.right, heights: [back.height, opts.height] };
  });
  expect(m.backLeft).toBeLessThan(24);
  expect(m.optsRight).toBeLessThan(24);
  expect(Math.min(...m.heights)).toBeGreaterThanOrEqual(43.5);
  await page.locator('#nitnemOptsBtn').click();
  await expect(page.locator('#nitnemOpts')).toHaveClass(/\bon\b/);
  await page.locator('#fontPlus').click();
  expect(await page.evaluate(() => localStorage.getItem('gsize'))).toBe('24');
  await page.locator('#tglT').click();
  await expect(page.locator('body')).toHaveClass(/hide-t/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#nitnemOpts')).toHaveAttribute('inert', '');
  await expect(page.locator('#nitnemOptsBtn')).toBeFocused();
});
