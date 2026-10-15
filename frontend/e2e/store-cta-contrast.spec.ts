import { test, expect } from '@playwright/test';

// The App Store calls to action render only when PUBLIC_APP_STORE_LIVE=1, which CI builds never
// set — so a cascade bug in them (gold text on the gold fill, launch day 2026-10-15) was invisible to
// every other test. This spec plants the exact live markup into each place it renders, in both
// appearances, and checks the text against its own fill: WCAG AA, 4.5:1.

const PLACES = [
  { name: 'hero', host: '.hero-cta', html: '<a class="pill" href="#">Download on the App Store</a>' },
  { name: 'nav', host: '.mnav-right', html: '<a class="pill" href="#">Get the app</a>' },
  { name: 'menu', host: '#mobileMenu', html: '<a class="pill mm-cta" href="#">Get the app</a>' },
  { name: 'download', host: '.dl-cta', html: '<a class="btn" href="#">Download on the App Store</a>' },
];

for (const theme of ['light', 'dark'] as const) {
  test(`the live App Store buttons are readable (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const results = await page.evaluate((places) => {
      const rgb = (c: string) => (c.match(/[\d.]+/g) || []).slice(0, 4).map(Number);
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      return places.map((p) => {
        const host = document.querySelector(p.host);
        if (!host) return { name: p.name, ratio: -1, note: 'host missing' };
        host.insertAdjacentHTML('beforeend', p.html);
        const a = host.lastElementChild as HTMLElement;
        const cs = getComputedStyle(a);
        const fg = rgb(cs.color), bg = rgb(cs.backgroundColor);
        const [l1, l2] = [lum(fg), lum(bg)].sort((x, y) => y - x);
        a.remove();
        return { name: p.name, ratio: +((l1 + 0.05) / (l2 + 0.05)).toFixed(2), note: `${cs.color} on ${cs.backgroundColor}` };
      });
    }, PLACES);
    for (const r of results) expect(r.ratio, `${r.name}: ${r.note}`).toBeGreaterThanOrEqual(4.5);
  });
}
