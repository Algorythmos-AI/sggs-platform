// format.ts — numbers, money and dates in the page's language. Every formatter names its locale
// explicitly (never the visitor's browser), so a page builds the same everywhere.
import { LOCALES, type Locale } from "./locales";
import { paharRange, paharWindow } from "../scripts/pahar.js";

const tag = (l: Locale) => LOCALES[l].intl;

export const fmtNumber = (l: Locale, n: number, opts: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat(tag(l), opts).format(n);

// Whole Australian dollars: "A$5" (en-GB), "5 $AU" (fr-FR).
export const fmtAud = (l: Locale, n: number) =>
  new Intl.NumberFormat(tag(l), { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);

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
