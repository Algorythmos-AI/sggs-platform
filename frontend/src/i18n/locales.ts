// locales.ts — the site's languages, typed over locales.json (also read by the redirect generator,
// scripts/gen-i18n-redirects.mjs, and the unit tests, scripts/test-i18n.mjs).
//
// Every marketing page lives under a language prefix (/en, /pa, /fr). The Knowledge Base
// (/search, /reader, …), /ang/N, /og/*, /rss.xml and /sitemap.xml are not localized and keep
// their paths. Only ENABLED locales build; a known locale that is not enabled has no pages and its
// URLs redirect to English (vercel.json).
import config from "./locales.json" with { type: "json" };
import { configProblems, isLocale as isLocaleIn } from "./core.js";

export type Locale = "en" | "pa" | "fr";

export interface LocaleInfo {
  htmlLang: string;   // <html lang>
  intl: string;       // the Intl locale for numbers and dates (en-GB: "26 October 2026")
  ogLocale: string;   // og:locale
  name: string;       // the language's own name, in its own script
}

export const I18N = config;
export const LOCALES = config.locales as Record<Locale, LocaleInfo>;
export const DEFAULT_LOCALE = config.default as Locale;
export const ENABLED_LOCALES = config.enabled as Locale[];

export const isLocale = (s: string | undefined): s is Locale => isLocaleIn(config, s);

// A broken locales.json must fail the build, not ship.
const problems = configProblems(config);
if (problems.length) throw new Error(`locales.json: ${problems.join("; ")}`);

// getStaticPaths() for a page that exists in every enabled language.
export const localeStaticPaths = () => ENABLED_LOCALES.map((lang) => ({ params: { lang } }));
