// <!-- sggs:app-builds --> (or <sggs-app-builds limit="N"></sggs-app-builds>, as remark-widgets
// rewrites it) becomes the app's upload history, read at build from gurbani-soul-ios's ledger
// (ios/testflight-builds.json) at the commit pinned in sources.lock.json: newest first, one row
// per upload, with the platform and dataset commits it was built from. The ledger records uploads,
// not App Review outcomes, so the table says nothing about approval. The build fails when the
// ledger is not pinned or not installed (tools/fetch_sibling_docs.py).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { visit } from 'unist-util-visit';
import { REPO_ROOT, SOURCES_DIR, PLATFORM_REPO, loadSources } from './paths.mjs';

const APP = 'gurbani-soul-ios';
const LEDGER = 'ios/testflight-builds.json';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const short = (sha) => (sha ? String(sha).slice(0, 7) : '');

export function parseLedger(text) {
  const doc = JSON.parse(text);
  if (!doc || !Array.isArray(doc.builds)) throw new Error(`sggs:app-builds: ${LEDGER} has no "builds" array`);
  return doc.builds.map((b, i) => {
    // The earliest rows were backfilled from App Store Connect: no upload time, no commits, a note.
    if (!b.version || b.build == null) throw new Error(`sggs:app-builds: ${LEDGER} entry ${i} lacks version or build`);
    return {
      version: String(b.version), build: String(b.build), uploaded: b.uploaded_at ? String(b.uploaded_at).slice(0, 10) : '',
      app: b.source_commit ?? '', note: b.note ?? '',
      channel: b.channel ?? 'testflight', profile: b.profile ?? '',
      platform: b.platform_commit ?? '', dataset: b.dataset_commit ?? '', db: b.db_sha256 ?? '', xcode: b.xcode ?? '',
    };
  }).reverse();
}

export function appBuildsHtml(builds, pin, limit = 0) {
  const shown = limit > 0 ? builds.slice(0, limit) : builds;
  const link = (repo, sha, label) => `<a href="https://github.com/${esc(repo)}/commit/${esc(sha)}" title="${label} ${esc(sha)}"><code>${esc(short(sha))}</code></a>`;
  // One "Built from" cell: the app, platform and dataset commits and the database hash that exist; a row with
  // none (the backfilled ones) shows its ledger note instead, since that is what explains it.
  const builtFrom = (b) => {
    const parts = [['app', pin.repository, b.app], ['platform', PLATFORM_REPO, b.platform], ['dataset', 'Algorythmos-AI/sggs-data', b.dataset]]
      .filter(([, , sha]) => sha).map(([label, repo, sha]) => `<span class="app-builds__c">${label} ${link(repo, sha, label)}</span>`);
    if (b.db) parts.push(`<span class="app-builds__c" title="sha256 of the bundled database">database <code>${esc(short(b.db))}</code></span>`);
    const note = b.note ? `<span class="app-builds__note">${esc(b.note)}</span>` : '';
    return parts.length ? parts.join(' ') + note : note || '—';
  };
  const rows = shown.map((b) => `<tr><td class="app-builds__v"><strong>${esc(b.version)}</strong>&nbsp;(${esc(b.build)})</td>`
    + `<td class="app-builds__nw">${esc(b.uploaded || '—')}</td>`
    + `<td class="app-builds__nw">${b.channel === 'appstore' ? 'App Store' : 'TestFlight'}</td><td>${esc(b.profile || '—')}</td>`
    + `<td>${builtFrom(b)}</td></tr>`).join('');
  const more = limit > 0 && builds.length > limit ? ` The newest ${limit} of ${builds.length} are shown.` : ` All ${builds.length} uploads.`;
  return `<div class="app-builds-wrap"><table class="app-builds"><caption>Read at build time from <a href="https://github.com/${esc(pin.repository)}/blob/${esc(pin.commit)}/${LEDGER}"><code>${LEDGER}</code></a> at <code>${esc(short(pin.commit))}</code>.${more}</caption>`
    + '<thead><tr><th scope="col">Version (build)</th><th scope="col">Uploaded</th><th scope="col">Channel</th><th scope="col">Profile</th><th scope="col">Built from</th></tr></thead>'
    + `<tbody>${rows}</tbody></table></div>`;
}

export function remarkAppBuilds() {
  return (tree, file) => {
    visit(tree, 'html', (node) => {
      const m = /^<sggs-app-builds\b([^>]*)>\s*<\/sggs-app-builds>$/.exec(node.value.trim());
      if (!m) return;
      const where = file?.path ? path.relative(REPO_ROOT, file.path) : 'page';
      const pin = loadSources()[APP];
      if (!pin?.files?.[LEDGER]) throw new Error(`${where}: sggs:app-builds: ${APP} does not pin ${LEDGER} (sources.lock.json)`);
      const abs = path.join(REPO_ROOT, SOURCES_DIR, APP, LEDGER);
      if (!existsSync(abs)) throw new Error(`${where}: sggs:app-builds: ${LEDGER} is not installed (run tools/fetch_sibling_docs.py)`);
      const limit = Number(/\blimit="(\d+)"/.exec(m[1])?.[1] ?? 0);
      node.value = appBuildsHtml(parseLedger(readFileSync(abs, 'utf8')), pin, limit);
    });
  };
}
