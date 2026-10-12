// Shared pieces of the search, verify and Ang widgets: a verbatim line with its citation, and the
// walkthrough hand-off that lights a poster step.
import { el } from './api';

export type ApiLine = { id: number; ang: number; gurmukhi: string; translit?: string; en?: string | null; author?: string | null; raag?: string | null; comp_id?: number };

/** A result line: verbatim Gurmukhi (lang="pa"), the citation, the transliteration and the English layer, labelled. */
export function lineCard(l: ApiLine, extra: (Node | string)[] = []) {
  const card = el('li', { class: 'line' });
  card.append(
    el('p', { class: 'line__gm', lang: 'pa' }, [l.gurmukhi]),
    el('p', { class: 'line__cite' }, [`Sri Guru Granth Sahib Ji · Ang ${l.ang}`, ...(l.author ? [` · ${l.author}`] : []), ...(l.raag ? [` · ${l.raag}`] : []), ...extra]),
  );
  if (l.translit) card.append(el('p', { class: 'line__tr' }, [l.translit]));
  if (l.en) card.append(el('p', { class: 'line__en' }, [el('span', { class: 'line__label' }, ['English (translation): ']), l.en]));
  return card;
}

// the same run as plugins/rehype-lang-pa.mjs marks at build time
const PA_RUN = /[\u0A00-\u0A7F](?:[\u0A00-\u0A7F\u0964\u0965\u200C\u200D ]*[\u0A00-\u0A7F\u0964\u0965])?/g;
/** Text for a widget, with each Gurmukhi run marked lang="pa". The pieces, joined, are the text. */
export function markPa(text: string): (Node | string)[] {
  const out: (Node | string)[] = [];
  let at = 0;
  for (const m of text.matchAll(PA_RUN)) {
    if (m.index > at) out.push(text.slice(at, m.index));
    out.push(el('span', { lang: 'pa', class: 'pa' }, [m[0]]));
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

/** Light a step on the walkthrough of this poster, if it is on the page. */
export function lightStep(poster: string, stepId: string | null) {
  const wt = document.querySelector<HTMLElement & { goTo?: (id: string) => void; show?: (i: number) => void }>(`sggs-walkthrough[data-poster="${poster}"]`);
  if (!wt) return;
  if (stepId && wt.goTo) wt.goTo(stepId);
  else if (wt.show) wt.show(-1);
}

export const chip = (text: string, cls = '') => el('span', { class: `chip ${cls}`.trim() }, [text]);
