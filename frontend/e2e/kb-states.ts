import { expect, type Page } from '@playwright/test';

// The states of the Knowledge Base that the shell contract (kb-shell.spec.ts) and the contrast
// proof (kb-contrast.spec.ts) both walk, and how one is loaded so that every run renders the same
// page. Not a spec: it defines no test.

export interface State {
  route: string;      // the manifest route this state belongs to ('' for the 404 page)
  url: string;        // what is loaded — fixed inputs only, so every run renders the same page
  ready: string[];    // selectors that are visible once the page's data has rendered
  status?: number;    // expected document status (default 200)
  clock?: string;     // pin Date for a page that renders "now" (the Raag Clock)
}

// One state per route as it opens, plus the two reading surfaces a bare URL does not reach: search
// results (a line of Japji Sahib typed in Roman: six cards, the match highlighted) and an opened
// bani (Aarti: short, and it carries both SGGS lines and the separate Sri Dasam Granth layer).
// /trail starts from a fixed verse (a line of Ang 712), because the bare URL draws a random one.
export const STATES: State[] = [
  { route: '/library', url: '/library', clock: '2026-01-15T07:30:00Z', ready: ['#hubNow .hub-eyebrow', 'nav.doors .door'] },
  { route: '/search', url: '/search', ready: ['#q'] },
  { route: '/search', url: '/search?q=sochai+soch+na+hovee', ready: ['#results .card mark'] },
  { route: '/reader', url: '/reader?ang=712', ready: ['#angOut .sline', '#angCtx .timechip'] },
  { route: '/nitnem', url: '/nitnem', ready: ['#nitnemList .bani-tile'] },
  { route: '/nitnem', url: '/nitnem?bani=aarti', ready: ['#baniOut .sline.tap', '#baniOut .sline.extra'] },
  { route: '/browse', url: '/browse', ready: ['#quickOut .tile'] },
  { route: '/themes', url: '/themes', ready: ['#themesOut .theme-tile'] },
  { route: '/lineage', url: '/lineage', ready: ['#timeline .tl-node', '#linStats .lin-stat'] },
  { route: '/trail', url: '/trail?line_id=30729', ready: ['#trailNow .g', '#trailStones .stone'] },
  { route: '/analytics', url: '/analytics', ready: [
    '#network svg circle', '#networkTable summary', '#chordTable summary', '#streamTable summary', '#radarNote:not(:empty)',
    '#chord svg path.res-ribbon', '#stream svg path', '#streamLegend span', '#vaar .vaar-ladder',
  ] },
  { route: '/constellation', url: '/constellation', ready: ['#constel svg circle', '#constel .constel-list li'] },
  { route: '/raag-clock', url: '/raag-clock', clock: '2026-01-15T19:00:00Z', ready: [
    '#nowBody .now-pahar', '#clockWrap svg', '#clockDetail .det-head', '#claimsExplorer .exp-table',
  ] },
  { route: '/divergence', url: '/divergence', ready: ['#divOut table.div-table'] },
  { route: '', url: '/this-page-does-not-exist', status: 404, ready: ['#v-404'] },
];

// Load a state in an explicit theme and wait until its data is on the page: the page's own ready
// selectors, the footer version (/api/meta has landed) and the webfonts (text metrics are final).
export async function open(page: Page, s: State, theme: 'light' | 'dark' = 'light') {
  // Reduce Motion: the D3 layouts settle synchronously, so nothing is measured mid-transition.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Before the inline pre-paint script reads it, as a stored choice would be.
  await page.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch (e) {} }, theme);
  if (s.clock) await page.clock.setFixedTime(new Date(s.clock));
  const res = await page.goto(s.url);
  expect(res?.status(), `${s.url} status`).toBe(s.status ?? 200);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  for (const sel of s.ready) await expect(page.locator(sel).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#ver')).not.toBeEmpty();
  await page.evaluate(() => document.fonts.ready);
}

