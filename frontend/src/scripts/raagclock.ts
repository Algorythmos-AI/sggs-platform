// raagclock.ts — the Raag Clock page (/raag-clock), in step with the app's clock.
// One face answers "what time is it here, and which raags belong to it": a ring of the eight
// watches (fixed hours, or the sun's own when solar mode has a location) around the reader's own
// clock — hour, minute and second hands — on ONE 12-hour scale: every boundary sits where the hour
// hand points at that time, and the ring shows the half of the day the hand is in (AM or PM). Beside it, the claims for the watch
// that was tapped; under it, the time in words, the eight watches as a list (the full-content
// path for a keyboard or a screen reader), the seasonal raags, and every claim in a table.
// Everything here is METADATA about raags — scripture rendering is untouched; all API text passes
// esc() before innerHTML.
import { $, esc, guard, store, toast, prefersReducedMotion, failHTML } from './core';
import { loadClock as loadClockShared, currentPahar, getMode, getLoc, type Mode } from './timing';
import {
  paharFromMinutes, paharWindow, paharSolarWindow, paharLabel, fmt12,
  nextPaharBoundary, raagsForPahar, minutesOf,
} from './pahar.js';
import { halfOf, faceDegrees, clipToHalf, halfLabels, halfSpoken } from './paharface.js';

const NS = 'http://www.w3.org/2000/svg';
// The face, from the centre outwards (units of an 800 box): the 12-hour clock in the hollow, the
// band of the watches in this half of the day, the 12 hour ticks, the labels (the half, 3 · 6 · 9).
const C = 400, R_IN = 196, R_OUT = 316, R_FACE = R_IN - 8, R_TICK = R_OUT + 5, R_NUM = R_OUT + 26;
let CLOCK: any = null;
let BYRAAG: Record<string, any[]> = {};
let selPahar = 0;
let selSeason = '';
let dialKey = '';

// ---- tiny SVG helpers -------------------------------------------------------
function el(tag: string, attrs: Record<string, string | number> = {}, text?: string) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text != null) e.textContent = text;
  return e;
}
/** minutes-since-midnight → radians on the 12-hour face: 12 at the top, clockwise — the hour
 *  hand's own angle at that minute, so 6 AM and 6 PM both point at the 6 (as in the app). */
const angle = (m: number) => (faceDegrees(m) - 90) * Math.PI / 180;
const pt = (m: number, r: number) => [C + r * Math.cos(angle(m)), C + r * Math.sin(angle(m))];
/** the band between two minutes of one half (720 min = a full turn) */
function arcPath(m0: number, m1: number, r0: number, r1: number) {
  const [x0, y0] = pt(m0, r1), [x1, y1] = pt(m1, r1);
  const [x2, y2] = pt(m1, r0), [x3, y3] = pt(m0, r0);
  const large = (m1 - m0) > 360 ? 1 : 0;
  return `M${x0},${y0} A${r1},${r1} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 0 ${x3},${y3} Z`;
}

// ---- the reader's own clock: 12- or 24-hour as their locale has it ------------
const H24 = (() => {
  try { return /^h2[34]$/.test(new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle || ''); }
  catch { return false; }
})();
const pad = (n: number) => String(n).padStart(2, '0');
/** minutes-since-midnight → "6:12 AM" / "06:12" */
function tm(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440, h = Math.floor(m / 60), mm = m % 60;
  return H24 ? `${pad(h)}:${pad(mm)}` : fmt12(`${h}:${pad(mm)}`);
}
/** a window as "3–6 PM" / "9 PM–12 AM" / "15:00–18:00" */
function span(w: { start: number; end: number }): string {
  const a = tm(w.start), b = tm(w.end);
  if (H24) return `${a}–${b}`;
  const [ah, aap] = a.split(' '), [bh, bap] = b.split(' ');
  return aap === bap ? `${ah}–${bh} ${bap}` : `${a}–${b}`;
}
/** the window of a watch on the clock in force: the sun's when solar mode is live, else fixed */
function win(p: number, st = currentPahar()) {
  return st.mode === 'solar' && st.sun ? paharSolarWindow(p, st.sun.sunrise, st.sun.sunset) : paharWindow(p);
}
const windowText = (p: number, st = currentPahar()) => span(win(p, st));
const countOf = (n: number) => `${n} raag${n === 1 ? '' : 's'}`;

async function loadClock(): Promise<any> {
  if (CLOCK) return CLOCK;
  CLOCK = await loadClockShared();
  return CLOCK;
}
function indexClaims() {
  BYRAAG = {};
  for (const c of allClaims()) (BYRAAG[c.raag_name] ||= []).push(c);
}
const allClaims = () => CLOCK
  ? [...CLOCK.claims.primary, ...CLOCK.claims.variant, ...CLOCK.claims.seasonal, ...CLOCK.claims.ceremonial]
  : [];
const variantsOf = (p: number) => (CLOCK.claims.variant || []).filter((c: any) => c.pahar === p);

// =============================================================================
// The dial
// =============================================================================
/** the shape key: the dial is drawn again when the mode, the sun's times, the day or the half changes */
const shapeKey = (st: any, now: Date) =>
  [st.mode, st.sun?.sunrise, st.sun?.sunset, now.toDateString(), halfOf(minutesOf(now)).key].join('|');

// Drawn again only when what it shows changes shape: the mode, the sun's times, the day, and at
// noon and midnight, when the hour hand passes 12 and the ring turns to the other half.
function buildDial() {
  const wrap = $('#clockWrap'); if (!wrap || !CLOCK) return;
  const st = currentPahar(), now = new Date(), half = halfOf(minutesOf(now));
  dialKey = shapeKey(st, now);
  wrap.textContent = '';
  const svg = el('svg', { viewBox: `0 0 ${C * 2} ${C * 2}`, class: 'raagdial', 'data-half': half.key });
  // the group names the half it shows; the watches of the other half are in the list below
  wrap.setAttribute('aria-label', `Raag clock on your own 12-hour clock face, showing ${halfSpoken(half, H24)}: `
    + 'each watch sits where the hour hand points at that time. Each watch shown is a button; all eight are listed below.');

  // 12 hour ticks on the dial's own hours, a longer one every three; the labels name the half on
  // the 12 and its 3 · 6 · 9 beside the face's own numbers
  const ring = el('g', { class: 'hours', 'aria-hidden': 'true' });
  const labels = halfLabels(half, H24);
  for (let h = 0; h < 12; h++) {
    const major = h % 3 === 0;
    const [x1, y1] = pt(h * 60, R_TICK), [x2, y2] = pt(h * 60, R_TICK + (major ? 11 : 6));
    ring.appendChild(el('line', { x1, y1, x2, y2, class: major ? 'tick tick-major' : 'tick' }));
    if (major) {
      // a label sits clear of its tick: beside it at the sides, above or below it at the ends
      const [x, y] = pt(h * 60, R_NUM), top = h === 0;
      const side = x < C - 60 ? 'end' : x > C + 60 ? 'start' : 'middle';
      ring.appendChild(el('text', { x, y: y + (side === 'middle' ? (y < C ? 2 : 17) : 7),
        class: top ? 'hourmark hourmark-half' : 'hourmark', 'text-anchor': side }, labels[h / 3].label));
    }
  }
  svg.appendChild(ring);

  // the watches of this half; one that crosses noon or midnight shows the part on this side
  for (let p = 1; p <= 8; p++) {
    const w = win(p, st), len = ((w.end - w.start) % 1440 + 1440) % 1440;
    const spans = clipToHalf(w, half);
    if (!spans.length) continue;
    const big = spans.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
    const mid = (big.start + big.end) / 2, roomy = big.end - big.start >= 40;
    const primary = raagsForPahar(CLOCK, p), variants = variantsOf(p);
    const g = el('g', { class: 'wedge', 'data-wedge': p });
    const path = el('path', {
      d: spans.map((sp) => arcPath(sp.start, sp.end, R_IN, R_OUT)).join(' '),
      class: p === 7 ? 'arc arc-quiet' : `arc ${p <= 4 ? 'arc-day' : 'arc-night'} arc-p${p}`,
      tabindex: 0, role: 'button', 'data-pahar': p,
    });
    path.setAttribute('aria-label', p === 7
      ? `Pahar 7, ${span(w)}: deliberately no raags — the deep night is left in silence.`
      : `Pahar ${p}, ${paharLabel(p)}, ${span(w)}, ${countOf(primary.length)}: ${primary.map((c: any) => c.roman).join(', ') || 'none'}${variants.length ? `, plus ${variants.length} disputed variant` : ''}. Press Enter for detail.`);
    g.appendChild(path);
    const [nx, ny] = pt(mid, R_IN + 34);
    if (roomy) g.appendChild(el('text', { x: nx, y: ny + 11, class: 'pnum', 'text-anchor': 'middle', 'pointer-events': 'none', 'aria-hidden': 'true' }, String(p)));
    if (p === 7 && roomy) {
      const [sx, sy] = pt(mid, R_OUT - 34);
      g.appendChild(el('text', { x: sx, y: sy + 8, class: 'quiet-star', 'text-anchor': 'middle', 'pointer-events': 'none', 'aria-hidden': 'true' }, '✦'));
    }
    // one bead for each raag, spaced along the WHOLE watch: filled for a primary claim, ringed for
    // a variant; a watch cut at noon or midnight shows the beads that fall on this side
    const beads = [...primary.map(() => 0), ...variants.map(() => 1)].slice(0, 10);
    beads.forEach((v, i) => {
      const bm = w.start + len * (i + 1) / (beads.length + 1);
      if (halfOf(Math.floor(bm)).key !== half.key) return;
      const [bx, by] = pt(bm, R_OUT - 30);
      g.appendChild(el('circle', { cx: bx, cy: by, r: v ? 5 : 5.6, class: v ? 'bead bead-var' : 'bead', 'pointer-events': 'none' }));
    });
    svg.appendChild(g);
  }

  // sunrise and sunset, on the seam between day and night, when the sun's hours are in force (the
  // one in this half)
  if (st.mode === 'solar' && st.sun) {
    ([[st.sun.sunrise, 'Sunrise', 1], [st.sun.sunset, 'Sunset', -1]] as [number, string, number][]).forEach(([m, name, up]) => {
      if (halfOf(m).key !== half.key) return;
      const [x, y] = pt(m, (R_IN + R_OUT) / 2);
      const g = el('g', { class: 'sunmark', 'pointer-events': 'none' });
      g.appendChild(el('title', {}, `${name} ${tm(m)}`));
      g.appendChild(el('circle', { cx: x, cy: y, r: 15, class: 'sun-badge' }));
      g.appendChild(el('path', { d: `M${x - 7},${y + 2} A7,7 0 0 ${up > 0 ? 1 : 0} ${x + 7},${y + 2} Z`, class: 'sun-disc' }));
      g.appendChild(el('line', { x1: x - 10, y1: y + 2, x2: x + 10, y2: y + 2, class: 'sun-line' }));
      svg.appendChild(g);
    });
  }

  // "now" is the hour hand itself: it points into the lit watch, so the ring has no pointer of its own

  svg.appendChild(buildFace(now));

  svg.addEventListener('click', (e: any) => hit(e.target));
  svg.addEventListener('keydown', (e: any) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hit(e.target); }
  });
  svg.addEventListener('focusin', (e: any) => {
    const w = e.target.closest('[data-pahar]'); if (w) selectPahar(+w.dataset.pahar, true);
  });
  wrap.appendChild(svg);
  markNow(st.pahar);
  if (selSeason) markSelected('season', selSeason); else if (selPahar) markSelected('pahar', selPahar);
  positionHands();
}

// The 12-hour face in the hollow: sixty rim ticks with the hours bold, numerals 1–12, the day and
// date, and the hands. Decoration for a screen reader — the time is in words under the dial.
function buildFace(now: Date) {
  const r = R_FACE, g = el('g', { class: 'face', 'aria-hidden': 'true', 'pointer-events': 'none' });
  const at = (a: number, rad: number) => [C + rad * Math.cos(a), C + rad * Math.sin(a)];
  g.appendChild(el('circle', { cx: C, cy: C, r, class: 'face-disc' }));
  for (let i = 0; i < 60; i++) {
    const hour = i % 5 === 0, a = (i / 60) * 2 * Math.PI - Math.PI / 2;
    const [x1, y1] = at(a, r - 4), [x2, y2] = at(a, r - (hour ? 17 : 10));
    g.appendChild(el('line', { x1, y1, x2, y2, class: hour ? 'ftick ftick-hour' : 'ftick' }));
  }
  for (let h = 1; h <= 12; h++) {
    const [x, y] = at((h / 12) * 2 * Math.PI - Math.PI / 2, r * 0.7);
    g.appendChild(el('text', { x, y: y + 12, class: 'fnum', 'text-anchor': 'middle' }, String(h)));
  }
  let weekday = '', day = String(now.getDate());
  try { weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(now).toUpperCase(); } catch {}
  const date = el('text', { x: C + r * 0.4, y: C + 7, class: 'fdate', 'text-anchor': 'middle' });
  date.appendChild(el('tspan', { class: 'fdate-w' }, weekday + ' '));
  date.appendChild(el('tspan', { class: 'fdate-d' }, day));
  g.appendChild(date);
  // a hand is a slim stem from the hub, then a rounded bar, with a halo where it crosses a numeral
  const hand = (id: string, len: number, width: number) => {
    const h = el('g', { id, class: 'hand' }), neck = len * 0.17;
    h.appendChild(el('line', { x1: C, y1: C - neck, x2: C, y2: C - len, class: 'hand-halo', 'stroke-width': width + 5 }));
    h.appendChild(el('line', { x1: C, y1: C, x2: C, y2: C - neck, class: 'hand-stem', 'stroke-width': Math.max(2, width * 0.35) }));
    h.appendChild(el('line', { x1: C, y1: C - neck, x2: C, y2: C - len, class: 'hand-bar', 'stroke-width': width }));
    return h;
  };
  g.appendChild(hand('handHour', r * 0.5, r * 0.06));
  g.appendChild(hand('handMinute', r * 0.84, r * 0.045));
  if (!prefersReducedMotion()) {
    const s = el('g', { id: 'handSecond', class: 'hand' });
    s.appendChild(el('line', { x1: C, y1: C + r * 0.18, x2: C, y2: C - r * 0.9, class: 'hand-second' }));
    g.appendChild(s);
  }
  g.appendChild(el('circle', { cx: C, cy: C, r: 8, class: 'hub' }));
  g.appendChild(el('circle', { cx: C, cy: C, r: 3, class: 'hub-pin' }));
  return g;
}

// The hands, from the clock itself. The second hand sweeps and the others creep with it, as on a
// real movement; with reduced motion there is no second hand and the others step once a minute.
function positionHands() {
  const d = new Date(), smooth = !prefersReducedMotion();
  const s = smooth ? d.getSeconds() + d.getMilliseconds() / 1000 : 0;
  const m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
  const turn = (id: string, deg: number) => document.getElementById(id)?.setAttribute('transform', `rotate(${deg.toFixed(2)} ${C} ${C})`);
  turn('handHour', h * 30); turn('handMinute', m * 6); turn('handSecond', s * 6);
}
let sweeping = false, dialSeen = true, lastFrame = 0;
function sweep(t: number) {
  if (!sweeping) return;
  if (dialSeen && t - lastFrame > 33) { lastFrame = t; positionHands(); }      // at most 30 a second, and only on screen
  requestAnimationFrame(sweep);
}
function startHands() {
  if (prefersReducedMotion() || sweeping) return;
  const wrap = $('#clockWrap');
  if (wrap && 'IntersectionObserver' in window)
    new IntersectionObserver((es) => { dialSeen = es.some((e) => e.isIntersecting); }).observe(wrap);
  sweeping = true; requestAnimationFrame(sweep);
}

function hit(target: any) {
  const w = target.closest('[data-pahar]'); if (w) return selectPahar(+w.dataset.pahar);
}
function markNow(p: number) {
  document.querySelectorAll('.raagdial .wedge').forEach((g: any) => g.classList.toggle('is-now', g.dataset.wedge === String(p)));
  document.querySelectorAll('#watchList .watch').forEach((b: any) => {
    const on = b.dataset.pahar === String(p);
    b.classList.toggle('is-now', on);
    if (on) b.setAttribute('aria-current', 'time'); else b.removeAttribute('aria-current');
  });
}
function markSelected(kind: 'pahar' | 'season', key: string | number) {
  document.querySelectorAll('.raagdial .arc').forEach((a: any) =>
    a.classList.toggle('arc-sel', kind === 'pahar' && a.dataset.pahar === String(key)));
  document.querySelectorAll('#watchList .watch').forEach((b: any) =>
    b.setAttribute('aria-pressed', String(kind === 'pahar' && b.dataset.pahar === String(key))));
  document.querySelectorAll('#seasonList .season').forEach((b: any) =>
    b.setAttribute('aria-pressed', String(kind === 'season' && b.dataset.season === String(key))));
}
function scrollPanelIntoView() {
  try {
    if (matchMedia('(max-width: 860px)').matches)
      $('#clockDetail')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  } catch {}
}

// =============================================================================
// Detail panel
// =============================================================================
const TRAD = (t: string) => t === 'hindustani' ? 'Hindustani' : 'Gurmat Sangeet';
const safeHref = (u: any) => (/^https?:\/\//i.test(u || '') ? esc(u) : '');   // never javascript: etc.
function whenText(c: any): string {
  if (c.pahar) return esc(`${paharLabel(c.pahar)} · ${windowText(c.pahar)}`);
  if (c.time_start) return esc(`${fmt12(c.time_start)}–${fmt12(c.time_end)}`) + (c.occasion ? ` · ${esc(c.occasion)}` : '');
  if (c.season) return `${esc(c.season)} · any time`;
  if (c.occasion) return esc(c.occasion);
  return '';
}
function raagCard(c: any, isVariant: boolean): string {
  const others = (BYRAAG[c.raag_name] || []).filter((x: any) =>
    x !== c && (x.claim_type === 'seasonal' || x.claim_type === 'ceremonial'));
  const occ = others.map((x: any) => `<span class="occhip">${esc(x.season || x.occasion || '')}</span>`).join('');
  return `<div class="raagcard${isVariant ? ' is-variant' : ''}">
    <div class="rc-top">
      <div class="rc-name"><span class="gm" lang="pa">${esc(c.raag_name)}</span><span class="rc-roman">${esc(c.roman || '')}</span></div>
      <button class="rc-read" type="button" data-go-ang="${c.first_ang || 1}" data-go-raag="${esc(c.raag_name)}" aria-label="Read raag ${esc(c.roman)} from Ang ${c.first_ang || 1}">Ang ${c.first_ang || 1} ›</button>
    </div>
    <div class="rc-meta">
      <span class="cbadge cb-${esc(c.claim_type)}">${esc(c.claim_type)}</span>
      <span class="conf conf-${esc(c.confidence)}">${esc(c.confidence)}</span>
      <span class="tbadge tb-${esc(c.tradition)}">${esc(TRAD(c.tradition))}</span>
    </div>
    <div class="rc-src">${safeHref(c.source_url) ? `<a href="${safeHref(c.source_url)}" target="_blank" rel="noopener">${esc(c.source_name)}</a>` : esc(c.source_name)}</div>
    ${c.notes ? `<div class="rc-note">${esc(c.notes)}</div>` : ''}
    ${occ ? `<div class="rc-occ"><span class="rc-occ-l">also sung for</span> ${occ}</div>` : ''}
  </div>`;
}
function detailPahar(p: number): string {
  if (p === 7) {
    return `<div class="det-quiet">
      <div class="det-quiet-star">✦</div>
      <div class="det-badge pbadge-night">P7</div>
      <h3>The quiet hours</h3>
      <div class="det-sub">${esc(windowText(7))} · 3rd pahar of night</div>
      <p>No raag of the Granth is assigned to this watch. The deep night is left in silence —
      this absence is deliberate and canonical, so the empty arc is itself part of the tradition,
      not missing data.</p></div>`;
  }
  const primary = raagsForPahar(CLOCK, p);
  const variants = variantsOf(p);
  const dn = p <= 4 ? 'day' : 'night';
  const cards = [...primary.map((c: any) => raagCard(c, false)), ...variants.map((c: any) => raagCard(c, true))].join('');
  return `<div class="det-head">
      <div class="det-badge pbadge-${dn}">P${p}</div>
      <div><div class="det-title">${paharLabel(p)}</div>
      <div class="det-sub">${esc(windowText(p))} · ${countOf(primary.length)}${variants.length ? ` · ${variants.length} variant` : ''}</div></div>
    </div>
    <div class="det-cards">${cards || '<div class="hint">No raags in this pahar.</div>'}</div>`;
}
function selectPahar(p: number, soft = false) {
  selPahar = p; selSeason = '';
  markSelected('pahar', p);
  const d = $('#clockDetail'); if (d) d.innerHTML = detailPahar(p);
  if (!soft) scrollPanelIntoView();
}
function selectSeason(raagName: string, soft = false) {
  const claims = (BYRAAG[raagName] || []);
  const seasonal = claims.find((c: any) => c.claim_type === 'seasonal') || claims[0];
  const d = $('#clockDetail'); if (!d || !seasonal) return;
  selSeason = raagName; selPahar = 0;
  markSelected('season', raagName);
  d.innerHTML = `<div class="det-head">
      <div class="det-badge pbadge-season">✿</div>
      <div><div class="det-title gm" lang="pa">${esc(raagName)}</div>
      <div class="det-sub">${esc(seasonal.roman || '')} · seasonal raag</div></div>
    </div>
    <div class="det-cards">${raagCard(seasonal, false)}</div>
    <p class="det-foot">Seasonal raags are sung at <b>any time of day</b> while their season lasts.</p>`;
  if (!soft) scrollPanelIntoView();
}

// =============================================================================
// The eight watches, and the raags of a season — the same content as the dial, as lists
// =============================================================================
function renderWatches(st = currentPahar()) {
  const box = $('#watchList'); if (!box || !CLOCK) return;
  let h = '';
  for (let p = 1; p <= 8; p++) {
    const n = raagsForPahar(CLOCK, p).length;
    h += `<button type="button" class="watch" data-pahar="${p}" aria-pressed="false">
      <span class="watch-p ${p <= 4 ? 'pbadge-day' : 'pbadge-night'}">P${p}</span>
      <span class="watch-main"><span class="watch-l">${paharLabel(p)}</span><span class="watch-w">${esc(windowText(p, st))}</span></span>
      <span class="watch-n">${n ? countOf(n) : (p === 7 ? 'silent' : '—')}</span>
    </button>`;
  }
  box.innerHTML = h;
  markNow(st.pahar);
  if (selPahar) markSelected('pahar', selPahar);
}
const seasonNow = () => {
  const month = new Date().getMonth() + 1;
  return (month === 3 || month === 4) ? 'ਬਸੰਤੁ' : (month === 7 || month === 8) ? 'ਮਲਾਰ' : null;
};
function renderSeasons() {
  const box = $('#seasonList'), sec = $('#seasonSec'); if (!box || !sec || !CLOCK) return;
  const seen = new Set<string>();
  const rows = (CLOCK.claims.seasonal || []).filter((c: any) => !seen.has(c.raag_name) && seen.add(c.raag_name));
  if (!rows.length) { (sec as HTMLElement).hidden = true; return; }
  const live = seasonNow();
  box.innerHTML = rows.map((c: any) => `<button type="button" class="season" data-season="${esc(c.raag_name)}" aria-pressed="false">
      <span class="gm" lang="pa">${esc(c.raag_name)}</span>
      <span class="season-main"><span class="season-r">${esc(c.roman || '')}</span><span class="season-s">${esc(c.season || 'seasonal')} · any time</span></span>
      ${c.raag_name === live ? '<span class="season-now">in season now</span>' : ''}
    </button>`).join('');
}

// =============================================================================
// "What raag is it now?"
// =============================================================================
let nowHTML = '';
function renderNow() {
  const body = $('#nowBody'); if (!body || !CLOCK) return;
  const st = currentPahar(), now = new Date();
  const m = minutesOf(now);
  const raags = raagsForPahar(CLOCK, st.pahar);
  const nb = nextPaharBoundary(m, st.mode, st.sun?.sunrise, st.sun?.sunset);
  const hrs = Math.floor(nb.minutes / 60), mins = nb.minutes % 60;
  const inWait = (hrs ? `${hrs} h ` : '') + `${mins} min`;
  const nextRaags = raagsForPahar(CLOCK, nb.nextPahar);
  const season = seasonNow();

  const html = `
    <div class="now-pahar"><b>${paharLabel(st.pahar)}</b>
      <span class="now-range">${esc(windowText(st.pahar, st))}${st.mode === 'solar' && st.sun
        ? ` · sunrise ${esc(tm(st.sun.sunrise))} · sunset ${esc(tm(st.sun.sunset))}` : ''}</span></div>
    ${st.pahar === 7
      ? `<p class="quiet-note">✦ The quiet hours — no raag is assigned to the 3rd pahar of night. This silence is deliberate and canonical.</p>`
      : `<div class="now-raags">${raags.map((c: any) =>
          `<button type="button" class="now-chip gm" lang="pa" data-go-ang="${c.first_ang || 1}" data-go-raag="${esc(c.raag_name)}"
             aria-label="Read raag ${esc(c.roman)} from Ang ${c.first_ang || 1}">${esc(c.raag_name)}<span class="tr">${esc(c.roman)} · Ang ${c.first_ang || 1}</span></button>`).join('')}
        ${season ? `<button type="button" class="now-chip gm season" lang="pa" data-go-ang="${
            (CLOCK.claims.seasonal.find((c: any) => c.raag_name === season) || {}).first_ang || 1
          }" data-go-raag="${esc(season)}" aria-label="Seasonal raag, any time of day right now">${esc(season)}<span class="tr">in season · any time</span></button>` : ''}</div>`}
`;
  // the region is announced when it changes: once a watch. The countdown, which changes every
  // minute, sits outside it.
  if (html !== nowHTML) { nowHTML = html; body.innerHTML = html; }
  const nx = $('#nowNext');
  if (nx) nx.innerHTML = `next: <b>${paharLabel(nb.nextPahar)}</b> in ${inWait}${
    nextRaags.length ? ` — ${nextRaags.map((c: any) => esc(c.roman)).join(', ')}` : ' — the quiet hours'}`;

  // the time in words, under the dial
  const ro = $('#clockReadout');
  if (ro) {
    let t = tm(m);
    try { t = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(now); } catch {}
    ro.innerHTML = `<b class="cr-time">${esc(t)}</b><span class="cr-dot" aria-hidden="true">·</span><span class="cr-p">${paharLabel(st.pahar)}</span>`;
  }

  // the dial is drawn again only when its shape changed (mode, the sun's hours, a new day, the half)
  const key = shapeKey(st, now);
  if (key !== dialKey) {
    buildDial(); renderWatches(st);
    if (selPahar) { const d = $('#clockDetail'); if (d) d.innerHTML = detailPahar(selPahar); }
    renderExp();
  } else { markNow(st.pahar); positionHands(); }
}

// ---- solar mode: the sun's own watches need a place, asked for only by a button ----------------
// The place is rounded to two decimals (about 1 km) before it is kept, in this browser only.
const keepLoc = (lat: number, lon: number) => store.set('pahar_loc', JSON.stringify({ lat: +lat.toFixed(2), lon: +lon.toFixed(2) }));
function renderSolar() {
  const box = $('#solarBox') as HTMLElement | null; if (!box) return;
  const st = currentPahar(), loc = getLoc();
  if (getMode() !== 'solar') { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  if (loc) {
    box.innerHTML = `<p class="solar-note">${st.mode === 'solar'
        ? 'Solar watches from your stored location (rounded to about 1 km; it never leaves this device).'
        : esc(st.note || 'Showing the fixed clock.')}</p>
      <button type="button" class="solar-link" data-solar="forget">Forget location</button>`;
    return;
  }
  box.innerHTML = `<p class="solar-ask">Sun-accurate watches need your location once. It is rounded to about 1 km, stored in this browser, and never sent.</p>
    <div class="solar-btns">
      <button type="button" class="solar-go" data-solar="locate">Use my location</button>
      <button type="button" class="solar-alt" data-solar="manual" aria-expanded="false" aria-controls="solarForm">Enter manually</button>
    </div>
    <form id="solarForm" class="solar-form" hidden novalidate>
      <label>Latitude <input id="solarLat" inputmode="decimal" autocomplete="off" placeholder="e.g. 31.63" /></label>
      <label>Longitude <input id="solarLon" inputmode="decimal" autocomplete="off" placeholder="e.g. 74.87" /></label>
      <button type="submit" class="solar-alt">Use these coordinates</button>
      <p id="solarErr" class="solar-err" role="alert" hidden>Latitude must be −90…90 and longitude −180…180.</p>
    </form>
    <p class="solar-note">Until then: showing the fixed clock (pahar 1 at 6 AM).</p>`;
}
function refreshAll() { reflectMode(); renderSolar(); renderNow(); }
function reflectMode() {
  $('#modeTgl')?.querySelectorAll('button').forEach((b: any) => b.setAttribute('aria-checked', String(b.dataset.mode === getMode())));
}
function initSolar() {
  const tgl = $('#modeTgl');
  tgl?.addEventListener('click', (e: any) => {
    const b = e.target.closest('button'); if (!b) return;
    store.set('pahar_mode', b.dataset.mode as Mode); refreshAll();
  });
  const box = $('#solarBox');
  box?.addEventListener('click', (e: any) => {
    const b = e.target.closest('[data-solar]'); if (!b) return;
    if (b.dataset.solar === 'forget') { try { localStorage.removeItem('pahar_loc'); } catch {} refreshAll(); toast('Location removed from this browser.'); }
    else if (b.dataset.solar === 'manual') {
      const f = $('#solarForm') as HTMLElement | null; if (!f) return;
      f.hidden = !f.hidden; b.setAttribute('aria-expanded', String(!f.hidden));
      if (!f.hidden) ($('#solarLat') as HTMLElement | null)?.focus();
    } else if (b.dataset.solar === 'locate') {
      if (!('geolocation' in navigator)) { toast('Location is not available in this browser — enter coordinates manually.'); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => { keepLoc(pos.coords.latitude, pos.coords.longitude); refreshAll(); },
        () => { toast('Location was not shared — enter coordinates manually, or stay on the fixed clock.'); },
        { maximumAge: 86400000, timeout: 8000 });
    }
  });
  box?.addEventListener('submit', (e: any) => {
    e.preventDefault();
    const num = (id: string) => { const v = ($(id) as HTMLInputElement).value.trim(); return /^-?\d+(\.\d+)?$/.test(v) ? +v : NaN; };
    const lat = num('#solarLat'), lon = num('#solarLon');
    const ok = Math.abs(lat) <= 90 && Math.abs(lon) <= 180;                 // NaN fails both
    const err = $('#solarErr') as HTMLElement | null; if (err) err.hidden = ok;
    if (ok) { keepLoc(lat, lon); refreshAll(); }
  });
  reflectMode(); renderSolar();
}

// =============================================================================
// Claims explorer (searchable, filterable, with a 24h timeline per raag)
// =============================================================================
const CLAIM_ORDER: any = { primary: 0, variant: 1, seasonal: 2, ceremonial: 3 };
const FILTERS = { type: 'all', disputedOnly: false, q: '' };

function activeCells(c: any): number[] | 'all' {
  if (c.claim_type === 'seasonal') return 'all';
  if (c.pahar) return [c.pahar];
  if (c.time_start) { const [h, mm] = c.time_start.split(':').map(Number); return [paharFromMinutes(h * 60 + mm)]; }
  return [];
}
function timeline(c: any): string {
  const act = activeCells(c);
  let cells = '';
  for (let p = 1; p <= 8; p++) {
    const on = act === 'all' || (Array.isArray(act) && act.includes(p));
    const kind = act === 'all' ? 'season' : (p <= 4 ? 'day' : 'night');
    cells += `<span class="tl-cell${on ? ' on tl-' + kind : ''}"></span>`;
  }
  return `<div class="tl" aria-hidden="true">${cells}</div>`;
}
function rowHTML(c: any): string {
  return `<tr class="exp-row${c.confidence === 'disputed' ? ' is-disp' : ''}">
    <td class="c-raag" data-l="Raag"><span class="gm" lang="pa">${esc(c.raag_name)}</span><span class="c-roman">${esc(c.roman || '')}</span></td>
    <td class="c-when" data-l="When"><b>${whenText(c)}</b>${c.notes ? `<div class="c-note">${esc(c.notes)}</div>` : ''}</td>
    <td class="c-tl" data-l="Across the day">${timeline(c)}</td>
    <td class="c-claim" data-l="Claim"><span class="cbadge cb-${esc(c.claim_type)}">${esc(c.claim_type)}</span><span class="conf conf-${esc(c.confidence)}">${esc(c.confidence)}</span></td>
    <td class="c-src" data-l="Source"><span class="tbadge tb-${esc(c.tradition)}">${esc(TRAD(c.tradition))}</span><div class="c-srcname">${safeHref(c.source_url) ? `<a href="${safeHref(c.source_url)}" target="_blank" rel="noopener">${esc(c.source_name)}</a>` : esc(c.source_name)}</div></td>
  </tr>`;
}
function renderExp() {
  const body = $('#expBody'); if (!body) return;
  const rows = allClaims().filter((c: any) => {
    if (FILTERS.type !== 'all' && c.claim_type !== FILTERS.type) return false;
    if (FILTERS.disputedOnly && c.confidence !== 'disputed') return false;
    if (FILTERS.q) {
      const hay = `${c.raag_name} ${c.roman} ${c.source_name} ${c.occasion || ''} ${c.season || ''} ${c.notes || ''}`.toLowerCase();
      if (!hay.includes(FILTERS.q)) return false;
    }
    return true;
  }).sort((a: any, b: any) => (a.seq - b.seq) || (CLAIM_ORDER[a.claim_type] - CLAIM_ORDER[b.claim_type]) || ((a.pahar || 0) - (b.pahar || 0)));
  if (!rows.length) { body.innerHTML = '<div class="exp-empty">No claims match your filters.</div>'; return; }
  body.innerHTML = `<div class="exp-count">${rows.length} claim${rows.length !== 1 ? 's' : ''}</div>
    <div class="exp-scroll"><table class="exp-table">
      <thead><tr><th scope="col">Raag</th><th scope="col">When</th>
        <th scope="col" class="tl-h">6a · noon · 6p · 12a</th><th scope="col">Claim</th><th scope="col">Source</th></tr></thead>
      <tbody>${rows.map(rowHTML).join('')}</tbody></table></div>`;
}
function buildExplorer() {
  const box = $('#claimsExplorer'); if (!box || !CLOCK) return;
  const types = ['all', 'primary', 'variant', 'seasonal', 'ceremonial'];
  box.innerHTML = `
    <div class="exp-tools">
      <input id="expSearch" class="exp-search" type="search" placeholder="Search raag, source, occasion…" aria-label="Search timing claims" />
      <div class="exp-chips" role="group" aria-label="Filter by claim type">
        ${types.map(t => `<button type="button" class="chip${t === 'all' ? ' on' : ''}" data-type="${t}" aria-pressed="${t === 'all'}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
        <button type="button" class="chip chip-disp" id="dispChip" data-disp aria-pressed="false">Disputed only</button>
      </div>
    </div>
    <div id="expBody"></div>`;
  const search = $('#expSearch') as HTMLInputElement;
  search.addEventListener('input', () => { FILTERS.q = search.value.trim().toLowerCase(); renderExp(); });
  box.querySelectorAll('.exp-chips .chip[data-type]').forEach((c: any) => c.addEventListener('click', () => {
    FILTERS.type = c.dataset.type;
    box.querySelectorAll('.exp-chips .chip[data-type]').forEach((x: any) => {
      const on = x === c; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on));
    });
    renderExp();
  }));
  $('#dispChip')?.addEventListener('click', () => {
    FILTERS.disputedOnly = !FILTERS.disputedOnly;
    $('#dispChip')?.classList.toggle('on', FILTERS.disputedOnly);
    $('#dispChip')?.setAttribute('aria-pressed', String(FILTERS.disputedOnly));
    renderExp();
  });
  renderExp();
}

// =============================================================================
// boot
// =============================================================================
guard(async () => {
  const d = await loadClock();
  if (!d.available) {
    ($('#nowBody') as HTMLElement).innerHTML = '<div class="hint">The timing knowledge layer is not present in this database build.</div>';
    ($('#clockDetail') as HTMLElement).innerHTML = '';
    return;
  }
  indexClaims();
  buildDial();
  renderWatches();
  renderSeasons();
  buildExplorer();
  initSolar();
  renderNow();
  startHands();
  // on the minute, so the words change with the hands
  setTimeout(() => { renderNow(); setInterval(renderNow, 60000); }, 60000 - (Date.now() % 60000) + 50);
  $('#watchList')?.addEventListener('click', (e: any) => { const w = e.target.closest('[data-pahar]'); if (w) selectPahar(+w.dataset.pahar); });
  $('#seasonList')?.addEventListener('click', (e: any) => { const b = e.target.closest('[data-season]'); if (b) selectSeason(b.dataset.season); });
  window.addEventListener('storage', (e) => { if (e.key === 'pahar_mode' || e.key === 'pahar_loc') refreshAll(); });
  // a page restored from the back/forward cache, or a tab brought back to the front, has a timer
  // that was frozen or throttled: show the current pahar at once rather than up to a minute late
  window.addEventListener('pageshow', (e) => { if (e.persisted) renderNow(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) renderNow(); });

  // deep link: /raag-clock?raag=<roman|gurmukhi> opens that raag's pahar
  const q = new URLSearchParams(location.search).get('raag');
  const hitClaim = q && [...d.claims.primary, ...d.claims.variant, ...d.claims.seasonal]
    .find((c: any) => c.raag_name === q || c.roman === q.toLowerCase());
  if (hitClaim && hitClaim.pahar) selectPahar(hitClaim.pahar);
  else if (hitClaim && hitClaim.claim_type === 'seasonal') selectSeason(hitClaim.raag_name);
  else selectPahar(currentPahar().pahar, true);      // default: the current pahar
}, () => {
  const nb = $('#nowBody'); if (nb) nb.innerHTML = failHTML('The Raag Clock');
  const cd = $('#clockDetail'); if (cd) cd.innerHTML = '';
})();
