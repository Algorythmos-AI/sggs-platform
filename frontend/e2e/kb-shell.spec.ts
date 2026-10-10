import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { routes } from '../src/routes';
import { STATES, open } from './kb-states';

// The Knowledge Base safety net: guards that must hold on every KB page before (and after) any
// visual change. For every KB route in the manifest, plus one 404 path:
//   * no horizontal overflow on a 375×812 phone, once the page's data has rendered;
//   * every id in the document is unique;
//   * the viewport meta still allows pinch-zoom, and the document is <html lang="en">;
//   * axe (WCAG 2 A/AA, serious + critical) in the light AND the dark theme.
//
// What is red TODAY is written down below, per page, and nowhere else: OVERFLOWS_TODAY marks a
// page test.fail(), and KNOWN_AXE lists the rule ids a page violates. Both are ratchets — a new
// overflow or a new rule fails, and so does an entry that no longer reproduces (delete it, and it
// can never come back). Never widen either list to get a change through, and never disable a rule.
//
// The overflow baseline is per platform, because the KB sets its Latin text in the system font
// (--font-sans): whether a tight row fits depends on that font, and no two platforms share one.
// See OVERFLOWS_TODAY.

const __dirname = dirname(fileURLToPath(import.meta.url));

// A KB route is a manifest route whose page renders in the shared KB shell (layouts/Base.astro);
// the marketing pages and the Learn articles use layouts/Marketing.astro.
const isKbRoute = (path: string): boolean => {
  const src = resolve(__dirname, `../src/pages${path}.astro`);
  return existsSync(src) && readFileSync(src, 'utf8').includes('layouts/Base.astro');
};
const KB_ROUTES = routes.map((r) => r.path).filter(isKbRoute);

// Pages that scroll sideways on a 375px phone today, per platform (the measured scrollWidth is in
// the reason). Each is test.fail(): it turns into a hard failure the day the page is fixed — delete
// the entry then.
//
// Per platform, because the system font decides whether a tight row fits. Swapping the UI font on
// macOS shows the spread: the Reader overflows in every font (411–465px); Lineage fits in
// Arial-width fonts and overflows in San Francisco, Tahoma and Verdana (377–409px). The search bar
// (Search and the Library) used to overflow in Verdana-width fonts — 388px in Chromium, 402px in
// WebKit on the runners — because its <input> would not shrink below 20 characters of the system
// font; `.searchbar input { min-width:0 }` fixed it in every font. macOS is the reference: its system font is
// the one an iPhone renders. The Linux baseline is what the runners measured on the first CI run,
// per project ('*' = every project) because the two engines pick different fonts there. A platform
// with no baseline measures, reports an overflow as a warning, and asserts nothing.
const OVERFLOWS_TODAY: Partial<Record<NodeJS.Platform, Record<string, Record<string, string>>>> = {
  darwin: { '*': {} },
  linux: { desktop: {}, mobile: {} },
};

// Serious/critical axe rule ids each page violates today, per theme. Unlisted page or theme = clean.
const KNOWN_AXE: Record<string, { light?: string[]; dark?: string[] }> = {
  '/search?q=sochai+soch+na+hovee': { light: ['nested-interactive'], dark: ['nested-interactive'] },
  '/trail?line_id=30729': { light: ['aria-prohibited-attr'], dark: ['aria-prohibited-attr'] },
  '/analytics': { light: ['nested-interactive'], dark: ['nested-interactive'] },
};

// UTC plus the state's pinned clock make the one time-dependent page (the Raag Clock) render the
// same watch on every machine.
test.use({ timezoneId: 'UTC' });

test('every Knowledge Base route in the manifest has a state here', () => {
  expect(KB_ROUTES.length, 'no KB route found in src/routes.ts').toBeGreaterThan(0);
  const covered = new Set(STATES.map((s) => s.route));
  expect(KB_ROUTES.filter((p) => !covered.has(p)), 'KB routes with no state in STATES').toEqual([]);
  const urls = new Set(STATES.map((s) => s.url));
  const listed = [
    ...Object.values(OVERFLOWS_TODAY).flatMap((byProject) => Object.values(byProject).flatMap((b) => Object.keys(b))),
    ...Object.keys(KNOWN_AXE),
  ];
  expect(listed.filter((u) => !urls.has(u)), 'known-failure entries for a URL that is not in STATES').toEqual([]);
});

// The Study Trail drawer waits off the right edge of every KB page. Closed, it must not paint
// into the page: its shadow once reached 80px back in, a grey band on a light paper.
test('the closed Study Trail drawer casts no shadow onto the page', async ({ page }) => {
  await open(page, STATES.find((s) => s.route === '/library')!);
  const drawer = page.locator('#trailDrawer');
  await expect(drawer).not.toHaveClass(/(^|\s)on(\s|$)/);
  expect(await drawer.evaluate((el) => getComputedStyle(el).boxShadow)).toBe('none');
});

// The phone-width check owns its viewport, on both engines: 375×812 with mobile emulation (the
// viewport meta is honoured and scrollbars overlay, so clientWidth is the full 375).
test.describe('at 375px', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  const forPlatform = OVERFLOWS_TODAY[process.platform];

  for (const s of STATES) {
    test(`${s.url} does not scroll sideways on a 375px phone`, async ({ page }, testInfo) => {
      const baseline = forPlatform && (forPlatform[testInfo.project.name] ?? forPlatform['*']);
      test.fail(!!baseline && s.url in baseline, baseline?.[s.url]);
      await open(page, s);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(clientWidth, 'the layout viewport is the phone width').toBe(375);
      if (!baseline) {
        // No baseline for this platform's fonts yet: say what was measured, assert nothing.
        if (scrollWidth > clientWidth) {
          console.log(`::warning::kb-shell (${process.platform}, ${testInfo.project.name}): ${s.url} is ${scrollWidth}px wide `
            + `on a ${clientWidth}px phone — not enforced until OVERFLOWS_TODAY has a "${process.platform}" baseline`);
        }
        return;
      }
      expect(scrollWidth, `${s.url} is ${scrollWidth}px wide in a ${clientWidth}px viewport`)
        .toBeLessThanOrEqual(clientWidth);
    });
  }
});

for (const s of STATES) {
  test(`${s.url} has unique ids, one heading, a zoomable viewport and lang="en"`, async ({ page }) => {
    await open(page, s);

    const duplicates = await page.evaluate(() => {
      const seen = new Map<string, number>();
      for (const el of document.querySelectorAll('[id]')) seen.set(el.id, (seen.get(el.id) || 0) + 1);
      return [...seen].filter(([, n]) => n > 1).map(([id, n]) => `#${id} ×${n}`);
    });
    expect.soft(duplicates, `duplicate ids on ${s.url}`).toEqual([]);

    // Pinch-zoom must stay available (WCAG 1.4.4): never user-scalable=no, never a cap under 2×.
    const content = (await page.locator('meta[name="viewport"]').getAttribute('content')) || '';
    const viewport = Object.fromEntries(content.split(',').map((kv) => {
      const [k, v = ''] = kv.split('=');
      return [k.trim().toLowerCase(), v.trim().toLowerCase()];
    }));
    expect.soft(viewport['width'], `viewport meta on ${s.url}: "${content}"`).toBe('device-width');
    expect.soft(['no', '0'], `user-scalable on ${s.url}`).not.toContain(viewport['user-scalable']);
    expect.soft(Number(viewport['maximum-scale'] ?? Infinity), `maximum-scale on ${s.url}`)
      .toBeGreaterThanOrEqual(2);

    await expect.soft(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect.soft(page.locator('h1'), `one <h1> on ${s.url}`).toHaveCount(1);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`${s.url} has no new serious/critical accessibility violations (${theme})`, async ({ page }) => {
      test.setTimeout(90_000);   // axe walks every node; the big pages take a while on a busy runner
      await open(page, s, theme);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const found = results.violations
        .filter((v) => ['serious', 'critical'].includes(v.impact || ''))
        .map((v) => v.id)
        .sort();
      const known = KNOWN_AXE[s.url]?.[theme] ?? [];
      expect.soft(found.filter((id) => !known.includes(id)),
        `new violations on ${s.url} (${theme}) — fix them, do not add them to KNOWN_AXE`).toEqual([]);
      expect.soft(known.filter((id) => !found.includes(id)),
        `fixed on ${s.url} (${theme}) — delete from KNOWN_AXE so it cannot come back`).toEqual([]);
    });
  }
}
