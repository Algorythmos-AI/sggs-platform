import { test, expect } from '@playwright/test';
import config from '../src/i18n/locales.json' with { type: 'json' };

// Language routing as served by serve.py (and any host without vercel.json): the bare root picks a
// language in the browser, the pre-i18n URLs forward to their English pages, and a legacy "/?q="
// search bookmark still lands in Search. On gurbanisoul.com the same answers come from
// vercel.json's redirects (scripts/gen-i18n-redirects.mjs; LanguageRouting in test_repo_gates.py).

// A deployed site (vercel.json answers the redirects) rather than serve.py on this machine.
const deployed = /^https:/.test(process.env.PLAYWRIGHT_BASE_URL ?? '');

test('the bare root opens the default language home', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(new RegExp(`/${config.default}$`));
  await expect(page.locator('html')).toHaveAttribute('lang', config.locales[config.default as 'en'].htmlLang);
});

test('the root follows the browser language only when that language is enabled', async ({ browser }) => {
  // A French browser: French is not enabled yet, so it gets the default language.
  const ctx = await browser.newContext({ locale: 'fr-FR' });
  const page = await ctx.newPage();
  await page.goto('/');
  const want = config.enabled.includes('fr') ? 'fr' : config.default;
  await expect(page).toHaveURL(new RegExp(`/${want}$`));
  await ctx.close();
});

for (const old of ['/features', '/watch', '/learn', '/support', '/privacy', '/contribute', '/learn/what-is-an-ang']) {
  test(`the old URL ${old} lands on /${config.default}${old}`, async ({ page }) => {
    const res = await page.goto(old);
    await expect(page).toHaveURL(new RegExp(`/${config.default}${old}$`));
    expect(res?.status() ?? 0).toBeLessThan(400);
  });
}

test('a hash survives the old Contribute URL (Stripe returns to /contribute#thank-you)', async ({ page }) => {
  test.skip(!deployed, 'serve.py forwards with a meta refresh, which drops the hash; vercel.json keeps it');
  await page.goto('/contribute#thank-you');
  await expect(page).toHaveURL(new RegExp(`/${config.default}/contribute#thank-you$`));
});

test('a legacy /?q= search bookmark lands in Search', async ({ page }) => {
  await page.goto('/?q=waheguru');
  await expect(page).toHaveURL(/\/search\?q=waheguru/);
});

test('a language that is not enabled has no pages', async ({ request }) => {
  for (const l of Object.keys(config.locales).filter((l) => !config.enabled.includes(l))) {
    const res = await request.get(`/${l}`, { maxRedirects: 0 });
    // vercel.json: 302 to the default language. serve.py: no such page.
    expect([302, 404]).toContain(res.status());
  }
});
