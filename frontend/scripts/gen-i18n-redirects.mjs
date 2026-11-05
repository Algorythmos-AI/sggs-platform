#!/usr/bin/env node
// gen-i18n-redirects.mjs — write the language redirects into frontend/vercel.json "redirects"
// from src/i18n/locales.json (rules in src/i18n/core.js `redirects`).
//
//   node scripts/gen-i18n-redirects.mjs           # rewrite vercel.json's "redirects"
//   node scripts/gen-i18n-redirects.mjs --check   # exit 1 if vercel.json is stale
//
// Only the "redirects" key is owned here; tools/gen_gateway.py owns "rewrites" and keeps every
// other key as it finds it, so the two generators never overwrite each other.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { configProblems, redirects } from "../src/i18n/core.js";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const VERCEL = here("../vercel.json");
const cfg = JSON.parse(readFileSync(here("../src/i18n/locales.json"), "utf8"));

const problems = configProblems(cfg);
if (problems.length) {
  console.error(`locales.json: ${problems.join("; ")}`);
  process.exit(1);
}

const current = readFileSync(VERCEL, "utf8");
const doc = JSON.parse(current);
// "redirects" sits right after "cleanUrls", so the file reads top-down in the order Vercel applies
// it (redirects, then rewrites). Every other key is kept as it is, in its place.
const ordered = {};
for (const [k, v] of Object.entries(doc)) {
  if (k === "redirects") continue;
  ordered[k] = v;
  if (k === "cleanUrls") ordered.redirects = redirects(cfg);
}
if (!("redirects" in ordered)) ordered.redirects = redirects(cfg);
const want = JSON.stringify(ordered, null, 2) + "\n";

if (process.argv.includes("--check")) {
  if (current !== want) {
    console.error("frontend/vercel.json redirects are stale — run: node frontend/scripts/gen-i18n-redirects.mjs");
    process.exit(1);
  }
  console.log("language redirects are current");
} else {
  writeFileSync(VERCEL, want);
  console.log(`wrote vercel.json (${redirects(cfg).length} redirects; enabled: ${cfg.enabled.join(", ")})`);
}
