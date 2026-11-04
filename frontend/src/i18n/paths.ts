// paths.ts — language-aware URLs for the marketing site (rules and examples in core.js).
import { I18N, type Locale } from "./locales";
import * as core from "./core.js";

export const isLocalizedPath = (path: string): boolean => core.isLocalizedPath(I18N, path);
export const localizeHref = (href: string, locale: Locale): string => core.localizeHref(I18N, href, locale);
export const localeOf = (pathname: string): Locale => core.localeOf(I18N, pathname) as Locale;
export const stripLocale = (pathname: string): string => core.stripLocale(I18N, pathname);
