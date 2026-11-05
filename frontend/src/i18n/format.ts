// format.ts — numbers, money and dates in the page's language. Every formatter names its locale
// explicitly (never the visitor's browser), so a page builds the same everywhere.
import { LOCALES, type Locale } from "./locales";
import { paharRange, paharWindow } from "../scripts/pahar.js";

// Interface numerals follow the language (Punjabi: Gurmukhi ੧੨੩, via the locale's numbering system).
// Ang numbers do not: a citation is always "Ang 1430" in Western digits, in every language, so it
// matches the printed Bir's index, the app and every link — use fmtAng for those.
const tag = (l: Locale) => LOCALES[l].numbering ? `${LOCALES[l].intl}-u-nu-${LOCALES[l].numbering}` : LOCALES[l].intl;
export const intlTag = tag;

export const fmtNumber = (l: Locale, n: number, opts: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat(tag(l), opts).format(n);

// An Ang number or Ang range end: Western digits in every language (see tag above).
export const fmtAng = (l: Locale, n: number) => new Intl.NumberFormat(LOCALES[l].intl).format(n);

// Australian dollars: "A$5", "A$0.50" (en-GB); "5 $AU", "0,50 $AU" (fr-FR). Cents only when present.
export const fmtAud = (l: Locale, n: number) => {
  const cents = Number.isInteger(n) ? 0 : 2;
  return new Intl.NumberFormat(tag(l), { style: "currency", currency: "AUD", minimumFractionDigits: cents, maximumFractionDigits: cents }).format(n);
};

export const fmtDate = (l: Locale, d: Date, opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" }) =>
  new Intl.DateTimeFormat(tag(l), { timeZone: "UTC", ...opts }).format(d);

// A pahar's fixed-clock window: "6–9 AM" in English (pahar.js, the wording the dial uses), and the
// language's own clock elsewhere, e.g. "06:00–09:00" in French.
export const fmtPaharRange = (l: Locale, p: number) => {
  if (l === "en") return paharRange(p);
  const { start, end } = paharWindow(p);
  const at = (min: number) => new Date(Date.UTC(2000, 0, 1, 0, min % 1440));
  return new Intl.DateTimeFormat(tag(l), { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatRange(at(start), at(end));
};
