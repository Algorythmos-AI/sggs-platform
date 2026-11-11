import { test, expect } from '@playwright/test';

// /privacy and /support are the URLs entered in App Store Connect. A 404, a stale app name or a
// missing disclosure there is an App Review problem, so they are part of the smoke set.

test('privacy policy names the app and covers every on-device feature @smoke', async ({ page }) => {
  const res = await page.goto('/en/privacy');
  expect(res?.status()).toBe(200);
  const body = page.locator('#v-privacy');
  await expect(body).toContainText('Gurbani Soul');
  await expect(body).toContainText('Data Not Collected');
  for (const topic of ['Location', 'Reminders', 'Live Activity', 'Nitnem', 'Widgets', 'Diagnostics']) {
    await expect(body.locator('strong', { hasText: topic }).first()).toBeVisible();
  }
});

test('support page names the app and offers a contact @smoke', async ({ page }) => {
  const res = await page.goto('/en/support');
  expect(res?.status()).toBe(200);
  const body = page.locator('#v-support');
  await expect(body).toContainText('Gurbani Soul');
  await expect(body.locator('a[href^="mailto:"]').first()).toBeVisible();
  await expect(body.locator('a[href="/en/privacy"]').first()).toBeVisible();
});

// Since v1.3.5 /privacy and /support render in the Gurbani Soul marketing shell (LegalPage), not
// the Knowledge Base's. The contents rail marks the section being read; a jump from the rail must
// mark exactly the section jumped to, even when the next section is short.
for (const route of ['/en/privacy', '/en/support', '/en/developers']) {
  test(`${route} is in the marketing shell with a working contents rail`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('#mnav')).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('#saroopBtn')).toHaveCount(0);
    const links = page.locator('.legal-toc a');
    const n = await links.count();
    expect(n).toBeGreaterThan(2);
    for (let i = n - 1; i >= 0; i--) {
      const a = links.nth(i);
      await a.click();
      await expect(a).toHaveAttribute('aria-current', 'true');
    }
  });
}

test('privacy policy discloses the website analytics honestly', async ({ page }) => {
  await page.goto('/en/privacy');
  const site = page.locator('#this-website');
  await expect(site).toContainText('Vercel Web Analytics');
  await expect(site).toContainText('no cookies');
  // Everything the site keeps in the browser, and its optional location use, must stay disclosed.
  await expect(site).toContainText('local storage');
  await expect(site.locator('strong', { hasText: 'Location' })).toBeVisible();
});

test('support FAQ questions are visible headings with a jump list', async ({ page }) => {
  await page.goto('/en/support');
  const qs = page.locator('#faq h3');
  expect(await qs.count()).toBeGreaterThan(5);
  const first = page.locator('.faq-jump a').first();
  const target = (await first.getAttribute('href'))!.slice(1);
  await expect(page.locator(`#${target}`)).toHaveCount(1);
});

// The Developers page: code samples scroll inside their own boxes (the page never scrolls
// sideways, even at 320px in a wide font), each box is reachable by keyboard, and the anchor the
// API's `terms_url` points at exists in every language.
for (const lang of ['en', 'pa', 'fr']) {
  test(`/${lang}/developers keeps its code inside the page and has the terms anchor`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(`/${lang}/developers`);
    await page.addStyleTag({ content: '*{font-family:Verdana !important;letter-spacing:.6px !important}' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await expect(page.locator('#terms h2')).toBeVisible();
    const blocks = page.locator('pre.dev-code');
    expect(await blocks.count()).toBeGreaterThanOrEqual(5);
    for (const b of await blocks.all()) await expect(b).toHaveAttribute('tabindex', '0');
    // No line of Gurbani is shown in a code font: the example's text fields are elided.
    const sample = JSON.parse((await page.locator('#dev-sample').innerText()));
    expect(sample.opening_gurmukhi).toBe('…');
    for (const line of sample.lines) expect([line.gurmukhi, line.translit]).toEqual(['…', '…']);
  });
}
