// core.js — the pure language/URL rules, in plain JS so scripts/test-i18n.mjs (and the redirect
// generator) run them under bare Node. Typed wrappers: locales.ts, paths.ts. Every function takes
// the config (locales.json) explicitly; nothing here reads the environment.
//
//   localizeHref(cfg, "/features", "en")      → "/en/features"
//   localizeHref(cfg, "/", "en")              → "/en"
//   localizeHref(cfg, "/support#contact", "en")→ "/en/support#contact"
//   localizeHref(cfg, "/search", "en")        → "/search"   (Knowledge Base: never prefixed)
//   localeOf(cfg, "/en/learn/x")              → "en"
//   stripLocale(cfg, "/en/learn/x")           → "/learn/x"
//
// No trailing slashes (trailingSlash: 'never'); slugs are the same in every language.

/** @param {any} cfg @param {string | undefined} s */
export const isLocale = (cfg, s) => !!s && Object.prototype.hasOwnProperty.call(cfg.locales, s);

/** "/x/" → "/x", "" → "/" */
const norm = (/** @type {string} */ p) => p.replace(/\/+$/, "") || "/";

/** @param {string} href @returns {[string, string]} the path and its "?…"/"#…" tail */
const splitPath = (href) => {
  const i = href.search(/[?#]/);
  return i === -1 ? [href, ""] : [href.slice(0, i), href.slice(i)];
};

/** True for paths that live under a language prefix: the listed pages and everything below them
 *  ("/learn/<slug>"). "/" matches only itself. @param {any} cfg @param {string} path */
export const isLocalizedPath = (cfg, path) => {
  const p = norm(path);
  return cfg.localizedPages.some((/** @type {string} */ page) =>
    page === "/" ? p === "/" : p === page || p.startsWith(page + "/"));
};

/** @param {any} cfg @param {string} href @param {string} locale */
export const localizeHref = (cfg, href, locale) => {
  if (!href.startsWith("/") || href.startsWith("//")) return href; // external, mailto:, protocol-relative
  const [path, rest] = splitPath(href);
  if (isLocale(cfg, path.split("/")[1])) return href;               // already localized
  if (!isLocalizedPath(cfg, path)) return href;
  const p = norm(path);
  return (p === "/" ? `/${locale}` : `/${locale}${p}`) + rest;
};

/** @param {any} cfg @param {string} pathname */
export const localeOf = (cfg, pathname) => {
  const first = pathname.split("/")[1];
  return isLocale(cfg, first) ? first : cfg.default;
};

/** @param {any} cfg @param {string} pathname */
export const stripLocale = (cfg, pathname) => {
  const parts = pathname.split("/");
  if (!isLocale(cfg, parts[1])) return norm(pathname);
  return norm("/" + parts.slice(2).join("/"));
};

/** Validate locales.json; returns a list of problems (empty = fine). @param {any} cfg */
export const configProblems = (cfg) => {
  const out = [];
  if (!isLocale(cfg, cfg.default)) out.push(`default locale "${cfg.default}" is not defined`);
  for (const l of cfg.enabled) if (!isLocale(cfg, l)) out.push(`enabled locale "${l}" is not defined`);
  if (!cfg.enabled.includes(cfg.default)) out.push(`the default locale "${cfg.default}" must be enabled`);
  if (new Set(cfg.enabled).size !== cfg.enabled.length) out.push("enabled lists a locale twice");
  for (const p of cfg.localizedPages) {
    if (!p.startsWith("/") || (p !== "/" && p.endsWith("/"))) out.push(`localized page "${p}" must be root-relative with no trailing slash`);
  }
  return out;
};

/** The Vercel redirects for this config: the bare root to the default language (302: it is a
 *  per-visitor answer, never cached as permanent), every pre-i18n marketing URL to its English page
 *  (308, forever: App Store Connect, the app and old links point at them), and every known but
 *  not-enabled language back to English (302, so turning it on later is not blocked by caches).
 *  @param {any} cfg */
export const redirects = (cfg) => {
  const d = cfg.default;
  // The root follows the browser's FIRST preferred language, when that language is enabled (a
  // bare "fr-CA,fr;q=0.9" goes to /fr; "en-US,fr;q=0.8" goes to English). Crawlers send none.
  const out = cfg.enabled.filter((/** @type {string} */ l) => l !== d).map((/** @type {string} */ l) => ({
    source: "/",
    has: [{ type: "header", key: "accept-language", value: `^\\s*${l}(?:[-_,;].*)?$` }],
    destination: `/${l}`,
    statusCode: 302,
  }));
  out.push({ source: "/", destination: `/${d}`, statusCode: 302 });
  for (const page of cfg.localizedPages) {
    if (page === "/") continue;
    out.push({ source: page, destination: `/${d}${page}`, permanent: true });
    out.push({ source: `${page}/:rest+`, destination: `/${d}${page}/:rest+`, permanent: true });
  }
  for (const l of Object.keys(cfg.locales)) {
    if (cfg.enabled.includes(l)) continue;
    out.push({ source: `/${l}`, destination: `/${d}`, statusCode: 302 });
    out.push({ source: `/${l}/:rest+`, destination: `/${d}/:rest+`, statusCode: 302 });
  }
  return out;
};
