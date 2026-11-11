---
title: "Security and privacy"
description: "The defences at each layer — browser headers, a read-only API with bounded input, an immutable database, gated CI — what is and is not collected about readers, and the known gaps."
sidebar:
  order: 8
verified:
  commit: 26d86be7
  date: "2026-11-08"
---
# Security and privacy

The system has an unusually small attack surface, by design. It has no accounts, no logins, no
user data, no request bodies and no writes: the API answers `GET` requests from a database it
opens read-only. What it must protect is **the integrity of the text** and **the privacy of the
people reading it**. This page lists the defences at each layer, what is collected, and the gaps
that are known and open. To report a vulnerability, follow [SECURITY.md](../../SECURITY.md)
(email, not a public issue).

```mermaid
flowchart TB
    accTitle: Defences at each layer between a reader and the database
    accDescr: In the browser, the site sends a content security policy, frame denial, no referrer, HSTS and a restrictive permissions policy, and escapes all API text. The request reaches the API on the same origin over HTTPS, so there is no CORS. The API accepts only GET, bounds every parameter, cleans full-text queries, parameterises all SQL and returns a generic body for any internal error. SQLite is opened read-only, immutable and query-only, and each context can read only the tables it declares. Beside the request path, CI scans for secrets, audits dependencies and deploys only after the required checks pass.
    b[Browser: CSP, HSTS,<br/>frame denial,<br/>no referrer, escaping]
    b -->|HTTPS, same origin| api[API: GET only,<br/>bounded input,<br/>clean full-text query,<br/>parameterised SQL]
    api --> db[(SQLite: read-only,<br/>immutable, query-only,<br/>declared tables)]
    ci[CI: secret scan,<br/>npm audit, deploys<br/>gated by commit] -.-> api
    class ci side
    classDef side stroke-dasharray: 4 3
```

## The API

The same handler serves every host (`serve.py`, and each Vercel function subclasses it).

| Defence | How | Where |
|---|---|---|
| Read-only by construction | only `do_GET` and `do_HEAD` exist, so there are no request bodies | `serve.py` |
| A database that cannot be written | `mode=ro&immutable=1` and `PRAGMA query_only=ON`; the image makes the file `0444` | `sggs/core.py`, `webapp/Dockerfile` |
| Least privilege per context | each context declares its `TABLES`; a test runs every route under an SQLite authorizer that refuses anything else, and a function will not load if its slice lacks a declared table | `webapp/tests/test_declared_tables.py`, `tools/build_api_functions.py` |
| Bounded input | every integer through `_int()` (at most 12 characters, clamped to a range); search `q` at most 300 characters, `limit` at most 200; a verify claim at most 600 characters; id lists at most 300 | `sggs/core.py`, `sggs/search.py`, `sggs/verification.py` |
| No injection | every value bound with `?`; the only built SQL strings are constant columns and `?` lists; full-text input loses `"` and `*` and each token is quoted; FTS columns come from an allowlist | `sggs/search.py`, [invariants](../engineering/invariants.md) |
| No path traversal | static paths are resolved with `realpath` and must stay under the static root; `%`-encoded input is never decoded | `serve.py` `_resolve_static` |
| No leaks on error | a bad parameter is a 400 with a message the code wrote; anything unexpected is a 500 with the fixed body `{"error": "internal server error"}` and the traceback only in the log | `serve.py` |
| Slow clients | 15-second socket timeout; at most 48 worker threads and a backlog of 128 | `serve.py` |
| Response headers | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, HSTS, `X-Request-Id`, `X-Service` on every response; one exception, the Hukamnama embed (`/embed/hukamnama`), omits `X-Frame-Options` and sends its own strict CSP | `serve.py` `_sec_headers` |

## The browser

Both sites send their headers from `vercel.json`:

- **Content Security Policy.** `default-src 'self'`, `frame-ancestors 'none'`, `object-src
  'none'`, `base-uri 'self'`. The website allows `'unsafe-inline'` for scripts and styles
  (inline theme and handler code) and one outside origin, the newsletter provider, for
  `connect-src` and `form-action`. The wiki allows inline scripts only by **SHA-256 hash**,
  checked in CI by `npm run check:csp`.
- **The one framable page.** `/embed/hukamnama` exists to be shown inside other sites, so the
  website's header rule excludes that path (`/((?!embed/hukamnama).*)`) and a second rule gives it
  its own set: no `X-Frame-Options`, and `default-src 'none'; style-src 'unsafe-inline'; font-src
  'self'; frame-ancestors *; base-uri 'none'; form-action 'none'`. The document has no script,
  form, button or image and takes nothing from its query string, so there is nothing in it to
  click-jack. A test proves every other path keeps the frame ban, and after each deploy
  `verify_functions.py` reads the live headers of `/`, a Hukamnama page and the embed.
- **Transport and isolation.** HSTS for two years with `includeSubDomains; preload`,
  `Cross-Origin-Opener-Policy: same-origin`, and a `Permissions-Policy` that turns off camera,
  microphone and payment (the website keeps geolocation for its own origin, for the raag clock's
  solar mode).
- **Escaping.** All scripture and API text is escaped by `esc()` before it reaches the page
  ([the website](website.md)).
- **Tests.** `frontend/e2e/csp.spec.ts` loads every route under the enforced policy and expects
  zero violations; the wiki's e2e server sends its production headers to every test.

## CI and the supply chain

- **Deploys only through CI.** Production and staging deploy only from their workflows, after the
  required checks pass on the exact commit, and are verified by the commit the running API
  reports ([ADR-0005](../adr/0005-ci-gated-deploys.md)). The platforms' own Git deployments are
  off.
- **Secrets** live in the `production` and `staging` GitHub Environments (and
  `production-approval` for an optional reviewer). Values are never typed into chat, logs or
  files; one that is pasted anywhere is treated as leaked and rotated
  ([delivery](../engineering/delivery.md)).
- **Least-privilege workflows.** Every workflow declares `permissions:`; most are
  `contents: read`, with `issues: write` only where a workflow files an issue, and
  `contents: write` only for tagging a release.
- **Scans** (`security.yml`): gitleaks on every change (the required `secrets` check);
  `npm audit --audit-level=high` for the website and the wiki; bandit, semgrep and actionlint.
  Dependabot proposes npm, Actions and Docker updates weekly.
- **The dataset is fetched only by pin.** `fetch_dataset.py` downloads the exact object named in
  `dataset.lock.json` and checks its SHA-256 and size; `build_api_functions.py --verify-output`
  refuses a build that would publish the database or the API source as static files.

## Privacy

What is and is not collected, as the public [privacy policy](../../frontend/src/pages/[lang]/privacy.astro)
states it (every statement there is checked against the code). The policy is served at
`/en/privacy`, `/pa/privacy` and `/fr/privacy`; English governs, and `/privacy`, the URL in App
Store Connect, redirects permanently to `/en/privacy`:

- **The app** collects nothing: no accounts, no network connections, no analytics or third-party
  SDKs. Its App Store label is "Data Not Collected". Location for the raag clock is rounded to
  about 1 km and stays on the device.
- **The Knowledge Base pages** load no analytics and set no cookies. Preferences, reading
  positions, pins and a rounded location (about 1 km) stay in the browser's storage. The raag
  clock asks for location only when the reader presses "Use my location" in solar mode, and
  "Forget location" removes it.
- **The Gurbani Soul pages** on `gurbanisoul.com` use Vercel Web Analytics: cookieless totals of
  page, referrer, country, browser, OS and device type, with a visitor hash discarded daily.
  A language chosen in the language switcher is kept in the browser's local storage as `gs_lang`
  (never a cookie, never sent anywhere) and read only by the bare root, to open that language
  again; the policy names it among the browser's stored settings.
- **The API log** is one JSON line per request with the method, the path, the status, the
  duration and the request id. It never records the query string, the IP address or the user
  agent; a test fails if a query string appears
  ([ADR-0009](../adr/0009-production-verification.md)). Hosting providers keep their own standard
  logs.
- **Contributions**, when the Contribute page is on (`CONTRIBUTE_MODE` in `frontend/src/contribute.ts`),
  leave the site for a checkout page run by Stripe; no Stripe code loads before the click, and
  the site never sees card details. The policy's Contributions section appears only in that mode
  ([Contribute and Stripe](../website/contribute.md)).
- **The wiki's "open in ChatGPT / Claude" links** pass only the page's address to that service;
  the wiki records nothing.
- **The newsletter**, when enabled, sends only an email address to Buttondown, with double
  opt-in ([newsletter runbook](../process/runbooks/newsletter.md)).

## Known gaps

These are open and tracked here so nobody mistakes them for guarantees:

- **Static analysis does not block.** bandit runs with `|| true` and semgrep with
  `continue-on-error`; only the secret scan is a required check. `npm audit` fails its job but
  is not in the branch rulesets.
- **Not every Action is pinned to a SHA.** The deploy and docs workflows are; `web-ci`,
  `security`, `e2e` and several others use version tags. gitleaks is downloaded without a
  checksum check.
- **The website's CSP allows inline script** (`'unsafe-inline'`), unlike the wiki's hash-based
  policy.
- **No application rate limiting.** The API relies on its bounded input and the platform's own
  protection.
- **The API container runs as the image's default user** (no `USER` line in the Dockerfile).
  Production runs as Vercel functions; the container is the Render standby.
- **`frontend/e2e/headers.spec.ts` never runs in CI.** It needs `SMOKE_BASE_URL`, which no
  workflow sets, so nothing checks the website's deployed headers.
- **No written threat model** for the web and API.

New risks go into the [risk register](../risk-register.md).
