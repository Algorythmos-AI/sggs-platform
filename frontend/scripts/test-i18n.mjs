#!/usr/bin/env node
// Gate tests for the language/URL rules (src/i18n/core.js). Repo style: standalone, exit 1 on
// failure, no test-runner dependency. Run: node frontend/scripts/test-i18n.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  isLocalizedPath, localizeHref, localeOf, stripLocale, configProblems, redirects,
} from "../src/i18n/core.js";
import { createFormatter } from "../src/i18n/format-message.js";
import { pseudo } from "../src/i18n/pseudo.js";

const cfg = JSON.parse(readFileSync(fileURLToPath(new URL("../src/i18n/locales.json", import.meta.url)), "utf8"));
let pass = 0, fail = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}` + (ok ? "" : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));
}

console.log("config");
eq("committed locales.json is valid", configProblems(cfg), []);
eq("default must be enabled", configProblems({ ...cfg, enabled: ["fr"] }).length > 0, true);
eq("unknown enabled locale", configProblems({ ...cfg, enabled: ["en", "de"] }).length > 0, true);
eq("trailing slash page", configProblems({ ...cfg, localizedPages: ["/x/"] }).length > 0, true);

console.log("localizeHref");
eq("home", localizeHref(cfg, "/", "en"), "/en");
eq("page", localizeHref(cfg, "/features", "fr"), "/fr/features");
eq("trailing slash dropped", localizeHref(cfg, "/features/", "en"), "/en/features");
eq("hash kept", localizeHref(cfg, "/support#contact", "pa"), "/pa/support#contact");
eq("query kept", localizeHref(cfg, "/contribute?x=1#thank-you", "en"), "/en/contribute?x=1#thank-you");
eq("learn article", localizeHref(cfg, "/learn/what-is-an-ang", "en"), "/en/learn/what-is-an-ang");
eq("Knowledge Base untouched", localizeHref(cfg, "/search", "fr"), "/search");
eq("KB with query untouched", localizeHref(cfg, "/reader?ang=1", "fr"), "/reader?ang=1");
eq("rss untouched", localizeHref(cfg, "/rss.xml", "fr"), "/rss.xml");
eq("prefix lookalike untouched", localizeHref(cfg, "/learning", "en"), "/learning");
eq("external untouched", localizeHref(cfg, "https://stripe.com/privacy", "en"), "https://stripe.com/privacy");
eq("mailto untouched", localizeHref(cfg, "mailto:a@b.c", "en"), "mailto:a@b.c");
eq("protocol-relative untouched", localizeHref(cfg, "//x.org/features", "en"), "//x.org/features");
eq("already localized untouched", localizeHref(cfg, "/fr/features", "en"), "/fr/features");
eq("bare anchor untouched", localizeHref(cfg, "#vaars", "en"), "#vaars");

console.log("localeOf / stripLocale / isLocalizedPath");
eq("localeOf en", localeOf(cfg, "/en/features"), "en");
eq("localeOf fr home", localeOf(cfg, "/fr"), "fr");
eq("localeOf KB = default", localeOf(cfg, "/search"), "en");
eq("strip article", stripLocale(cfg, "/en/learn/x"), "/learn/x");
eq("strip home", stripLocale(cfg, "/pa"), "/");
eq("strip home slash", stripLocale(cfg, "/pa/"), "/");
eq("strip non-localized", stripLocale(cfg, "/search/"), "/search");
eq("root is localized", isLocalizedPath(cfg, "/"), true);
eq("search is not", isLocalizedPath(cfg, "/search"), false);

console.log("redirects");
const r = redirects(cfg);
const find = (src) => r.filter((x) => x.source === src);
eq("root last rule → default, 302", find("/").at(-1), { source: "/", destination: "/en", statusCode: 302 });
eq("old page → 308", find("/privacy")[0], { source: "/privacy", destination: "/en/privacy", permanent: true });
eq("old article → 308", find("/learn/:rest+")[0], { source: "/learn/:rest+", destination: "/en/learn/:rest+", permanent: true });
eq("no rule for a KB path", find("/search").length, 0);
eq("no rule catches an enabled prefix", r.some((x) => x.source === "/en" || x.source.startsWith("/en/")), false);
for (const l of Object.keys(cfg.locales).filter((l) => !cfg.enabled.includes(l))) {
  eq(`disabled /${l} → /en`, find(`/${l}`)[0], { source: `/${l}`, destination: "/en", statusCode: 302 });
}
const both = { ...cfg, enabled: ["en", "fr", "pa"] };
const rb = redirects(both).filter((x) => x.source === "/");
eq("negotiated root: one rule per extra language, default last", rb.map((x) => x.destination), ["/fr", "/pa", "/en"]);
eq("no disabled-language rules when all enabled", redirects(both).some((x) => x.source === "/fr" || x.source === "/pa"), false);
const re = (l) => new RegExp(rb.find((x) => x.destination === `/${l}`).has[0].value);
eq("fr-CA,fr;q=0.9 → fr", re("fr").test("fr-CA,fr;q=0.9"), true);
eq("fr → fr", re("fr").test("fr"), true);
eq("en-US,fr;q=0.8 not fr", re("fr").test("en-US,fr;q=0.8"), false);
eq("fy (Frisian) not fr", re("fr").test("fy-NL"), false);
eq("pa-IN → pa", re("pa").test("pa-IN,pa;q=0.9,en;q=0.8"), true);
eq("pa-Guru-IN → pa", re("pa").test("pa-Guru-IN"), true);

console.log("messages");
const en = JSON.parse(readFileSync(fileURLToPath(new URL("../src/i18n/messages/en.json", import.meta.url)), "utf8"));
const flat = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [[pre + k, v]] : flat(v, `${pre}${k}.`)));
const f = createFormatter(en, "en-GB");
const throws = (fn) => { try { fn(); return false; } catch { return true; } };
let parsed = 0, roundTrip = 0;
for (const [key, src] of flat(en)) {
  const hasArgs = /[{<]/.test(src);
  if (!hasArgs) { if (f.t(key) === src) roundTrip++; else eq(`"${key}" renders as written`, f.t(key), src); }
  else if (throws(() => f.rich(key, { year: "2026", amount: "A$5", what: "x", who: "y", date: "1 May 2026" }))) eq(`"${key}" parses`, false, true);
  parsed++;
}
eq("every source message parses", parsed > 0, true);
eq("plain messages render exactly as written (ICU apostrophes safe)", roundTrip, flat(en).filter(([, v]) => !/[{<]/.test(v)).length);
eq("a missing key fails the build", throws(() => f.t("nav.nope")), true);
eq("a tag message refuses plain t()", throws(() => f.t("footer.give")), true);
eq("rich parts", f.rich("footer.give"), ["Gurbani Soul is free and ad-free. ", { tag: "link", text: "Contribute" }]);
eq("values are never markup", f.rich("footer.photoCredit", { who: "<b>x</b>" }), [{ tag: "link", text: "<b>x</b>" }, " / Unsplash"]);
const nested = createFormatter({ m: "<a>x <b>y</b></a>" }, "en-GB");
eq("nested tags are refused", throws(() => nested.rich("m")), true);
const plural = createFormatter({ n: "{n, plural, one {# Ang} other {# Angs}}" }, "fr-FR");
eq("French plural: 0 is singular", plural.t("n", { n: 0 }), "0 Ang");
eq("pseudo marks and lengthens", /^⟦.+·+⟧$/.test(pseudo("See every feature")), true);
eq("pseudo leaves blank text alone", pseudo("  "), "  ");
const p = createFormatter(en, "en-GB", { pseudo: true });
eq("pseudo reaches rich text", p.rich("footer.give").every((x) => (typeof x === "string" ? x : x.text).startsWith("⟦")), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
