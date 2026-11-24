import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import en from '../src/i18n/messages/en.json' with { type: 'json' };
import pa from '../src/i18n/messages/pa.json' with { type: 'json' };
import fr from '../src/i18n/messages/fr.json' with { type: 'json' };

// The one-day Gurpurab banner (components/GurpurabBanner.astro + the decision script in
// layouts/Marketing.astro). It shows only on the reader's own 24 Nov 2026, inside the hard UTC
// window [2026-11-23T10:00Z, 2026-11-25T10:00Z), unless dismissed. Under automation it stays hidden
// unless gp557_force is set, so every other suite sees the page unchanged; this spec sets it.
// Remove this spec with the banner.

const BANNER = '[data-gp-banner]';
const force = (page: Page) => page.addInitScript(() => {
  (window as unknown as { __gp557force: boolean }).__gp557force = true;
});

const at = async (page: Page, iso: string) => { await page.clock.setFixedTime(new Date(iso)); };

type Case = { tz: string; iso: string; shown: boolean; why: string };
const CASES: Case[] = [
  { tz: 'Australia/Sydney',    iso: '2026-11-24T04:00:00Z', shown: true,  why: 'Sydney 24 Nov 15:00' },
  { tz: 'America/Los_Angeles', iso: '2026-11-25T07:00:00Z', shown: true,  why: 'Los Angeles 24 Nov 23:00' },
  { tz: 'Pacific/Honolulu',    iso: '2026-11-25T09:59:00Z', shown: true,  why: 'Honolulu 24 Nov 23:59' },
  { tz: 'Pacific/Kiritimati',  iso: '2026-11-23T10:00:00Z', shown: true,  why: 'Kiritimati 24 Nov 00:00 (window opens)' },
  { tz: 'Pacific/Honolulu',    iso: '2026-11-25T10:00:00Z', shown: false, why: 'Honolulu 25 Nov 00:00 (window closes)' },
  { tz: 'Australia/Sydney',    iso: '2026-11-24T13:30:00Z', shown: false, why: 'Sydney 25 Nov 00:30' },
  { tz: 'Pacific/Kiritimati',  iso: '2026-11-24T10:30:00Z', shown: false, why: 'Kiritimati 25 Nov 00:30' },
  { tz: 'Asia/Kolkata',        iso: '2026-11-23T17:30:00Z', shown: false, why: 'Kolkata 23 Nov 23:00' },
  { tz: 'Europe/London',       iso: '2026-11-26T12:00:00Z', shown: false, why: 'London 26 Nov' },
  { tz: 'Australia/Sydney',    iso: '2027-11-24T04:00:00Z', shown: false, why: 'Sydney 24 Nov 2027 (wrong year)' },
];

test.describe('Gurpurab banner: date window', () => {
  for (const c of CASES) {
    test.describe(c.why, () => {
      test.use({ timezoneId: c.tz });
      test(`${c.shown ? 'shows' : 'hidden'}: ${c.why}`, async ({ page }) => {
        await force(page);
        await at(page, c.iso);
        await page.goto('/en/');
        if (c.shown) await expect(page.locator(BANNER)).toBeVisible();
        else await expect(page.locator(BANNER)).toBeHidden();
      });
    });
  }
});

test.describe('Gurpurab banner: behaviour on the day', () => {
  test.use({ timezoneId: 'Australia/Sydney' });
  const DAY = '2026-11-24T04:00:00Z';

  test('decided before the page finishes parsing (no layout shift)', async ({ page }) => {
    await force(page);
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        (window as unknown as { __gpAtDcl: boolean }).__gpAtDcl = document.documentElement.hasAttribute('data-gp557');
      });
    });
    await at(page, DAY);
    await page.goto('/en/');
    expect(await page.evaluate(() => (window as unknown as { __gpAtDcl: boolean }).__gpAtDcl)).toBe(true);
  });

  test('hidden under automation without the force flag', async ({ page }) => {
    await at(page, DAY);
    await page.goto('/en/');
    await expect(page.locator(BANNER)).toBeHidden();
  });

  test('stays across a ClientRouter navigation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the desktop nav has the Features link in view');
    await force(page);
    await at(page, DAY);
    await page.goto('/en/');
    await expect(page.locator(BANNER)).toBeVisible();
    await page.evaluate(() => { (window as unknown as { __soft: boolean }).__soft = true; });
    await page.locator('a[href="/en/features"]:visible').first().click();
    await page.waitForURL(/\/en\/features\/?$/);
    // Same window object: the swap path (astro:after-swap) ran, not a full page load.
    expect(await page.evaluate(() => (window as unknown as { __soft?: boolean }).__soft)).toBe(true);
    await expect(page.locator(BANNER)).toBeVisible();
  });

  test('Dismiss hides it, moves focus to main, and is remembered', async ({ page }) => {
    await force(page);
    await at(page, DAY);
    await page.goto('/en/');
    await page.locator('[data-gp-dismiss]').click();
    await expect(page.locator(BANNER)).toBeHidden();
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('main');
    await page.reload();
    await expect(page.locator(BANNER)).toBeHidden();
    await page.goto('/pa/');
    await expect(page.locator(BANNER)).toBeHidden();
  });

  test('blocked localStorage: still shows, and Dismiss still hides it for the visit', async ({ page }) => {
    await force(page);
    await page.addInitScript(() => {
      const boom = () => { throw new DOMException('blocked', 'SecurityError'); };
      Object.defineProperty(window, 'localStorage', { configurable: true, get: boom });
    });
    await at(page, DAY);
    await page.goto('/en/');
    await expect(page.locator(BANNER)).toBeVisible();
    await page.locator('[data-gp-dismiss]').click();
    await expect(page.locator(BANNER)).toBeHidden();
  });

  test('the verse is the database line, byte for byte, cited by Ang', async ({ page, request }) => {
    await force(page);
    await at(page, DAY);
    await page.goto('/en/');
    const shown = await page.locator(`${BANNER} .gp-verse`).textContent();
    const ang = await (await request.get('/api/ang/1408')).json();
    const lines: { id: number; gurmukhi: string }[] = ang.lines ?? ang.data?.lines ?? [];
    const db = lines.find((l) => l.id === 59822);
    expect(db, 'line 59822 is on Ang 1408').toBeTruthy();
    expect(shown).toBe(db!.gurmukhi);
    await expect(page.locator(`${BANNER} .gp-cite`)).toContainText('Sri Guru Granth Sahib Ji · Ang 1408');
    await expect(page.locator(`${BANNER} a.gp-link`)).toHaveAttribute('href', '/ang/1408');
  });

  for (const [lang, m] of [['en', en], ['pa', pa], ['fr', fr]] as const) {
    test(`${lang}: strings render and axe finds nothing`, async ({ page }) => {
      await force(page);
      await at(page, DAY);
      await page.goto(`/${lang}/`);
      const b = page.locator(BANNER);
      await expect(b).toBeVisible();
      await expect(b.locator('.gp-title')).toHaveText(m.gurpurab.title);
      await expect(b.locator('.gp-fateh')).toHaveText(m.gurpurab.fateh);
      await expect(b.locator('[data-gp-dismiss]')).toHaveAttribute('aria-label', m.gurpurab.dismiss);
      const axe = await new AxeBuilder({ page }).include(BANNER).analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  }

  for (const wide of [false, true]) {
    test(`fits a 320px screen${wide ? ' in a wide font' : ''}`, async ({ page }) => {
      await force(page);
      await at(page, DAY);
      await page.setViewportSize({ width: 320, height: 800 });
      for (const lang of ['en', 'pa', 'fr']) {
        await page.goto(`/${lang}/`);
        if (wide) await page.addStyleTag({ content: '*,*::before,*::after{font-family:Verdana,"DejaVu Sans",sans-serif !important;letter-spacing:.6px !important}' });
        await expect(page.locator(BANNER)).toBeVisible();
        const w = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth,
          right: document.querySelector('[data-gp-banner] .gp-in')!.getBoundingClientRect().right,
        }));
        expect(w.scroll, `/${lang}/ is ${w.scroll}px wide`).toBeLessThanOrEqual(w.client);
        expect(w.right).toBeLessThanOrEqual(w.client + 0.5);
      }
    });
  }
});

test.describe('Gurpurab banner: without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('never shows', async ({ page }) => {
    await page.goto('/en/');
    await expect(page.locator(BANNER)).toBeHidden();
  });
});
