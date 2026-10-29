// og/v2/[...id].png.ts — the share card for every wiki page, prerendered at build. "v2" is the
// cache key link-preview services fetch by: bump it when the card design changes.
//
// Drawn by the same renderer as gurbanisoul.com's cards (frontend/src/og/render.ts, copied to
// src/og at prebuild by scripts/copy-assets.mjs): paper, the app icon and "Gurbani Soul", the
// host, the section as the eyebrow, the page title in Source Serif 4 on balanced lines, the gold
// rule, and the Knowledge Base's name. Gurmukhi in a title is set in Sant Lipi with real shaping;
// a glyph missing from the fonts fails the build. Byte-deterministic across builds.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { pageCard } from '../../../og/render';

const SECTION: Record<string, string> = {
  onboarding: 'Start here', scripture: 'Scripture 101', 'learning-paths': 'Learning paths', exercises: 'Exercises', contributing: 'Contributing to the wiki',
  architecture: 'Architecture', data: 'Data & pipeline', search: 'Search & verification', api: 'API', ios: 'iOS app', engineering: 'Engineering handbook',
  process: 'Process & runbooks', brand: 'Brand', adr: 'Decisions', reference: 'Reference', diagrams: 'Reference', website: 'Reference',
};

export async function getStaticPaths() {
  const docs = await getCollection('docs');
  return docs.map((d) => ({
    params: { id: d.id },
    props: { title: d.data.title, section: d.id === 'index' || d.id === '404' ? null : (SECTION[d.id.split('/')[0]] ?? 'Reference') },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { title, section } = props as { title: string; section: string | null };
  const png = await pageCard({
    eyebrow: section ? `Engineering wiki · ${section}` : 'Engineering wiki',
    title,
    sub: 'Sri Guru Granth Sahib Ji — Knowledge Base',
    host: 'docs.gurbanisoul.com',
  });
  return new Response(png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' } });
};
