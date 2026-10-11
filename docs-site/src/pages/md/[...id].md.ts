// md/[...id].md.ts — every published page as portable Markdown, prerendered at build:
// /md/index.md, /md/api/quickstart.md, … (plugins/portable-md.mjs explains what changes and what
// never does). Under /md/ rather than beside the page because pages live under /api/, and
// vercel.json sends any /api path that is not a built file to the product API.
import type { APIRoute } from 'astro';
import { listExportPages, exportOne } from '../../../plugins/export-pages.mjs';

export function getStaticPaths() {
  return listExportPages().map((page) => ({ params: { id: page.id }, props: { page } }));
}

export const GET: APIRoute = ({ props }) =>
  new Response(exportOne(props.page).markdown, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
