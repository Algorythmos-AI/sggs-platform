// t.ts — the message catalogs and the formatter for a page's language (rules in
// format-message.js). en.json is the source; a translation joins CATALOGS only with every key.
import en from "./messages/en.json" with { type: "json" };
import { LOCALES, type Locale } from "./locales";
import { createFormatter } from "./format-message.js";

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
