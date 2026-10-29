// og/v2/ang/[n].png.ts — the share card for each /ang/N page: the Ang, its raag and its opening
// line, verbatim from frontend/src/generated/ang-cards.json (generated from db/sggs.sqlite).
// Built on deploy only: scripts/sync-to-webapp.mjs leaves og/v2/ang out of the committed
// webapp/static, so 1430 images never enter git. scripts/check-share-cards.mjs checks them.
import type { APIRoute } from "astro";
import data from "../../../../generated/ang-cards.json";
import { angCard } from "../../../../og/render";

type Ang = { line: number; raag: string | null; gurmukhi: string };
const angs = data.angs as Record<string, Ang>;

export function getStaticPaths() {
  return Object.keys(angs).map((n) => ({ params: { n } }));
}

export const GET: APIRoute = async ({ params }) => {
  const n = params.n!;
  const a = angs[n];
  const body = await angCard({ ang: Number(n), raag: a.raag, gurmukhi: a.gurmukhi });
  return new Response(body, {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" },
  });
};
