// palette.ts — jump anywhere (⌘K, Ctrl+K, "/" or the bar's search button): an Ang by number, a
// raag, a section, a bani, a contributor, a theme, or a page. Loaded only when first asked for.
// It matches plain text against names the site already has (/api/meta, /api/banis): there is no
// second copy of the search engine here, and anything it does not know is handed to the real
// search. It only navigates — every result is a link.
import { esc, meta, api, store, validAng } from './core';
import { overlayOpened, overlayClosed } from './overlay';
import { themeName } from './themegroups';

type Item = { kind: string; label: string; gm?: string; sub?: string; href: string; hay: string };
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
const PAGES: [string, string][] = [['Home', '/library'], ['Reader', '/reader'], ['Nitnem', '/nitnem'], ['Index', '/browse'], ['Search', '/search'],
  ['Themes', '/themes'], ['Constellation', '/constellation'], ['Verse trail', '/trail'], ['Contributors', '/lineage'], ['Insights', '/analytics'], ['Raag Clock', '/raag-clock']];
let ITEMS: Item[] | null = null, RAAGS: any[] = [], shown: Item[] = [], active = 0;

async function load(): Promise<Item[]> {
  if (ITEMS) return ITEMS;
  const out: Item[] = PAGES.map(([label, href]) => ({ kind: 'Page', label, href, hay: label.toLowerCase() }));
  try {
    const m = await meta();
    RAAGS = m.raags || [];
    for (const r of RAAGS) out.push({ kind: 'Raag', label: r.roman || r.name, gm: r.name, sub: `Angs ${r.first_ang}–${r.last_ang}`,
      href: `/reader?ang=${r.first_ang}&raag=${encodeURIComponent(r.name)}`, hay: `${r.roman || ''} ${r.name}`.toLowerCase() });
    for (const s of m.sections || []) out.push({ kind: 'Section', label: '', gm: s.name, sub: `from Ang ${s.first_ang}`, href: `/reader?ang=${s.first_ang}`, hay: String(s.name).toLowerCase() });
    for (const a of m.authors || []) out.push({ kind: 'Contributor', label: a.name, sub: `${Number(a.n_lines).toLocaleString()} lines · first on Ang ${a.first_ang}`,
      href: `/reader?ang=${a.first_ang}`, hay: String(a.name).toLowerCase() });
    for (const c of m.concepts || []) out.push({ kind: 'Theme', label: themeName(String(c.concept)), sub: `${c.n_lines} lines`,
      href: `/search?q=${encodeURIComponent(c.concept)}&mode=theme`, hay: `${themeName(String(c.concept))} ${String(c.concept).replace(/_/g, ' ')}`.toLowerCase() });
  } catch { /* the pages and the search still work */ }
  try {
    const d = await api('banis');
    for (const b of (d?.banis || []).filter((x: any) => x.is_default)) out.push({ kind: 'Bani', label: b.title_en, gm: b.title_gm,
      sub: b.estimated_minutes ? `about ${b.estimated_minutes} min` : '', href: `/nitnem?bani=${encodeURIComponent(b.key)}`, hay: `${b.title_en} ${b.title_gm}`.toLowerCase() });
  } catch { /* no registry in this build */ }
  ITEMS = out;
  return out;
}

function results(q: string): Item[] {
  const all = ITEMS || [], t = q.trim().toLowerCase(), out: Item[] = [];
  if (!t) {
    const last = validAng(store.get('sggs_last_ang', ''));
    if (last) out.push({ kind: 'Continue', label: `Ang ${last}`, sub: 'where you were reading', href: `/reader?ang=${last}`, hay: '' });
    return out.concat(all.filter((i) => i.kind === 'Page'));
  }
  const n = /^(?:ang\s*)?(\d{1,4})$/.exec(t);
  if (n && +n[1] >= 1 && +n[1] <= 1430) {
    const r = RAAGS.find((x) => +n[1] >= x.first_ang && +n[1] <= x.last_ang);
    out.push({ kind: 'Ang', label: `Go to Ang ${+n[1]}`, sub: r ? `in ${r.roman || r.name}` : 'of 1430', href: `/reader?ang=${+n[1]}`, hay: '' });
  }
  // names that begin with what was typed come first, then names that contain it
  const hit = all.filter((i) => i.hay.includes(t));
  hit.sort((a, b) => Number(!a.hay.startsWith(t)) - Number(!b.hay.startsWith(t)));
  out.push(...hit.slice(0, 12));
  out.push({ kind: 'Search', label: `Search the Granth for “${q.trim()}”`, href: `/search?q=${encodeURIComponent(q.trim())}`, hay: '' });
  return out;
}

function render() {
  const list = el('paletteList'), input = el<HTMLInputElement>('paletteQ'); if (!list || !input) return;
  shown = results(input.value);
  active = Math.min(active, Math.max(0, shown.length - 1));
  list.innerHTML = shown.map((i, k) => `<a id="pal-${k}" role="option" class="pal-item${k === active ? ' on' : ''}" aria-selected="${k === active}" href="${esc(i.href)}">
      <span class="pal-kind">${esc(i.kind)}</span>
      <span class="pal-main">${i.gm ? `<span class="gm" lang="pa">${esc(i.gm)}</span> ` : ''}<span class="pal-label">${esc(i.label)}</span></span>
      ${i.sub ? `<span class="pal-sub">${esc(i.sub)}</span>` : ''}</a>`).join('');
  input.setAttribute('aria-activedescendant', shown.length ? `pal-${active}` : '');
}
function move(d: number) {
  if (!shown.length) return;
  active = (active + d + shown.length) % shown.length;
  document.querySelectorAll('#paletteList .pal-item').forEach((a, k) => { a.classList.toggle('on', k === active); a.setAttribute('aria-selected', String(k === active)); });
  el('paletteQ')?.setAttribute('aria-activedescendant', `pal-${active}`);
  el(`pal-${active}`)?.scrollIntoView({ block: 'nearest' });
}

export async function openPalette() {
  const sheet = el('palette'), input = el<HTMLInputElement>('paletteQ'); if (!sheet || !input || sheet.classList.contains('on')) return;
  input.value = ''; active = 0;
  sheet.removeAttribute('inert'); sheet.classList.add('on'); el('paletteScrim')?.classList.add('on');
  overlayOpened(sheet, closePalette, { focus: input, fallback: () => el('paletteBtn') });
  render();                                    // the pages at once; the names as soon as they are in
  await load();
  if (sheet.classList.contains('on')) render();
}
function closePalette() {
  const sheet = el('palette'); if (!sheet || !sheet.classList.contains('on')) return;
  sheet.classList.remove('on'); sheet.setAttribute('inert', ''); el('paletteScrim')?.classList.remove('on');
  overlayClosed(sheet);
}

el('paletteScrim')?.addEventListener('click', closePalette);
el('paletteClose')?.addEventListener('click', closePalette);
el('paletteQ')?.addEventListener('input', () => { active = 0; render(); });
el('paletteQ')?.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
  else if (e.key === 'Enter') { e.preventDefault(); el(`pal-${active}`)?.click(); }
});
// a result on the page being read (the Reader → another Ang) must still close the palette
el('paletteList')?.addEventListener('click', (e) => { if ((e.target as Element).closest('.pal-item')) closePalette(); });
