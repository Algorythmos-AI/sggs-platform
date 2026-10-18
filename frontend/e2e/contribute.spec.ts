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

// Entry points: /contribute must be reachable from every page when it has payment links
// (PUBLIC_CONTRIBUTE_MODE test|live) and invisible when it does not ("off", the CI default).
// The mode is read from the built page itself so the same suite holds in every mode.
async function contributeOn(page: import('@playwright/test').Page): Promise<boolean> {
  await page.goto('/contribute');
  return (await page.locator('section#contribute').count()) > 0;
}

test('nav, footer and home band link to /contribute only when it is on', async ({ page }) => {
  const on = await contributeOn(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const navGive = page.locator('#mnav a.mnav-give');
  const footGive = page.locator('.mfoot .mfoot-give a');
  const band = page.locator('#contribute-band a[href="/contribute"]');
  if (!on) {
    await expect(navGive).toHaveCount(0);
    await expect(footGive).toHaveCount(0);
    await expect(band).toHaveCount(0);
    return;
  }
  await expect(navGive).toBeVisible();
  await expect(navGive).toHaveAttribute('href', '/contribute');
  await expect(navGive).toHaveAccessibleName('Contribute');
  await expect(footGive).toHaveAttribute('href', '/contribute');
  await expect(band).toBeVisible();
  // The help column no longer files Contribute under "Support".
  await expect(page.locator('.mfoot-col a[href="/contribute"]')).toHaveCount(0);
  // Never "donate" anywhere these entry points speak.
  for (const t of [await page.locator('#contribute-band').innerText(), await page.locator('.mfoot-give').innerText()]) {
    expect(t.toLowerCase()).not.toMatch(/\bdonat/);
  }
});

test('nav contribute link is icon-only at 900px and in the mobile menu at 375px', async ({ page }) => {
  if (!(await contributeOn(page))) test.skip(true, 'contributions are off in this build');
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto('/features');
  const navGive = page.locator('#mnav a.mnav-give');
  await expect(navGive).toBeVisible();
  await expect(navGive.locator('.lbl')).toHaveCSS('position', 'absolute');
  await expect(navGive).toHaveAccessibleName('Contribute');
  for (const w of [840, 900, 1000, 1024, 1100]) {
    await page.setViewportSize({ width: w, height: 800 });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over, `overflow at ${w}px`).toBeLessThanOrEqual(0);
    const squeeze = await page.locator('#mnav .mnav-in').evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(squeeze, `nav row overflows at ${w}px`).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(navGive).toBeHidden();
  await page.locator('#mnav .burger').click();
  await expect(page.locator('#mobileMenu a.mm-give')).toBeVisible();
  await expect(page.locator('#mobileMenu a.mm-give')).toHaveAttribute('href', '/contribute');
});

test('Knowledge Base footer and support page link to /contribute when it is on', async ({ page }) => {
  const on = await contributeOn(page);
  await page.goto('/search');
  await expect(page.locator('footer.kb-foot a[href="/contribute"]')).toHaveCount(on ? 1 : 0);
  await page.goto('/support');
  await expect(page.locator('#v-support a[href="/contribute"]').first()).toBeVisible();
  await expect(page.locator('#v-support .give-card')).toHaveCount(on ? 1 : 0);
});
