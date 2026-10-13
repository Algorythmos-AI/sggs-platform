// panel.ts — the shared composition modal (#panel) loaded on every page:
// renders a full shabad/composition and the Hukam-style random draw. Escape, the Tab trap and
// the return of focus are the overlay stack's (./overlay).
// Logic is ported 1:1 from the original index.html (only the "Open Ang" action is
// adapted to MPA navigation via goReader instead of in-page nav()/ang()).
import { $, esc, api, guard, prefersReducedMotion } from './core';
import { pinButtonHTML } from './store';
import { overlayOpened, overlayClosed } from './overlay';

function panelLines(lines: any[]): string {
  return lines.map((l: any) => `<div class="sline ${l.is_rahao ? 'rahao' : ''}${l.is_header ? '' : ' haspin'}"${l.is_header ? '' : ` data-line-id="${l.id}"`}>
      ${l.is_header ? '' : pinButtonHTML(l.id, l.ang, l.comp_id, l.gurmukhi)}
      <div class="g gm${l.is_header ? ' ph' : ''}${l.is_header && l.gurmukhi.startsWith('ੴ') ? ' invoc' : ''}" lang="pa">${esc(l.gurmukhi)}</div>
      <div class="t${l.is_header ? ' ph' : ''}">${esc(l.translit)}</div>
      ${l.en ? `<div class="en" lang="en">${esc(l.en)}</div>` : ''}</div>`).join('');
}
// Synthesize a composition title from the metadata every line carries — robust for ALL
// shabads, even when the section's title header (e.g. ਸਲੋਕ ਮਹਲਾ ੪) sits outside the unit.
function compTitle(lines: any[]): { main: string; sub: string; ang: any } {
  const b = lines.find((l: any) => !l.is_header) || lines[0] || {};
  const ang = (lines[0] || {}).ang || b.ang || '';
  // raag or section only — comp_type is unreliable in the source (Japji mislabeled ਰੁਤੀ,
  // shabads mislabeled ਪਉੜੀ), so we never surface it as a title.
  const main = b.raag || b.section || '';
  // Japji carries no author field in the source, but it is wholly Guru Nanak Dev Ji — show it
  // rather than leaving the title's byline blank.
  const author = b.author || (b.section === 'ਜਪੁ' ? 'Guru Nanak Dev Ji (M1)' : '');
  const sub = [author, ang ? ('Ang ' + ang) : ''].filter(Boolean).join('  ·  ');
  return { main, sub, ang };
}
function titleBlock(lines: any[]): string {
  const t = compTitle(lines);
  // The composition now carries its own verbatim heading row(s) (e.g.
  // 'ਟੋਡੀ ਮਹਲਾ ੫ ਘਰੁ ੨ ਚਉਪਦੇ'), rendered by panelLines. When such a real,
  // non-invocation title header is present, drop the synthesized raag/section
  // title to avoid showing it twice — keep only the "author · Ang N" subtitle.
  const hasTitleHeader = lines.some((l: any) =>
    l.is_header && !String(l.gurmukhi || '').startsWith('ੴ'));
  if (hasTitleHeader) t.main = '';
  if (!t.main && !t.sub) return '';
  return `<div class="ptitle">
    ${t.main ? `<div class="pt-main gm" lang="pa">${esc(t.main)}</div>` : ''}
    ${t.sub ? `<div class="pt-sub">${esc(t.sub)}</div>` : ''}</div>`;
}

// ---- open / close (focus moves into the dialog, and back to the trigger on close) ----
// What the panel is waiting for. A composition that arrives after the panel was closed, or after
// another was asked for, is dropped: it must not replace the newer one or move the focus.
let panelReq = 0;
export function openPanel() {
  const p = $('#panel') as HTMLElement | null;
  if (!p) return;
  p.classList.add('on');
  overlayOpened(p, closePanel, { focus: $('#panel .x') as HTMLElement | null });
}
export function closePanel() {
  const p = $('#panel') as HTMLElement | null;
  if (!p || !p.classList.contains('on')) return;
  panelReq++;
  p.classList.remove('on');
  overlayClosed(p);
}

const setP = (title: string, body: string) => {
  const pt = $('#ptitle'); if (pt) pt.textContent = title;
  const pb = $('#pbody'); if (pb) pb.innerHTML = body;
};

// ---- a full composition by composition id (hi kept for signature parity; unused) ----
export const shabad = guard(async (cid: number, hi?: number) => {
  openPanel();
  const req = ++panelReq;
  setP('Loading…', '<div class="hint">Loading composition…</div>');
  const d = await api('shabad/' + cid);
  if (req !== panelReq) return;
  const ang = (d.lines[0] || {}).ang || '';
  const first = d.lines.find((l: any) => !l.is_header) || d.lines[0];
  const line = hi || (first ? first.id : 0);
  setP(`Composition · Ang ${ang}`,
    titleBlock(d.lines) + panelLines(d.lines) +
    `<div class="endnav" style="margin-top:16px"><span></span>
      <button data-go-ang="${ang || 1}" data-go-line="${line}">Open Ang ${ang} ›</button></div>`);
  if (hi) focusPanelLine(hi);
});

/* Scroll the tapped verse to the centre of the MODAL (the #panel element is the overflow:auto
   scroller — the page behind must not move), flash it, and hand focus to it after openPanel's
   own close-button focus has run. */
function focusPanelLine(id: number) {
  const panel = $('#panel'), inner = document.querySelector('#panel .inner') as HTMLElement | null;
  const el = document.querySelector(`#pbody .sline[data-line-id="${id}"]`) as HTMLElement | null;
  if (!panel || !inner || !el) return;
  const top = el.offsetTop + inner.offsetTop - (panel.clientHeight - el.offsetHeight) / 2;
  if (prefersReducedMotion()) panel.scrollTop = Math.max(0, top);
  else panel.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  el.setAttribute('tabindex', '-1');
  el.classList.add('verse-focus');
  el.addEventListener('animationend', () => el.classList.remove('verse-focus'), { once: true });
  setTimeout(() => { try { el.focus({ preventScroll: true }); } catch {} }, 0);
}

// ---- Hukam-style random draw ----
let randomLoading = false;
export const randomShabad = guard(async () => {
  if (randomLoading) return;                                       // ignore rapid 'Another' taps
  randomLoading = true;
  openPanel();
  const req = ++panelReq;
  setP('Loading…', '<div class="hint">Drawing a composition…</div>');
  try {
    const d = await api('random');
    if (req !== panelReq) return;
    const ang = (d.lines[0] || {}).ang || '';
    const first = d.lines.find((l: any) => !l.is_header) || d.lines[0];
    setP(`Hukam-style random · Ang ${ang}`,
      titleBlock(d.lines) + panelLines(d.lines) +
      `<div class="endnav" style="margin-top:16px"><button onclick="randomShabad()">Another ↻</button>
        <button data-go-ang="${ang || 1}" data-go-line="${first ? first.id : ''}">Open Ang ${ang} ›</button></div>`);
  } finally { randomLoading = false; }
});

// ---- wire panel interactions (every page) ----
$('#panel')?.addEventListener('click', (e: any) => { if (e.target.id === 'panel') closePanel(); });

// Hukam-style random button lives in the shared nav on every page.
const rb = document.getElementById('randomBtn');
if (rb) rb.onclick = () => randomShabad();
document.addEventListener('click', (e: any) => { if (e.target?.closest?.('[data-random]')) randomShabad(); });

// expose for inline onclick in dynamically-rendered HTML + cross-page modal reuse
(window as any).shabad = shabad;
(window as any).randomShabad = randomShabad;
(window as any).closePanel = closePanel;
(window as any).openPanel = openPanel;       // lineage page reuses the shared modal (focus save/restore)
