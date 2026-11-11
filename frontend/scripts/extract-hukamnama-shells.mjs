#!/usr/bin/env node
// extract-hukamnama-shells.mjs — hand the built Hukamnama page shells to the server.
//
//   node scripts/extract-hukamnama-shells.mjs [--dist dist] [--out ../webapp/hukamnama_shells]
//
// astro build writes src/pages/[lang]/hukamnama/hk-shell.astro to dist/<lang>/hukamnama/hk-shell/
// index.html. That file is not a page: it is the shell webapp/hukamnama_page.py fills for
// /<lang>/hukamnama and /<lang>/hukamnama/YYYY-MM-DD. This script, run right after the build:
//
//   1. rewrites the shell's own path, "/<lang>/hukamnama/hk-shell", to
//      "/<lang>/hukamnama__HK_SUFFIX__" (canonical, hreflang, og:url, the language switcher);
//   2. checks the shell honours the contract (every token the server knows, balanced blocks, the
//      strings JSON with every key) and fails the build otherwise;
//   3. writes it to <out>/<lang>.html and removes it from dist, so it is never published, listed
//      in the sitemap or seen by the page gates.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i === -1 ? dflt : process.argv[i + 1]; };
const DIST = arg("--dist", here("../dist"));
const OUT = arg("--out", here("../../webapp/hukamnama_shells"));
const cfg = JSON.parse(readFileSync(here("../src/i18n/locales.json"), "utf8"));

// Kept in step with webapp/hukamnama_page.py (STRING_KEYS, and the tokens _values fills).
const STRING_KEYS = ["months", "date", "title_today", "title_dated", "h1_today", "h1_dated", "description",
  "description_none", "status_before", "status_not_today", "status_none", "status_missing", "citation",
  "translation_label", "rahao_label"];
const REQUIRED = ["TITLE", "DESCRIPTION", "ROBOTS", "JSONLD", "H1", "LINES", "CITATION", "SUFFIX"];
const KNOWN = new Set([...REQUIRED, "CANONICAL", "STATUS", "DATE", "DATE_ISO", "ANG", "RAAG", "AUTHOR",
  "READER_HREF", "PERMALINK", "RANGE_SHA", "TRANSLATION_LABEL", "ENDIF",
  ...["SHABAD", "STATUS", "TODAY", "LATEST", "DATED", "MEANING", "UNAVAILABLE", "RAAG", "AUTHOR"].map((f) => `IF_${f}`)]);

const problems = [];
let written = 0;
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith(".html")) rmSync(join(OUT, f));   // no stale language

for (const lang of cfg.enabled) {
  const dir = join(DIST, lang, "hukamnama");
  const file = join(dir, "hk-shell", "index.html");
  if (!existsSync(file)) { problems.push(`${lang}: ${file} was not built`); continue; }
  const own = `/${lang}/hukamnama/hk-shell`;
  let html = readFileSync(file, "utf8");
  // Every language's shell path (the switcher links to the others), then nothing may be left.
  for (const l of Object.keys(cfg.locales)) html = html.replaceAll(`/${l}/hukamnama/hk-shell`, `/${l}/hukamnama__HK_SUFFIX__`);
  if (html.includes("hk-shell")) problems.push(`${lang}: "hk-shell" is still in the shell after rewriting ${own}`);

  const tokens = [...html.matchAll(/__HK_([A-Z0-9]+(?:_[A-Z0-9]+)*)__/g)].map((m) => m[1]);
  for (const t of REQUIRED) if (!tokens.includes(t)) problems.push(`${lang}: token __HK_${t}__ is missing`);
  for (const t of new Set(tokens)) if (!KNOWN.has(t)) problems.push(`${lang}: unknown token __HK_${t}__`);
  const opens = tokens.filter((t) => t.startsWith("IF_")).length, closes = tokens.filter((t) => t === "ENDIF").length;
  if (opens !== closes) problems.push(`${lang}: ${opens} __HK_IF_…__ but ${closes} __HK_ENDIF__`);

  const m = html.match(/<script type="application\/json" id="hk-strings">(.*?)<\/script>/s);
  if (!m) problems.push(`${lang}: the hk-strings JSON is missing (or its tag changed shape)`);
  else {
    let s = null;
    try { s = JSON.parse(m[1]); } catch (e) { problems.push(`${lang}: hk-strings does not parse: ${e.message}`); }
    if (s) {
      for (const k of STRING_KEYS) if (!(k in s)) problems.push(`${lang}: hk-strings lacks "${k}"`);
      if (!Array.isArray(s.months) || s.months.length !== 12) problems.push(`${lang}: hk-strings.months must be 12 names`);
    }
  }
  if (!new RegExp(`<html lang="${cfg.locales[lang].htmlLang}"`).test(html)) problems.push(`${lang}: wrong <html lang>`);

  writeFileSync(join(OUT, `${lang}.html`), html);
  rmSync(dir, { recursive: true, force: true });
  written++;
}

if (problems.length) {
  for (const p of problems) console.error(`extract-hukamnama-shells: ${p}`);
  process.exit(1);
}
console.log(`Hukamnama shells: ${written} language(s) → ${OUT} (removed from ${DIST})`);
