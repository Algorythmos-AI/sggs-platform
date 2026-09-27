// Poster 09 — the five bounded contexts, module slicing, and the gateway generated from the code.
// Layout (posters/kit.mjs): three bands top to bottom — the contexts, the routing that is generated
// from them, and what proves it — then the one-line rollback. Route lists live in the captions.
const V = { version: '1.3.10', date: '2026-09-27', commit: 'd2f2e415' };
export default {
  kit: 2,
  number: '09', slug: 'bounded-contexts-and-gateway',
  title: 'Bounded contexts and the gateway',
  subtitle: 'One codebase, five contexts: how a function serves a slice of it, and how routing is generated so it cannot drift',
  description: 'The 26 routes are tagged with five bounded contexts (reader, search, verify, insights, knowledge), each declaring the tables it reads. SGGS_MODULES selects the contexts a process serves and readiness refuses a database missing any declared table. gateway/routes.json says per environment where /api goes; tools/gen_gateway.py generates the Vercel rewrites from the route table, the API functions are built at deploy time, and CI proves the routing with X-Service probes and the 274-record golden contract.',
  height: 1714, verified: V,
  sources: ['webapp/serve.py', 'gateway/routes.json', 'tools/gen_gateway.py', 'tools/build_api_functions.py'],
  legendText: { note: 'explanation or setting', good: 'proven on every staging deploy' },
  groups: [
    { label: 'Five contexts, one codebase', x: 40, y: 186, w: 1120, h: 432 },
    { label: 'Routing, generated from the code', x: 40, y: 670, w: 1120, h: 532 },
    { label: 'Proven on every staging deploy', x: 40, y: 1254, w: 1120, h: 300 },
  ],
  nodes: [
    { id: 'reader', x: 60, y: 246, w: 340, h: 96, lines: ['reader', 'pages, banis, health'], step: 'step-01' },
    { id: 'search', x: 430, y: 246, w: 340, h: 96, lines: ['search', 'search, word'], step: 'step-01' },
    { id: 'verify', x: 800, y: 246, w: 340, h: 96, lines: ['verify', 'quotation verdicts'], step: 'step-01' },
    { id: 'insights', x: 60, y: 372, w: 340, h: 96, lines: ['insights', 'themes, analytics'], step: 'step-01' },
    { id: 'knowledge', x: 430, y: 372, w: 340, h: 96, lines: ['knowledge', 'raag timing, forms'], step: 'step-01' },
    { id: 'tables', kind: 'store', x: 800, y: 372, w: 340, h: 104, lines: [{ text: 'CONTEXT_TABLES', mono: true }, 'each its own tables'], step: 'step-02' },
    { id: 'modules', kind: 'note', x: 60, y: 498, w: 1080, h: 96, lines: [{ text: 'SGGS_MODULES=all | reader,search,…', mono: true }, 'a process serves only the contexts it names; readiness needs their tables'], step: 'step-02' },
    { id: 'routes', kind: 'store', x: 60, y: 730, w: 380, h: 104, lines: [{ text: 'serve.ROUTES', mono: true }, 'path → handler, context'], step: 'step-03' },
    { id: 'cfg', kind: 'pin', x: 760, y: 730, w: 380, h: 104, lines: [{ text: 'gateway/routes.json', mono: true }, 'where each /api goes'], step: 'step-03' },
    { id: 'gen', x: 350, y: 894, w: 500, h: 96, lines: [{ text: 'tools/gen_gateway.py', mono: true }, 'routes → Vercel rewrites'], step: 'step-03' },
    { id: 'vercel', kind: 'store', x: 60, y: 1050, w: 500, h: 124, lines: [{ text: 'frontend/vercel.json', mono: true }, 'the rewrites, committed'], step: 'step-04' },
    { id: 'fns', x: 640, y: 1050, w: 500, h: 124, lines: ['API functions', 'one per context, plus all', 'built at deploy, not kept'], step: 'step-04' },
    { id: 'p1', kind: 'gate', x: 60, y: 1314, w: 525, h: 96, lines: [{ text: 'gen_gateway.py --check', mono: true }, 'vercel.json = generated'], step: 'step-05' },
    { id: 'p2', kind: 'gate', x: 625, y: 1314, w: 515, h: 96, lines: [{ text: '--verify-output', mono: true }, 'each function: its slice only'], step: 'step-05' },
    { id: 'p3', kind: 'gate', x: 60, y: 1434, w: 525, h: 96, lines: ['X-Service probes', 'each context answers itself'], step: 'step-05' },
    { id: 'p4', kind: 'good', x: 625, y: 1434, w: 515, h: 96, lines: ['The golden contract', '274 records via the gateway'], step: 'step-05' },
    { id: 'rollback', kind: 'note', x: 40, y: 1594, w: 1120, h: 96, lines: ['Reversible in one line', 'remove a context from routes.json and the all function answers it again'], step: 'step-06' },
  ],
  edges: [
    { from: 'routes', to: 'gen', step: 'step-03' },
    { from: 'cfg', to: 'gen', dashed: true, step: 'step-03' },
    { from: 'gen', to: 'vercel', label: 'writes', step: 'step-04' },
    { from: 'gen', to: 'fns', label: 'builds', step: 'step-04' },
    { from: 'p3', to: 'p4', step: 'step-05' },
  ],
  steps: [
    { id: 'step-01', title: 'Five contexts, 26 routes', caption: 'Every route in serve.ROUTES is tagged with the bounded context that owns it: reader (meta, health, Angs, compositions, random, lines, banis), search (search, word), verify, insights (the theme network, analytics, related, line concepts, neighbours) and knowledge (raag timing and forms). No two contexts share a path prefix, so any route can be sent to exactly one function.', link: '/architecture/overview/' },
    { id: 'step-02', title: 'Each context declares its tables', caption: 'Each module lists the tables it reads (CONTEXT_TABLES). SGGS_MODULES chooses the contexts a process serves — all by default, or a comma list to run one context from the same code; an unknown name is an error, a route outside the enabled set is a 404, and readiness refuses a database missing any declared table. The same lists cut each function’s database slice.', link: '/adr/0010-services-behind-a-generated-gateway/' },
    { id: 'step-03', title: 'Routing is generated, never hand-written', caption: 'gateway/routes.json says, per environment, where /api goes: on staging to Vercel functions, one per context plus all; on integration the production entry lists the same five contexts, which go live together in the first release after the app is on the App Store — production today (1.3.10) answers every path with all. tools/gen_gateway.py combines it with the route table to produce the rewrites — every prefix of a routed context and its /api/v1 twin, then a catch-all to all.', link: '/adr/0011-api-as-functions-in-the-web-project/' },
    { id: 'step-04', title: 'What ships', caption: 'The committed frontend/vercel.json carries only the rewrites: staging’s, host-conditioned, first; then production’s, host-less, one per routed prefix; then the catch-all to all. At deploy time tools/build_api_functions.py generates the functions — each fixing its SGGS_MODULES, its database slice and the commit — and adds their configuration; nothing generated is committed.', link: '/process/runbooks/deploy/' },
    { id: 'step-05', title: 'Proven on every deploy', caption: 'CI fails if vercel.json is not what the code generates, if a function bundles anything but its own code and slice, if any context answers with the wrong X-Service (or an unknown prefix does not fall through to all), or if the golden contract — the 274 records the six HTTP suites replay — does not pass through the gateway on the staging site.', link: '/process/ci-gates/' },
    { id: 'step-06', title: 'And reversible in one line', caption: 'Removing a context from gateway/routes.json sends its routes back to the all function on the next deploy. Production answers /api with all today and moves all five contexts in one release, each gated on its own — the functions proven at the commit, the golden contract, the performance baseline (p95 within +10 % per context) and the data canary; setting api_platform back to render returns it to the Render single API, which keeps deploying as the rollback.', link: '/process/runbooks/services-production/' },
  ],
};
