// Poster 01 — the system landscape (C4 level 1, with the pieces a newcomer meets in week one).
// Kit 2 (posters/kit2.mjs): people on top, the three surfaces, the platform (API and database),
// where the text comes from, and the only path to production. The lock file and the source PDF are
// named inside the boxes they belong to; the captions carry the detail.
const V = { version: '1.3.10', date: '2026-09-27', commit: 'd2f2e415' };
export default {
  kit: 2,
  number: '01', slug: 'system-landscape',
  title: 'System landscape',
  subtitle: 'Who uses the SGGS Knowledge Base, what they touch, and where the text comes from',
  description: 'The people (sangat and students, Granthis and scholars, engineers), the three surfaces they use (website, iOS app, wiki), the read-only API running as Vercel functions and the pinned database behind it, sggs-data that turns the source Bir PDF into that database, the labelled English layer, and CI as the only way anything reaches production.',
  height: 1210, verified: V,
  sources: ['docs/architecture/overview.md', 'webapp/serve.py', 'gateway/routes.json', 'dataset.lock.json', '.github/workflows/deploy-production.yml'],
  groups: [
    { label: 'Surfaces', x: 40, y: 340, w: 1120, h: 208 },
    { label: 'Platform', x: 40, y: 600, w: 1120, h: 208 },
  ],
  nodes: [
    { id: 'sangat', kind: 'actor', x: 40, y: 196, w: 340, h: 96, lines: ['Sangat · students', 'read, search, study'], step: 'step-01' },
    { id: 'granthi', kind: 'actor', x: 430, y: 196, w: 340, h: 96, lines: ['Granthi · scholar', 'reviews, never edits'], step: 'step-01' },
    { id: 'eng', kind: 'actor', x: 820, y: 196, w: 340, h: 96, lines: ['Engineers · interns', 'change it by PRs'], step: 'step-01' },
    { id: 'web', x: 60, y: 400, w: 340, h: 124, lines: ['Website', 'gurbanisoul.com', { text: 'frontend/', mono: true }], step: 'step-02' },
    { id: 'ios', x: 430, y: 400, w: 340, h: 124, lines: ['Gurbani Soul (iOS)', 'offline, own DB copy'], step: 'step-02' },
    { id: 'wiki', x: 800, y: 400, w: 340, h: 124, lines: ['This wiki', 'docs.gurbanisoul.com'], step: 'step-02' },
    { id: 'api', x: 60, y: 660, w: 500, h: 124, lines: ['The API, Python stdlib', 'Vercel functions, same origin', '26 routes · 5 contexts'], step: 'step-03' },
    { id: 'db', kind: 'store', x: 640, y: 660, w: 500, h: 124, lines: [{ text: 'db/sggs.sqlite', mono: true }, '60,658 lines · 1,430 Angs', 'installed by pin, verified'], step: 'step-04' },
    { id: 'eng2', kind: 'ext', x: 60, y: 870, w: 500, h: 124, lines: ['ShabadOS / BaniDB', 'English, a labelled layer', 'never blended in'], step: 'step-05' },
    { id: 'data', x: 640, y: 870, w: 500, h: 124, lines: ['sggs-data', 'source PDF → database', 'reconciled, gated, ledgered'], step: 'step-05' },
    { id: 'ci', kind: 'gate', x: 60, y: 1060, w: 440, h: 124, lines: ['CI gates', 'tests · contract · integrity', 'the only way to deploy'], step: 'step-06' },
    { id: 'vercel', x: 640, y: 1060, w: 500, h: 124, lines: ['Vercel', 'the web + the API functions', 'Render kept on standby'], step: 'step-06' },
  ],
  edges: [
    { from: 'sangat', to: 'web', step: 'step-02' },
    { from: 'sangat', to: 'ios', step: 'step-02', via: [[320, 316], [520, 316]] },
    { from: 'granthi', to: 'wiki', step: 'step-02', via: [[700, 316], [900, 316]] },
    { from: 'eng', to: 'wiki', step: 'step-02' },
    { from: 'web', to: 'api', label: '/api/*', step: 'step-03', x: 330 },
    { from: 'wiki', to: 'api', label: 'live widgets', step: 'step-03', via: [[970, 572], [480, 572]] },
    { from: 'api', to: 'db', step: 'step-04' },
    { from: 'data', to: 'db', dashed: true, label: 'by pin', step: 'step-05' },
    { from: 'eng2', to: 'api', dashed: true, label: 'translations', step: 'step-05' },
    { from: 'ci', to: 'vercel', label: 'deploys', step: 'step-06' },
  ],
  steps: [
    { id: 'step-01', title: 'The people', caption: 'Three kinds of people meet the system: the sangat and students who read, search and study; Granthis and scholars who review anything flagged in the text but never edit it; and engineers and interns, who change code and documentation only through reviewed pull requests.', link: '/onboarding/reverence-checklist/' },
    { id: 'step-02', title: 'Three surfaces', caption: 'The website (gurbanisoul.com, a static Astro site), the Gurbani Soul iOS app (fully offline, with its own copy of the database) and this wiki. All three show scripture verbatim, cited by Ang.', link: '/architecture/overview/' },
    { id: 'step-03', title: 'One read-only API', caption: 'The API is Python standard-library code (webapp/serve.py and the five bounded contexts in webapp/sggs/: reader, search, verify, insights, knowledge) answering 26 routes. It runs as Python functions inside the same Vercel project as the website, so the browser calls it same-origin under /api/* with no CORS; gateway/routes.json decides which function answers which path. The wiki’s live widgets call it the same way.', link: '/architecture/request-lifecycle/' },
    { id: 'step-04', title: 'The pinned database', caption: 'db/sggs.sqlite holds 60,658 verbatim lines over 1,430 Angs with FTS5 indexes, opened read-only. It is never committed here: dataset.lock.json names the sggs-data commit and the sha256 of the exact object, and make dataset installs it verified. The app builds its own copy from the same pin.', link: '/data/dataset-pin/' },
    { id: 'step-05', title: 'Where the text comes from', caption: 'sggs-data turns the source Bir PDF (1,483 pages) into the corpus and the database through character-exact reconciliation, golden checks and a scholar-reviewed editorial ledger, then publishes the result by commit and checksum — the pin. The English layer from ShabadOS / BaniDB is a separate, labelled table the API reads beside the Gurmukhi, never blended into it.', link: '/data/integrity-chain/' },
    { id: 'step-06', title: 'Only CI deploys', caption: 'A pull request runs the gates (tests, the golden contract, dataset integrity, security, the docs gates). Merging to integration deploys staging; a release merge to main runs the gated production deploy to Vercel — the website and the API functions together — verified by the running commit, and cuts the tag. The single Render API stays deployed as the rollback. Nobody deploys by hand.', link: '/process/ci-gates/' },
  ],
};
