import { test, expect } from '@playwright/test';

// /contribute — optional support via Stripe-hosted Payment Links (src/contribute.ts). The page must
// load no third-party script, must never call contributions "donations" or tax-deductible gifts,
// and must only ever link to Stripe-hosted pages.

test('contribute page renders in the marketing shell @smoke', async ({ page }) => {
  const res = await page.goto('/contribute');
  expect(res?.status()).toBe(200);
  await expect(page.locator('#mnav')).toBeVisible();
  await expect(page.locator('h1')).toHaveCount(1);
  const body = page.locator('#v-contribute');
  await expect(body).toContainText('Everything stays free');
  await expect(body).toContainText('not a registered charity');
  await expect(body.locator('#refunds')).toBeVisible();
});

test('contribute page wording and links stay within the rules', async ({ page }) => {
  await page.goto('/contribute');
  const text = (await page.locator('#v-contribute').innerText()).toLowerCase();
  expect(text).not.toMatch(/\bdonat/);
  expect(text).not.toMatch(/\bis tax-deductible\b/);
  const hrefs = await page.locator('#v-contribute a[href^="http"]').evaluateAll(
    (as) => as.map((a) => (a as HTMLAnchorElement).href));
  for (const h of hrefs) {
    expect(h).toMatch(/^https:\/\/(buy\.stripe\.com|billing\.stripe\.com|stripe\.com)\//);
  }
});

test('contribute page loads nothing from Stripe before a click', async ({ page }) => {
  const thirdParty: string[] = [];
  page.on('request', (r) => { if (/stripe\.(com|network)/.test(r.url())) thirdParty.push(r.url()); });
  await page.goto('/contribute', { waitUntil: 'networkidle' });
  expect(thirdParty).toEqual([]);
});

test('thank-you note shows only after the Stripe redirect', async ({ page }) => {
  await page.goto('/contribute');
  await expect(page.locator('#thank-you')).toBeHidden();
  await page.goto('/contribute#thank-you');
  await expect(page.locator('#thank-you')).toBeVisible();
});

test('contribute page does not overflow at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/contribute');
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over).toBeLessThanOrEqual(0);
});
