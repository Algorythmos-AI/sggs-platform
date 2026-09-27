// Poster 10 — every workflow and job, what each proves, which are required (.github/workflows, .github/rulesets).
// Layout (posters/kit.mjs): three bands — every pull request, a merge, between merges — one card
// per job with its one-line purpose; what each proves in full is in the captions.
const V = { version: '1.3.10', date: '2026-09-27', commit: 'd85c2adc' };
export default {
  kit: 2,
  number: '10', slug: 'ci-gates-map',
  title: 'The CI gates map',
  subtitle: 'Every GitHub Actions workflow and job — what it proves, when it runs, and which checks a branch ruleset requires before a merge',
  description: 'On every pull request: web-ci (python, frontend, api-image), scripture-integrity (integrity), version-consistency (versions), security (secrets, static-analysis, deps), pr-hygiene (title), e2e (playwright) and deploy-docs (docs). The integration ruleset requires python, frontend, integrity, secrets and docs; the main ruleset adds versions and static-analysis, strictly. Merges into integration run deploy-staging; merges into main run deploy-production, which waits for the required checks plus playwright on the exact commit. Between merges: the data canary and docs-watch every six hours, uptime (product and wiki) every fifteen minutes, the docs job every night, and on Mondays a full-history secret scan, the external-link check, the sibling docs pins and the page-freshness report.',
  height: 1790, verified: V,
  sources: ['.github/workflows/web-ci.yml', '.github/workflows/deploy-docs.yml', '.github/rulesets/integration.json', '.github/rulesets/main.json'],
  groups: [
    { label: 'On every pull request', x: 40, y: 186, w: 1120, h: 724 },
    { label: 'On a merge', x: 40, y: 962, w: 1120, h: 316 },
    { label: 'Between merges', x: 40, y: 1330, w: 1120, h: 316 },
  ],
  nodes: [
    { id: 'python', kind: 'gate', x: 60, y: 246, w: 510, h: 96, lines: ['web-ci · python', 'tests, contract, harnesses'], step: 'step-01' },
    { id: 'frontend', kind: 'gate', x: 630, y: 246, w: 510, h: 96, lines: ['web-ci · frontend', 'the website builds'], step: 'step-01' },
    { id: 'image', x: 60, y: 382, w: 510, h: 96, lines: ['web-ci · api-image', 'the container, over HTTP'], step: 'step-01' },
    { id: 'integrity', kind: 'gate', x: 630, y: 382, w: 510, h: 96, lines: ['integrity', 'the pin, 60,658 lines'], step: 'step-02' },
    { id: 'versions', kind: 'gate', x: 60, y: 518, w: 510, h: 96, lines: ['versions', 'five version strings agree'], step: 'step-02' },
    { id: 'security', kind: 'gate', x: 630, y: 518, w: 510, h: 96, lines: ['security · three jobs', 'secrets, analysis, deps'], step: 'step-03' },
    { id: 'title', x: 60, y: 654, w: 510, h: 96, lines: ['pr-hygiene · title', 'a conventional title'], step: 'step-03' },
    { id: 'e2e', x: 630, y: 654, w: 510, h: 96, lines: ['e2e · playwright', 'Ang 712, search, axe'], step: 'step-04' },
    { id: 'docs', kind: 'gate', x: 60, y: 790, w: 510, h: 96, lines: ['deploy-docs · docs', 'the wiki, gated like code'], step: 'step-05' },
    { id: 'rules', kind: 'pin', x: 630, y: 790, w: 510, h: 96, lines: [{ text: '.github/rulesets', mono: true }, 'what a merge requires'], step: 'step-06' },
    { id: 'staging', kind: 'good', x: 60, y: 1022, w: 510, h: 96, lines: ['deploy-staging', 'integration → staging'], step: 'step-07' },
    { id: 'prod', kind: 'good', x: 630, y: 1022, w: 510, h: 96, lines: ['deploy-production', 'main → production, the tag'], step: 'step-07' },
    { id: 'docsdeploy', kind: 'good', x: 60, y: 1158, w: 1080, h: 96, lines: ['deploy-docs: staging and production', 'the wiki, deployed and smoked by commit, rolled back if not'], step: 'step-07' },
    { id: 'canary', x: 60, y: 1390, w: 510, h: 96, lines: ['data-canary · every 6 h', 'production = the pin'], step: 'step-08' },
    { id: 'uptime', x: 630, y: 1390, w: 510, h: 96, lines: ['uptime · every 15 min', 'health, the App Store URLs'], step: 'step-08' },
    { id: 'weekly', kind: 'note', x: 60, y: 1526, w: 1080, h: 96, lines: ['Nightly and weekly', 'docs nightly · docs-watch · secret scan · links · pins · freshness'], step: 'step-08' },
    { id: 'foot', kind: 'note', x: 40, y: 1686, w: 1120, h: 96, lines: ['Not here', 'the scripture gates run in sggs-data; the app’s in gurbani-soul-ios'], step: 'step-08' },
  ],
  edges: [
    { from: 'rules', to: 'staging', dashed: true, step: 'step-07', via: [[700, 936], [315, 936]] },
    { from: 'rules', to: 'prod', dashed: true, step: 'step-07' },
  ],
  steps: [
    { id: 'step-01', title: 'web-ci: the code', caption: 'python runs ruff, the server and repo-gate unit tests, replays the golden contract over HTTP, checks that contract/openapi.json is current and covers every dispatcher route, that /api/health is all-true, the shabad-heading regression and the search harnesses. frontend builds the Astro site and passes the pahar vectors. api-image builds the Docker image and proves the running container reports the commit and honours the contract.', link: '/process/ci-gates/' },
    { id: 'step-02', title: 'The data pin and the version', caption: 'integrity proves dataset.lock.json and contract/_meta.json name the same object, that sggs-data publishes it at the pinned commit, and that the installed database opens, passes quick_check and holds 60,658 lines over Angs 1–1430. versions proves the five platform version strings agree and that a main PR comes from integration or a hotfix branch.', link: '/data/dataset-pin/' },
    { id: 'step-03', title: 'Security and hygiene', caption: 'gitleaks (secrets), bandit and semgrep (static analysis), actionlint, and a blocking npm audit at level high on frontend/ and docs-site/ (deps). pr-hygiene requires a conventional-commit title.', link: '/process/ci-gates/' },
    { id: 'step-04', title: 'End to end', caption: 'The Playwright suite drives the real site against serve.py and the pinned database: the Ang 712 heading, search to the panel heading, and axe on the home page. It is not a required check, but both deploy chains wait for it on the exact commit.', link: '/process/ci-gates/' },
    { id: 'step-05', title: 'The docs job', caption: 'The wiki is gated like the product: the sibling pin is consistent and installed; tools/docs_check.py checks frontmatter, links and anchors, widget fallbacks, the Mermaid palette, the scripture-quotation rule, the posters, the verified stamps and drift against the code; the generated routes page is current; the plugin and tool unit tests pass; the types check; the site builds with every Mermaid fence rendered; the built site is checked whole — every page rendered, every internal link resolving, the page budgets, and every inline script allowed by its CSP hash; Playwright and axe run with a mocked API under the production headers; Lighthouse passes its budgets.', link: '/process/ci-gates/' },
    { id: 'step-06', title: 'What a ruleset requires', caption: 'The JSON files under .github/rulesets are the source of truth, applied by scripts/gh/apply_rulesets.sh. integration requires python, frontend, integrity, secrets and docs; main requires python, frontend, integrity, versions, secrets, static-analysis and docs with the strict policy, plus a review and CODEOWNERS. Neither allows deletion or force-push; main has no linear-history rule because release PRs are merge commits.', link: '/process/branching/' },
    { id: 'step-07', title: 'On a merge: the deploy chains', caption: 'A merge into integration runs deploy-staging: gates on the commit, preflight for secrets, the API functions generated and proven, the web built and aliased, then verify (every function ready at the commit, the gateway, the smoke, the whole contract). A merge into main runs deploy-production: every required check except the wiki’s docs job (which gates the merge, not the product) plus playwright, preflight, an optional approval, API deploy and verification by commit, web built unaliased and smoked, promotion with the public smoke and a rollback edge, then the tag. The wiki has the same chain in deploy-docs: its staging deploy refuses to be the project’s first deployment (Vercel made that one production), its rollback targets the deployment the domain actually serves, and every production failure — or a docs job that failed on main — opens an issue.', link: '/process/runbooks/deploy/' },
    { id: 'step-08', title: 'Between merges', caption: 'Every six hours the data canary proves production serves the pinned scripture byte for byte — 500 sampled lines and fifteen Angs, at the API origin and through the site’s CDN — and replays the golden contract; every fifteen minutes uptime probes /api/health and the App Store URLs; every fifteen minutes uptime also probes the wiki; every six hours docs-watch proves docs.gurbanisoul.com serves the commit its last production deploy shipped and runs the live suite against the real API; every night the whole docs job re-runs on integration to catch drift from outside the repository; on Mondays security scans the full history for secrets, docs-links checks every external link in the wiki and the sibling docs it publishes, docs-pins moves a sibling pin when the docs it publishes changed, and docs-freshness lists the pages whose cited code moved since their verified stamp. Each opens or updates one issue; none pages or redeploys.', link: '/process/ci-gates/' },
  ],
};
