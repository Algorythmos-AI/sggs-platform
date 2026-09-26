// Starlight route middleware: adjustments to the data every page renders with.
import { defineRouteMiddleware, type StarlightRouteData } from '@astrojs/starlight/route-data';

type Entry = StarlightRouteData['sidebar'][number];
type Link = NonNullable<StarlightRouteData['pagination']['prev']>;

/** The label of the group that directly holds the link to `href`. */
function groupOf(entries: Entry[], href: string, parent?: string): string | undefined {
  for (const e of entries) {
    if (e.type === 'group') {
      const found = groupOf(e.entries, href, e.label);
      if (found) return found;
    } else if (e.href === href) {
      return parent;
    }
  }
  return undefined;
}

export const onRequest = defineRouteMiddleware(async (context, next) => {
  // after the rest of the chain: starlight-openapi's middleware (order 'post') rebuilds pagination
  await next();
  const route = context.locals.starlightRoute;
  // Every section's index is labelled "Overview" in the sidebar (plugins/nav.mjs), which is clear in
  // place but not as "Next: Overview"; pagination names the section instead ("Data overview").
  // Pagination's link objects are the sidebar's own entries, so each is replaced by a copy, never
  // edited — editing it would rename the sidebar entry too.
  const named = (link: Link | undefined): Link | undefined => {
    if (!link || link.label !== 'Overview') return link;
    const section = groupOf(route.sidebar, link.href);
    return section ? { ...link, label: `${section} overview` } : link;
  };
  route.pagination = { prev: named(route.pagination.prev), next: named(route.pagination.next) };
});
