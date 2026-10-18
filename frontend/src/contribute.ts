// contribute.ts — the single source for /contribute (optional support for Gurbani Soul via
// Stripe-hosted Payment Links). Plain <a> links only: no Stripe.js and no script from Stripe ever
// loads on our pages; the visitor leaves for buy.stripe.com only when they click.
//
// Mode is a build-time switch, PUBLIC_CONTRIBUTE_MODE (Vercel project env):
//   * "off"  (default, also any unknown value) — the page explains support is opening soon and
//            renders NO payment link.
//   * "test" — staging: only Stripe TEST-mode links (https://buy.stripe.com/test_…) or null.
//   * "live" — production: every link must be a live link (never test_, never null).
// assertLinks() runs at import time, so a wrong link for the mode FAILS THE BUILD rather than
// shipping a test link to production or a live link to staging.
//
// Wording rules (constraint 1 of the plan): Algorythmos Pty Ltd is a company, not a charity —
// these are contributions, never "donations", and they are not tax-deductible. Support unlocks
// nothing; every feature stays free.

export type ContributeMode = "off" | "test" | "live";

const raw = import.meta.env.PUBLIC_CONTRIBUTE_MODE;
export const CONTRIBUTE_MODE: ContributeMode = raw === "test" || raw === "live" ? raw : "off";

export type Tier = {
  key: string;
  amount: string;   // display text, e.g. "A$21" — the price itself lives in Stripe
  note: string;
  url: string | null; // null = not created yet (allowed in test mode only)
};

type LinkSet = { once: Tier[]; monthly: Tier[]; custom: string | null; portal: string | null };

// Stripe TEST-mode links from the "Algorythmos sandbox" account (no real money). They redirect to
// https://sggs-staging.vercel.app/contribute#thank-you. Pay with card 4242 4242 4242 4242.
const TEST: LinkSet = {
  once: [
    { key: "once-5", amount: "A$5", note: "A small offering", url: "https://buy.stripe.com/test_dRmeVc9uXh0McOUaHg18c0a" },
    { key: "once-11", amount: "A$11", note: "Helps keep the lights on", url: "https://buy.stripe.com/test_6oU6oGfTl4e0dSYeXw18c05" },
    { key: "once-21", amount: "A$21", note: "Helps cover a month of hosting", url: "https://buy.stripe.com/test_7sYaEW9uXaCog16cPo18c06" },
    { key: "once-51", amount: "A$51", note: "Helps fund scholarly review", url: "https://buy.stripe.com/test_4gM9AS36z9yk3ekdTs18c07" },
  ],
  monthly: [
    { key: "monthly-5", amount: "A$5 / month", note: "Steady sewa", url: "https://buy.stripe.com/test_28EfZgaz111O2ag4iS18c03" },
    { key: "monthly-11", amount: "A$11 / month", note: "Steady sewa", url: "https://buy.stripe.com/test_cNi14m8qTcKwaGM2aK18c01" },
    { key: "monthly-21", amount: "A$21 / month", note: "Steady sewa", url: "https://buy.stripe.com/test_5kQ28q7mPfWI0289Dc18c02" },
  ],
  custom: "https://buy.stripe.com/test_3cIcN49uXcKwdSY3eO18c09", // "customer chooses what to pay" link (A$0.50 minimum — Stripe's AUD floor — A$1,000 maximum)
  portal: "https://billing.stripe.com/p/login/test_4gM6oG22vh0M16caHg18c00", // Stripe customer portal login link (cancel / update a monthly contribution)
};

// LIVE links from the Algorythmos Stripe account (real payments; card only, Algorythmos is the
// merchant). They redirect to https://gurbanisoul.com/contribute#thank-you.
const LIVE: LinkSet = {
  once: [
    { ...TEST.once[0], url: "https://buy.stripe.com/aFacN48jTfwE4BP58Ed3i0i" },
    { ...TEST.once[1], url: "https://buy.stripe.com/aFaaEW8jTgAI4BPbx2d3i00" },
    { ...TEST.once[2], url: "https://buy.stripe.com/14A5kC43D0BKfgtdFad3i01" },
    { ...TEST.once[3], url: "https://buy.stripe.com/bJe14mcA9cks9W9fNid3i02" },
  ],
  monthly: [
    { ...TEST.monthly[0], url: "https://buy.stripe.com/7sY4gy57H0BK1pDfNid3i04" },
    { ...TEST.monthly[1], url: "https://buy.stripe.com/dRmdR80Rr98g8S50Sod3i05" },
    { ...TEST.monthly[2], url: "https://buy.stripe.com/14A3cu2Zzack3xL9oUd3i06" },
  ],
  custom: "https://buy.stripe.com/28E28qas11FOc4h1Wsd3i0h",
  portal: "https://billing.stripe.com/p/login/aFaaEW8jTgAI4BPbx2d3i00",
};

const TEST_RE = /^https:\/\/buy\.stripe\.com\/test_[A-Za-z0-9]+$/;
const LIVE_RE = /^https:\/\/buy\.stripe\.com\/(?!test_)[A-Za-z0-9]+$/;
const PORTAL_TEST_RE = /^https:\/\/billing\.stripe\.com\/p\/login\/test_[A-Za-z0-9]+$/;
const PORTAL_LIVE_RE = /^https:\/\/billing\.stripe\.com\/p\/login\/(?!test_)[A-Za-z0-9]+$/;

export function assertLinks(mode: ContributeMode, set: LinkSet): void {
  if (mode === "off") return;
  const urls = [...set.once, ...set.monthly].map((t) => [t.key, t.url] as const);
  urls.push(["custom", set.custom]);
  const problems: string[] = [];
  for (const [key, url] of urls) {
    if (url === null) {
      if (mode === "live") problems.push(`${key}: missing live link`);
    } else if (!(mode === "live" ? LIVE_RE : TEST_RE).test(url)) {
      problems.push(`${key}: ${url} is not a ${mode} Payment Link`);
    }
  }
  if (set.portal === null) {
    if (mode === "live") problems.push("portal: missing live link");
  } else if (!(mode === "live" ? PORTAL_LIVE_RE : PORTAL_TEST_RE).test(set.portal)) {
    problems.push(`portal: ${set.portal} is not a ${mode} customer-portal link`);
  }
  if (problems.length) {
    throw new Error(`contribute.ts: PUBLIC_CONTRIBUTE_MODE=${mode} has bad links:\n  ${problems.join("\n  ")}`);
  }
}

export const LINKS: LinkSet | null = CONTRIBUTE_MODE === "live" ? LIVE : CONTRIBUTE_MODE === "test" ? TEST : null;
if (LINKS) assertLinks(CONTRIBUTE_MODE, LINKS);
