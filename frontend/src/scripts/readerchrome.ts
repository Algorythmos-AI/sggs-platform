// readerchrome.ts — the Reader's controls, in step with the app: the bar's title and "Go to" open
// a sheet for going to an Ang (type it, drag to it, step to it, or pick a raag); the page bar at
// the foot shows where the Ang is in the Granth and the Angs either side; reading options sit in a
// small panel; and a sideways swipe turns the Ang. Navigation only — no scripture is drawn or
// changed here, and nothing is fetched until the reader says Go.
import { $, esc, meta } from './core';
import { overlayOpen, overlayOpened, overlayClosed } from './overlay';

const LAST = 1430;
type Hooks = { current: () => number; go: (n: number) => void; turn: (d: number) => void };
let H: Hooks;
let RAAGS: any[] = [], SECTIONS: any[] = [];
const clamp = (n: number) => Math.max(1, Math.min(LAST, n));
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;

/** The Reader has drawn Ang n: the title, the page bar and the hidden number follow. */
export function syncReaderChrome(n: number) {
  const t = el('angTitleN'); if (t) t.textContent = `Ang ${n}`;
  el('angTitle')?.setAttribute('aria-label', `Ang ${n} of ${LAST}. Go to another Ang`);
  const pt = el('pageProgressT'); if (pt) pt.textContent = `Ang ${n} of ${LAST}`;
  const bar = el('pageProgressBar'); if (bar) bar.style.width = `${(n / LAST) * 100}%`;
  const side = (id: string, numId: string, to: number, word: string) => {
    const b = el<HTMLButtonElement>(id), ok = to >= 1 && to <= LAST;
    if (b) { b.disabled = !ok; b.setAttribute('aria-label', ok ? `${word} Ang, Ang ${to}` : `${word} Ang`); }
    const num = el(numId); if (num) num.textContent = ok ? String(to) : '';
  };
  side('prevAng', 'prevAngN', n - 1, 'Previous'); side('nextAng', 'nextAngN', n + 1, 'Next');
}

// ---- go to an Ang ---------------------------------------------------------------------------
// What the sheet will go to. The number field is the reader's to edit, so while it holds a valid
// Ang that wins; an empty or impossible number disables Go and says why.
let target = 1;
const typed = (): number | null => {
  const v = (el<HTMLInputElement>('angIn')?.value || '').trim();
  return /^\d{1,4}$/.test(v) && +v >= 1 && +v <= LAST ? +v : null;
};
function whereIs(n: number): string {
  const r = RAAGS.find((x) => n >= x.first_ang && n <= x.last_ang);
  if (r) return `In <span class="gm" lang="pa">${esc(r.name)}</span> ${esc(r.roman || '')} · Angs ${r.first_ang}–${r.last_ang}`;
  const s = SECTIONS.find((x) => n >= x.first_ang && n <= x.last_ang);
  return s ? `In <span class="gm" lang="pa">${esc(s.name)}</span> · Angs ${s.first_ang}–${s.last_ang}` : '';
}
function reflect(fromField = false) {
  const n = typed(), ok = n !== null;
  if (ok) target = n as number;
  const err = el('jumpErr'); if (err) err.hidden = ok;
  const go = el<HTMLButtonElement>('jumpGo');
  if (go) { go.disabled = !ok; go.textContent = ok ? `Go to Ang ${target}` : 'Go'; }
  const range = el<HTMLInputElement>('jumpRange'); if (range && ok) range.value = String(target);
  const where = el('jumpWhere'); if (where) where.innerHTML = ok ? whereIs(target) : '';
  if (!fromField) { const f = el<HTMLInputElement>('angIn'); if (f) f.value = String(target); }
}
function setTarget(n: number) { target = clamp(n); const f = el<HTMLInputElement>('angIn'); if (f) f.value = String(target); reflect(); }

function openJump(typing: boolean) {
  const sheet = el('jumpSheet'); if (!sheet || sheet.classList.contains('on')) return;
  setTarget(H.current());
  const raag = el<HTMLSelectElement>('jumpRaag'); if (raag) raag.value = '';
  sheet.removeAttribute('inert'); sheet.classList.add('on'); el('jumpScrim')?.classList.add('on');
  const field = el<HTMLInputElement>('angIn');
  // from the title the reader means to type: the number is selected, so one keystroke replaces it
  overlayOpened(sheet, closeJump, { focus: typing ? field : el('jumpClose'), fallback: () => el('angTitle') });
  if (typing) setTimeout(() => field?.select(), 0);
}
function closeJump() {
  const sheet = el('jumpSheet'); if (!sheet || !sheet.classList.contains('on')) return;
  sheet.classList.remove('on'); sheet.setAttribute('inert', ''); el('jumpScrim')?.classList.remove('on');
  const f = el<HTMLInputElement>('angIn'); if (f) f.value = String(H.current());        // the field always says where the Reader is
  overlayClosed(sheet);
}

// ---- reading options ------------------------------------------------------------------------
function openOpts() {
  const p = el('readerOpts'), b = el('readerOptsBtn'); if (!p || p.classList.contains('on')) return;
  p.removeAttribute('inert'); p.classList.add('on'); el('readerOptsScrim')?.classList.add('on');
  b?.setAttribute('aria-expanded', 'true');
  overlayOpened(p, closeOpts, { fallback: () => b });
}
function closeOpts() {
  const p = el('readerOpts'); if (!p || !p.classList.contains('on')) return;
  p.classList.remove('on'); p.setAttribute('inert', ''); el('readerOptsScrim')?.classList.remove('on');
  el('readerOptsBtn')?.setAttribute('aria-expanded', 'false');
  overlayClosed(p);
}

// ---- a sideways swipe turns the Ang ------------------------------------------------------------
// One finger, quick and clearly sideways, on the page itself. Never while text is selected, the
// page is zoomed, something is open over it, or from the screen's edge (the browser's own Back).
function initSwipe() {
  const zone = el('angOut'); if (!zone) return;
  let x0 = 0, y0 = 0, t0 = 0, live = false;
  zone.addEventListener('touchstart', (e) => {
    live = false;
    if (e.touches.length !== 1 || overlayOpen()) return;
    const t = e.touches[0], w = window.innerWidth;
    if (t.clientX < 28 || t.clientX > w - 28) return;
    if ((window.visualViewport?.scale ?? 1) > 1.05) return;
    if ((e.target as Element).closest('input, select, textarea, .related, [data-noswipe]')) return;
    x0 = t.clientX; y0 = t.clientY; t0 = performance.now(); live = true;
  }, { passive: true });
  zone.addEventListener('touchmove', (e) => { if (e.touches.length !== 1) live = false; }, { passive: true });
  zone.addEventListener('touchcancel', () => { live = false; }, { passive: true });
  zone.addEventListener('touchend', (e) => {
    if (!live) return; live = false;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    if (performance.now() - t0 > 700 || Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 2.5) return;
    if (!document.getSelection()?.isCollapsed) return;
    H.turn(dx < 0 ? 1 : -1);                       // a swipe to the left brings the next Ang
  }, { passive: true });
}

export function initReaderChrome(hooks: Hooks) {
  H = hooks;
  document.body.classList.add('has-pagebar');
  el('jumpBtn')?.addEventListener('click', () => openJump(false));
  el('pageProgress')?.addEventListener('click', () => openJump(false));
  el('angTitle')?.addEventListener('click', () => openJump(true));
  el('jumpClose')?.addEventListener('click', closeJump);
  el('jumpScrim')?.addEventListener('click', closeJump);
  el('angIn')?.addEventListener('input', () => reflect(true));
  el('jumpRange')?.addEventListener('input', (e) => setTarget(+(e.target as HTMLInputElement).value));
  el('jumpRaag')?.addEventListener('change', (e) => { const v = +(e.target as HTMLSelectElement).value; if (v) setTarget(v); });
  el('jumpSheet')?.addEventListener('click', (e) => {
    const s = (e.target as Element).closest('[data-jump-step]') as HTMLElement | null;
    if (s) setTarget((typed() ?? target) + +(s.dataset.jumpStep as string));
  });
  el('jumpForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const n = typed(); if (n === null) { reflect(true); return; }
    closeJump(); H.go(n);
  });
  el('prevAng')?.addEventListener('click', () => H.turn(-1));
  el('nextAng')?.addEventListener('click', () => H.turn(1));
  el('readerOptsBtn')?.addEventListener('click', () => (el('readerOpts')?.classList.contains('on') ? closeOpts() : openOpts()));
  el('readerOptsScrim')?.addEventListener('click', closeOpts);
  initSwipe();
  // the raags, for the location line, the ticks on the scrubber and the menu
  meta().then((m: any) => {
    RAAGS = m.raags || []; SECTIONS = m.sections || [];
    const ticks = el('jumpTicks');
    if (ticks) ticks.innerHTML = RAAGS.map((r) => `<i style="left:${(((r.first_ang - 1) / (LAST - 1)) * 100).toFixed(2)}%"></i>`).join('');
    const sel = el<HTMLSelectElement>('jumpRaag');
    if (sel) sel.insertAdjacentHTML('beforeend', RAAGS.map((r) => `<option value="${r.first_ang}">${esc(r.roman || r.name)} · Ang ${r.first_ang}</option>`).join(''));
    if (el('jumpSheet')?.classList.contains('on')) reflect();
  }).catch(() => {});
}
