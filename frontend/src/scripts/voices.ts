// voices.ts — how a contributor's name and numbers are said, shared by /lineage and /analytics.
// The corpus author strings carry a Mahala tag ("Guru Arjan Dev Ji (M5)") or a Gurmukhi kind tag
// ("Bhatt Nal (ਭਟ)"); readers see the full name, with the Mahala as a small badge where it helps.
// Display only: the stored strings are never changed, and every join still uses them verbatim.

export type Voice = { name: string; mahala: string };

/** The display parts of a corpus author string: the full name without its tag, and the Mahala. */
export function voice(author: string): Voice {
  const s = String(author || '');
  const m = s.match(/\s*\(M(\d)\)\s*$/);
  return { name: s.replace(/\s*\([^)]*\)\s*$/, '').trim() || s, mahala: m ? 'M' + m[1] : '' };
}

/** "1 shabad", "2 shabads", "0 shabads" — English only (the web is English-first). */
export const plural = (n: number, one: string, many = one + 's') =>
  `${Number(n || 0).toLocaleString()} ${n === 1 ? one : many}`;

/** Granth order: by first Ang; a voice whose Bani is not yet indexed goes last, by name. */
export const granthOrder = <T extends { first_ang?: number | null; name: string }>(a: T, b: T) =>
  (a.first_ang ?? Infinity) - (b.first_ang ?? Infinity) || a.name.localeCompare(b.name);
