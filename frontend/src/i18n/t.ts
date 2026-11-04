// t.ts — the message catalogs and the formatter for a page's language (rules in
// format-message.js). en.json is the source; a translation joins CATALOGS only with every key.
import en from "./messages/en.json" with { type: "json" };
import { LOCALES, type Locale } from "./locales";
import { createFormatter, richHtml as richHtmlJs } from "./format-message.js";

export type Messages = typeof en;

// Dotted paths to every string in the source catalog, e.g. "nav.features".
type Paths<T> = { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}` }[keyof T & string];
export type MessageKey = Paths<Messages>;
export type RichPart = string | { tag: string; text: string };

const CATALOGS: Partial<Record<Locale, Messages>> = { en };
const PSEUDO = import.meta.env.PUBLIC_I18N_PSEUDO === "1";

export const useT = (locale: Locale) => {
  const catalog = CATALOGS[locale];
  if (!catalog) throw new Error(`i18n: no catalog for "${locale}"`);
  const f = createFormatter(catalog, LOCALES[locale].intl, { pseudo: PSEUDO });
  return {
    t: (key: MessageKey, values?: Record<string, unknown>): string => f.t(key, values),
    rich: (key: MessageKey, values?: Record<string, unknown>): RichPart[] => f.rich(key, values),
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
