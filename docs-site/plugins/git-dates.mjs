// When each page last changed, from git — for the "Last updated" date on every page.
//
// Starlight dates a page only when its file lies under src/content/docs; this site reads ../docs in
// place, so it never did (the setting was on and nothing showed). One `git log` over the published
// sources gives every file's newest commit; src/route-data.ts puts it on each page:
//   a page from docs/                  -> its own last commit
//   a page pinned from a sibling repo  -> when the pin last moved (docs-site/sources.lock.json)
//   the generated API reference        -> contract/openapi.json
// A shallow clone would date every file to the one commit it holds, which is wrong, not missing:
// then no dates are shown, and in CI (where the checkout must be full) the build fails.
import { execFileSync } from 'node:child_process';
import { REPO_ROOT } from './paths.mjs';

export const DATED = ['docs', 'docs-site/sources.lock.json', 'contract/openapi.json'];

/** Parse `git log --format=t:%ct --name-only`: the first (newest) time each path appears. */
export function parseLog(out) {
  const dates = new Map();
  let t = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('t:')) t = Number(line.slice(2)) * 1000;
    else if (line && t != null && !dates.has(line)) dates.set(line, new Date(t));
  }
  return dates;
}

let cache = null;
/** repo-relative path -> Date of its newest commit (memoised for the build). */
export function commitDates({ root = REPO_ROOT, env = process.env, run = execFileSync } = {}) {
  if (cache) return cache;
  const git = (...args) => run('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  let shallow;
  try { shallow = git('rev-parse', '--is-shallow-repository').trim() === 'true'; }
  catch { cache = new Map(); return cache; }                         // not a git checkout: no dates
  if (shallow) {
    if (env.CI) throw new Error('git-dates: the checkout is shallow, so every page would carry the same date — check out with fetch-depth: 0');
    console.warn('git-dates: shallow clone — "Last updated" dates are left out');
    cache = new Map(); return cache;
  }
  cache = parseLog(git('log', '--format=t:%ct', '--name-only', '--', ...DATED));
  return cache;
}

/** The repo-relative file whose last commit dates a page (filePath is relative to docs-site/). */
export function datedFile(id, filePath) {
  if (id === 'api/reference' || id.startsWith('api/reference/')) return 'contract/openapi.json';
  if (!filePath) return null;
  const rel = filePath.startsWith('../') ? filePath.slice(3) : `docs-site/${filePath}`;
  if (rel.startsWith('docs-site/.sources/')) return 'docs-site/sources.lock.json';   // a pinned sibling page
  if (rel.startsWith('docs/')) return rel;
  return null;                                                                      // the site's own 404 page
}

export function _resetForTests() { cache = null; }
