// robots.txt.ts — /robots.txt. Everything may be crawled; the sitemaps are named.
//
// The Hukamnama sitemap (/sitemap-hukamnama.xml, served by the API function) is named only once
// the Hukamnama is launched in production (src/hukamnama.ts HUKAMNAMA_LIVE): before that the path
// does not exist there, and a robots.txt must not point at a 404.
import type { APIRoute } from "astro";
import { SITE_URL } from "../site";
import { HUKAMNAMA_LIVE } from "../hukamnama";

export const GET: APIRoute = () => {
  const lines = ["User-agent: *", "Allow: /", "", `Sitemap: ${SITE_URL}/sitemap.xml`];
  if (HUKAMNAMA_LIVE) lines.push(`Sitemap: ${SITE_URL}/sitemap-hukamnama.xml`);
  return new Response(lines.join("\n") + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
