// format-message.js — render an ICU message from a catalog, at build time. Plain JS so
// scripts/test-i18n.mjs runs it under Node; typed wrapper: t.ts.
//
//   t("nav.features")                    → "Features"
//   t("band.fine", { amount: "A$5" })    → "From A$5 · once or monthly"
//   rich("footer.give")                  → ["Gurbani Soul is free and ad-free. ", { tag: "link", text: "Contribute" }]
//
// rich() never returns markup: the component renders each tag part itself (`<a …>{p.text}</a>`),
// so Astro escapes every translated word and scoped styles still reach the element. Translations
// therefore cannot inject HTML. A missing key or a malformed message throws: the build fails.
import { IntlMessageFormat } from "intl-messageformat";
import { pseudo as pseudoText } from "./pseudo.js";

/** @param {any} catalog @param {string} key */
const lookup = (catalog, key) => {
  const v = key.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), catalog);
  if (typeof v !== "string") throw new Error(`i18n: no message "${key}"`);
  return v;
};

/**
 * @param {any} catalog   the language's messages (nested object of strings)
 * @param {string} intl   Intl locale for plurals and numbers, e.g. "en-GB"
 * @param {{ pseudo?: boolean }} [opts]
 */
export const createFormatter = (catalog, intl, opts = {}) => {
  const cache = new Map();
  const fmt = (/** @type {string} */ key) => {
    let f = cache.get(key);
    if (!f) {
      f = new IntlMessageFormat(lookup(catalog, key), intl);
      cache.set(key, f);
    }
    return f;
  };
  const text = (/** @type {string} */ s) => (opts.pseudo ? pseudoText(s) : s);

  /** Plain text. @param {string} key @param {Record<string, any>} [values] */
  const t = (key, values) => {
    const out = fmt(key).format(values);
    if (typeof out !== "string") throw new Error(`i18n: "${key}" has tags; use rich()`);
    return text(out);
  };

  /** Text and tag parts, in order. Tags may not nest (a tag's content is plain text).
   *  @param {string} key @param {Record<string, any>} [values]
   *  @returns {(string | { tag: string, text: string })[]} */
  const rich = (key, values = {}) => {
    const src = lookup(catalog, key);
    /** @type {Record<string, any>} */
    const wrapped = { ...values };
    for (const m of src.matchAll(/<([a-zA-Z][\w-]*)>/g)) {
      const tag = m[1];
      wrapped[tag] = (/** @type {any[]} */ chunks) => {
        if (chunks.some((c) => typeof c !== "string")) throw new Error(`i18n: "${key}": <${tag}> may not hold another tag`);
        return { tag, text: text(chunks.join("")) };
      };
    }
    const out = fmt(key).format(wrapped);
    /** @type {(string | { tag: string, text: string })[]} */
    const parts = [];
    for (const p of Array.isArray(out) ? out : [out]) {
      if (typeof p === "string" || typeof p === "number") {
        const prev = parts[parts.length - 1];
        if (typeof prev === "string") parts[parts.length - 1] = prev + String(p);
        else parts.push(String(p));
      } else parts.push(p);
    }
    return parts.map((p) => (typeof p === "string" ? text(p) : p));
  };

  return { t, rich };
};

/** Escape text for HTML. @param {unknown} s */
export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => /** @type {Record<string,string>} */ ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Rich parts as an HTML string, for the few places that need markup as text (the FAQ answers and
 *  their FAQPage JSON-LD). Every text part and tag text is escaped; only the renderers — written
 *  in our own pages — produce markup.
 *  @param {(string | { tag: string, text: string })[]} parts
 *  @param {Record<string, (escapedText: string) => string>} renderers */
export const richHtml = (parts, renderers) =>
  parts.map((p) => {
    if (typeof p === "string") return escapeHtml(p);
    const r = renderers[p.tag];
    if (!r) throw new Error(`i18n: no renderer for <${p.tag}>`);
    return r(escapeHtml(p.text));
  }).join("");
