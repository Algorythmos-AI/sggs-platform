// constellation.ts — Concept Constellation (/constellation), v2 "the Granth, seen by idea".
// Focus: one theme at the centre; its companion themes placed so that distance = the corpus bond
// (closer = higher PPMI), line weight = Jaccard, size = verses shared, colour = theological group.
// "Most shared" orders companions by verses shared; "Most distinctive" by PPMI (base-rate controlled).
// The caption always adds up: total = shared + alone. Sky: all 54 themes at once, a deterministic
// force layout over the PPMI network. Lenses (voice, raag, this hour, refrains, many themes,
// an Ang bin) re-run the same server query. All numbers come from the API; nothing is invented.
import * as d3 from 'd3';
import { $, esc, api, guard, failHTML, goReader } from './core';
import { cssVar, onTheme } from './viz';
import { loadClock, currentPahar } from './timing';
import { THEME_GROUPS, groupOf, groupVar, themeName } from './themegroups';

type Companion = { co: string; n: number; ppmi: number; jaccard: number; shabad_count: number };
const SHOWN = 9, PAGE = 50, BINS = 15;
const nf = (n: number) => (n || 0).toLocaleString();
const T = (k: string) => themeName(k);

const st = {
  theme: 'naam', view: 'focus' as 'focus' | 'sky', rank: 'shared' as 'shared' | 'distinctive',
  author: '', raag: '', hour: false, rahao: false, bright: false, bin: -1,
  pair: '' as string, alone: false,
};
let hourRaags: string[] = [];
let raagRoman: Record<string, string> = {};

function readUrl() {
  const q = new URLSearchParams(location.search);
  if (q.get('theme')) st.theme = q.get('theme')!;
  if (q.get('view') === 'sky') st.view = 'sky';
  if (q.get('rank') === 'distinctive') st.rank = 'distinctive';
  st.author = q.get('author') || ''; st.raag = q.get('raag') || '';
  st.rahao = q.get('rahao') === '1'; st.bright = q.get('bright') === '1'; st.hour = q.get('hour') === '1';
  const b = Number(q.get('bin')); st.bin = Number.isInteger(b) && b >= 0 && b < BINS && q.has('bin') ? b : -1;
  st.pair = q.get('with') || ''; st.alone = q.get('alone') === '1';
}
function writeUrl() {
  const q = new URLSearchParams();
  q.set('theme', st.theme);
  if (st.view === 'sky') q.set('view', 'sky');
  if (st.rank === 'distinctive') q.set('rank', 'distinctive');
  if (st.author) q.set('author', st.author);
  if (st.raag) q.set('raag', st.raag);
  if (st.hour) q.set('hour', '1');
  if (st.rahao) q.set('rahao', '1');
  if (st.bright) q.set('bright', '1');
  if (st.bin >= 0) q.set('bin', String(st.bin));
  if (st.pair) q.set('with', st.pair);
  if (st.alone) q.set('alone', '1');
  history.replaceState(null, '', location.pathname + '?' + q.toString());
}

/** the lens as query parameters (shared by the Focus and pair requests) */
function lensQs(): string {
  const p: string[] = [];
  if (st.author) p.push('author=' + encodeURIComponent(st.author));
  if (st.raag) p.push('raag=' + encodeURIComponent(st.raag));
  if (st.hour && hourRaags.length) p.push('raags=' + encodeURIComponent(hourRaags.join(',')));
  if (st.rahao) p.push('rahao=1');
  if (st.bright) p.push('min_themes=5');
  if (st.bin >= 0) p.push(`ang_min=${st.bin * 100 + 1}`, `ang_max=${Math.min(1430, st.bin * 100 + 100)}`);
  return p.length ? '&' + p.join('&') : '';
}
function lensWords(): string {
  const w: string[] = [];
  if (st.author) w.push(st.author);   // names in full, as stored
  if (st.raag) w.push('Raag ' + (raagRoman[st.raag] || st.raag));
  if (st.hour) w.push('this hour');
  if (st.rahao) w.push('refrains');
  if (st.bright) w.push('5+ themes');
  if (st.bin >= 0) w.push(`Angs ${st.bin * 100 + 1}–${Math.min(1430, st.bin * 100 + 100)}`);
  return w.join(' · ');
}

const ranked = (cs: Companion[]) => st.rank === 'shared'
  ? cs.slice().sort((a, b) => b.n - a.n || a.co.localeCompare(b.co))
  : cs.slice().sort((a, b) => b.ppmi - a.ppmi || b.n - a.n || a.co.localeCompare(b.co));

// ---- Focus ---------------------------------------------------------------------------------------
function drawFocus(host: HTMLElement, d: any) {
  const cs: Companion[] = ranked(d.companions || []).slice(0, SHOWN);
  const W = host.clientWidth || 900, H = Math.min(600, Math.max(460, W * 0.75)), cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) / 2 - 58, rMin = Math.min(104, R * 0.55);
  const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('height', H)
    .attr('role', 'group')
    .attr('aria-label', `${T(st.theme)} and its ${cs.length} ${st.rank === 'shared' ? 'most shared' : 'most distinctive'} companion themes. The same data is listed after the chart.`);
  const maxN = Math.max(1, ...cs.map((c) => c.n)), maxJ = Math.max(1e-6, ...cs.map((c) => c.jaccard));
  const ps = cs.map((c) => c.ppmi), lo = Math.min(...ps), hi = Math.max(...ps);
  const near = (p: number) => (hi > lo ? (p - lo) / (hi - lo) : 0.5);   // 1 = the strongest bond shown
  const pts = cs.map((c, i) => {
    const a = (i / Math.max(1, cs.length)) * 2 * Math.PI - Math.PI / 2;
    const dist = rMin + (R - rMin) * (1 - near(c.ppmi));
    return { c, x: cx + dist * Math.cos(a), y: cy + dist * Math.sin(a), r: 9 + 21 * Math.sqrt(c.n / maxN) };
  });
  pts.forEach((p) => svg.append('line').attr('x1', cx).attr('y1', cy).attr('x2', p.x).attr('y2', p.y)
    .attr('stroke', cssVar(groupVar(p.c.co))).attr('stroke-opacity', 0.45)
    .attr('stroke-width', 1 + 6 * (p.c.jaccard / maxJ)).attr('aria-hidden', 'true'));

  // the verses that carry the theme alone: a soft halo around the centre, opened like a companion
  if (d.solo > 0) {
    // pointer only: its keyboard and screen-reader path is the "alone" button in the list twin
    const halo = svg.append('g').attr('class', 'con-halo').attr('aria-hidden', 'true').on('click', openAlone);
    halo.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 54).attr('fill', 'none')
      .attr('stroke', cssVar('--soft')).attr('stroke-width', 2).attr('stroke-dasharray', '3 5');
    halo.append('text').attr('x', cx).attr('y', cy + 50).attr('text-anchor', 'middle').attr('font-size', 11.5)
      .attr('font-weight', 650).attr('fill', cssVar('--soft')).attr('paint-order', 'stroke').attr('stroke', cssVar('--card')).attr('stroke-width', 4)
      .text(`${nf(d.solo)} alone`);
  }

  pts.forEach((p) => {
    const g = svg.append('g').attr('class', 'con-node').attr('tabindex', 0).attr('role', 'button')
      .attr('aria-label', `${T(p.c.co)}: ${nf(p.c.n)} verses carry both ${T(st.theme)} and ${T(p.c.co)}; together in ${nf(p.c.shabad_count)} shabads`)
      .on('click keydown', (ev: any) => { if (ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return; ev.preventDefault(); openPair(p.c.co); });
    g.append('circle').attr('cx', p.x).attr('cy', p.y).attr('r', p.r).attr('fill', cssVar(groupVar(p.c.co)))
      .attr('fill-opacity', st.pair === p.c.co ? 1 : 0.82)
      .attr('stroke', st.pair === p.c.co ? cssVar('--ink') : 'none').attr('stroke-width', 2);
    g.append('text').attr('x', p.x).attr('y', p.y + p.r + 15).attr('text-anchor', 'middle')
      .attr('font-size', 12).attr('font-weight', 700).attr('fill', cssVar('--ink'))
      .attr('paint-order', 'stroke').attr('stroke', cssVar('--card')).attr('stroke-width', 3)
      .text(`${T(p.c.co)} · ${nf(p.c.n)}`);
  });

  // centre star last (a filled control: the fill token, its edge, and the label proven on it)
  const centre = svg.append('g').attr('class', 'con-node').attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', `${T(st.theme)}: about this theme`)
    .on('click keydown', (ev: any) => { if (ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return; ev.preventDefault(); openCard(); });
  centre.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 34).attr('fill', cssVar('--accent-fill') || '#FFBC0D')
    .attr('stroke', cssVar('--accent-ui') || '#A87900').attr('stroke-width', 2);
  centre.append('text').attr('x', cx).attr('y', cy).attr('dy', '.35em').attr('text-anchor', 'middle')
    .attr('font-size', 13).attr('font-weight', 800).attr('fill', cssVar('--on-accent') || '#2B1A05').text(T(st.theme));

  // the list twin: the same model, the keyboard and screen-reader path
  const items = cs.map((c) => `<li><button type="button" class="con-link" data-co="${esc(c.co)}">${esc(T(c.co))}</button> `
    + `<span class="cl-n">${nf(c.n)} verses shared · together in ${nf(c.shabad_count)} shabads · PPMI ${c.ppmi.toFixed(2)}</span></li>`).join('')
    + (d.solo > 0 ? `<li><button type="button" class="con-link" data-alone="1">${esc(T(st.theme))} alone</button> <span class="cl-n">${nf(d.solo)} verses carry no other theme</span></li>` : '');
  host.insertAdjacentHTML('beforeend', `<ul class="constel-list" aria-label="Companion themes, as a list">${items}</ul>`);
}

function drawStrip(d: any) {
  const el = $('#conStrip'); if (!el) return;
  const bins: number[] = d.ang_bins || [];
  const max = Math.max(1, ...bins);
  el.hidden = false;
  el.innerHTML = `<div class="con-strip-head">Where ${esc(T(st.theme))} falls in reading order <span class="con-note">(verses per 100 Angs; tap a bin to look only there)</span></div>`
    + `<div class="con-bins">` + bins.map((n, i) => {
      const a = i * 100 + 1, b = Math.min(1430, i * 100 + 100);
      return `<button type="button" class="con-bin${st.bin === i ? ' on' : ''}" data-bin="${i}" aria-pressed="${st.bin === i}" `
        + `aria-label="Angs ${a} to ${b}: ${nf(n)} verses" title="Angs ${a}–${b}: ${nf(n)}"><span style="height:${Math.round(6 + 54 * n / max)}px"></span></button>`;
    }).join('') + `</div><div class="con-bins-axis"><span>Ang 1</span><span>1430</span></div>`;
}

// ---- Sky -----------------------------------------------------------------------------------------
let skyData: any = null;
function drawSky(host: HTMLElement) {
  const nodes = skyData.nodes.map((n: any) => ({ ...n }));
  // the layout uses every pair (pull ∝ PPMI), so a theme with no strong bond still sits near its
  // nearest themes; only the pairs at PPMI ≥ 0.7 are drawn. Deterministic: d3-force starts from its
  // phyllotaxis arrangement and its own seeded LCG, and runs a fixed number of ticks.
  const maxP = Math.max(...skyData.layout.map((e: any) => e.ppmi), 1e-6);
  const pull = skyData.layout.filter((e: any) => e.ppmi > 0)
    .map((e: any) => ({ source: e.source, target: e.target, ppmi: e.ppmi }));
  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(pull).id((n: any) => n.concept).distance((l: any) => 40 + 160 * (1 - l.ppmi / maxP)).strength((l: any) => 0.03 + 0.5 * (l.ppmi / maxP)))
    .force('charge', d3.forceManyBody().strength(-260))
    .force('x', d3.forceX(0).strength(0.06)).force('y', d3.forceY(0).strength(0.06))
    .force('collide', d3.forceCollide().radius(26))
    .stop();
  for (let i = 0; i < 400; i++) sim.tick();
  // a theme with few pairs drifts out and would shrink everything else to fit: keep it at the rim
  const ds = nodes.map((n: any) => Math.hypot(n.x, n.y)).sort((a: number, b: number) => a - b);
  const rim = ds[Math.floor(ds.length * 0.9)] * 1.1;
  nodes.forEach((n: any) => { const r = Math.hypot(n.x, n.y); if (r > rim) { n.x *= rim / r; n.y *= rim / r; } });
  const at: Record<string, any> = {}; nodes.forEach((n: any) => { at[n.concept] = n; });
  const links = skyData.edges.map((e: any) => ({ source: at[e.source], target: at[e.target], ppmi: e.ppmi, jaccard: e.jaccard }))
    .filter((l: any) => l.source && l.target);
  const W = host.clientWidth || 900, H = Math.min(640, Math.max(460, W * 0.8));
  const xs = nodes.map((n: any) => n.x), ys = nodes.map((n: any) => n.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = Math.min((W - 90) / Math.max(1, x1 - x0), (H - 70) / Math.max(1, y1 - y0));
  const X = (x: number) => 45 + (x - x0) * k, Y = (y: number) => 35 + (y - y0) * k;
  const maxN = Math.max(...nodes.map((n: any) => n.n));
  const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('height', H)
    .attr('role', 'group').attr('aria-label', `All ${nodes.length} themes. Lines join themes that share shabads more than chance (PPMI 0.7 or more). The same themes are listed by group after the chart.`);
  const z = svg.append('g');
  svg.call(d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.6, 5]).on('zoom', (ev: any) => z.attr('transform', ev.transform)) as any);
  links.forEach((l: any) => z.append('line').attr('x1', X(l.source.x)).attr('y1', Y(l.source.y)).attr('x2', X(l.target.x)).attr('y2', Y(l.target.y))
    .attr('stroke', cssVar('--soft')).attr('stroke-opacity', 0.08 + 0.5 * Math.min(1, l.jaccard / 0.5)).attr('stroke-width', 0.5 + 2.5 * Math.min(1, (l.ppmi - 0.7) / 2.9))
    .attr('aria-hidden', 'true'));
  nodes.forEach((n: any) => {
    const r = 4 + 15 * Math.sqrt(n.n / maxN);
    const g = z.append('g').attr('class', 'con-node').attr('tabindex', 0).attr('role', 'button')
      .attr('aria-label', `${T(n.concept)}: ${nf(n.n)} verses — focus this theme`)
      .on('click keydown', (ev: any) => { if (ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return; ev.preventDefault(); focusTheme(n.concept); });
    g.append('circle').attr('cx', X(n.x)).attr('cy', Y(n.y)).attr('r', r).attr('fill', cssVar(groupVar(n.concept)))
      .attr('fill-opacity', 0.85).attr('stroke', n.concept === st.theme ? cssVar('--accent-ui') : 'none').attr('stroke-width', 3);
    g.append('text').attr('x', X(n.x)).attr('y', Y(n.y) + r + 11).attr('text-anchor', 'middle').attr('font-size', 10.5)
      .attr('font-weight', 600).attr('fill', cssVar('--ink')).attr('paint-order', 'stroke').attr('stroke', cssVar('--card')).attr('stroke-width', 3)
      .text(T(n.concept));
  });
  const byG = THEME_GROUPS.map((g) => `<li><b>${esc(g.title)}</b> `
    + g.keys.filter((k) => nodes.some((n: any) => n.concept === k)).map((k) => `<button type="button" class="con-link" data-theme="${esc(k)}">${esc(T(k))}</button>`).join(' · ') + '</li>').join('');
  host.insertAdjacentHTML('beforeend', `<ul class="constel-list" aria-label="All themes by group, as a list">${byG}</ul>`);
}

function drawLegend() {
  const el = $('#conLegend'); if (!el) return;
  el.innerHTML = THEME_GROUPS.map((g) => `<span class="con-key"><i style="background:var(--tg-${g.key})" aria-hidden="true"></i>${esc(g.title)}</span>`).join('');
}

// ---- panels: the theme card and the verses a pair shares --------------------------------------------
const gmMarked = (text: string, terms: string[]) =>      // whole words only: the text itself is never changed
  String(esc(text)).split(' ').map((w: string) => (terms.includes(w) ? `<mark>${w}</mark>` : w)).join(' ');

async function openCard() {
  const el = $('#conCard'); if (!el) return;
  el.hidden = false; el.innerHTML = '<div class="hint">Loading…</div>';
  try {
    const c = await api('analytics/theme?concept=' + encodeURIComponent(st.theme));
    const rate = (x: number) => (x * 100).toFixed(1) + '%';
    const row = (x: any, name: string) => `<li><b>${esc(name)}</b> <span class="cl-n">${x.lift.toFixed(2)}× the Granth's rate — ${rate(x.entity_rate)} of its tagged verses against ${rate(x.corpus_rate)} overall (${nf(x.n_tagged)} verses)</span></li>`;
    const g = groupOf(st.theme);
    el.innerHTML = `<div class="con-panel-head"><div><div class="viz-title">${esc(T(st.theme))}</div>`
      + `<div class="viz-sub">${g ? esc(g.title) + ' · ' : ''}${nf(c.n_verses)} verses in ${nf(c.n_shabads)} shabads · ${nf(c.n_rahao)} refrains</div></div>`
      + `<button type="button" class="con-close" data-close="conCard" aria-label="Close">×</button></div>`
      // an editorial note about the theme: set apart from scripture and labelled as such
      + (c.description ? `<div class="con-sub">About this theme</div><p class="con-desc">${esc(c.description)}</p><p class="con-note">An editorial note, not scripture.</p>` : '')
      + `<div class="con-sub">The Gurmukhi words that tag it</div><div class="con-terms">${(c.terms || []).map((t: string) => `<span class="gm" lang="pa">${esc(t)}</span>`).join('')}</div>`
      + (c.raags.length ? `<div class="con-sub">Raags where it appears more often</div><ul class="con-rows">${c.raags.map((x: any) => row(x, 'Raag ' + (raagRoman[x.entity_id] || x.entity_id))).join('')}</ul>` : '')
      + (c.authors.length ? `<div class="con-sub">Voices where it appears more often</div><ul class="con-rows">${c.authors.map((x: any) => row(x, x.entity_id)).join('')}</ul>` : '')
      + `<p class="con-note">Rates only where the sample is large enough to be reliable. Descriptive, never a ranking.</p>`
      + `<a class="con-more" href="/search?q=${encodeURIComponent(st.theme)}&mode=theme">See all ${nf(c.n_verses)} verses →</a>`;
  } catch { el.innerHTML = failHTML('This theme card'); }
}

let pairOffset = 0;
async function loadPair(append: boolean) {
  const el = $('#conPair'); if (!el) return;
  const qs = st.alone ? 'alone=1' : 'with=' + encodeURIComponent(st.pair);
  const d = await api(`analytics/pair?concept=${encodeURIComponent(st.theme)}&${qs}&limit=${PAGE}&offset=${pairOffset}${lensQs()}`);
  const head = st.alone ? `${T(st.theme)} alone` : `${T(st.theme)} ✦ ${T(st.pair)}`;
  const why = st.alone
    ? `Shown because it carries a word of ${T(st.theme)} and no other theme's word.`
    : `Shown because it carries a word of each theme (marked): matched by a shared word, not by meaning.`;
  const shabads = (d.shabads || []).map((sh: any) => `<div class="con-shabad"><div class="con-eyebrow">`
    + [sh.raag ? 'Raag ' + (raagRoman[sh.raag] || sh.raag) : '', sh.author || '', 'Ang ' + sh.ang].filter(Boolean).map(esc).join(' · ')
    + `</div>` + sh.verses.map((v: any) => `<div class="sline${v.is_rahao ? ' rahao' : ''}">`
      + `<div class="g gm" lang="pa">${gmMarked(v.gurmukhi || '', v.terms || [])}</div><div class="t">${esc(v.translit || '')}</div>`
      + `<div class="con-vmeta">${v.is_rahao ? '<span class="con-badge">Rahao</span>' : ''}<a href="/reader?ang=${v.ang}" data-ang="${v.ang}" data-line="${v.id}" data-comp="${sh.comp_id}">Ang ${v.ang} · open in the Reader</a></div></div>`).join('')
    + `</div>`).join('');
  const shown = pairOffset + (d.shabads || []).reduce((s: number, sh: any) => s + sh.verses.length, 0);
  const more = shown < d.total ? `<button type="button" class="con-more" id="conMore">Show ${Math.min(PAGE, d.total - shown)} more (${nf(shown)} of ${nf(d.total)})</button>` : '';
  if (!append) {
    const bond = d.bond ? `<div class="viz-sub">Together in ${nf(d.bond.shabad_count)} shabads across the Granth · PPMI ${d.bond.ppmi.toFixed(2)} · Jaccard ${d.bond.jaccard.toFixed(2)}</div>` : '';
    el.innerHTML = `<div class="con-panel-head"><div><div class="viz-title">${esc(head)} · ${nf(d.total)} verses${lensWords() ? ' (' + esc(lensWords()) + ')' : ''}</div>${bond}</div>`
      + `<button type="button" class="con-close" data-close="conPair" aria-label="Close">×</button></div>`
      + `<p class="con-note">${esc(why)}</p><div id="conVerses">${shabads}</div><div id="conMoreBox">${more}</div>`;
  } else {
    $('#conVerses')?.insertAdjacentHTML('beforeend', shabads);
    const box = $('#conMoreBox'); if (box) box.innerHTML = more;
  }
  pairOffset = shown;
}
async function openPair(co: string) {
  st.pair = co; st.alone = false; pairOffset = 0; writeUrl(); showPair();
}
async function openAlone() {
  st.pair = ''; st.alone = true; pairOffset = 0; writeUrl(); showPair();
}
async function showPair() {
  const el = $('#conPair'); if (!el) return;
  el.hidden = false; el.innerHTML = '<div class="hint">Loading…</div>';
  try { await loadPair(false); el.scrollIntoView({ block: 'nearest' }); } catch { el.innerHTML = failHTML('These verses'); }
}

// ---- the page --------------------------------------------------------------------------------------
let draw: () => Promise<void> = async () => {};
function focusTheme(k: string) {
  st.theme = k; st.view = 'focus'; st.pair = ''; st.alone = false;
  const sel = $('#conSel') as HTMLSelectElement | null; if (sel) sel.value = k;
  const card = $('#conCard'), pair = $('#conPair'); if (card) card.hidden = true; if (pair) pair.hidden = true;
  draw();
}

async function constellation() {
  const host = $('#constel'); if (!host) return;
  const sel = $('#conSel') as HTMLSelectElement;
  const authorSel = $('#conAuthor') as HTMLSelectElement, raagSel = $('#conRaag') as HTMLSelectElement;
  const head = $('#conHead');
  readUrl();
  const list = await api('analytics/constellation');
  const concepts: { concept: string; n: number }[] = list.concepts || [];
  if (!concepts.length) { host.innerHTML = '<div class="hint">Concept data is not available in this DB build.</div>'; return; }
  const count: Record<string, number> = {}; concepts.forEach((c) => { count[c.concept] = c.n; });
  if (!(st.theme in count)) st.theme = count.naam ? 'naam' : concepts[0].concept;
  const placed = new Set<string>();
  sel.innerHTML = THEME_GROUPS.map((g) => {
    const opts = g.keys.filter((k) => k in count).map((k) => { placed.add(k); return `<option value="${esc(k)}">${esc(T(k))} · ${nf(count[k])} verses</option>`; }).join('');
    return opts ? `<optgroup label="${esc(g.title)}">${opts}</optgroup>` : '';
  }).join('') + (() => {                                   // a theme no group names is never dropped
    const rest = concepts.filter((c) => !placed.has(c.concept));
    return rest.length ? `<optgroup label="More themes">${rest.map((c) => `<option value="${esc(c.concept)}">${esc(T(c.concept))} · ${nf(c.n)} verses</option>`).join('')}</optgroup>` : '';
  })();
  sel.value = st.theme;
  authorSel.innerHTML = '<option value="">All voices</option>' + (list.authors || []).map((a: string) => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
  raagSel.innerHTML = '<option value="">All raags</option>' + (list.raags || []).map((r: any) => `<option value="${esc(r.name)}">${esc(r.roman || r.name)}</option>`).join('');
  (list.raags || []).forEach((r: any) => { raagRoman[r.name] = r.roman || r.name; });
  authorSel.value = st.author; raagSel.value = st.raag;
  ($('#conRahao') as HTMLInputElement).checked = st.rahao;
  ($('#conBright') as HTMLInputElement).checked = st.bright;
  ($('#conHour') as HTMLInputElement).checked = st.hour;
  drawLegend();

  const syncButtons = () => {
    document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === st.view)));
    document.querySelectorAll<HTMLButtonElement>('[data-rank]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.rank === st.rank)));
    const bar = $('#conFocusBar'); if (bar) bar.hidden = st.view === 'sky';
    const on = $('#conLensOn'); if (on) on.textContent = lensWords() ? '· ' + lensWords() : '';
  };

  let req = 0;
  draw = guard(async () => {
    const my = ++req;
    syncButtons(); writeUrl();
    if (st.view === 'sky') {
      if (!skyData) {
        const [drawn, all] = await Promise.all([api('analytics/sky'), api('analytics/sky?min_ppmi=0')]);
        skyData = { nodes: drawn.nodes, edges: drawn.edges, layout: all.edges };
      }
      if (my !== req) return;
      host.replaceChildren();
      const strip = $('#conStrip'); if (strip) strip.hidden = true;
      if (head) head.textContent = `All ${skyData.nodes.length} themes · lines join themes that share shabads more than chance would give (PPMI 0.7 or more) · tap a star to focus it`;
      drawSky(host);
      return;
    }
    if (st.hour && !hourRaags.length) {
      try {
        const clock = await loadClock(), p = currentPahar().pahar;
        hourRaags = [...new Set<string>(((clock && clock.claims && clock.claims.primary) || []).filter((c: any) => c.pahar === p).map((c: any) => c.raag_name))];
      } catch { hourRaags = []; }
    }
    const d = await api(`analytics/constellation?concept=${encodeURIComponent(st.theme)}${lensQs()}`);
    if (my !== req) return;                                     // a newer pick is in flight
    host.replaceChildren();
    const lw = lensWords(), name = T(st.theme);
    if (head) head.textContent = d.total
      ? `${nf(d.total)} verses carry ${name}${lw ? ' (' + lw + ')' : ''} · ${nf(d.shared)} also carry another theme · ${nf(d.solo)} carry ${name} alone`
      : `No verses of ${name}${lw ? ' for ' + lw : ''} — try a different lens.`;
    if (st.hour && !hourRaags.length && head) head.textContent += ' · no raag is attributed to this watch';
    drawStrip(d);
    if (!d.total) return;
    if (!(d.companions || []).length) host.insertAdjacentHTML('beforeend', `<div class="hint">These verses carry no other theme.</div>`);
    else drawFocus(host, d);
    if (st.pair || st.alone) showPair();
  }, () => { host.insertAdjacentHTML('beforeend', failHTML('This constellation')); if (head) head.textContent = 'Could not load this theme.'; });

  sel.onchange = () => focusTheme(sel.value);
  authorSel.onchange = () => { st.author = authorSel.value; draw(); };
  raagSel.onchange = () => { st.raag = raagSel.value; draw(); };
  ($('#conRahao') as HTMLInputElement).onchange = (e: any) => { st.rahao = e.target.checked; draw(); };
  ($('#conBright') as HTMLInputElement).onchange = (e: any) => { st.bright = e.target.checked; draw(); };
  ($('#conHour') as HTMLInputElement).onchange = (e: any) => { st.hour = e.target.checked; draw(); };
  document.addEventListener('click', (e: any) => {
    const t = e.target.closest('[data-view], [data-rank], .con-bin, .con-link, .con-close, #conMore, #conPair a[data-ang]');
    if (!t) return;
    if (t.dataset.view) { st.view = t.dataset.view; draw(); }
    else if (t.dataset.rank) { st.rank = t.dataset.rank; draw(); }
    else if (t.classList.contains('con-bin')) { const b = +t.dataset.bin; st.bin = st.bin === b ? -1 : b; draw(); }
    else if (t.dataset.theme) focusTheme(t.dataset.theme);
    else if (t.dataset.co) openPair(t.dataset.co);
    else if (t.dataset.alone) openAlone();
    else if (t.dataset.close) {
      const p = document.getElementById(t.dataset.close); if (p) p.hidden = true;
      if (t.dataset.close === 'conPair') { st.pair = ''; st.alone = false; writeUrl(); }
    } else if (t.id === 'conMore') { t.disabled = true; loadPair(true).catch(() => { t.disabled = false; }); }
    else if (t.dataset.ang) { e.preventDefault(); goReader(+t.dataset.ang, undefined, { line: +t.dataset.line, comp: +t.dataset.comp }); }
  });
  onTheme(draw);
  draw();
}
guard(constellation, () => { const h = $('#constel'); if (h) h.innerHTML = failHTML('The constellation'); const hd = $('#conHead'); if (hd) hd.textContent = 'Could not load concept data.'; })();
