// content.ts — which languages a Learn article exists in. An article is published in a language
// only once its translation is written and reviewed (docs/i18n); until then a language's pages link
// to the English article, and the article has no page (and no hreflang) in that language.
import { DEFAULT_LOCALE, ENABLED_LOCALES, LOCALES, type Locale } from "./locales";
import { isLocalizedPath, localizeHref, stripLocale } from "./paths";

// Translated articles, by language: none yet (the Learn translations are their own PRs).
const TRANSLATED: Partial<Record<Locale, readonly string[]>> = {};

export const articleLocales = (slug: string): Locale[] =>
  ENABLED_LOCALES.filter((l) => l === DEFAULT_LOCALE || TRANSLATED[l]?.includes(slug));

// The language a link to the article opens in, from a page in `lang`.
export const articleLangFor = (lang: Locale, slug: string): Locale =>
  articleLocales(slug).includes(lang) ? lang : DEFAULT_LOCALE;

// The article's URL from a page in `lang`: its own language when it exists there, else English.
export const learnHref = (lang: Locale, slug: string): string =>
  localizeHref(`/learn/${slug}`, articleLocales(slug).includes(lang) ? lang : DEFAULT_LOCALE);

// The language versions of a localized page, for hreflang: every enabled language the page exists
// in (a Learn article only where it is translated), plus the bare root as x-default (it picks the
// visitor's language). Pages outside the marketing site have none.
export const alternates = (pathname: string): { lang: Locale | null; hreflang: string; href: string }[] => {
  const page = stripLocale(pathname);
  if (!isLocalizedPath(page)) return [];
  const article = page.match(/^\/learn\/([^/]+)$/)?.[1];
  const langs = article ? articleLocales(article) : ENABLED_LOCALES;
  return [
    ...langs.map((l) => ({ lang: l, hreflang: LOCALES[l].htmlLang, href: localizeHref(page, l) })),
    { lang: null, hreflang: "x-default", href: "/" },
  ];
};
