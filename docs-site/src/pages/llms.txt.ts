// /llms.txt — the site described for language-model tools (llmstxt.org): one line per page, grouped
// as the sidebar groups them, each linking to the page's Markdown under /md/.
import type { APIRoute } from 'astro';
import { listExportPages, exportOne, manifestEntry, llmsText } from '../../plugins/export-pages.mjs';
import { sidebarLinks } from '../../plugins/nav.mjs';
import { SIDEBAR } from '../../sidebar.mjs';

export const GET: APIRoute = () =>
  new Response(llmsText(listExportPages().map((p) => manifestEntry(exportOne(p))), [...sidebarLinks(SIDEBAR)]), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
