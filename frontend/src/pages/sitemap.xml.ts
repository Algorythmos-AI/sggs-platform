// sitemap.xml.ts — static endpoint emitting /sitemap.xml over the routes manifest.
//
// Deterministic (routes.ts uses a fixed lastmod). Each marketing URL lists its language versions
// and x-default, the same set its page's <head> carries (i18n/content.ts alternates()). robots.txt
// already points at /sitemap.xml. (frontend/public/sitemap.xml was removed: Astro forbids a public
// file colliding with a page route.)
import type { APIRoute } from "astro";
import { SITE_URL } from "../site";
import { routes } from "../routes";
import { alternates } from "../i18n/content";

const loc = (path: string) => new URL(path, SITE_URL).href;

export const GET: APIRoute = () => {
  const urls = routes
    .map((r) => {
      const href = loc(r.path);
      return [
        "  <url>",
        `    <loc>${href}</loc>`,
        `    <lastmod>${r.lastmod}</lastmod>`,
        `    <changefreq>${r.changefreq}</changefreq>`,
        `    <priority>${r.priority.toFixed(1)}</priority>`,
        // Marketing pages list every language version and x-default (the bare root, which picks a
        // language); the Knowledge Base is English-only and names itself.
        ...(alternates(r.path).length
          ? alternates(r.path).map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${loc(a.href)}"/>`)
          : [`    <xhtml:link rel="alternate" hreflang="en" href="${href}"/>`]),
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
    'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    urls +
    "\n</urlset>\n";

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
