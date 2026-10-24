// lineage.ts — The Contributors (/lineage).
// An immersive, groupable, comparable view of the voices gathered in the Granth.
// Merges a hand-authored public-domain chronology (public/contributors.json) with the
// live corpus: Ang spans & line counts via /api/meta, and composition stats, a theme
// fingerprint, and distinctive terms via /api/analytics/author.
// READ-ONLY: this view never touches the corpus or scripture text — it only describes it.
import { $, esc, api, goSearchTheme } from './core';
import { plural, granthOrder } from './voices';

// Roster v2 (frontend/public/contributors.json): a source is {ref, entry, url} keyed into source_index;
// review is {status, reviewer, date}. load() normalises them into the shape the views below draw.
type Source = { title: string; publisher?: string; url?: string };
type RawSource = { ref?: string; entry?: string; url?: string };
type C = {
  name: string; roman: string; kind: string; seq: number | null;
  born: number | null; died: number | null; circa: boolean; fl_century?: number | null;
  era: string; region: string; tradition: string; blurb: string;
  gurmukhi_name?: string | null; sources?: Source[]; review?: string; context?: string | null;
  first_ang?: number; last_ang?: number; n_lines?: number;
};

const KIND_LABEL: Record<string, string> = { guru: 'Guru', bhagat: 'Bhagat', bhatt: 'Bhatt', gursikh: 'Gursikh' };
const KIND_PLURAL: Record<string, string> = { guru: 'Gurus', bhagat: 'Bhagats', bhatt: 'Bhatts', gursikh: 'Gursikhs' };
const KIND_DESC: Record<string, string> = {
  guru: 'The Sikh Gurus', bhagat: 'Bhakti & Sufi saints', bhatt: 'Court bards (Bhatts)', gursikh: 'Gursikh companions',
};
const KIND_ORDER = ['guru', 'bhagat', 'bhatt', 'gursikh'];

let LIST: C[] = [];
const byName = new Map<string, C>();
let groupMode: 'granth' | 'time' | 'kind' | 'volume' = 'granth';   // Granth order first: never volume-first
let kindFilter = 'all';
let maxLines = 1;

let compareMode = false;
const compareSel: C[] = [];

// ---------- small helpers ----------
const ord = (n: number) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const centuryOf = (y: number) => Math.floor((y - 1) / 100) + 1;
const titleCase = (s: string) => (s || '').replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1));
const bar = (n: number) => n > 0 ? Math.max(4, Math.round(100 * Math.sqrt(n / maxLines))) : 0;   // sqrt so small voices stay visible
// When no source gives a birth year, order by the death year, else by the century the voice is known
// from (roster v2 `fl_century`); only a voice with none of these goes to "Dates not established".
const yearOf = (c: C) => c.born ?? c.died ?? (c.fl_century ? (c.fl_century - 1) * 100 + 50 : Infinity);
const byBorn = (a: C, b: C) => (yearOf(a) - yearOf(b)) || a.name.localeCompare(b.name);
const NOT_INDEXED = 'Bani not yet indexed under this name';
// a source link is shown only for an http(s) URL; anything else is plain text
const safeUrl = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : '');

// kind-coloured medallion text: M# for Gurus, otherwise the leading initials of the name
const HONORIFIC = new Set(['baba', 'bhai', 'bhagat', 'bhatt', 'guru', 'sant', 'the', 'ji']);
function initials(c: C): string {
  if (c.kind === 'guru' && c.seq) return 'M' + c.seq;
  const words = c.roman.replace(/\(.*?\)/g, '').replace(/&/g, ' ').split(/\s+/)
    .filter((w) => w && !HONORIFIC.has(w.toLowerCase()));
  const pick = (words.length ? words : c.roman.split(/\s+/)).slice(0, 2);
  const letters = pick.map((w) => (w.replace(/[^A-Za-z]/g, '')[0] || '')).join('');
  return (letters || c.roman[0] || '•').toUpperCase();
}

// ---------- load ----------
async function load() {
  const host = $('#timeline'); if (!host) return;
  let data: any, meta: any;
  try {
    [data, meta] = await Promise.all([fetch('/contributors.json').then((r) => r.json()), api('meta')]);
  } catch { host.innerHTML = '<div class="hint">Could not load the contributor data.</div>'; return; }

  const live: Record<string, any> = {};
  (meta.authors || []).forEach((a: any) => { live[a.name] = a; });
  const index: Record<string, { title?: string }> = data.source_index || {};
  LIST = (data.contributors || []).map((c: any) => ({
    ...c,
    gurmukhi_name: c.gurmukhi ?? c.gurmukhi_name ?? null,
    // the corpus itself is not a biographical source: list only the references the life facts rest on
    sources: ((c.sources || []) as RawSource[]).filter((s) => s && s.ref !== 'SGGS' && s.entry)
      .map((s) => ({ title: String(s.entry), publisher: index[s.ref || '']?.title, url: s.url })),
    review: c.review?.status === 'approved' ? 'approved' : 'pending',
    first_ang: live[c.name]?.first_ang, last_ang: live[c.name]?.last_ang, n_lines: live[c.name]?.n_lines,
  }));
  LIST.forEach((c) => byName.set(c.name, c));
  maxLines = Math.max(1, ...LIST.map((c) => c.n_lines || 0));

  renderHero();
  renderLegend();
  wireControls();
  render();
}

// ---------- hero ----------
function renderHero() {
  let verses = 0, bMin = Infinity, bMax = -Infinity;
  LIST.forEach((c) => {
    verses += c.n_lines || 0;
    if (c.born == null) return;
    bMin = Math.min(bMin, c.born);
    bMax = Math.max(bMax, c.died || c.born);
  });
  const span = `${ord(centuryOf(bMin))}–${ord(centuryOf(bMax))} c.`;
  const h = $('#linHeadline');
  if (h) h.textContent = `${LIST.length} voices · ${ord(centuryOf(bMin))}–${ord(centuryOf(bMax))} century`;
  const s = $('#linStats');
  const tile = (v: string | number, l: string) =>
    `<div class="lin-stat"><span class="lin-stat-v">${esc(String(v))}</span><span class="lin-stat-l">${esc(l)}</span></div>`;
  if (s) s.innerHTML = [
    tile(LIST.length, 'contributors'),
    tile(verses.toLocaleString(), 'verses preserved here'),
    tile(span, 'span of voices'),
  ].join('');
}

// ---------- legend / kind filter ----------
function renderLegend() {
  const el = $('#tlFilter'); if (!el) return;
  const counts: Record<string, number> = {};
  LIST.forEach((c) => { counts[c.kind] = (counts[c.kind] || 0) + 1; });
  const chip = (k: string, label: string, n: number) =>
    `<button class="lin-chip${kindFilter === k ? ' on' : ''}${k !== 'all' ? ' kind-' + k : ''}" data-k="${k}" type="button" aria-pressed="${kindFilter === k}">` +
    `${k !== 'all' ? '<span class="lin-dot" aria-hidden="true"></span>' : ''}${esc(label)}<span class="lin-chip-n">${n}</span></button>`;
  el.innerHTML = chip('all', 'All', LIST.length) + KIND_ORDER.map((k) => chip(k, KIND_PLURAL[k], counts[k] || 0)).join('');
  el.querySelectorAll('.lin-chip').forEach((b: any) => {
    b.addEventListener('click', () => { kindFilter = b.dataset.k || 'all'; renderLegend(); render(); });
  });
}

// ---------- controls (group-by + compare toggle) ----------
function wireControls() {
  const g = $('#linGroup');
  g?.querySelectorAll('[data-g]').forEach((b: any) => {
    b.addEventListener('click', () => {
      groupMode = (b.dataset.g || 'granth') as typeof groupMode;
      g.querySelectorAll('[data-g]').forEach((x: any) => {
        const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on));
      });
      render();
    });
  });
  $('#cmpToggle')?.addEventListener('click', () => setCompare(!compareMode));
}

// ---------- main render of the timeline ----------
function render() {
  const host = $('#timeline'); if (!host) return;
  const rows = kindFilter === 'all' ? LIST.slice() : LIST.filter((c) => c.kind === kindFilter);

  let html = '';
  if (groupMode === 'granth') {
    const inGranth = rows.filter((c) => c.first_ang).sort(granthOrder);
    const later = rows.filter((c) => !c.first_ang).sort(byBorn);
    html = (inGranth.length ? band('In the order of the Granth, by first Ang', inGranth.length) + inGranth.map(nodeHTML).join('') : '')
      + (later.length ? band(NOT_INDEXED, later.length) + later.map(nodeHTML).join('') : '');
  } else if (groupMode === 'volume') {
    rows.sort((a, b) => (b.n_lines || 0) - (a.n_lines || 0) || granthOrder(a, b));
    html = band('Ordered by how much Bani is preserved here — never importance', rows.length) + rows.map(nodeHTML).join('');
  } else if (groupMode === 'kind') {
    const order = kindFilter === 'all' ? KIND_ORDER : [kindFilter];
    html = order.map((k) => {
      const g = rows.filter((c) => c.kind === k).sort(byBorn);
      if (!g.length) return '';
      return band(KIND_DESC[k], g.length) + g.map(nodeHTML).join('');
    }).join('');
  } else {
    rows.sort(byBorn);
    let cur: number | null = -1;
    const cenOf = (c: C) => (c.born != null ? centuryOf(c.born) : c.died != null ? centuryOf(c.died) : c.fl_century || null);
    html = rows.map((c) => {
      const cen = cenOf(c);
      let pre = '';
      if (cen !== cur) {
        cur = cen; const n = rows.filter((x) => cenOf(x) === cen).length;
        pre = band(cen == null ? 'Dates not established' : `${ord(cen)} century`, n);
      }
      return pre + nodeHTML(c);
    }).join('');
  }

  host.innerHTML = html || '<div class="hint">No voices in this filter.</div>';
  host.querySelectorAll('.tl-node').forEach((n: any) => {
    n.onclick = () => {
      const c = byName.get(n.dataset.name); if (!c) return;
      if (compareMode) toggleCompareSelect(c); else openDetail(c);
    };
  });
  markSelected();
}

function band(label: string, n: number): string {
  return `<div class="tl-band"><span class="tl-band-l">${esc(label)}</span><span class="tl-band-n">${esc(plural(n, 'voice'))}</span></div>`;
}

function nodeHTML(c: C): string {
  const yr = c.born != null ? (c.circa ? 'c.' : '') + c.born
    : c.died != null ? `d. ${c.circa ? 'c.' : ''}${c.died}` : c.fl_century ? `fl. ${ord(c.fl_century)} c.` : '—';
  const lines = c.n_lines ? `${plural(c.n_lines, 'line')} · ${c.first_ang === c.last_ang ? `Ang ${c.first_ang}` : `Angs ${c.first_ang}–${c.last_ang}`}` : NOT_INDEXED;
  return `<button class="tl-node kind-${esc(c.kind)}" data-name="${esc(c.name)}" type="button" aria-label="${esc(c.roman)} — open profile">
      <span class="tl-year">${esc(yr)}</span>
      <span class="tl-dot" aria-hidden="true"></span>
      <span class="tl-card">
        <span class="tl-med" aria-hidden="true">${esc(initials(c))}</span>
        <span class="tl-main">
          <span class="tl-row"><span class="tl-name">${esc(c.roman)}</span><span class="tl-kind">${esc(KIND_LABEL[c.kind] || c.kind)}${c.seq ? ' · M' + esc(c.seq) : ''}</span></span>
          ${c.gurmukhi_name ? `<span class="tl-gm" lang="pa">${esc(c.gurmukhi_name)}</span>` : ''}
          <span class="tl-era">${esc(c.era)} · ${esc(c.region)}</span>
          <span class="tl-bar" aria-hidden="true"><i style="width:${bar(c.n_lines || 0)}%"></i></span>
          <span class="tl-lines">${esc(lines)}</span>
        </span>
        <span class="tl-pick" aria-hidden="true">✓</span>
      </span>
    </button>`;
}

// ---------- shared modal helpers ----------
const setTitle = (t: string) => { const pt = $('#ptitle'); if (pt) pt.textContent = t; };
const setBody = (h: string) => { const pb = $('#pbody'); if (pb) pb.innerHTML = h; };
const openPanel = () => (window as any).openPanel?.();
const closePanel = () => (window as any).closePanel?.();

// ---------- a single contributor profile (full panel, or compact compare column) ----------
function profileHTML(c: C, d: any, compact: boolean): string {
  const st = (d && d.stylometry) || {};
  const reliable = st.is_reliable !== 0;
  const c_ = c.circa ? 'c.' : '';
  const lifespan = c.born == null ? (c.died ? `d. ${c_}${c.died}` : c.fl_century ? `fl. ${ord(c.fl_century)} century` : 'Dates not established')
    : c.died ? `${c_}${c.born}–${c.died}` : `${c_}${c.born}`;

  // stat tiles — prefer the corpus line count (matches the card) for consistency
  const lineN = c.n_lines ?? st.n_lines;
  const tile = (v: any, l: string, note?: string) =>
    (v == null || v === '' || (typeof v === 'number' && isNaN(v))) ? '' :
      `<div class="ld-stat"><span class="ld-stat-v">${esc(String(v))}</span><span class="ld-stat-l">${esc(l)}${note ? ` <span class="ld-q" tabindex="0" role="img" aria-label="${esc(note)}" title="${esc(note)}">?</span>` : ''}</span></div>`;
  // Only counts of the Bani itself. The stylometry measures (vocabulary variety, words per line) are
  // computed on the English translation's tokens, so they describe the translator, not the voice.
  const tiles = [
    tile(typeof lineN === 'number' ? lineN.toLocaleString() : lineN, lineN === 1 ? 'Line' : 'Lines'),
    tile(st.n_shabads, st.n_shabads === 1 ? 'Composition' : 'Compositions'),
    st.n_raags === 0 ? tile('Swaiyye', 'Outside the raag framework') : tile(st.n_raags, st.n_raags === 1 ? 'Raag' : 'Raags'),
    tile(c.first_ang ? (c.first_ang === c.last_ang ? String(c.first_ang) : `${c.first_ang}–${c.last_ang}`) : null, c.first_ang === c.last_ang ? 'Ang' : 'Ang range'),
  ].filter(Boolean).join('');
  const statsHTML = !c.n_lines
    ? (compact ? `<div class="ld-note">${esc(NOT_INDEXED)}.</div>` : `<div class="ld-note ld-sec">${esc(NOT_INDEXED)} in this build: the attribution of these lines is being reviewed, so no counts are shown yet.</div>`)
    : tiles ? `<div class="ld-statgrid">${tiles}</div>`
    : (compact ? '' : '<div class="ld-note ld-sec">Composition statistics aren’t available for this voice in this build.</div>');

  // where the dates and region come from; a roster entry stays "awaiting review" until a scholar signs it
  const srcs = (c.sources || []).filter((x) => x && x.title);
  const sourcesHTML = compact || !srcs.length ? '' :
    `<div class="ld-sec ld-sources"><div class="ld-h">Sources <span class="ld-note">— for the dates, places and context${c.review === 'pending' ? ' · awaiting scholar review' : ''}</span></div><ul>` +
    srcs.map((x) => {
      const t = esc(x.title) + (x.publisher ? ` <span class="ld-note">· ${esc(x.publisher)}</span>` : '');
      const u = safeUrl(x.url);
      return `<li>${u ? `<a href="${esc(u)}" rel="noopener noreferrer" target="_blank">${t}</a>` : t}</li>`;
    }).join('') + '</ul></div>';

  // signature themes (lift vs. corpus baseline)
  let themesHTML = '';
  const fp = ((d && d.theme_fingerprint) || []).filter((t: any) => t && t.lift != null);
  if (reliable && fp.length) {
    const top = fp.slice(0, compact ? 5 : 6);
    const maxL = Math.max(...top.map((t: any) => +t.lift)) || 1;
    themesHTML = `<div class="ld-sec"><div class="ld-h">Signature themes <span class="ld-note">— ideas this voice returns to more than the Granth overall</span></div>` +
      top.map((t: any) => {
        const w = Math.max(8, Math.round((+t.lift) / maxL * 100));
        return `<div class="ld-trow"><button class="ld-tlabel" data-theme="${esc(t.concept)}" type="button" title="Search this theme across the Granth">${esc(titleCase(String(t.concept).replace(/_/g, ' ')))}</button>` +
          `<span class="ld-ttrack" aria-hidden="true"><i style="width:${w}%"></i></span><span class="ld-tpct">×${(+t.lift).toFixed(1)}</span></div>`;
      }).join('') + `</div>`;
  }

  // distinctive words (full profile only)
  let termsHTML = '';
  if (!compact) {
    const terms = ((d && d.distinctive_terms) || []).slice(0, 10);
    if (reliable && terms.length) {
      termsHTML = `<div class="ld-sec"><div class="ld-h">Distinctive words <span class="ld-note">(Gurmukhi words this voice uses far more than the rest of the Granth · pen-names and function words left out)</span></div>` +
        `<div class="ld-termwrap">${terms.map((t: any) => `<span class="ld-term" lang="pa">${esc(t.term)}</span>`).join('')}</div></div>`;
    } else if (!reliable) {
      termsHTML = `<div class="ld-note ld-sec">Stylometry is withheld here — this voice’s sample is too small to compare reliably.</div>`;
    }
  }

  // actions
  const actions = compact
    ? (c.first_ang ? `<div class="ld-cactions"><button onclick="goReader(${Number(c.first_ang)})" type="button">Read · Ang ${esc(c.first_ang)} →</button></div>` : '')
    : `<div class="endnav ld-actions">
        <button class="ld-cmp" data-name="${esc(c.name)}" type="button">⇄ Compare with another voice</button>
        ${c.first_ang ? `<button onclick="goReader(${Number(c.first_ang)})" type="button">Read their first composition · Ang ${esc(c.first_ang)} →</button>` : '<span></span>'}
      </div>`;

  return `<div class="ld kind-${esc(c.kind)}">
    <div class="ld-hero">
      <span class="ld-med" aria-hidden="true">${esc(initials(c))}</span>
      <div class="ld-id">
        <div class="ld-name">${esc(c.roman)}</div>
        ${c.gurmukhi_name ? `<div class="ld-gm" lang="pa">${esc(c.gurmukhi_name)}</div>` : ''}
        <div class="ld-chips">
          <span class="ld-chip kind-${esc(c.kind)}">${esc(KIND_LABEL[c.kind] || c.kind)}${c.seq ? ' · M' + esc(c.seq) : ''}</span>
          <span class="ld-chip">${esc(lifespan)}</span>
          <span class="ld-chip">${esc(c.region)}</span>
          <span class="ld-chip">${esc(c.tradition)}</span>
        </div>
      </div>
    </div>
    <p class="ld-blurb${compact ? ' ld-blurb-c' : ''}">${esc((!compact && c.context) || c.blurb)}</p>
    ${statsHTML}${themesHTML}${termsHTML}${sourcesHTML}${actions}
  </div>`;
}

// theme links + compare buttons inside freshly-rendered modal content
function wireProfile() {
  const root = $('#pbody'); if (!root) return;
  root.querySelectorAll('.ld-tlabel').forEach((b: any) => b.addEventListener('click', () => goSearchTheme(b.dataset.theme || '')));
  root.querySelectorAll('.ld-cmp').forEach((b: any) => b.addEventListener('click', () => { const nm = b.dataset.name || ''; closePanel(); startCompareWith(nm); }));
}

// a voice with no indexed lines has no analytics row: asking would only raise an error toast
const fetchAnalytics = (c: C) => c.n_lines
  ? api('analytics/author?author=' + encodeURIComponent(c.name)).catch(() => ({}))
  : Promise.resolve({});

async function openDetail(c: C) {
  openPanel();
  setTitle('Voice in the Granth');
  setBody('<div class="hint">Loading profile…</div>');
  const d = await fetchAnalytics(c);
  if (!$('#panel')?.classList.contains('on')) return;   // user closed it while loading
  setBody(profileHTML(c, d, false));
  wireProfile();
}

// ---------- compare mode ----------
function setCompare(on: boolean) {
  compareMode = on;
  document.body.classList.toggle('cmp-mode', on);
  const t = $('#cmpToggle');
  if (t) { t.classList.toggle('on', on); t.setAttribute('aria-pressed', String(on)); }
  if (!on) compareSel.length = 0;
  markSelected();
  renderTray();
}
function startCompareWith(name: string) {
  setCompare(true);
  const c = byName.get(name);
  if (c) toggleCompareSelect(c);
}
function toggleCompareSelect(c: C) {
  const i = compareSel.findIndex((x) => x.name === c.name);
  if (i >= 0) compareSel.splice(i, 1);
  else { if (compareSel.length >= 2) compareSel.shift(); compareSel.push(c); }
  markSelected();
  renderTray();
  if (compareSel.length === 2) openCompare(compareSel[0], compareSel[1]);
}
function markSelected() {
  $('#timeline')?.querySelectorAll('.tl-node').forEach((n: any) => {
    n.classList.toggle('cmp-on', compareMode && compareSel.some((c) => c.name === n.dataset.name));
  });
}
function renderTray() {
  const t = $('#cmpTray'); if (!t) return;
  if (!compareMode) { (t as HTMLElement).hidden = true; t.innerHTML = ''; return; }
  (t as HTMLElement).hidden = false;
  const need = 2 - compareSel.length;
  const chips = compareSel.map((c) =>
    `<span class="cmp-chip kind-${esc(c.kind)}"><span class="lin-dot" aria-hidden="true"></span>${esc(c.roman)}<button class="cmp-x" data-name="${esc(c.name)}" type="button" aria-label="Remove ${esc(c.roman)}">×</button></span>`).join('');
  t.innerHTML = `<span class="cmp-tray-l">⇄ Compare</span>${chips}` +
    `<span class="cmp-hint">${need > 0 ? `Pick ${need} more voice${need > 1 ? 's' : ''} on the timeline` : 'Showing comparison'}</span>` +
    `<button class="cmp-clear" type="button">Done</button>`;
  t.querySelectorAll('.cmp-x').forEach((b: any) => b.addEventListener('click', (e: any) => {
    e.stopPropagation();
    const i = compareSel.findIndex((x) => x.name === b.dataset.name);
    if (i >= 0) { compareSel.splice(i, 1); markSelected(); renderTray(); }
  }));
  t.querySelector('.cmp-clear')?.addEventListener('click', () => setCompare(false));
}
async function openCompare(a: C, b: C) {
  openPanel();
  setTitle('Compare voices');
  setBody('<div class="hint">Loading comparison…</div>');
  const [da, db] = await Promise.all([fetchAnalytics(a), fetchAnalytics(b)]);
  if (!$('#panel')?.classList.contains('on')) return;
  setBody(`<div class="cmp-grid"><div class="cmp-col">${profileHTML(a, da, true)}</div><div class="cmp-col">${profileHTML(b, db, true)}</div></div>`);
  wireProfile();
}

load();
