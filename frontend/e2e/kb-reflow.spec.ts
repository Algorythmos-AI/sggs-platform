import { test, expect, type Page } from '@playwright/test';
import { STATES, open } from './kb-states';

// WCAG 2.2 reflow and keyboard checks on every Knowledge Base state.
//  - 1.4.4: text enlarged to 200% still fits a tablet width without sideways scrolling.
//  - 1.4.10: the page reflows at 320 CSS px (a 1280px window at 400% zoom).
//  - 2.4.7 / 2.4.11: every control Tab reaches shows a focus ring and is not hidden under a bar.

test.use({ timezoneId: 'UTC' });

const width = (page: Page) => page.evaluate(() => ({
  scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth,
}));

test.describe('text at 200%', () => {
  test.use({ viewport: { width: 768, height: 1024 } });
  for (const s of STATES) {
    test(`${s.url} reflows with text at 200%`, async ({ page }) => {
      await open(page, s);
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await page.waitForTimeout(150);
      const w = await width(page);
      expect(w.scroll, `${s.url} is ${w.scroll}px wide at 200% text`).toBeLessThanOrEqual(w.client);
    });
  }
});

test.describe('at 320px', () => {
  test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });
  for (const s of STATES) {
    test(`${s.url} reflows at 320px`, async ({ page }) => {
      await open(page, s);
      const w = await width(page);
      expect(w.scroll, `${s.url} is ${w.scroll}px wide at 320px`).toBeLessThanOrEqual(w.client);
    });
  }
});

test.describe('keyboard', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  for (const s of STATES) {
    test(`${s.url}: the first 30 Tab stops show a ring and are not hidden`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'keyboard pass runs on the desktop project');
      await open(page, s);
      // read each ring at rest, not part-way through a hover/focus transition
      await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important}' });
      const problems: string[] = [];
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press('Tab');
        const r = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return null;
          el.scrollIntoView({ block: 'nearest' });
          const b = el.getBoundingClientRect();
          const name = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ' "' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30) + '"';
          const cs = getComputedStyle(el);
          let ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
          if (!ring && el instanceof SVGElement) {
            // an SVG mark rings itself with its stroke: compare it with an unfocused mark of its kind
            const peer = [...(el.ownerSVGElement?.querySelectorAll(el.tagName) || [])]
              .find((x) => x !== el && x.getAttribute('class') && x.classList[0] === el.classList[0]);
            const ps = peer && getComputedStyle(peer);
            ring = !!ps && (ps.stroke !== cs.stroke || ps.strokeWidth !== cs.strokeWidth);
          }
          if (b.width === 0 || b.height === 0) return { name, ring, hidden: false, zero: true };
          const x = Math.min(Math.max(b.left + b.width / 2, 0), innerWidth - 1), y = Math.min(Math.max(b.top + b.height / 2, 0), innerHeight - 1);
          const top = document.elementFromPoint(x, y);
          const hidden = !!top && !el.contains(top) && !top.contains(el);
          return { name, ring, hidden, zero: false };
        });
        if (!r) continue;
        if (!r.ring) problems.push(`no focus ring: ${r.name}`);
        if (r.hidden) problems.push(`covered: ${r.name}`);
      }
      expect([...new Set(problems)], s.url).toEqual([]);
    });
  }
});
