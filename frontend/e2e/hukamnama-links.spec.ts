import { test, expect } from '@playwright/test';
import gateway from '../../gateway/routes.json' with { type: 'json' };
import en from '../src/i18n/messages/en.json' with { type: 'json' };
import pa from '../src/i18n/messages/pa.json' with { type: 'json' };
import fr from '../src/i18n/messages/fr.json' with { type: 'json' };

// Once the Hukamnama is launched (production.hukamnama_api, src/hukamnama.ts HUKAMNAMA_LIVE), every
// marketing page reaches the day's page, /{lang}/hukamnama, from the top bar (the desktop row and
// the menu sheet) and the footer, and the home page carries one card that links to it and to the
// API's page, /{lang}/developers. The labels are interface text: never Gurbani, never "official".

const LIVE = !!(gateway as { production?: { hukamnama_api?: string } }).production?.hukamnama_api;
const CATALOGS = { en, pa, fr } as const;
const LANGS = Object.keys(CATALOGS) as (keyof typeof CATALOGS)[];

test.skip(!LIVE, 'the Hukamnama is not launched in production');

test('the labels are interface text only', () => {
  for (const lang of LANGS) {
    const c = CATALOGS[lang];
    for (const s of [c.nav.hukamnama, c.home.hukamnama.link, c.home.hukamnama.developers]) {
      expect(s).not.toMatch(/official|officiel|ਅਧਿਕਾਰਤ/i);
      expect(s).not.toMatch(/[॥ੴ]/);
    }
  }
});

for (const lang of LANGS) {
  const c = CATALOGS[lang];
  const hk = `/${lang}/hukamnama`;
  const dev = `/${lang}/developers`;

  test.describe(`${lang}`, () => {
    test('the desktop row, the footer and the home card link the Hukamnama', async ({ page, isMobile }) => {
      test.skip(isMobile, 'desktop row');
      await page.setViewportSize({ width: 1600, height: 900 });
      await page.goto(`/${lang}`);
      const navLink = page.locator(`#mnav .mnav-links a[href="${hk}"]`);
      await expect(navLink).toBeVisible();
      await expect(navLink).toHaveText(c.nav.hukamnama);
      await expect(navLink).not.toHaveAttribute('data-astro-prefetch', /.*/);
      await expect(page.locator(`.mfoot-nav a[href="${hk}"]`)).toHaveText(c.nav.hukamnama);
      await expect(page.locator(`.mfoot-nav a[href="${dev}"]`)).toHaveCount(1);
      const card = page.locator('.hk-card');
      await expect(card).toHaveCount(1);
      await expect(card.locator(`a[href="${hk}"]`)).toContainText(c.home.hukamnama.link);
      await expect(card.locator(`a[href="${dev}"]`)).toHaveText(c.home.hukamnama.developers);
      // Another marketing page carries the same item.
      await page.goto(`/${lang}/features`);
      await expect(page.locator(`#mnav .mnav-links a[href="${hk}"]`)).toBeVisible();
    });

    test('the menu sheet links the Hukamnama on a phone', async ({ page, isMobile }) => {
      test.skip(!isMobile, 'menu sheet');
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`/${lang}`);
      await page.locator('#mnav .burger').click();
      const link = page.locator(`#mobileMenu .mm-links a[href="${hk}"]`);
      await expect(link).toBeVisible();
      await expect(link).toHaveText(c.nav.hukamnama);
      await page.keyboard.press('Escape');
      const card = page.locator('.hk-card');
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator(`a[href="${hk}"]`)).toBeVisible();
      await expect(card.locator(`a[href="${dev}"]`)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });
  });
}
