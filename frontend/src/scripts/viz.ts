// viz.ts — what the drawings share. A chart reads its colours from the stylesheet when it draws,
// so it must draw again when the theme changes (the appearance, the colour theme, the paper tone):
// onTheme() does that, once per change however many attributes moved. Category colours are fixed
// (--viz-1 … --viz-10): a colour means the same voice or theme whichever accent is chosen.
import { api } from './core';

export const cssVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
export const viz = (i: number) => cssVar(`--viz-${(((i % 10) + 10) % 10) + 1}`);

const redraws: Array<() => unknown> = [];
let timer: number | undefined;
document.addEventListener('themechange', () => {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => redraws.forEach((fn) => { try { fn(); } catch { /* one chart must not stop the others */ } }), 80);
});
/** draw again whenever the theme changes */
export function onTheme(fn: () => unknown) { redraws.push(fn); }

// A redraw must not ask the server again for what it already has.
const got = new Map<string, Promise<any>>();
export function cached(path: string): Promise<any> {
  let p = got.get(path);
  if (!p) { p = api(path); got.set(path, p); p.catch(() => got.delete(path)); }
  return p;
}
