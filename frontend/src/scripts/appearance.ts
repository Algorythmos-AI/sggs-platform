// appearance.ts — the Knowledge Base's colour theme (html[data-accent]) and paper tone
// (html[data-tone]). Light/dark stays in ./theme, which the marketing shell shares; this module is
// Knowledge Base only. The inline script in Base.astro sets both attributes before first paint;
// this module changes them afterwards, keeps other tabs in step, puts them back after a
// back/forward restore, and announces `themechange` to anything that drew with colours it read
// from the stylesheet. The themes themselves are generated (docs/brand/web-themes.json).
import kb from '../generated/kb-themes.json';

export const THEMES = kb.themes;
export const DEFAULT_ACCENT: string = kb.default;
export type Tone = 'paper' | 'warm';
const ACCENT_KEY = 'sggs_accent', TONE_KEY = 'sggs_reader_tone';

const known = (id: string | null): id is string => !!id && THEMES.some((t) => t.id === id);
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };
const stored = () => {
  const a = read(ACCENT_KEY);
  return { accent: known(a) ? a : DEFAULT_ACCENT, tone: (read(TONE_KEY) === 'warm' ? 'warm' : 'paper') as Tone };
};

// held in memory too, so a choice still applies for this visit when storage is blocked
let state = stored();
export const getAccent = () => state.accent;
export const getTone = () => state.tone;

function reflect() {
  const root = document.documentElement;
  if (state.accent === DEFAULT_ACCENT) root.removeAttribute('data-accent'); else root.setAttribute('data-accent', state.accent);
  if (state.tone === 'warm') root.setAttribute('data-tone', 'warm'); else root.removeAttribute('data-tone');
}
export function setAccent(id: string) {
  if (!known(id)) return;
  state.accent = id; write(ACCENT_KEY, id); reflect();
}
export function setTone(t: Tone) {
  state.tone = t === 'warm' ? 'warm' : 'paper'; write(TONE_KEY, state.tone); reflect();
}

export function initAppearance() {
  reflect();
  window.addEventListener('storage', (e) => {
    if (e.key === ACCENT_KEY || e.key === TONE_KEY) { state = stored(); reflect(); }
  });
  window.addEventListener('pageshow', (e) => { if (e.persisted) { state = stored(); reflect(); } });
  new MutationObserver(() => document.dispatchEvent(new CustomEvent('themechange')))
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent', 'data-tone'] });
}
