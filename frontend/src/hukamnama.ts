// hukamnama.ts — what the site says about the public Hukamnama API, and whether it is launched.
//
// One switch for launch: `production.hukamnama_api` in gateway/routes.json. The same key turns on
// the Hukamnama pages, feeds, sitemap and embed in production (tools/gen_gateway.py). While it is
// absent the Developers page is built but hidden from search (noindex, not in the sitemap) and
// nothing links to it; the day it is set, the page is indexed, listed and linked from the footer.
// It is read from the file, not from the build's environment, so every build of a commit is the
// same (the committed webapp/static, staging and production).
import gateway from "../../gateway/routes.json" with { type: "json" };

const production = (gateway as { production?: { hukamnama_api?: string } }).production ?? {};

/** True once the Hukamnama is launched in production. */
export const HUKAMNAMA_LIVE = typeof production.hukamnama_api === "string" && production.hukamnama_api !== "";

/** The public API's origin, as documented for developers. */
export const HUKAMNAMA_API = production.hukamnama_api || "https://api.gurbanisoul.com";

/** The first date the public archive holds (services/hukamnama-edge/src/core.js EARLIEST). */
export const HUKAMNAMA_EARLIEST = "2026-11-01";

/** The list route's bounds (the same file: DEFAULT_LIMIT, MAX_LIMIT). */
export const HUKAMNAMA_LIST = { default: 7, max: 30 };

/** The embed's themes (webapp/hukamnama_embed.py THEMES). */
export const HUKAMNAMA_EMBED_THEMES = ["auto", "light", "dark"];

/** The path the API's `terms_url` points at (services/hukamnama/hukamnama/public.py TERMS_URL). */
export const DEVELOPERS_PATH = "/developers";
export const TERMS_ANCHOR = "terms";
