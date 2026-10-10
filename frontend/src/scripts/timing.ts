// timing.ts — shared client cache for the raag-timing knowledge layer.
// One /api/timing/clock fetch per browser session (sessionStorage, version-
// keyed so an APP_VERSION bump invalidates it), shared by the Raag Clock page
// and the reader's timing chip. Returns {available:false} payloads untouched
// so callers degrade gracefully.
import { api, meta, store } from './core';
import { minutesOf, paharFromMinutes, sunTimes, paharSolar } from './pahar.js';

let CLOCK: any = null;

export async function loadClock(): Promise<any> {
  if (CLOCK) return CLOCK;
  const m = await meta();
  const key = 'sggs_timing_v' + (m.version || '0');
  try { const s = sessionStorage.getItem(key); if (s) { CLOCK = JSON.parse(s); return CLOCK; } } catch {}
  CLOCK = await api('timing/clock');
  try { sessionStorage.setItem(key, JSON.stringify(CLOCK)); } catch {}
  return CLOCK;
}

/** All claims for one raag (by Gurmukhi name), grouped by type. */
export function claimsFor(clock: any, raagName: string) {
  if (!clock?.available) return null;
  const pick = (t: string) => (clock.claims[t] || []).filter((c: any) => c.raag_name === raagName);
  const all = { primary: pick('primary'), variant: pick('variant'),
                seasonal: pick('seasonal'), ceremonial: pick('ceremonial') };
  return (all.primary.length || all.variant.length || all.seasonal.length || all.ceremonial.length) ? all : null;
}

// ---- which pahar is it now? Fixed hours unless the reader chose solar mode on the Raag Clock
// and gave a location; shared by the Raag Clock and the home page. ----
export type Mode = 'fixed' | 'solar';
export function getMode(): Mode { return (store.get('pahar_mode', 'fixed') === 'solar' ? 'solar' : 'fixed'); }
export function getLoc(): { lat: number; lon: number } | null {
  try { const s = store.get('pahar_loc', ''); return s ? JSON.parse(s) : null; } catch { return null; }
}
export function currentPahar(): { pahar: number; mode: Mode; sun?: any; note?: string } {
  const now = new Date(); const m = minutesOf(now);
  if (getMode() === 'solar') {
    const loc = getLoc();
    if (loc) {
      if (Math.abs(loc.lat) > 60) return { pahar: paharFromMinutes(m), mode: 'fixed', note: 'Above 60° latitude solar watches degenerate — using fixed clock.' };
      const sun = sunTimes(now, loc.lat, loc.lon);
      if (!sun.polar) return { pahar: paharSolar(m, sun.sunrise, sun.sunset), mode: 'solar', sun };
      return { pahar: paharFromMinutes(m), mode: 'fixed', note: 'Polar day/night here right now — using fixed clock.' };
    }
    return { pahar: paharFromMinutes(m), mode: 'fixed', note: 'Location not set — using fixed clock.' };
  }
  return { pahar: paharFromMinutes(m), mode: 'fixed' };
}
