// search.ts — the Search page (/) : word/sound/first-letter/theme search + Verify-quote.
// Ported 1:1 from the original; in-page nav()/ang() calls are replaced by MPA goReader().
import { $, esc, api, guard, goReader, failHTML } from './core';
import { pinButtonHTML } from './store';
import { themeName } from './themegroups';

let mode = 'auto';

// mode chips: keep the chip UI + `mode` in sync; usable by click, keyboard, and code paths
function syncMode(m: string) {
  mode = m;
  renderIdle();
  document.querySelectorAll('#modes button').forEach((x: any) => {
    const on = x.dataset.m === m; x.classList.toggle('on', on);
    x.setAttribute('aria-checked', String(on)); x.setAttribute('tabindex', on ? '0' : '-1');
  });
}
document.querySelectorAll('#modes button').forEach((s: any) => {
  s.setAttribute('role', 'radio');
  s.setAttribute('aria-checked', String(s.classList.contains('on')));
  s.setAttribute('tabindex', s.classList.contains('on') ? '0' : '-1');
  s.onclick = () => { syncMode(s.dataset.m); if (($('#q') as HTMLInputElement).value) go(0); };
  s.onkeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); syncMode(s.dataset.m); if (($('#q') as HTMLInputElement).value) go(0); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); (s.nextElementSibling || s.parentElement.firstElementChild).focus(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); (s.previousElementSibling || s.parentElement.lastElementChild).focus(); }
  };
});
// ---- before anything is typed: what this mode takes, in a few lines (the app's idle canvas) ----
const IDLE: Record<string, [string, string[]]> = {
  auto: ['Search the Granth', ['Words, sounds, first letters or a theme. Auto picks the way.', 'Roman spelling is forgiven: waheguru, satgur kirpa, gobind.', 'Every result is verbatim scripture, cited by Ang.']],
  gurmukhi: ['Gurmukhi', ['Type the words as they are written.']],
  roman: ['Roman', ['waheguru · satgur · naam. Spelling is forgiven.']],
  english: ['English', ['Search the labelled translation layer: mercy, light, ego.']],
  first: ['First letters', ['Type the first letter of each word of a line you half remember.', 'In Gurmukhi or in Roman: s n k']],
  theme: ['Theme', ['Try naam, hukam, haumai, seva, simran.', 'Every tagged verse, cited by Ang.']],
  verify: ['Verify a quotation', ['Paste a line as you remember it, in Gurmukhi or Roman, and press Enter.', 'Add @ and an Ang to check a claimed page, for example “… @1”.', 'The verdict cites the canonical line and its Ang.']],
};
const SAMPLE: Record<string, string> = { auto: 'ਨਾਮੁ', gurmukhi: 'ਨਾਮੁ · ਸਤਿਗੁਰ · ਹੁਕਮਿ', first: 'ਸ ਨ ਕ' };
function renderIdle() {
  const box = $('#searchIdle') as HTMLElement | null; if (!box) return;
  const empty = !($('#q') as HTMLInputElement).value.trim() && !($('#results') as HTMLElement).innerHTML;
  box.hidden = !empty;
  if (!empty) return;
  const [title, lines] = IDLE[mode] || IDLE.auto;
  box.innerHTML = `<div class="si-mark gm" lang="pa" aria-hidden="true">ੴ</div><h2>${esc(title)}</h2>
    ${SAMPLE[mode] ? `<p class="si-sample gm" lang="pa">${esc(SAMPLE[mode])}</p>` : ''}
    ${lines.map((l) => `<p>${esc(l)}</p>`).join('')}`;
}
// ---- search as you type: a pause, then the search; an empty box returns to the idle canvas ----
let typeTimer: number | undefined;
const qEl = $('#q') as HTMLInputElement | null, qClear = $('#qClear') as HTMLElement | null;
function clearSearch() {
  searchReq++;                                         // a search in flight must not land on the cleared page
  ($('#results') as HTMLElement).innerHTML = '';
  try { const u = new URL(location.href); u.searchParams.delete('q'); history.replaceState({}, '', u); } catch {}
  renderIdle();
}
qEl?.addEventListener('input', () => {
  window.clearTimeout(typeTimer);
  const v = qEl.value.trim();
  if (qClear) qClear.hidden = !qEl.value;
  if (!v) { clearSearch(); return; }
  // a quotation is checked when the reader says so (Enter): half a line would always read "not found"
  if (mode === 'verify' || v.length < 2) return;
  typeTimer = window.setTimeout(() => go(0, true), 300);
});
qEl?.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter') { window.clearTimeout(typeTimer); go(0); qEl.blur(); } });
qClear?.addEventListener('click', () => { if (!qEl) return; qEl.value = ''; qClear.hidden = true; window.clearTimeout(typeTimer); clearSearch(); qEl.focus(); });

// ---- search ----
let hlToks: string[] = [];
const GURMUKHI = /[\u0A00-\u0A7F]/;
function hl(escaped: string): string {
  if (!hlToks.length) return escaped;
  // Gurmukhi is marked a whole word at a time: an element boundary inside a word would split a
  // conjunct or part a vowel sign from its consonant
  if (GURMUKHI.test(escaped)) {
    const toks = hlToks.filter((t) => t.length >= 2 && GURMUKHI.test(t));
    if (!toks.length) return escaped;
    return escaped.split(' ').map((w) => (toks.some((t) => w.includes(t)) ? `<mark>${w}</mark>` : w)).join(' ');
  }
  let out = escaped;
  for (const t of hlToks) {
    if (t.length < 2) continue;
    const safe = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(safe, 'g'), (m) => `<mark>${m}</mark>`);
  }
  return out;
}
function lineCard(l: any): string {
  const chips = [`<span class="ang">Ang ${l.ang}</span>`];
  if (l.raag) chips.push(`<span class="gm">${esc(l.raag)}</span>`);
  if (l.section) chips.push(`<span class="gm">${esc(l.section)}</span>`);
  if (l.author) chips.push(`<span>${esc(l.author)}</span>`);
  if (l.is_rahao) chips.push(`<span class="rahao">ਰਹਾਉ · refrain</span>`);
  if (l.matched_term) chips.push(`<span class="gm">term: ${esc(l.matched_term)}</span>`);
  return `<div class="card haspin" role="button" tabindex="0" aria-label="Open composition at Ang ${l.ang}" onclick="shabad(${l.comp_id},${l.id})">
    ${pinButtonHTML(l.id, l.ang, l.comp_id, l.gurmukhi)}
    <div class="g gm" lang="pa">${hl(esc(l.gurmukhi))}</div><div class="t">${hl(esc(l.translit))}</div>
    ${l.en ? `<div class="en" lang="en">${esc(l.en)}</div>` : ''}
    <div class="meta">${chips.join('')}</div></div>`;
}
let searchReq = 0;
const go = guard(async (off: number, typing = false) => {
  const q = ($('#q') as HTMLInputElement).value.trim(); if (!q) return;
  if (mode === 'verify') return doVerify(q);
  const myReq = ++searchReq;
  const out = $('#results') as HTMLElement;
  // while typing, the last results stay (dimmed) until the new ones arrive: no flicker between keystrokes
  if (typing && out.querySelector('.card')) out.classList.add('busy'); else out.innerHTML = '<div class="hint">Searching…</div>';
  ($('#searchIdle') as HTMLElement | null)?.setAttribute('hidden', '');
  hlToks = q.split(/\s+/).filter((t) => t.length > 1);
  const d = await api(`search?q=${encodeURIComponent(q)}&mode=${mode}&limit=50&offset=${off}`);
  if (myReq !== searchReq) return;          // a newer search was fired; drop this stale result
  out.classList.remove('busy');
  let h = '';
  if (d.related_themes && d.related_themes.length)
    h += `<div class="count">Related themes: ${d.related_themes.map((t: string) =>
      `<a href="#" class="rel-theme" data-theme="${esc(t)}">${esc(themeName(t))}</a>`).join(' · ')}</div>`;
  if (d.concept) h += `<div class="themedesc"><b>${esc(themeName(d.concept.name))}</b> — ${esc(d.concept.description)}<br>
      terms: <span class="gm">${d.concept.terms.map(esc).join(' · ')}</span> — ${d.concept.total} lines</div>`;
  h += `<div class="count">${d.results.length}${d.results.length === 50 ? '+' : ''} result(s) · interpreted as <b>${esc(d.mode)}</b>${off ? ` · from #${off + 1}` : ''}</div>`;
  h += d.results.map(lineCard).join('');
  if (d.results.length === 50) h += `<button class="more" onclick="go(${off + 50})">More ›</button>`;
  if (!d.results.length) h += `<div class="hint">No results for &ldquo;<b>${esc(q)}</b>&rdquo;.<br>
      Try fewer words or first-letters mode, a theme —
      <a href="#" class="rel-theme" data-theme="naam">naam</a> ·
      <a href="#" class="rel-theme" data-theme="hukam">hukam</a> ·
      <a href="#" class="rel-theme" data-theme="haumai">haumai</a> —
      or <a href="/browse">browse the index</a>.</div>`;
  out.innerHTML = h; if (!typing) window.scrollTo({ top: 0 });
  try {                                            // shareable URL; one entry, not one per keystroke
    const u = new URL(location.href); u.searchParams.set('q', q); u.searchParams.set('mode', mode);
    history.replaceState({ q, mode }, '', u);
  } catch {}
}, () => { const r = $('#results'); if (r) { r.classList.remove('busy'); r.innerHTML = failHTML('Search'); } });
// delegated handlers for #results — keyboard activation of cards + related-theme links
($('#results') as HTMLElement | null)?.addEventListener('click', (e: any) => {
  const a = e.target.closest('.rel-theme');
  if (a) { e.preventDefault(); ($('#q') as HTMLInputElement).value = a.dataset.theme; syncMode('theme'); go(0); return; }
});
($('#results') as HTMLElement | null)?.addEventListener('keydown', (e: any) => {
  const c = e.target.closest('.card');
  if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); c.click(); }
});

// ---- verify ----
const doVerify = guard(async (qIn: string) => {
  let ang: string | null = null; const m = qIn.match(/@(\d{1,4})\s*$/);  // optional "@123" claims an Ang
  let q = qIn;
  if (m) { ang = m[1]; q = q.replace(/@\d{1,4}\s*$/, '').trim(); }
  const d = await api(`verify?q=${encodeURIComponent(q)}${ang ? `&ang=${ang}` : ''}`);
  const v = d.verdict || '';
  const cls = v.startsWith('VERIFIED') ? 'v-ok' : (v.startsWith('NOT_FOUND') ? 'v-no' : 'v-maybe');
  ($('#searchIdle') as HTMLElement | null)?.setAttribute('hidden', '');
  let h = `<div class="verdict ${cls}">
      <div class="vv">${esc(v.replace(/\+/g, ' + '))}</div>
      ${v.startsWith('NOT_FOUND') ? '' : `<div class="vc">confidence ${(d.confidence * 100).toFixed(1)}%</div>`}
      <div class="vh">${v.startsWith('VERIFIED') ? 'This is scripture, verified against the canonical corpus.' :
      v.startsWith('NOT_FOUND') ? 'No such line exists in Sri Guru Granth Sahib Ji (this edition). Treat the quote as unverified.' :
        'Close match found — compare carefully below.'}</div></div>`;
  if (d.gurmukhi) {
    h += `<div class="count">Canonical line:</div>
    <div class="card" role="button" tabindex="0" aria-label="Open Ang ${d.ang}" onclick="goReader(${d.ang})">
      <div class="g gm" lang="pa">${esc(d.gurmukhi)}</div>
      <div class="meta"><span class="ang">Ang ${d.ang}</span>
        ${d.raag ? `<span class="gm">${esc(d.raag)}</span>` : ''}
        ${d.author ? `<span>${esc(d.author)}</span>` : ''}</div></div>`;
  }
  ($('#results') as HTMLElement).innerHTML = h; window.scrollTo({ top: 0 });
}, () => { const r = $('#results'); if (r) r.innerHTML = failHTML('Verification'); });

(window as any).go = go;          // for inline "More" button + programmatic calls

// ---- bootstrap from URL (?q= & ?mode=) so theme tiles / verify links deep-link here ----
(function () {
  const p = new URLSearchParams(location.search);
  const qp = p.get('q'); const mp = p.get('mode');
  const VALID = ['auto', 'gurmukhi', 'roman', 'english', 'first', 'theme', 'verify'];
  if (mp && VALID.includes(mp)) syncMode(mp);
  if (qp) { ($('#q') as HTMLInputElement).value = qp; if (qClear) qClear.hidden = false; go(0); }
  renderIdle();
  // the cursor waits in the box on a desktop; on a phone that would raise the keyboard on arrival
  if (matchMedia('(min-width: 841px) and (hover: hover) and (pointer: fine)').matches) ($('#q') as HTMLInputElement | null)?.focus();
})();
