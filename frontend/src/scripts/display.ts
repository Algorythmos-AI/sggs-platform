// display.ts — the display sheet (#displaySheet): appearance, colour theme, paper tone, Gurmukhi
// text size and the traditional-saroop switch in one place, on every Knowledge Base page. A choice
// applies at once to the page behind the sheet and is kept in this browser under the keys the
// privacy page names (theme, sggs_accent, sggs_reader_tone, gsize, sggs_saroop). Nothing here
// touches the scripture text: these are colours and sizes. The saroop switch (#saroopBtn) is
// wired by ./saroop.
import { $, store, stepFontSize } from './core';
import { applyTheme } from './theme';
import { THEMES, getAccent, getTone, setAccent, setTone } from './appearance';
import { overlayOpened, overlayClosed } from './overlay';

type Appearance = 'system' | 'light' | 'dark';
const sheet = $('#displaySheet') as HTMLElement | null;
const scrim = $('#displayScrim') as HTMLElement | null;
const btn = $('#displayBtn') as HTMLElement | null;
const radios = (name: string) => Array.from(document.querySelectorAll(`#displaySheet input[name="${name}"]`)) as HTMLInputElement[];
const pick = (name: string, value: string) => radios(name).forEach((r) => { r.checked = r.value === value; });

const appearance = (): Appearance => {
  const t = store.get('theme', 'system');
  return t === 'light' || t === 'dark' ? t : 'system';
};
const SIZE_MIN = 16, SIZE_MAX = 40;                       // the limits of stepFontSize
const size = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--gsize'), 10) || 22;

// the sheet shows what is in force now — also after a change made elsewhere (the theme button,
// the Reader's own size buttons, another tab)
function sync() {
  if (!sheet) return;
  pick('kbTheme', appearance());
  pick('kbAccent', getAccent());
  pick('kbTone', getTone());
  const t = THEMES.find((x) => x.id === getAccent());
  const ev = $('#dsEvokes'); if (ev && t) ev.textContent = `${t.name} — ${t.evokes}`;
  const s = size();
  const v = $('#dsSizeVal'); if (v) v.textContent = `${s} px`;
  $('#dsSizeDown')?.setAttribute('aria-disabled', String(s <= SIZE_MIN));
  $('#dsSizeUp')?.setAttribute('aria-disabled', String(s >= SIZE_MAX));
}

function open() {
  if (!sheet || sheet.classList.contains('on')) return;
  sync();
  sheet.removeAttribute('inert');
  sheet.classList.add('on');
  scrim?.classList.add('on');
  btn?.setAttribute('aria-expanded', 'true');
  overlayOpened(sheet, close, { focus: $('#displayClose') as HTMLElement | null, fallback: () => btn });
}
function close() {
  if (!sheet || !sheet.classList.contains('on')) return;
  sheet.classList.remove('on');
  sheet.setAttribute('inert', '');
  scrim?.classList.remove('on');
  btn?.setAttribute('aria-expanded', 'false');
  overlayClosed(sheet);
}

if (sheet && btn) {
  btn.addEventListener('click', () => (sheet.classList.contains('on') ? close() : open()));
  $('#displayClose')?.addEventListener('click', close);
  scrim?.addEventListener('click', close);
  sheet.addEventListener('change', (e) => {
    const r = e.target as HTMLInputElement;
    if (r.type !== 'radio' || !r.checked) return;
    if (r.name === 'kbTheme') { store.set('theme', r.value); applyTheme(r.value as Appearance); }
    else if (r.name === 'kbAccent') setAccent(r.value);
    else if (r.name === 'kbTone') setTone(r.value === 'warm' ? 'warm' : 'paper');
    sync();
  });
  const step = (d: number) => (e: Event) => {
    if ((e.currentTarget as HTMLElement).getAttribute('aria-disabled') === 'true') return;
    stepFontSize(d); sync();
  };
  $('#dsSizeDown')?.addEventListener('click', step(-1));
  $('#dsSizeUp')?.addEventListener('click', step(1));
  // the theme button cycles the appearance by itself (./theme): follow it once it has stored its choice
  $('#themeBtn')?.addEventListener('click', () => setTimeout(sync, 0));
  document.addEventListener('themechange', sync);
  window.addEventListener('storage', (e) => { if (e.key === 'theme') applyTheme(appearance()); sync(); });
  window.addEventListener('pageshow', (e) => { if (e.persisted) sync(); });
  sync();
}
