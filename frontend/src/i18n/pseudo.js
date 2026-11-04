// pseudo.js — the "en-XA" pseudo-locale: every translated string comes out accented, about 40%
// longer and bracketed, e.g. "See every feature" → "⟦Šéé éṽéŕý ƒéåţûŕé ·······⟧". A build with
// PUBLIC_I18N_PSEUDO=1 (never deployed) renders every message this way, so any English left on a
// page is a string that does not come from the message files (scripts/ci/check_i18n_coverage.py),
// and the longer text shows where a layout would break in French. Plain JS so it runs under Node.

const MAP = {
  a: "å", b: "ƀ", c: "ç", d: "ð", e: "é", f: "ƒ", g: "ĝ", h: "ĥ", i: "î", j: "ĵ", k: "ķ", l: "ļ", m: "ɱ",
  n: "ñ", o: "ö", p: "þ", q: "ǫ", r: "ŕ", s: "š", t: "ţ", u: "û", v: "ṽ", w: "ŵ", x: "ẋ", y: "ý", z: "ž",
  A: "Å", B: "Ɓ", C: "Ç", D: "Ð", E: "É", F: "Ƒ", G: "Ĝ", H: "Ĥ", I: "Î", J: "Ĵ", K: "Ķ", L: "Ļ", M: "Ṁ",
  N: "Ñ", O: "Ö", P: "Þ", Q: "Ǫ", R: "Ŕ", S: "Š", T: "Ţ", U: "Û", V: "Ṽ", W: "Ŵ", X: "Ẋ", Y: "Ý", Z: "Ž",
};

export const OPEN = "⟦";
export const CLOSE = "⟧";

/** @param {string} s */
export const pseudo = (s) => {
  if (!s.trim()) return s;
  const accented = s.replace(/[A-Za-z]/g, (ch) => MAP[ch] ?? ch);
  const pad = "·".repeat(Math.ceil(s.length * 0.4));
  return `${OPEN}${accented}${pad ? " " + pad : ""}${CLOSE}`;
};
