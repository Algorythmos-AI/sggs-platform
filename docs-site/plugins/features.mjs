// What this build can be held to, announced in <meta name="sggs-docs-features"> on every page.
// The live checks (scripts/ci/docs_smoke.py, e2e-live) run against production too, which stays on
// an older build until the next release — so each check for a newer feature runs only when the
// build it is looking at announces that feature. Add a token here, never a second meta tag.
//   nav2      every page is in the sidebar and no group is empty
//   md1       every page is exported as Markdown under /md/, listed in /md-manifest.json and /llms.txt
//   actions1  the page menu (copy, view as Markdown, the assistant links, print) is on every page
//   print1    the print layout: provenance on the first page, a colophon, numbered link references
//   pdf1      every exported page has a pre-built PDF under /pdf/ (only when the build was asked for them)
//   look2     the reading layout: the type scale, the summary under the title, callouts, steps (src/styles/look.css)
//   tabs1     the section tabs under the header, and Gurmukhi in prose marked lang="pa"
//
// Switches (build-time environment; documented in docs/process/runbooks/docs-site.md):
//   DOCS_PAGE_ACTIONS=0   build without the page menu, should it ever misbehave in production
//   DOCS_PDF=1            also build a PDF of every page (scripts/build-pdfs.mjs). CI sets it for
//                         every build that is tested or deployed; a local build is quicker without.
const off = (name) => process.env[name] === '0';

export const PAGE_ACTIONS = !off('DOCS_PAGE_ACTIONS');
export const PDFS = process.env.DOCS_PDF === '1';
export const FEATURES = ['nav2', 'md1', ...(PAGE_ACTIONS ? ['actions1'] : []), 'print1', ...(PDFS ? ['pdf1'] : []), 'look2', 'tabs1'];
