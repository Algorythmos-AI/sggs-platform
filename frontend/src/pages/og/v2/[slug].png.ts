// og/v2/[slug].png.ts — the 1200×630 share card for each OG slug (routes.ts), built at build time.
//
// The copy comes from share.ts (learn articles: their own title); the drawing is src/og/render.ts.
// The "v2" segment is the cache key that link-preview services (WhatsApp, Facebook, Slack, X)
// fetch by: bump it whenever the card design changes so nobody keeps an old card.
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { ogSlugs } from "../../../routes";
import { SHARE, LEARN_EYEBROW, LEARN_SUB, type Share } from "../../../share";
import { pageCard } from "../../../og/render";

export async function getStaticPaths() {
  const learn = await getCollection("learn");
  const cards: Record<string, Share> = { ...SHARE };
  for (const a of learn) {
    cards[`learn-${a.id}`] = { eyebrow: LEARN_EYEBROW, title: a.data.title, sub: LEARN_SUB, social: a.data.description };
  }
  return ogSlugs().map((slug) => {
    const card = cards[slug];
    if (!card) throw new Error(`og/v2: no share copy for slug "${slug}" (add it to src/share.ts)`);
    return { params: { slug }, props: { card } };
  });
}

export const GET: APIRoute = async ({ props }) => {
  const { card } = props as { card: Share };
  const body = await pageCard({ eyebrow: card.eyebrow, title: card.title, sub: card.sub });
  return new Response(body, {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" },
  });
};
