import { test, expect, type Page } from '@playwright/test';

// The marketing top bar is one design in every language (en/pa/fr): the same height, capsule,
// type size (Gurmukhi optically matched) and 44px targets, and it never overflows or crowds —
// French, the longest, fits the full row from the one shared breakpoint (1440px) and the menu below
// it. Every marketing page is walked at the audit widths; phone/tablet widths also in a deliberately
// wide font (Verdana + tracking, wider than the Linux runners' fonts — see kb-reflow.spec.ts), and
// the desktop row must keep 48px of slack in the real font so a slightly wider runner font fits. Fix a failure
// in the CSS (`min-width:0`, `flex-wrap`, `minmax(0,1fr)`), never by loosening this test.

const LANGS = ['en', 'pa', 'fr'] as const;
const PAGES = ['', 'features', 'watch', 'learn', 'support', 'contribute', 'privacy'];
// Learn articles are English-only for now (the other languages' Learn index links to them).
const pagesFor = (lang: string) => (lang === 'en' ? [...PAGES, 'learn/what-is-an-ang', 'learn/how-to-read-nitnem'] : PAGES);
const WIDTHS = [320, 375, 768, 1024, 1280, 1440, 1920];
const WIDE_FONT = '*,*::before,*::after{font-family:Verdana,"DejaVu Sans",sans-serif !important;letter-spacing:.6px !important}';

const navProblems = (page: Page) => page.evaluate(() => {
  const de = document.documentElement;
  const bar = document.querySelector<HTMLElement>('#mnav .mnav-in')!;
  const bb = bar.getBoundingClientRect();
  const items = Array.from(document.querySelectorAll<HTMLElement>('#mnav .brand, #mnav .mnav-links a, #mnav .mnav-right > *'))
    .filter((e) => e.offsetParent !== null && getComputedStyle(e).display !== 'none');
  const out: string[] = [];
  if (de.scrollWidth > de.clientWidth) out.push(`page scrolls sideways (${de.scrollWidth} > ${de.clientWidth})`);
  if (bar.scrollWidth > bar.clientWidth) out.push(`bar squeezed by ${bar.scrollWidth - bar.clientWidth}px`);
  const links = document.querySelector<HTMLElement>('#mnav .mnav-links')!;
  if (links.offsetParent !== null) {
    const slack = links.clientWidth - Array.from(links.children).reduce((a, c) => a + (c as HTMLElement).getBoundingClientRect().width, 0);
    if (slack < 48) out.push(`desktop row has only ${Math.round(slack)}px of slack`);
  }
  const rs = items.map((e) => e.getBoundingClientRect());
  items.forEach((e, i) => {
    const r = rs[i];
    if (r.left < bb.left - 1 || r.right > bb.right + 1) out.push(`"${e.textContent?.trim()}" is clipped by the bar`);
    for (let j = i + 1; j < items.length; j++) {
      const o = rs[j];
      if (r.left < o.right - 1 && o.left < r.right - 1 && r.top < o.bottom - 1 && o.top < r.bottom - 1)
        out.push(`"${e.textContent?.trim()}" overlaps "${items[j].textContent?.trim()}"`);
    }
  });
  return out;
});

test.describe('nav never overflows', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'widths are set per test; one project is enough'));
  for (const lang of LANGS) {
    for (const w of WIDTHS) {
      test(`${lang} at ${w}px: no page or bar overflows`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: 800 });
        const problems: string[] = [];
        for (const p of pagesFor(lang)) {
          for (const wide of w <= 768 ? [false, true] : [false]) {
            await page.goto(`/${lang}/${p}`);
            if (wide) { await page.addStyleTag({ content: WIDE_FONT }); await page.waitForTimeout(50); }
            for (const m of await navProblems(page)) problems.push(`/${lang}/${p}${wide ? ' (wide font)' : ''}: ${m}`);
          }
        }
        expect(problems).toEqual([]);
      });
    }
  }
});

test.describe('one bar in every language', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'desktop project'));

  const measure = (page: Page) => page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>('#mnav .mnav-in')!;
    const cap = getComputedStyle(bar, '::before');
    const link = document.querySelector<HTMLElement>('#mnav .mnav-links a')!;
    const targets = Array.from(document.querySelectorAll<HTMLElement>('#mnav .brand, #mnav .mnav-links a, #mnav .mnav-right > *'))
      .filter((e) => e.offsetParent !== null && getComputedStyle(e).display !== 'none')
      .map((e) => Math.round(e.getBoundingClientRect().height));
    return {
      barH: bar.getBoundingClientRect().height,
      capOpacity: cap.opacity, capBorder: cap.borderTopWidth, capColor: cap.borderTopColor,
      linkPx: parseFloat(getComputedStyle(link).fontSize), linkWeight: Number(getComputedStyle(link).fontWeight),
      minTarget: Math.min(...targets),
    };
  });

  for (const [w, path] of [[1440, 'features'], [1440, ''], [1920, 'features']] as const) {
    test(`same height, capsule and type at ${w}px on /${path}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      const m: Record<string, Awaited<ReturnType<typeof measure>>> = {};
      for (const lang of LANGS) { await page.goto(`/${lang}/${path}`); m[lang] = await measure(page); }
      for (const lang of LANGS) {
        expect(m[lang].barH, lang).toBe(m.en.barH);
        expect(m[lang].capOpacity, `${lang} capsule drawn`).toBe('1');
        expect(m[lang].capBorder, `${lang} capsule border`).toBe('1px');
        expect(m[lang].capColor, `${lang} capsule border colour`).not.toMatch(/rgba\(.*, 0\)$/);
        expect(m[lang].minTarget, `${lang} tap targets`).toBeGreaterThanOrEqual(44);
      }
      expect(m.en.linkPx).toBeGreaterThanOrEqual(18);
      expect(m.fr.linkPx).toBe(m.en.linkPx);
      // Interface Gurmukhi is set a step larger and heavier so it reads the same size.
      expect(m.pa.linkPx).toBeGreaterThanOrEqual(m.en.linkPx);
      expect(m.pa.linkWeight).toBeGreaterThanOrEqual(m.en.linkWeight);
    });
  }

  test('the current page is marked and drawn', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const lang of LANGS) {
      await page.goto(`/${lang}/features`);
      const cur = page.locator('#mnav .mnav-links a[aria-current="page"]');
      await expect(cur).toHaveCount(1);
      expect(await cur.evaluate((a) => getComputedStyle(a, '::after').height)).toBe('3px');
    }
  });

  for (const lang of LANGS) for (const w of [1024, 1280]) {
    test(`${lang} at ${w}px: the menu opens, reports aria-expanded and closes on Escape`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto(`/${lang}/features`);
      await expect(page.locator('#mnav .mnav-links')).toBeHidden();
      const burger = page.locator('#mnav .burger');
      await expect(burger).toBeVisible();
      await expect(burger).toHaveAttribute('aria-expanded', 'false');
      await burger.click();
      await expect(page.locator('dialog#mobileMenu[open]')).toBeVisible();
      await expect(burger).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('#mobileMenu'))).toBe(true);
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog#mobileMenu[open]')).toHaveCount(0);
      await expect(burger).toHaveAttribute('aria-expanded', 'false');
    });
  }
});
