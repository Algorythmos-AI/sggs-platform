// /md-manifest.json — every exported page with its title, address, Markdown address, date and
// reading time. One list for /llms.txt, the page menu and the tests; deliberately outside /md/ so it
// can never collide with a page id.
import type { APIRoute } from 'astro';
import { listExportPages, exportOne, manifestEntry } from '../../plugins/export-pages.mjs';

export const GET: APIRoute = () =>
  new Response(JSON.stringify({ pages: listExportPages().map((p) => manifestEntry(exportOne(p))) }, null, 1) + '\n', {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
