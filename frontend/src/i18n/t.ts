// t.ts — the message catalogs and the formatter for a page's language (rules in
// format-message.js). en.json is the source; every other messages/<lang>.json is a translation.
// A language is ENABLED (locales.json) only when its catalog is complete, current and reviewed
// (scripts/i18n-status.mjs, run in CI), so a shipped page never mixes languages. A preview build of
// a draft language falls back to English for a key it lacks.
import en from "./messages/en.json" with { type: "json" };
import { LOCALES, type Locale } from "./locales";
import { createFormatter, richHtml as richHtmlJs } from "./format-message.js";

export type Messages = typeof en;

// Dotted paths to every string in the source catalog, e.g. "nav.features".
type Paths<T> = { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}` }[keyof T & string];
export type MessageKey = Paths<Messages>;
export type RichPart = string | { tag: string; text: string };

const files = import.meta.glob<{ default: Messages }>("./messages/*.json", { eager: true });
const CATALOGS: Partial<Record<Locale, Messages>> = Object.fromEntries(
  Object.entries(files)
    .filter(([path]) => !path.endsWith(".lock.json"))
    .map(([path, mod]) => [path.replace(/^.*\/|\.json$/g, ""), mod.default]),
);
const PSEUDO = import.meta.env.PUBLIC_I18N_PSEUDO === "1";

export const useT = (locale: Locale) => {
  const catalog = CATALOGS[locale];
  if (!catalog) throw new Error(`i18n: no catalog for "${locale}"`);
  // The language's numbering system rides on the Intl tag (pa → "pa-IN-u-nu-guru", ੧੨੩), so ICU
  // {n, number} and num() write the page's numerals; plural rules are unaffected. (format.ts holds
  // the same rule for the page-level formatters, and fmtAng for Western Ang numbers.)
  const { intl, numbering } = LOCALES[locale];
  const tag = numbering ? `${intl}-u-nu-${numbering}` : intl;
  const f = createFormatter(catalog, tag, { pseudo: PSEUDO, fallback: locale === "en" ? undefined : en });
  return {
    t: (key: MessageKey, values?: Record<string, unknown>): string => f.t(key, values),
    rich: (key: MessageKey, values?: Record<string, unknown>): RichPart[] => f.rich(key, values),
    num: (n: number, opts: Intl.NumberFormatOptions = {}): string => new Intl.NumberFormat(tag, opts).format(n),
  };
};

// Render rich parts in a template: each tag part goes through its renderer, which the page writes
// with the real element (`link1: (x) => <a href={…}>{x}</a>`), so Astro escapes the text and scoped
// styles still apply. A tag without a renderer fails the build.
export const richMap = <R>(parts: RichPart[], renderers: Record<string, (text: string) => R>): (string | R)[] =>
  parts.map((p) => {
    if (typeof p === "string") return p;
    const r = renderers[p.tag];
    if (!r) throw new Error(`i18n: no renderer for <${p.tag}>`);
    return r(p.text);
  });

// Rich parts as an HTML string, for the few places that need markup as text (the FAQ answers):
// every word is escaped; only the renderers, written in our own pages, produce markup.
export const richHtml = (parts: RichPart[], renderers: Record<string, (escapedText: string) => string>): string =>
  richHtmlJs(parts, renderers);

// Rich parts as plain text (JSON-LD, share text): tag text as written, or what a renderer gives.
export const richText = (parts: RichPart[], renderers: Record<string, (text: string) => string> = {}): string =>
  parts.map((p) => (typeof p === "string" ? p : (renderers[p.tag]?.(p.text) ?? p.text))).join("");
