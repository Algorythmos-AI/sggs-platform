// themes.ts — the Themes page (/themes) : the 54 corpus concepts grouped theologically.
// Ported 1:1; a tile deep-links into Search as a theme query via goSearchTheme.
import { $, esc, guard, meta, goSearchTheme } from './core';
import { THEME_GROUPS, titleCase } from './themegroups';

let META: any = null;

const themes = guard(async () => {
  const m = await meta(); META = m;
  const idx: Record<string, number> = {}; m.concepts.forEach((c: any, i: number) => idx[c.concept] = i);
  const placed = new Set<string>();
  const card = (i: number) => {
    const c = m.concepts[i]; placed.add(c.concept);
    const n = (c.n_lines || 0).toLocaleString();
    return `<div class="tile theme-tile" data-concept="${i}" role="button" tabindex="0"
      aria-label="${esc(titleCase(c.concept))} — explore ${n} lines">
      <div class="n">${esc(titleCase(c.concept))}</div>
      <div class="s">${esc(c.description)}</div>
      <div class="explore">Explore ${n} lines →</div></div>`;
  };
  let html = '';
  for (const { title: cat, caption: sub, keys } of THEME_GROUPS) {
    const cards = keys.filter((k) => k in idx).map((k) => card(idx[k])).join('');
    if (cards) html += `<div class="gridtitle" role="heading" aria-level="3">${esc(cat)} <span class="ct">· ${esc(sub)}</span></div><div class="grid">${cards}</div>`;
  }
  const leftover = m.concepts.filter((c: any) => !placed.has(c.concept));   // safety: never drop a theme
  if (leftover.length) html += `<div class="gridtitle">More Themes</div><div class="grid">` +
    leftover.map((c: any) => card(idx[c.concept])).join('') + `</div>`;
  ($('#themesOut') as HTMLElement).innerHTML = html;
});

// ---- delegated tile activation → Search (theme mode) ----
function tileActivate(t: any) {
  if (t.dataset.concept !== undefined) goSearchTheme(META.concepts[+t.dataset.concept].concept);
}
document.addEventListener('click', (e: any) => {
  const t = e.target.closest('.tile[data-concept]');
  if (t) tileActivate(t);
});
document.addEventListener('keydown', (e: any) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('tile')) {
    e.preventDefault(); tileActivate(e.target);
  }
});

// ---- bootstrap ----
themes();
