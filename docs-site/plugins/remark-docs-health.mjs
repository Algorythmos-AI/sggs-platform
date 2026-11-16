// <!-- sggs:docs-health --> becomes a table of the wiki's health, read at build from
// docs-site/.health.json — written just before the build by `python3 tools/docs_check.py --health`
// (git-ignored; the deploy-docs `docs` job writes it). When the file is absent the widget says
// "not measured in this build" instead of showing numbers that would be stale.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { visit } from 'unist-util-visit';
import { SITE_DIR } from './paths.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const reasons = (days) => ({ 'code-changed': 'cited code changed since the stamp', 'old-no-code': `cites no code, stamp older than ${days} days`, 'not-in-history': 'stamp not in history' });
export const NOT_MEASURED = 'Docs health was not measured in this build.';

export function readHealth(file) {
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

function pct(v) { return v === null || v === undefined ? '—' : `${v}%`; }

export function docsHealthHtml(h) {
  if (!h || typeof h !== 'object') return `<sggs-docs-health><p class="docs-health__none">${NOT_MEASURED}</p></sggs-docs-health>`;
  const stale = Object.entries(h.stale_by_reason ?? {});
  const REASONS = reasons(h.stale_days ?? 60);
  const debt = h.coupling_debt ?? {};
  const share = h.code_commits_with_docs ?? {};
  const rows = [
    ['Pages', `${h.pages}`],
    ['Pages with a <code>verified</code> stamp', `${h.stamped}`],
    ['Stamps that are fresh', `${pct(h.fresh_pct)} (${h.fresh} of ${h.stamped})`],
    ['Stale stamps, by reason', stale.length ? stale.map(([k, n]) => `${n} ${esc(REASONS[k] ?? k)}`).join('; ') : 'none'],
    ['Median stamp age', h.median_stamp_age_days === null || h.median_stamp_age_days === undefined ? '—' : `${h.median_stamp_age_days} days`],
    [`Coupling debt, last ${h.window_days} days`, `${debt.merges_with_debt ?? 0} of ${debt.merges ?? 0} merges changed covered code without its page (${debt.page_flags ?? 0} page flags)`],
    [`Code commits that also changed docs/, last ${h.window_days} days`, `${pct(share.pct)} (${share.with_docs ?? 0} of ${share.code_commits ?? 0})`],
  ];
  if (h.code_areas) {
    const a = h.code_areas;
    rows.push(['Code areas on a wiki page', `${a.covered} of ${a.total} (${a.exempt} exempt, ${a.backlog} in the backlog with no page yet)`]);
  }
  if (h.sibling_pin_lag) {
    const lag = Object.entries(h.sibling_pin_lag).map(([k, v]) => `${esc(k)}: ${v.days !== undefined ? `${v.days} days` : `${v.commits} commits`} behind`).join('; ');
    rows.push(['Sibling pins behind their branch', lag]);
  }
  const body = rows.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('');
  return `<sggs-docs-health><table class="docs-health"><caption>Measured ${esc(h.generated)} at <code>${esc(h.commit)}</code></caption><tbody>${body}</tbody></table></sggs-docs-health>`;
}

export function remarkDocsHealth(options = {}) {
  const file = options.file ?? path.join(SITE_DIR, '.health.json');
  return (tree) => {
    visit(tree, 'html', (node) => {
      if (!/^<sggs-docs-health\b[^>]*>\s*<\/sggs-docs-health>$/.test(node.value.trim())) return;
      node.value = docsHealthHtml(readHealth(file));
    });
  };
}
