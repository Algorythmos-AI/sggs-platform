import { test, expect, type Page } from '@playwright/test';

// The reverence walker. On every Knowledge Base view it visits each rendered text node that
// contains Gurmukhi and proves the display rules, which no stylesheet review can:
//   every Gurmukhi glyph   — set in Sant Lipi; no shadow; a neutral colour (ink, or a muted ink
//                            for labels), never an accent, gold or status colour;
//   scripture (verse lines and their headings) — exactly ink; no letter-spacing; inside an
//                            element marked class="gm" and lang="pa".
// The ੴ mark in the header and the ਯ label of the saroop button are a mark and a control, not text.

type Hit = { rule: string; where: string; text: string };

const scan = (page: Page) => page.evaluate(() => {
  const GM = /[਀-੿]/;
  const colourOf = (v: string) => {
    const p = document.createElement('span'); p.style.color = `var(${v})`;
    document.body.appendChild(p); const c = getComputedStyle(p).color; p.remove(); return c;
  };
  const ink = colourOf('--ink');
  const neutral = new Set([ink, colourOf('--soft'), colourOf('--faint')]);
  const out: { rule: string; where: string; text: string }[] = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode() as Text | null; n; n = w.nextNode() as Text | null) {
    if (!GM.test(n.data)) continue;
    const el = n.parentElement;
    if (!el || el.closest('script, style, noscript') || !el.getClientRects().length) continue;
    if (el.closest('header.site .onkar, #saroopBtn')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') continue;
    const name = (e: Element) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '')
      + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).join('.') : '');
    const where = (el.parentElement ? name(el.parentElement) + ' > ' : '') + name(el);
    const bad = (rule: string) => out.push({ rule, where, text: n!.data.trim().slice(0, 18) });
    const colour = el instanceof SVGElement ? cs.fill : cs.color;
    if (!/^"?Sant Lipi/.test(cs.fontFamily)) bad('font is not Sant Lipi');
    if (cs.textShadow !== 'none') bad('text-shadow');
    if (el.closest('.g, .hdr, .invoc')) {
      if (colour !== ink) bad('scripture is not ink: ' + colour);
      if (cs.letterSpacing !== 'normal' && parseFloat(cs.letterSpacing) !== 0) bad('letter-spacing ' + cs.letterSpacing);
      if (!el.closest('.gm')) bad('scripture outside .gm');
      if (el.closest('[lang]')?.getAttribute('lang') !== 'pa') bad('scripture not lang="pa"');
    } else if (!neutral.has(colour)) bad('Gurmukhi in a non-neutral colour: ' + colour);
  }
  // a search highlight covers whole words: its edges never fall inside a Gurmukhi word
  document.querySelectorAll('.gm mark').forEach((m) => {
    const before = m.previousSibling?.textContent ?? '', after = m.nextSibling?.textContent ?? '';
    if ((before && !/\s$/.test(before)) || (after && !/^\s/.test(after)))
      out.push({ rule: 'highlight splits a word', where: 'mark', text: (m.textContent || '').slice(0, 18) });
  });
  // one line per distinct fault
  return Array.from(new Map(out.map((h) => [h.rule + '|' + h.where, h])).values());
});

// Views that need a tap act through the DOM: on a phone today's sticky header covers the first lines.
const VIEWS: { name: string; path: string; ready?: string; act?: (page: Page) => Promise<void> }[] = [
  { name: 'search results', path: '/search?q=waheguru', ready: '#results .card' },
  { name: 'theme search', path: '/search?q=naam&mode=theme', ready: '#results .card' },
  { name: 'Gurmukhi search with highlights', path: '/search?q=' + encodeURIComponent('ਨਾਮ') + '&mode=gurmukhi', ready: '#results .card mark' },
  { name: 'composition panel', path: '/search?q=waheguru', ready: '#results .card',
    act: async (page) => { await page.locator('#results .card').first().click(); await expect(page.locator('#pbody .sline').first()).toBeVisible(); } },
  { name: 'reader, Ang 1', path: '/reader?ang=1', ready: '#angOut .sline' },
  { name: 'reader with related verses', path: '/reader?ang=712', ready: '#angOut .sline',
    act: async (page) => { await page.locator('#angOut .sline.tap .g').first().dispatchEvent('click'); await expect(page.locator('#angOut .related .relcard').first()).toBeVisible({ timeout: 15_000 }); } },
  { name: 'pinned verses drawer', path: '/reader?ang=712', ready: '#angOut .sline',
    act: async (page) => { await page.locator('#angOut .pin-btn').first().dispatchEvent('click'); await page.locator('#trailFab').dispatchEvent('click'); await expect(page.locator('#tab-pinned').locator('.gm').first()).toBeVisible(); } },
  { name: 'nitnem list', path: '/nitnem', ready: '.bani-tile' },
  { name: 'nitnem bani', path: '/nitnem?bani=rehras', ready: '#baniOut .sline' },
  { name: 'index', path: '/browse', ready: '.tile' },
  { name: 'themes', path: '/themes', ready: '.tile' },
  { name: 'contributors', path: '/lineage' },
  { name: 'verse trail', path: '/trail?line_id=30730', ready: '.stone' },
  { name: 'insights', path: '/analytics', ready: '#network svg' },
  { name: 'constellation', path: '/constellation', ready: '.constel-list' },
  { name: 'raag clock', path: '/raag-clock', ready: '#nowBody .now-pahar' },
  { name: 'timing divergence', path: '/divergence' },
  { name: 'not found', path: '/no-such-page' },
];

for (const theme of ['light', 'dark'] as const) {
  for (const v of VIEWS) {
    test(`Gurmukhi is ink, in Sant Lipi and undecorated: ${v.name} (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
      await page.goto(v.path);
      if (v.ready) await expect(page.locator(v.ready).first()).toBeVisible({ timeout: 20_000 });
      await page.waitForLoadState('networkidle');
      if (v.act) await v.act(page);
      await page.evaluate(() => document.fonts.ready);
      const hits: Hit[] = await scan(page);
      expect(hits, JSON.stringify(hits, null, 1)).toEqual([]);
    });
  }
}
