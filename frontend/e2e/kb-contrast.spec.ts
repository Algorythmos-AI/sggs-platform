import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { STATES, open } from './kb-states';
import { walkContrast } from './contrast-walk';

// Text contrast, in every colour theme. The theme generator proves the tokens (every text colour
// on every surface, the neutral inks on a chip over each); this proves the PAGES: on every state
// of the Knowledge Base — and with the composition, a contributor, Saved and the display sheet
// open — every visible text node clears WCAG AA (4.5:1, 3:1 for large text) against what is
// painted behind it, in each of the themes, by day and by night, and on the warm paper.
//
// A state is loaded once per appearance; the themes are then switched on the page (they are only
// attributes on <html>), so the whole matrix costs a page load per state, not per theme.
// Colour does not depend on the engine: this runs once, on the desktop project.

const here = dirname(fileURLToPath(import.meta.url));
const KB = JSON.parse(readFileSync(resolve(here, '../src/generated/kb-themes.json'), 'utf8')) as {
  default: string; themes: { id: string; name: string; swatch: { light: string[]; dark: string[] } }[];
};

// Not measured, and why:
//  * the theme network's labels: a label is placed beside its own node and may lie across a
//    neighbour's, by position — the charts get a halo with their own colours (plan step 15);
//  * a drawing's own text (the charts read their colours once, when drawn, so switching the theme
//    on the page would measure a state no visitor sees) — except the Raag Clock dial, which is
//    styled by the stylesheet and is measured.
const SKIP = '#network svg, #chord svg, #stream svg, #constel svg, #radar';

// What is opened over a page before it is measured.
const OVER: Record<string, { url: string; act: (page: Page) => Promise<void> }> = {
  'a composition': { url: '/search?q=sochai+soch+na+hovee', act: async (page) => {
    await page.locator('#results .card').first().click();
    await expect(page.locator('#panel.on #pbody .sline').first()).toBeVisible({ timeout: 15_000 });
  } },
  'a contributor': { url: '/lineage', act: async (page) => {
    await page.locator('#timeline .tl-node').first().click();
    await expect(page.locator('#panel.on .ld-hero')).toBeVisible({ timeout: 15_000 });
  } },
  'Saved': { url: '/search', act: async (page) => {
    await page.locator('[data-open-saved]:visible').click();
    await expect(page.locator('#trailDrawer')).toHaveClass(/\bon\b/);
  } },
  'the Go-to sheet': { url: '/reader?ang=712', act: async (page) => {
    await page.locator('#jumpBtn').click();
    await expect(page.locator('#jumpSheet')).toHaveClass(/\bon\b/);
    await expect(page.locator('#jumpWhere')).not.toBeEmpty();
  } },
  'a verse\'s actions': { url: '/reader?ang=712', act: async (page) => {
    await page.locator('#angOut .pin-btn').first().click();
    await expect(page.locator('#verseSheet')).toHaveClass(/\bon\b/);
  } },
  'reading options': { url: '/reader?ang=712', act: async (page) => {
    await page.locator('#readerOptsBtn').click();
    await expect(page.locator('#readerOpts')).toHaveClass(/\bon\b/);
  } },
  'the display sheet': { url: '/reader?ang=712', act: async (page) => {
    await page.locator('#displayBtn').click();
    await expect(page.locator('#displaySheet')).toHaveClass(/\bon\b/);
  } },
};
const CASES = [
  ...STATES.map((s) => ({ title: s.url, state: s, act: undefined as undefined | ((page: Page) => Promise<void>) })),
  ...Object.entries(OVER).map(([what, o]) => ({ title: `${o.url} with ${what} open`, state: STATES.find((s) => s.url === o.url)!, act: o.act })),
];

test.use({ timezoneId: 'UTC' });

for (const c of CASES) {
  for (const mode of ['light', 'dark'] as const) {
    test(`${c.title}: text is readable in every colour theme (${mode})`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'colour is engine-independent; proven once');
      test.setTimeout(120_000);
      await open(page, c.state, mode);
      if (c.act) await c.act(page);
      const failures: string[] = [];
      const tones = mode === 'light' ? ['', 'warm'] : [''];              // the paper tone is a daytime choice
      for (const t of KB.themes) {
        for (const tone of tones) {
          await page.evaluate(([id, def, tn]) => {
            const root = document.documentElement;
            if (id === def) root.removeAttribute('data-accent'); else root.setAttribute('data-accent', id);
            if (tn) root.setAttribute('data-tone', tn); else root.removeAttribute('data-tone');
          }, [t.id, KB.default, tone]);
          // the theme on the page is the generated one, not a fallback
          const fill = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent-fill').trim());
          expect(fill.toUpperCase(), `${t.name}: --accent-fill`).toBe(t.swatch[mode][0]);
          for (const f of await page.evaluate(walkContrast, SKIP)) failures.push(`${t.name}${tone ? ' on warm paper' : ''}: ${f}`);
        }
      }
      expect(failures, `text under WCAG AA on ${c.title} (${mode})`).toEqual([]);
    });
  }
}
