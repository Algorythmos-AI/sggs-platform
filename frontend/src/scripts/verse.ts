// verse.ts — what can be done with a verse, in one sheet, wherever a verse appears (Search, the
// Reader, a composition, Nitnem's trail): pin it, open it in the Reader, see its related verses,
// open its composition, copy it, share it. The sheet is opened by the verse's own "⋯" button
// (store.ts pinButtonHTML), which carries the verse as DATA: the text copied, shared or pinned is
// always the verbatim line from the API model (data-gm), never the painted glyphs, and it always
// goes out with its citation — Sri Guru Granth Sahib Ji · Ang N.
import { $, esc } from './core';
import { togglePin, isPinned, MAX_PINS } from './store';
import { themeName } from './themegroups';
import { overlayOpened, overlayClosed } from './overlay';
import { verseImage, shareImage } from './shareimage';

type Verse = { id: number; ang: number; cid: number; gm: string };
let cur: Verse | null = null;
const el = (id: string) => document.getElementById(id);
const cite = (v: Verse) => `Sri Guru Granth Sahib Ji · Ang ${v.ang}`;
// /ang/N unfurls as Ang N's own card in any chat (src/pages/ang); it opens the Reader at the line
const link = (v: Verse) => `${location.origin}/ang/${v.ang}?line=${v.id}`;
const asText = (v: Verse) => `${v.gm}\n— ${cite(v)}`;

function say(msg: string) {                                    // the shared toast (core's #toast)
  const t = $('#toast') as HTMLElement | null; if (!t) return;
  t.textContent = msg; t.classList.add('on');
  window.clearTimeout((t as any)._v); (t as any)._v = window.setTimeout(() => t.classList.remove('on'), 2600);
}
/** every button of this verse on the page says whether it is pinned */
export function markVerseButtons() {
  document.querySelectorAll('.pin-btn').forEach((b: any) => {
    const on = isPinned(+b.dataset.id);
    b.classList.toggle('pinned', on);
    b.setAttribute('aria-label', on ? 'Verse actions (pinned)' : 'Verse actions');
  });
}
function reflectPin() {
  const b = el('vsPin'); if (!b || !cur) return;
  const on = isPinned(cur.id);
  b.textContent = on ? 'Unpin' : 'Pin verse';
  b.setAttribute('aria-pressed', String(on));
}

export function openVerse(btn: HTMLElement) {
  const sheet = el('verseSheet'); if (!sheet) return;
  cur = { id: +(btn.dataset.id || 0), ang: +(btn.dataset.ang || 0), cid: +(btn.dataset.cid || 0), gm: btn.dataset.gm || '' };
  const g = el('vsText'); if (g) g.textContent = cur.gm;        // verbatim, as text
  const c = el('vsCite'); if (c) c.textContent = cite(cur);
  const open = el('vsOpen'); if (open) { open.dataset.goAng = String(cur.ang); open.dataset.goLine = String(cur.id); }
  const rel = el('vsRelated') as HTMLAnchorElement | null; if (rel) rel.href = `/trail?line_id=${cur.id}`;
  const comp = el('vsComp'); if (comp) comp.hidden = !cur.cid || !!btn.closest('#panel');
  const share = el('vsShare'); if (share) share.hidden = typeof navigator.share !== 'function';
  reflectPin();
  showThemes(cur.id);
  if (sheet.classList.contains('on')) return;
  sheet.removeAttribute('inert'); sheet.classList.add('on'); el('verseScrim')?.classList.add('on');
  overlayOpened(sheet, closeVerse, { focus: el('vsPin'), fallback: () => (document.contains(btn) ? btn : null) });
}
// the verse's themes (corpus-verified tags), each a way into every verse that carries it
const themesOf = new Map<number, Promise<string[]>>();
function showThemes(id: number) {
  const box = el('vsThemes'); if (!box) return;
  box.hidden = true; box.innerHTML = '';
  let p = themesOf.get(id);
  // optional extra: fetched quietly (no api() toast), so a server without the Insights context or a
  // dropped connection leaves the sheet as it was instead of announcing an error
  if (!p) {
    p = fetch(`/api/line_concepts?ids=${id}`).then((r) => (r.ok ? r.json() : null))
      .then((d: any) => (d?.concepts?.[String(id)] || []) as string[]).catch(() => []);
    themesOf.set(id, p);
  }
  p.then((list) => {
    if (!cur || cur.id !== id || !list.length) return;
    box.innerHTML = 'Themes: ' + list.map((c) => `<a href="/search?q=${encodeURIComponent(c)}&mode=theme">${esc(themeName(c))}</a>`).join('');
    box.hidden = false;
  });
}
function closeVerse() {
  const sheet = el('verseSheet'); if (!sheet || !sheet.classList.contains('on')) return;
  sheet.classList.remove('on'); sheet.setAttribute('inert', ''); el('verseScrim')?.classList.remove('on');
  overlayClosed(sheet);
}

el('verseScrim')?.addEventListener('click', closeVerse);
el('vsClose')?.addEventListener('click', closeVerse);
el('vsPin')?.addEventListener('click', () => {
  if (!cur) return;
  const r = togglePin({ line_id: cur.id, gm: cur.gm, ang: cur.ang, comp_id: cur.cid });
  if (r === 'cap') say(`Saved verses are full (max ${MAX_PINS}). Unpin a verse to add more.`);
  else if (r === 'quota') say('Could not save: your browser storage is full.');
  else say(r === 'pinned' ? 'Pinned. It is in Saved.' : 'Unpinned');
  reflectPin(); markVerseButtons();
});
// "Open in Reader" is a [data-go-ang] button: core's delegate navigates; the sheet only gets out of the way
el('vsOpen')?.addEventListener('click', () => { closeVerse(); });
el('vsComp')?.addEventListener('click', () => { const v = cur; closeVerse(); if (v) (window as any).shabad?.(v.cid, v.id); });
el('vsCopy')?.addEventListener('click', () => {
  if (!cur) return;
  const text = asText(cur);
  (navigator.clipboard?.writeText(text) || Promise.reject()).then(() => { say('Verse copied, with its Ang'); closeVerse(); }, () => say('Copy is not available in this browser'));
});
el('vsShare')?.addEventListener('click', () => {
  if (!cur) return;
  const v = cur;
  navigator.share({ text: asText(v), url: link(v) }).then(closeVerse, () => { /* dismissed: stay */ });
});
el('vsImage')?.addEventListener('click', async (e) => {
  if (!cur) return;
  const v = cur, b = e.currentTarget as HTMLButtonElement;
  b.disabled = true;
  try {
    const r = await shareImage(await verseImage(v.gm, v.ang), `gurbani-soul-ang-${v.ang}.png`, asText(v));
    if (r === 'saved') say('Image saved, with its Ang');
    if (r !== 'dismissed') closeVerse();
  } catch { say('Could not make the image in this browser'); }
  finally { b.disabled = false; }
});
