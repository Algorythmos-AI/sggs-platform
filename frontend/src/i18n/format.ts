// format.ts — numbers, money and dates in the page's language. Every formatter names its locale
// explicitly (never the visitor's browser), so a page builds the same everywhere.
import { LOCALES, type Locale } from "./locales";

const tag = (l: Locale) => LOCALES[l].intl;

export const fmtNumber = (l: Locale, n: number, opts: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat(tag(l), opts).format(n);

// Whole Australian dollars: "A$5" (en-GB), "5 $AU" (fr-FR).
export const fmtAud = (l: Locale, n: number) =>
  new Intl.NumberFormat(tag(l), { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);

export const fmtDate = (l: Locale, d: Date, opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" }) =>
  new Intl.DateTimeFormat(tag(l), { timeZone: "UTC", ...opts }).format(d);
