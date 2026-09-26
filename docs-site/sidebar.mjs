// The sidebar: which pages go in which group. plugins/nav.mjs resolves this against the pages on
// disk (every published page must be placed exactly once; no group may be empty) and emits
// explicit slug links — see that file for why Starlight's `autogenerate` is not used.
//
// A new page in an existing directory appears by itself (ordered by its frontmatter `sidebar.order`,
// then title). A new directory, or a page at the top of docs/, must be placed here — the build and
// plugins/test/sidebar.test.mjs fail until it is.
import { buildSidebar, group, page, pages, readPages } from './plugins/nav.mjs';

const DATA = 'sggs-data';          // pinned sibling sources (docs-site/sources.lock.json)
const APP = 'gurbani-soul-ios';

export const LAYOUT = [
  group('Get started', [
    pages('onboarding'),
    group('Learning paths', [pages('learning-paths')]),
    group('Exercises', [pages('exercises')]),
  ], { collapsed: false }),
  group('Scripture 101', [
    pages('scripture'),
    page('data/answer-protocol', { from: DATA }),
    page('reference/contributors'),
  ]),
  group('Architecture', [pages('architecture', { exclude: ['architecture/search-waterfall'] })]),
  group('Data', [
    pages('data'),
    pages('data/architecture', { from: DATA }),
    group('Runbooks', [pages('data/process/runbooks', { from: DATA })]),
  ]),
  group('Search & verification', [
    page('search'),
    page('architecture/search-waterfall'),
    pages('search', { index: false }),
  ]),
  // the generated API reference (starlight-openapi) is appended to this group in astro.config.mjs
  group('API', [pages('api')]),
  group('iOS app', [
    pages('ios'),
    page('ios/nitnem/spec', { from: APP }),
    pages('ios/ios', { from: APP }),
    page('ios/contributing', { from: APP }),
    group('Runbooks', [pages('ios/process/runbooks', { from: APP })]),
  ]),
  group('Ship & operate', [
    pages('engineering'),
    pages('process'),
    group('Runbooks', [pages('process/runbooks')]),
  ]),
  group('Brand', [pages('brand')]),
  group('Decisions', [
    page('adr'),
    group('Platform', [pages('adr', { index: false })]),
    group('Data (sggs-data)', [pages('data/adr', { from: DATA })]),
    group('iOS app', [pages('ios/adr', { from: APP })]),
  ]),
  group('Reference', [
    page('glossary'),
    page('reference/repo-map'),
    page('reference/releases'),
    page('diagrams'),
    page('website'),
    page('risk-register'),
    page('reports'),
    page('archive'),
    group('Writing these docs', [pages('contributing')]),
  ]),
];

// Short sidebar labels for pages whose title is long, or reads badly out of context. The page title
// (and so the H1, the browser tab and search) is unchanged. At most LABEL_MAX characters (tested).
export const LABELS = {
  'engineering': 'Engineering handbook',
  'learning-paths/platform-engineer': 'Platform engineer',
  'learning-paths/data-engineer': 'Data engineer',
  'learning-paths/ios-engineer': 'iOS engineer',
  'learning-paths/reviewer-scholar': 'Reviewer or scholar',
  'exercises/01-trace-a-search': '01 · Trace a search',
  'exercises/02-add-a-route': '02 · Add a route',
  'exercises/03-bump-a-pin': '03 · Bump a pin',
  'exercises/04-write-an-adr': '04 · Write an ADR',
  'exercises/05-fix-a-poster': '05 · Fix a poster',
  'exercises/06-add-a-widget': '06 · Add a widget',
  'onboarding/how-the-repos-fit': 'How the repositories fit',
  'onboarding/reverence-checklist': 'Working with sacred text',
  'scripture/answer-protocol-for-engineers': 'The Answer Protocol for engineers',
  'data/answer-protocol': 'The Answer Protocol (full text)',
  'architecture/overview': 'Overview',
  'architecture/microservices-roadmap': 'Microservices roadmap',
  'data/integrity-chain': 'The integrity chain',
  'data/architecture/database-schema': 'Database schema',
  'data/architecture/scripture-integrity': 'Scripture integrity',
  'data/process/runbooks/data-restore': 'Restore from the backups',
  'data/process/runbooks/rebuild-db': 'Rebuild from the PDF',
  'ios/nitnem/spec': 'Nitnem spec',
  'ios/ios/app-store-listing': 'App Store listing',
  'ios/ios/testflight-launch-plan': 'TestFlight launch plan',
  'ios/ios/testflight-test-plan': 'TestFlight test plan',
  'ios/contributing': 'Contributing to the app',
  'ios/process/runbooks/app-store-submission': 'App Store submission',
  'ios/process/runbooks/ios-hotfix': 'iOS hotfix',
  'process/branching': 'Branching and delivery flow',
  'process/ci-gates': 'CI gates',
  'process/release': 'Release process',
  'process/runbooks/deploy': 'Deploys',
  'process/runbooks/rollback': 'Rollback',
  'process/runbooks/services-production': 'Moving production to functions',
  'process/runbooks/newsletter': 'Launch-notice sign-up',
  'process/runbooks/support-inbox': 'Support inbox',
  'process/runbooks/docs-site': 'The docs site',
  'brand/gurbani-soul-brand-book': 'Brand book',
  'reports': 'Reports and audit history',
  'risk-register': 'Risk register',
  'website': 'The website',
  // decisions: number · short title (the full title is the page's H1)
  'adr/0001-integration-default-branch': '0001 · Integration is the trunk',
  'adr/0002-comp-id-keep-last-regroup': '0002 · Heading runs join the composition',
  'adr/0003-docs-in-repo': '0003 · The wiki lives in docs/',
  'adr/0004-unified-semver': '0004 · One version number',
  'adr/0005-ci-gated-deploys': '0005 · CI-gated deploys',
  'adr/0006-bani-registry-over-verbatim-corpus': '0006 · Banis as a registry of pointers',
  'adr/0007-three-repositories': '0007 · Three repositories',
  'adr/0008-dataset-by-pin': '0008 · The dataset by pin',
  'adr/0009-production-verification': '0009 · Production verified continuously',
  'adr/0010-services-behind-a-generated-gateway': '0010 · Services behind a generated gateway',
  'adr/0011-api-as-functions-in-the-web-project': '0011 · The API as Vercel functions',
  'adr/0012-docs-site': '0012 · The docs site',
  'data/adr/0002-comp-id-keep-last-regroup': '0002 · Heading runs join the composition',
  'data/adr/0003-integrity-proofs': '0003 · Every dataset carries its proofs',
  'data/adr/0004-backups-and-restore': '0004 · Recoverable from the backups',
  'ios/adr/0001-vendored-inputs-one-number': '0001 · Pinned inputs, one version number',
};

// Sort order, over a page's frontmatter `sidebar.order` (lower first; unordered pages sort by title,
// after). Pinned pages carry no frontmatter, so theirs is only here.
export const ORDER = {
  'architecture/overview': 1,
  'architecture/request-lifecycle': 2,
  'architecture/bounded-contexts-and-gateway': 3,
  'architecture/three-repositories-and-pins': 4,
  'architecture/microservices-roadmap': 5,
  'data/architecture/scripture-integrity': 1,
  'data/architecture/database-schema': 2,
  'data/process/runbooks/rebuild-db': 1,
  'data/process/runbooks/data-restore': 2,
  'ios/ios/testflight-launch-plan': 1,
  'ios/ios/testflight-test-plan': 2,
  'ios/ios/app-store-listing': 3,
  'ios/process/runbooks/app-store-submission': 1,
  'ios/process/runbooks/ios-hotfix': 2,
};

// Pinned pages say where they come from; the page itself also carries the "pinned copy" banner.
export const BADGES = {
  [DATA]: { text: 'sggs-data', variant: 'note' },
  [APP]: { text: 'app', variant: 'note' },
};

export const SIDEBAR = buildSidebar(LAYOUT, readPages(), { labels: LABELS, badges: BADGES, order: ORDER });
