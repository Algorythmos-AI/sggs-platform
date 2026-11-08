---
title: "Contribute and Stripe"
description: "The Contribute page on gurbanisoul.com: Stripe-hosted Payment Links, the off/test/live build switch, how the amounts are set, its history and a runbook for changing mode or an amount."
sidebar:
  order: 4
---
# Contribute and Stripe

The Contribute page (`/en/contribute`, and its Punjabi and French versions) lets a reader support
Gurbani Soul with a one-time or monthly contribution. It has been live in production since 1.4.4.
It is built from two files: `frontend/src/contribute.ts`, the single source of the links and the
mode, and `frontend/src/pages/[lang]/contribute.astro`, the page.

## The rules it keeps

- **Stripe-hosted Payment Links only.** Every amount is a plain `<a>` to a Stripe-hosted page.
  No Stripe.js and no script from Stripe ever loads on our pages; the reader leaves for Stripe only
  when they click, and the site never sees card details.
- **Contributions, never donations.** Algorythmos Pty Ltd is a company, not a charity: a
  contribution is not tax-deductible, and the page says so, with the company's ABN. Contributing
  unlocks nothing; every feature stays free.
- **Never from the app.** The page is not linked from the iOS app (App Store guideline 3.1.1).
  It is separate from `/support`, the App Store help page, whose path is frozen.
- **No script on the page.** The thank-you note is the page's `#thank-you` section, revealed by CSS
  `:target` when Stripe returns the reader to `/contribute#thank-you`, which redirects to the
  English page with the fragment kept.

## The mode switch: `PUBLIC_CONTRIBUTE_MODE`

The mode is a build-time variable, set in the Vercel project's environment:

| Mode | Where | What the page shows |
|---|---|---|
| `off` | the default, and any unknown value: CI and local builds | an "opening soon" note and **no payment link**; the nav, footer and home band do not link to it, and the privacy policy has no Contributions section |
| `test` | Preview (staging) | Stripe test-mode links only, from the sandbox account (no real money), with a note saying so |
| `live` | Production | live links only |

`assertLinks()` runs when `contribute.ts` is imported, so **a link that does not match the mode
fails the build**: a test link can never reach production, nor a live link staging. In `live`
every tier, the custom amount and the customer-portal link must be present; in `test` a link not
yet created may be `null`, and the page shows that tier as not connected.

## How the amounts work

| Kind | Amounts |
|---|---|
| Your own amount | from A$0.50 (Stripe's AUD floor), shown first |
| One time | A$5, A$11, A$21, A$51 |
| Monthly | A$5, A$11, A$21 |

The **price lives in Stripe**, on each Payment Link. In `contribute.ts` a tier is a key
(`once-21`, `monthly-11`), a display amount and its link. The page reads the number from the key and
formats it for the page's language (`fmtAud`), and each tier's note comes from the message catalog
(`contributeTiers.notes.<key>`), so a new tier needs its note translated and reviewed in every
enabled language ([translation workflow](translation.md)). Monthly contributions are cancelled or
updated by the reader in Stripe's customer portal, linked from the page; refunds are by email to
support. The live and test sets are kept side by side in `contribute.ts`, one link per tier.

## History

| Release | Change |
|---|---|
| 1.4.4 | The page, the mode switch and the privacy policy's Contributions section. One-time A$11/21/51/101, monthly A$5/11/21, your own amount from A$5. |
| 1.4.5 | Your own amount from A$0.50, with new live and test links (the old A$5 link retired after deploy); the ABN in the tax answer. |
| 1.4.6 | One-time tiers A$5, A$11, A$21 and A$51 (new A$5 links), with your own amount above the cards; larger gifts go through the custom amount. |
| 1.6.0–1.6.2 | The page moves under the language prefix (`/en/contribute`) and gains Punjabi and French versions, signed off with the legal review of Privacy and Contribute (gate G4). Checkout stays in English. |

## Runbook: change the mode

The mode is read at build time, so changing it is an environment change plus a redeploy of the
**same** commit; it is not a release.

<!-- sggs:steps -->
1. In Vercel, open the website's project → Settings → Environment Variables, and set
   `PUBLIC_CONTRIBUTE_MODE` for the environment you are changing: **Production** (`live` or `off`)
   or **Preview** (`test` or `off`). Never `test` on Production.
2. Rehearse on staging first: set Preview, then
   `gh workflow run deploy-staging --ref integration --repo Algorythmos-AI/sggs-platform`.
3. For production: `gh workflow run deploy-production --ref main --repo Algorythmos-AI/sggs-platform`.
   The same commit redeploys through every gate, and the build pulls the new variable
   ([deploy runbook](../process/runbooks/deploy.md)).
4. Check the page in a browser: in `live` every tier links to a Stripe page whose path has no
   `test_`; in `off` the page says contributions are opening soon and has no tier links. The
   privacy policy's Contributions section follows the same state.

## Runbook: change an amount or a link

<!-- sggs:steps -->
1. Create the Payment Link in Stripe: in the sandbox for `test`, in the live account for `live`.
   Its after-payment redirect is `https://gurbanisoul.com/contribute#thank-you` (staging:
   `https://sggs-staging.vercel.app/contribute#thank-you`).
2. In `frontend/src/contribute.ts`, change the tier's key and link in both sets. A new amount is a
   new key.
3. Add or rename the tier's note under `contributeTiers.notes` in `en.json`, then translate it and
   have it reviewed in every enabled language; `i18n-status.mjs` fails CI until it is.
4. Build with each mode (`PUBLIC_CONTRIBUTE_MODE=test npm run build`, then `live`) to let
   `assertLinks()` prove the links, and run `npx playwright test contribute` from `frontend/`.
5. Ship it as an ordinary pull request into `integration`. Deactivate the old link in Stripe only
   after the deploy that stops using it.

## What protects it

- **`assertLinks()`**: the mode and the links must agree, or the build fails.
- **`frontend/e2e/contribute.spec.ts`**: the page renders in the marketing shell, never says
  "donation" or "is tax-deductible", links only to Stripe-hosted pages, loads nothing from Stripe
  before a click, shows the thank-you note only after the redirect, fits a 320px screen, and is
  linked from the nav, footer, home band, Support page and Knowledge Base footer only when it is on.
- **`BrandDisciplineInSource`**: the small heart on the Contribute link is the one allowed use of
  brand red on the website, through a single `--contribute-heart` token.
- **Privacy**: what the policy says about contributions is on
  [security and privacy](../architecture/security-and-privacy.md#privacy).
