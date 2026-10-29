import { test, expect, type Page } from '@playwright/test';

// The Gurbani Soul top bar (MarketingNav.astro + marketing.css + landing.ts): one centre line, one
// gold action, a header whose height never changes on scroll (CLS), and an accessible menu sheet.

const centres = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(
      '#mnav .brand, #mnav .mnav-links a, #mnav .mnav-right > *:not(.burger)',
    ))
      .filter((el) => el.offsetParent !== null)
      .map((el) => { const r = el.getBoundingClientRect(); return { name: (el.textContent || el.className).trim(), y: r.top + r.height / 2 }; }),
  );

test.describe('desktop bar', () => {
  test.skip(({ isMobile }) => !!isMobile, 'desktop widths only');

  for (const w of [1024, 1280, 1440, 2000]) {
    test(`every item shares one centre line and the row never overflows at ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto('/');
      const items = await centres(page);
      expect(items.length).toBeGreaterThanOrEqual(7);
      const ys = items.map((i) => i.y);
      expect(Math.max(...ys) - Math.min(...ys), JSON.stringify(items)).toBeLessThanOrEqual(1.5);
      const squeeze = await page.locator('#mnav .mnav-in').evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(squeeze).toBeLessThanOrEqual(0);
      // Exactly one gold fill in the bar: the App Store CTA (or none before launch).
      expect(await page.locator('#mnav .pill:not(.soon):visible').count()).toBeLessThanOrEqual(1);
    });
  }

  test('scrolling turns on the capsule without moving or resizing anything', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const box = () => page.locator('#mnav .mnav-in').boundingBox();
    const navH = () => page.locator('#mnav').evaluate((el) => el.getBoundingClientRect().height);
    const before = { bar: await box(), h: await navH() };
    await expect(page.locator('#mnav')).not.toHaveClass(/scrolled/);
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect(page.locator('#mnav')).toHaveClass(/scrolled/);
    expect(await navH()).toBe(before.h);
    expect(await box()).toEqual(before.bar);
  });

  test('the theme icon reflects theme.ts state and still cycles', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const btn = page.locator('#themeBtn');
    await expect(btn).toHaveAttribute('aria-label', /^Theme: light/);
    await btn.click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'light');
  });
});

test.describe('menu sheet', () => {
  test.skip(({ isMobile }) => !isMobile, 'the menu button shows under 1024px');

  test('traps focus, locks scroll, and restores both on close', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(100);
    const y = await page.evaluate(() => window.scrollY);
    const burger = page.locator('#mnav .burger');
    await burger.click();
    const sheet = page.locator('dialog#mobileMenu[open]');
    await expect(sheet).toBeVisible();
    await expect(burger).toHaveAttribute('aria-expanded', 'true');
    expect(await page.evaluate(() => getComputedStyle(document.body).position)).toBe('fixed');
    // Tab never leaves the sheet, forwards or backwards.
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('#mobileMenu'))).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('#mobileMenu'))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(burger).toBeFocused();
    await expect(burger).toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate(() => getComputedStyle(document.body).position)).not.toBe('fixed');
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - y)).toBeLessThanOrEqual(1);
  });

  test('a tap outside the sheet closes it; Privacy is in the sheet', async ({ page }) => {
    await page.goto('/');
    await page.locator('#mnav .burger').click();
    await expect(page.locator('#mobileMenu a[href="/privacy"]')).toBeVisible();
    const vh = page.viewportSize()!.height;
    await page.mouse.click(20, vh - 20);
    await expect(page.locator('dialog#mobileMenu[open]')).toHaveCount(0);
  });

  test('the sheet theme button drives the page theme', async ({ page }) => {
    await page.goto('/');
    await page.locator('#mnav .burger').click();
    const proxy = page.locator('#mobileMenu [data-theme-proxy]');
    await expect(proxy).toHaveAttribute('aria-label', /^Theme: light/);
    await proxy.click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'light');
    await expect(proxy).not.toHaveAttribute('aria-label', /^Theme: light/);
  });
});

test('reduced motion: no hero entrance, no parallax, proof numbers final', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/');
  expect(await page.locator('h1.hero-rise').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(100);
  expect(await page.locator('.hero-media img').evaluate((el) => (el as HTMLElement).style.transform)).toBe('');
  const n = await page.locator('.proof strong[data-count]').first().textContent();
  expect(n).toMatch(/^[\d,]+$/);
  expect(n).not.toBe('0');
  await ctx.close();
});
