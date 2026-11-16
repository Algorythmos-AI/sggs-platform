// llms.txt.ts — /llms.txt: a plain map of the site for programs that read it on a person's behalf.
//
// Facts only, each already stated on the site (share.ts, the Developers page). No scripture and no
// claim the pages do not make. The Hukamnama section appears once the Hukamnama is launched in
// production (src/hukamnama.ts HUKAMNAMA_LIVE); the rules for quoting are there from the start,
// because they apply to every page.
import type { APIRoute } from "astro";
import { SITE_URL } from "../site";
import { FACTS } from "../facts";
import { HUKAMNAMA_API, HUKAMNAMA_LIVE } from "../hukamnama";

export const GET: APIRoute = () => {
  const out = [
    "# Gurbani Soul",
    "",
    `> Sri Guru Granth Sahib Ji, all ${FACTS.angs} Angs, in verbatim Gurmukhi and cited by Ang: an app for iPhone and iPad, and a Knowledge Base on the web.`,
    "",
    "## Quoting from this site",
    "",
    "- The Gurmukhi is scripture. Quote it exactly as shown, whole lines only, and never correct, shorten, re-space or reorder it.",
    '- Cite every quotation as "Sri Guru Granth Sahib Ji · Ang N", with the Ang shown beside the text.',
    "- Transliteration and translation are separate, labelled layers. Never present either as the Gurbani.",
    "- Do not summarise or paraphrase a shabad as if it were the text, and do not generate Gurbani.",
    "",
    "## Pages",
    "",
    `- [Knowledge Base search](${SITE_URL}/search): search the Granth by word, sound, first letters and theme`,
    `- [Reader](${SITE_URL}/reader): read any Ang`,
    `- [Features](${SITE_URL}/en/features): what the app does`,
    `- [Learn](${SITE_URL}/en/learn): short, sourced explanations`,
    `- [Support](${SITE_URL}/en/support) and [Privacy](${SITE_URL}/en/privacy)`,
  ];
  if (HUKAMNAMA_LIVE) {
    out.push(
      "",
      "## Hukamnama · Sri Harmandir Sahib",
      "",
      "The daily Hukamnama from Sri Harmandir Sahib, Amritsar. SGPC publishes the Hukamnama; this site finds the shabad by Ang and shows its text from Sri Guru Granth Sahib Ji. Gurbani Soul is not affiliated with SGPC.",
      "",
      `- [Today's Hukamnama](${SITE_URL}/en/hukamnama): also in Punjabi (/pa/hukamnama) and French (/fr/hukamnama); a past day is at /en/hukamnama/YYYY-MM-DD`,
      `- [For developers](${SITE_URL}/en/developers): the free API, how to check the text against its hash, display rules and terms`,
      `- API: ${HUKAMNAMA_API}/v1/hukamnama/today (JSON, no key)`,
      `- Feeds: ${SITE_URL}/feeds/hukamnama.xml and ${SITE_URL}/feeds/hukamnama.json`,
      "- A Hukamnama belongs to its date in Amritsar (UTC+05:30). Call it today's only on that date.",
    );
  }
  return new Response(out.join("\n") + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
