// nitnem.ts — the Nitnem / Gutka page (/nitnem): the bani registry from /api/banis and a
// paper reader over /api/bani/{key}. Every Sri Guru Granth Sahib Ji line is served verbatim
// from the corpus and cited by Ang (tapping it opens the Reader at that line); lines from
// the separate non-SGGS layer (Sri Dasam Granth / Ardaas) carry their source label and are
// never cited as an Ang. Reading position per bani lives in localStorage (this browser only).
// All scripture/API text goes through esc() before innerHTML; the `.gm` class lets saroop.ts
// paint the traditional rendering (display only).
import { $, esc, guard, api, store, goReader, applyPrefs, toast, stepFontSize } from './core';
import { overlayOpened, overlayClosed } from './overlay';

const CATEGORY_TITLE: Record<string, string> = {
  nitnem_morning: 'Morning', nitnem_evening: 'Evening', nitnem_night: 'Night',
  popular: 'Popular', ceremony: 'Ceremony',
};
const EXTRA_NOTE = 'Sri Dasam Granth / Ardaas text via ShabadOS — a separate layer, not part of Sri Guru Granth Sahib Ji.';

let BANIS: any[] = [];
let current: { key: string; variant: string } | null = null;
let saveTimer: number | undefined;

const prefs = {
  get rehras(): string { return store.get('sggs_rehras_variant') || 'sgpc'; },
  set rehras(v: string) { store.set('sggs_rehras_variant', v); },
  pos(id: string): number { return parseInt(store.get('sggs_bani_pos_' + id) || '0', 10) || 0; },
  setPos(id: string, seq: number) { store.set('sggs_bani_pos_' + id, String(seq)); },
};

function baniId(b: any) { return b.variant ? `${b.key}/${b.variant}` : b.key; }
function visible(banis: any[]) {
  return banis.filter((b) => (b.key === 'rehras' ? b.variant === prefs.rehras : b.is_default));
}

// ---- the day, as the app has it: four bands from 3 AM, and the set each one brings forward ----
type Band = { id: string; title: string; caption: string; focus: string; order: string[]; from: number; to: number };
const BANDS: Band[] = [
  { id: 'amrit', title: 'Amrit Vela', caption: 'The five morning banis.', focus: 'nitnem_morning', order: ['nitnem_morning', 'nitnem_evening', 'nitnem_night'], from: 180, to: 540 },
  { id: 'day', title: 'Morning banis', caption: 'The five morning banis, whenever the day allows.', focus: 'nitnem_morning', order: ['nitnem_morning', 'nitnem_evening', 'nitnem_night'], from: 540, to: 1020 },
  { id: 'evening', title: 'Evening', caption: 'Rehras Sahib, as the day closes.', focus: 'nitnem_evening', order: ['nitnem_evening', 'nitnem_night', 'nitnem_morning'], from: 1020, to: 1260 },
  { id: 'night', title: 'Night', caption: 'Kirtan Sohila before rest.', focus: 'nitnem_night', order: ['nitnem_night', 'nitnem_morning', 'nitnem_evening'], from: 1260, to: 1620 },
];
const sinceThree = (d: Date) => ((d.getHours() * 60 + d.getMinutes() - 180) % 1440 + 1440) % 1440;
const bandAt = (d: Date) => { const m = sinceThree(d) + 180; return BANDS.find((b) => m >= b.from && m < b.to) || BANDS[3]; };
const fraction = (b: any) => { const pos = prefs.pos(baniId(b)); return pos > 1 && b.n_lines ? Math.min(1, pos / b.n_lines) : 0; };
const shortTitle = (b: any) => String(b.title_en || '').replace(/ Sahib$/, '');

// The day as a half-arc: 3 AM at the left, over the top, to 3 AM again at the right. The band it
// is now is drawn in the accent; a dot marks the moment. One image, described in words.
function dayArc(now: Date, band: Band): string {
  const W = 320, H = 150, cx = W / 2, cy = H - 14, r = 130;
  const at = (f: number) => { const a = Math.PI * (1 - f); return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
  const seg = (f0: number, f1: number) => { const [x0, y0] = at(f0), [x1, y1] = at(f1); return `M${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)}`; };
  const gap = 0.006;
  const arcs = BANDS.map((b) => `<path class="da-seg${b.id === band.id ? ' on' : ''}" d="${seg((b.from - 180) / 1440 + gap, (b.to - 180) / 1440 - gap)}"/>`).join('');
  const [mx, my] = at(sinceThree(now) / 1440);
  return `<svg class="dayarc" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(band.title)}: the day from 3 AM to 3 AM, with now marked">
    ${arcs}<circle class="da-halo" cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="11"/><circle class="da-now" cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="6"/>
    <text class="da-t" x="${cx - r}" y="${H - 1}" text-anchor="middle">3 AM</text><text class="da-t" x="${cx}" y="${cy - r + 24}" text-anchor="middle">3 PM</text><text class="da-t" x="${cx + r}" y="${H - 1}" text-anchor="middle">3 AM</text>
  </svg>`;
}
// a thin ring: how far through the bani this browser's place is
function ring(f: number, size = 44): string {
  const r = 18, c = 2 * Math.PI * r;
  return `<svg class="pring" width="${size}" height="${size}" viewBox="0 0 44 44" aria-hidden="true">
    <circle class="pring-bg" cx="22" cy="22" r="${r}"/>${f > 0 ? `<circle class="pring-fg" cx="22" cy="22" r="${r}" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 22 22)"/>` : ''}</svg>`;
}

// ---- list ---------------------------------------------------------------------------
const renderList = () => {
  const rows = visible(BANIS), now = new Date(), band = bandAt(now);
  const focus = rows.filter((b) => b.category === band.focus);
  const next = focus.find((b) => fraction(b) > 0) || focus[0];
  let date = '';
  try { date = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(now); } catch {}
  // the hero: what to read now, and how far along the day is. The clock only ORDERS the list.
  let h = `<div class="nit-side"><div class="nit-hero nit-${band.id}">
      <div class="nit-eyebrow">${esc(date)}</div>
      <h2 class="nit-band">${esc(band.title)}</h2>
      <p class="nit-cap">${esc(band.caption)}</p>
      ${dayArc(now, band)}
      ${focus.length ? `<div class="nit-rings">${focus.map((b) => `<div class="nit-ring" title="${esc(b.title_en)}">${ring(fraction(b))}<span>${esc(shortTitle(b))}</span></div>`).join('')}</div>` : ''}
      ${next ? `<button type="button" class="nit-go" data-open="${esc(next.key)}">${fraction(next) > 0 ? 'Continue' : 'Read'} ${esc(next.title_en)}</button>` : ''}
    </div>
    <button type="button" class="nit-card" data-random>
      <span class="nit-card-i" aria-hidden="true">✦</span>
      <span class="nit-card-m"><b>Hukam</b><span>A complete composition, read verbatim</span></span>
      <span class="nit-card-c" aria-hidden="true">›</span>
    </button></div><div class="nit-main">`;
  for (const c of [...band.order, 'popular', 'ceremony']) {
    const list = rows.filter((b) => b.category === c);
    if (!list.length) continue;
    h += `<h2 class="sect">${esc(CATEGORY_TITLE[c] || c)}</h2><div class="bani-rows">`;
    h += list.map((b) => {
      const f = fraction(b), pct = Math.round(f * 100);
      const meta = [b.estimated_minutes ? `about ${b.estimated_minutes} min` : '', pct ? `${pct}% read` : '',
                    b.has_extra ? 'includes Sri Dasam Granth text' : ''].filter(Boolean).join(' · ');
      return `<button type="button" class="bani-row bani-tile" data-key="${esc(b.key)}"
          aria-label="${esc(b.title_en)}${pct ? `, ${pct} percent read` : ''}">
        ${ring(f)}
        <span class="bani-main"><span class="bani-en">${esc(b.title_en)}</span><span class="bani-gm gm" lang="pa">${esc(b.title_gm)}</span>
          <span class="bani-meta">${esc(meta)}</span></span>
        <span class="bani-chev" aria-hidden="true">›</span></button>`;
    }).join('');
    h += '</div>';
  }
  h += `<p class="hint nit-foot"><label>Rehras Sahib version:
    <select id="rehrasSel">
      <option value="sgpc" ${prefs.rehras === 'sgpc' ? 'selected' : ''}>SGPC (standard)</option>
      <option value="taksal" ${prefs.rehras === 'taksal' ? 'selected' : ''}>Damdami Taksal</option>
    </select></label></p>
    <p class="hint nit-foot">Sri Guru Granth Sahib Ji lines are shown verbatim from the verified corpus and cited by Ang. Non-SGGS text is a separate, labelled layer.</p></div>`;
  ($('#nitnemList') as HTMLElement).innerHTML = h;
  ($('#rehrasSel') as HTMLSelectElement | null)?.addEventListener('change', (e) => {
    prefs.rehras = (e.target as HTMLSelectElement).value; renderList();
  });
  document.querySelectorAll('#nitnemList .bani-tile, #nitnemList [data-open]').forEach((t) => {
    t.addEventListener('click', () => openBani((t as HTMLElement).dataset.key || (t as HTMLElement).dataset.open || ''));
  });
};

// ---- reader -------------------------------------------------------------------------
const openBani = guard(async (key: string, variant?: string) => {
  const v = variant ?? (key === 'rehras' ? prefs.rehras : '');
  const d = await api('bani/' + encodeURIComponent(key) + (v ? '?variant=' + encodeURIComponent(v) : ''));
  if (!d || !d.available) { toast('This bani is not available'); return; }
  current = { key, variant: d.bani.variant || '' };
  const id = baniId(d.bani);
  const range = d.ang_first != null
    ? (d.ang_first === d.ang_last ? `Sri Guru Granth Sahib Ji · Ang ${d.ang_first}` : `Sri Guru Granth Sahib Ji · Ang ${d.ang_first}–${d.ang_last}`)
    : (d.bani.has_extra ? 'Sri Dasam Granth · separate layer' : '');
  ($('#baniHead') as HTMLElement).innerHTML = `<div class="rn gm" lang="pa">${esc(d.bani.title_gm)}</div>
    <div class="rr">${esc(d.bani.title_en)}${range ? ' · ' + esc(range) : ''}${d.bani.estimated_minutes ? ` · about ${d.bani.estimated_minutes} min` : ''}</div>
    ${d.bani.has_extra ? `<div class="rr">${esc(EXTRA_NOTE)}</div>` : ''}`;
  const vs = (d.variants || []).filter((x: string) => x);
  ($('#nitnemVariants') as HTMLElement).innerHTML = vs.length > 1
    ? vs.map((x: string) => `<button type="button" class="vbtn" data-v="${esc(x)}" ${x === current!.variant ? 'disabled' : ''}>${esc(x === 'sgpc' ? 'SGPC' : x === 'taksal' ? 'Taksal' : x)}</button>`).join(' ')
    : '';
  document.querySelectorAll('#nitnemVariants .vbtn').forEach((b) =>
    b.addEventListener('click', () => { const nv = (b as HTMLElement).dataset.v || ''; if (key === 'rehras') prefs.rehras = nv; openBani(key, nv); }));

  let h = '';
  let group = 0;
  for (const l of d.lines) {
    if (l.line_group !== group) {
      if (group) h += '</div>';
      group = l.line_group;
      h += `<div class="shabad" data-group="${group}">`;
    }
    const isHeader = !!l.is_header && (l.gurmukhi.split(' ').length <= 6 || !l.gurmukhi.endsWith('॥'));
    if (isHeader) {
      h += `<div class="hdr gm" lang="pa"><div class="${l.gurmukhi.startsWith('ੴ') ? 'invoc' : ''}">${esc(l.gurmukhi)}</div>
        <div class="t">${esc(l.translit)}</div></div>`;
      continue;
    }
    if (l.source === 'sggs') {
      h += `<div class="sline tap ${l.is_rahao ? 'rahao' : ''}" data-seq="${l.seq}" data-ang="${l.ang}" data-line-id="${l.id}" data-comp="${l.comp_id}"
          title="Open Ang ${l.ang} in the Reader">
        <div class="g gm" lang="pa">${esc(l.gurmukhi)}</div><div class="t">${esc(l.translit)}</div>
        ${l.en ? `<div class="en" lang="en">${esc(l.en)}</div>` : ''}
        <div class="cite">Sri Guru Granth Sahib Ji · Ang ${l.ang}</div></div>`;
    } else {
      const src = l.source === 'dasam' ? (l.panna != null ? `Sri Dasam Granth · Panna ${l.panna}` : 'Sri Dasam Granth') : 'Ardaas';
      h += `<div class="sline extra" data-seq="${l.seq}">
        <div class="g gm" lang="pa">${esc(l.gurmukhi)}</div><div class="t">${esc(l.translit)}</div>
        <div class="cite">${esc(src)} · separate layer</div></div>`;
    }
  }
  if (group) h += '</div>';
  h += `<div class="endnav"><button type="button" id="baniTop">Top</button><button type="button" id="baniDone">Mark as read · start again</button></div>`;
  ($('#baniOut') as HTMLElement).innerHTML = h;
  ($('#nitnemList') as HTMLElement).hidden = true;
  ($('#nitnemReader') as HTMLElement).hidden = false;
  applyPrefs();
  document.querySelectorAll('#baniOut .sline.tap').forEach((el) => {
    el.addEventListener('click', () => {
      const e = el as HTMLElement;
      goReader(parseInt(e.dataset.ang || '1', 10), undefined, { line: parseInt(e.dataset.lineId || '0', 10), comp: parseInt(e.dataset.comp || '0', 10) });
    });
  });
  ($('#baniTop') as HTMLElement).addEventListener('click', () => window.scrollTo({ top: 0 }));
  ($('#baniDone') as HTMLElement).addEventListener('click', () => { prefs.setPos(id, 0); toast('Marked as read'); window.scrollTo({ top: 0 }); });
  // resume: the saved line returns to the anchor it was saved at (just above it, so the line
  // before stays clear of the anchor and the next save reads this same line)
  const saved = prefs.pos(id);
  const target = saved > 1 ? document.querySelector(`#baniOut [data-seq="${saved}"]`) : null;
  if (target) window.scrollTo({ top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - anchorY() + 2), behavior: 'instant' });
  else window.scrollTo({ top: 0 });
  try { history.replaceState(null, '', `/nitnem?bani=${encodeURIComponent(key)}${current.variant ? '&variant=' + encodeURIComponent(current.variant) : ''}`); } catch { /* ignore */ }
});

// One anchor for saving and resuming a place: just below the sticky toolbar. Saving reads the
// first line under it and resuming puts that line back there, so reopening lands on the same line.
function anchorY(): number {
  const tb = document.querySelector('#nitnemReader .toolbar') as HTMLElement | null;
  if (!tb) return 120;
  const stuck = parseFloat(getComputedStyle(tb).top);
  return (Number.isFinite(stuck) ? stuck : 0) + tb.offsetHeight + 8;
}

// position tracking: the first line under the anchor becomes the saved position
function trackPosition() {
  if (!current) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const lines = Array.from(document.querySelectorAll('#baniOut [data-seq]')) as HTMLElement[];
    const top = anchorY();
    const first = lines.find((el) => el.getBoundingClientRect().bottom > top);
    const b = BANIS.find((x) => x.key === current!.key && (x.variant || '') === current!.variant);
    if (first && b) prefs.setPos(baniId(b), parseInt(first.dataset.seq || '0', 10));
  }, 500);
}

function backToList() {
  current = null;
  ($('#nitnemReader') as HTMLElement).hidden = true;
  ($('#nitnemList') as HTMLElement).hidden = false;
  renderList();
  try { history.replaceState(null, '', '/nitnem'); } catch { /* ignore */ }
  window.scrollTo({ top: 0 });
}

// ---- boot ---------------------------------------------------------------------------
const boot = guard(async () => {
  const d = await api('banis');
  if (!d || !d.available) {
    ($('#nitnemList') as HTMLElement).innerHTML = '<div class="hint">The Nitnem registry is not in this database build.</div>';
    return;
  }
  BANIS = d.banis;
  renderList();
  const q = new URLSearchParams(location.search);
  const key = q.get('bani');
  if (key && /^[a-z0-9_]{1,32}$/.test(key)) openBani(key, q.get('variant') || undefined);
});
boot();
// the list follows the clock: come back to the tab in another band and the hero has moved on
document.addEventListener('visibilitychange', () => { if (!document.hidden && !current && BANIS.length) renderList(); });
window.addEventListener('pageshow', (e) => { if (e.persisted && !current && BANIS.length) renderList(); });
($('#nitnemBack') as HTMLElement).addEventListener('click', backToList);
window.addEventListener('scroll', trackPosition, { passive: true });
const tglT = $('#tglT') as HTMLElement;
function syncTranslit() {
  const on = store.get('show_t', '1') !== '0';
  document.body.classList.toggle('hide-t', !on);
  tglT.setAttribute('aria-checked', on ? 'true' : 'false');
}
tglT.addEventListener('click', () => { store.set('show_t', store.get('show_t', '1') === '0' ? '1' : '0'); syncTranslit(); });
tglT.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tglT.click(); } });
syncTranslit();
// reading options: the same small panel as the Reader's
const optsBtn = $('#nitnemOptsBtn') as HTMLElement | null, optsPanel = $('#nitnemOpts') as HTMLElement | null;
function closeOpts() {
  if (!optsPanel || !optsPanel.classList.contains('on')) return;
  optsPanel.classList.remove('on'); optsPanel.setAttribute('inert', ''); $('#nitnemOptsScrim')?.classList.remove('on');
  optsBtn?.setAttribute('aria-expanded', 'false'); overlayClosed(optsPanel);
}
optsBtn?.addEventListener('click', () => {
  if (!optsPanel) return;
  if (optsPanel.classList.contains('on')) { closeOpts(); return; }
  optsPanel.removeAttribute('inert'); optsPanel.classList.add('on'); $('#nitnemOptsScrim')?.classList.add('on');
  optsBtn.setAttribute('aria-expanded', 'true'); overlayOpened(optsPanel, closeOpts, { fallback: () => optsBtn });
});
$('#nitnemOptsScrim')?.addEventListener('click', closeOpts);
($('#fontMinus') as HTMLElement).addEventListener('click', () => stepFontSize(-1));
($('#fontPlus') as HTMLElement).addEventListener('click', () => stepFontSize(1));
