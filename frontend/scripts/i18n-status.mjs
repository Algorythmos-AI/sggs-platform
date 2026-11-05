#!/usr/bin/env node
// i18n-status.mjs — is every translation complete, current and reviewed?
//
//   node scripts/i18n-status.mjs                 # report every language; exit 1 if an ENABLED one is not ready
//   node scripts/i18n-status.mjs --lock fr       # record fr's keys as translated from today's English
//   node scripts/i18n-status.mjs --sheet fr OUT  # write a review sheet (HTML) for fr's reviewer
//
// For each translation catalog src/i18n/messages/<lang>.json:
//   missing   — an English key it does not have
//   extra     — a key English no longer has
//   stale     — the English changed since the translation was made (<lang>.lock.json keeps, per
//               key, a hash of the English it was translated from)
//   mismatch  — its <tags> differ from the English (the page would break), or it does not parse as
//               an ICU message (placeholders may differ; the preview build proves each one exists)
//   review    — src/i18n/reviews/<lang>.json must name a fluent reviewer and the sha256 of the exact
//               catalog they signed off (docs/website/translation.md)
// A language may be ENABLED (locales.json) only when all of these are clean; CI runs this script.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { IntlMessageFormat } from "intl-messageformat";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const DIR = here("../src/i18n/messages/");
const REVIEWS = here("../src/i18n/reviews/");
const cfg = JSON.parse(readFileSync(here("../src/i18n/locales.json"), "utf8"));
const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const flat = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [[pre + k, v]] : flat(v, `${pre}${k}.`)));
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const tags = (s) => [...new Set([...s.matchAll(/<\/?(\w+)>/g)].map((m) => m[1]))].sort().join(" ");

const en = new Map(flat(read(DIR + "en.json")));

export function status(lang) {
  const file = DIR + `${lang}.json`;
  if (!existsSync(file)) return null;
  const raw = readFileSync(file, "utf8");
  const tr = new Map(flat(JSON.parse(raw)));
  const lockFile = DIR + `${lang}.lock.json`;
  const lock = existsSync(lockFile) ? read(lockFile) : {};
  const out = { lang, total: en.size, translated: 0, missing: [], extra: [], stale: [], mismatch: [], review: null };
  for (const [k, src] of en) {
    if (!tr.has(k)) { out.missing.push(k); continue; }
    out.translated++;
    if (lock[k] !== hash(src)) out.stale.push(k);
    const v = tr.get(k);
    // Tags must match exactly (each one is an element the page renders). Placeholders may differ: a
    // translation picks among the values the page passes (e.g. {first} instead of {firstOrdinal}),
    // which the preview build (PUBLIC_I18N_PREVIEW=all) proves by rendering every page.
    if (tags(v) !== tags(src)) out.mismatch.push(`${k}: tags ${tags(v) || "none"}, English has ${tags(src) || "none"}`);
    else { try { new IntlMessageFormat(v, cfg.locales[lang].intl); } catch (e) { out.mismatch.push(`${k}: ${e.message}`); } }
  }
  for (const k of tr.keys()) if (!en.has(k)) out.extra.push(k);
  const revFile = REVIEWS + `${lang}.json`;
  const digest = createHash("sha256").update(raw).digest("hex");
  if (!existsSync(revFile)) out.review = "no review record";
  else {
    const r = read(revFile);
    if (!r.reviewer || !r.date) out.review = "review record has no reviewer or date";
    else if (r.catalogSha256 !== digest) out.review = `reviewed catalog ${String(r.catalogSha256).slice(0, 12)} ≠ current ${digest.slice(0, 12)}`;
  }
  out.ready = !out.missing.length && !out.extra.length && !out.stale.length && !out.mismatch.length && !out.review;
  return out;
}

const args = process.argv.slice(2);
if (args[0] === "--lock") {
  const lang = args[1];
  const tr = new Map(flat(read(DIR + `${lang}.json`)));
  const lock = Object.fromEntries([...en].filter(([k]) => tr.has(k)).map(([k, v]) => [k, hash(v)]));
  writeFileSync(DIR + `${lang}.lock.json`, JSON.stringify(lock, null, 2) + "\n");
  console.log(`${lang}: locked ${Object.keys(lock).length} keys to today's English`);
} else if (args[0] === "--sheet") {
  const [, lang, outPath] = args;
  const tr = new Map(flat(read(DIR + `${lang}.json`)));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const rows = [...en].map(([k, v]) => {
    const t = tr.get(k);
    const ratio = t ? (t.length / Math.max(1, v.length)).toFixed(2) : "";
    return `<tr${t ? "" : ' class="missing"'}><td><code>${esc(k)}</code></td><td>${esc(v)}</td><td lang="${cfg.locales[lang].htmlLang}">${t ? esc(t) : "<em>missing</em>"}</td><td>${ratio}</td></tr>`;
  });
  const s = status(lang);
  writeFileSync(outPath, `<!doctype html><meta charset="utf-8"><title>${lang} review sheet</title>
<style>body{font:15px/1.5 system-ui;margin:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 8px;vertical-align:top}th{background:#f5f0e6;text-align:left}tr.missing{background:#fff3f3}td:last-child{text-align:right;color:#666}code{font-size:12px}</style>
<h1>${cfg.locales[lang].name} — review sheet</h1>
<p>${s.translated} of ${s.total} strings translated · ${s.stale.length} stale · ${s.mismatch.length} placeholder mismatches. Review the rendered pages on staging too: the last column is the length against the English.</p>
<table><tr><th>Key</th><th>English</th><th>${esc(cfg.locales[lang].name)}</th><th>Length</th></tr>${rows.join("")}</table>`);
  console.log(`wrote ${outPath}`);
} else {
  const langs = Object.keys(cfg.locales).filter((l) => l !== cfg.default);
  let bad = 0;
  for (const l of langs) {
    const s = status(l);
    const enabled = cfg.enabled.includes(l);
    if (!s) { console.log(`${l}: no catalog${enabled ? " — but it is ENABLED" : ""}`); if (enabled) bad++; continue; }
    console.log(`${l}: ${s.translated}/${s.total} translated, ${s.missing.length} missing, ${s.stale.length} stale, ${s.extra.length} extra, ${s.mismatch.length} mismatched; review: ${s.review ?? "signed for this catalog"}${enabled ? " [ENABLED]" : ""}`);
    for (const m of s.mismatch.slice(0, 20)) console.log(`  mismatch ${m}`);
    for (const k of s.extra.slice(0, 10)) console.log(`  extra ${k}`);
    if (s.mismatch.length || s.extra.length) bad++;                    // broken in any language
    else if (enabled && !s.ready) bad++;                               // shipped languages must be whole and reviewed
  }
  process.exit(bad ? 1 : 0);
}
