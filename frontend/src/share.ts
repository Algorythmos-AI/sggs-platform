// share.ts — what a shared link to each page says: the card copy (src/pages/og/v2) and the
// social description (og:description / twitter:description, read by <Seo>), keyed by the route's
// og slug in routes.ts. Learn articles are added from their frontmatter in og/v2/[slug].png.ts.
//
// Limits (enforced by webapp/tests/test_repo_gates.py ShareCardMeta and e2e/share-meta.spec.ts):
// `social` ≤ 125 characters (WhatsApp, iMessage and Slack cut longer text), `ogTitle` ≤ 60, a card
// title fits three lines. Card text is English: no Gurmukhi here (verses come only from the DB).
export interface Share {
  eyebrow?: string;  // small caps above the card title
  title: string;     // the card's headline
  sub?: string;      // one supporting line under the rule
  social: string;    // og:description + twitter:description
  ogTitle?: string;  // og:title when the page <title> is too long to unfurl whole
}

const KB = "Knowledge Base";

export const SHARE: Record<string, Share> = {
  "home": {
    title: "A quiet, exact companion to Sri Guru Granth Sahib Ji",
    sub: "Verbatim · cited by Ang · fully offline · iPhone & iPad",
    social: "The complete Sri Guru Granth Sahib Ji for iPhone and iPad: verbatim, cited by Ang, fully offline, never AI-generated.",
  },
  "features": {
    eyebrow: "Features",
    title: "Everything Gurbani Soul does, on your device",
    sub: "Reader · search · Nitnem · Hukamnama · Vaars · themes",
    social: "Read the whole Granth, search the way you remember, keep your Nitnem and receive the Hukam of the day. Fully offline.",
  },
  "watch": {
    eyebrow: "The Raag Clock",
    title: "The raags of the eight watches of the day",
    sub: "Follows your device's clock, with an optional solar mode",
    social: "The Raag Clock follows the eight pahars, the watches of the day, and shows which raags belong to the current watch.",
  },
  "learn": {
    eyebrow: "Learn",
    title: "Plain, sourced explanations of Sri Guru Granth Sahib Ji",
    sub: "Hukamnama · Nitnem · raags · how the text is verified",
    social: "Short, sourced guides: what a Hukamnama is, how to read Nitnem, the raags and watches of the day, how the text is verified.",
  },
  "privacy": {
    eyebrow: "Privacy",
    title: "The Gurbani Soul app collects nothing",
    sub: "No account · no network · no analytics",
    social: "No accounts, no network connections, no analytics. What stays on your device, and what this website does.",
  },
  "support": {
    eyebrow: "Support",
    title: "Help with Gurbani Soul",
    sub: "Contact · report a text error · common questions",
    social: "Help with Gurbani Soul for iPhone and iPad: contact, reporting a text error, and answers to common questions.",
  },
  "contribute": {
    eyebrow: "Contribute",
    title: "Keep Gurbani Soul free, offline and ad-free",
    sub: "An optional contribution. Nothing is ever locked.",
    social: "Gurbani Soul is free, offline and ad-free. An optional contribution helps keep it that way.",
  },
  "knowledge-base": {
    eyebrow: KB,
    title: "Sri Guru Granth Sahib Ji — all 1430 Angs, verbatim",
    sub: "Search by word, sound, first letters and theme",
    social: "All 1430 Angs of Sri Guru Granth Sahib Ji in verbatim Gurmukhi, cited by Ang, searchable by word, sound and theme.",
  },
  "library": {
    eyebrow: KB,
    title: "Sri Guru Granth Sahib Ji — all 1430 Angs, verbatim",
    sub: "Search, the Reader, Nitnem, the Index and study tools",
    social: "Search Sri Guru Granth Sahib Ji, carry on where you were reading, and open the Reader, Nitnem and the Index.",
  },
  "search": {
    eyebrow: `${KB} · Search`,
    title: "Search Sri Guru Granth Sahib Ji",
    sub: "By word, by sound, by first letters, by theme",
    social: "Search all 1430 Angs of Sri Guru Granth Sahib Ji by word, by sound in Roman letters, by first letters and by theme.",
  },
  "reader": {
    eyebrow: `${KB} · Reader`,
    title: "Read Sri Guru Granth Sahib Ji, Ang by Ang",
    sub: "Verbatim Gurmukhi · cited by Ang",
    social: "Read all 1430 Angs of Sri Guru Granth Sahib Ji in verbatim Gurmukhi, cited by Ang.",
  },
  "nitnem": {
    eyebrow: `${KB} · Nitnem`,
    title: "The daily banis of Nitnem",
    sub: "Morning, evening and night, verbatim",
    social: "The daily banis of Nitnem, verbatim and in order, for morning, evening and night.",
  },
  "browse": {
    eyebrow: `${KB} · Index`,
    title: "The Index of Sri Guru Granth Sahib Ji",
    sub: "Raags, compositions and voices, Ang by Ang",
    social: "Browse Sri Guru Granth Sahib Ji by raag, composition and voice, with every entry cited by Ang.",
  },
  "themes": {
    eyebrow: `${KB} · Themes`,
    title: "Themes across Sri Guru Granth Sahib Ji",
    sub: "54 themes in six groups, each verse cited by Ang",
    social: "Explore the themes of Sri Guru Granth Sahib Ji, with every verse quoted verbatim and cited by Ang.",
  },
  "lineage": {
    eyebrow: `${KB} · Voices`,
    title: "The voices of Sri Guru Granth Sahib Ji",
    sub: "Gurus, Bhagats and Bhatts, and where each appears",
    social: "The Gurus, Bhagats and Bhatts whose Bani is in Sri Guru Granth Sahib Ji, and where each one's verses appear.",
  },
  "trail": {
    eyebrow: `${KB} · Semantic Trail`,
    title: "Follow a word through Sri Guru Granth Sahib Ji",
    sub: "Linked by shared words, every verse cited by Ang",
    social: "Follow a word from verse to verse through Sri Guru Granth Sahib Ji, every verse cited by Ang.",
  },
  "analytics": {
    eyebrow: `${KB} · Insights`,
    title: "Sri Guru Granth Sahib Ji in numbers",
    sub: "Raags, voices and words across the 1430 Angs",
    social: "Counts and patterns across the 1430 Angs of Sri Guru Granth Sahib Ji: raags, voices and words.",
  },
  "constellation": {
    eyebrow: `${KB} · Constellation`,
    title: "A constellation of concepts in the Granth",
    sub: "Themes that share words, drawn as a sky",
    social: "Concepts of Sri Guru Granth Sahib Ji drawn as a constellation, joined where their verses share words.",
  },
  "raag-clock": {
    eyebrow: `${KB} · Raag Clock`,
    title: "The traditional timing of the raags",
    sub: "The eight pahars of the day and night",
    social: "The traditional timing of the raags of Sri Guru Granth Sahib Ji across the eight pahars of the day and night.",
  },
  "divergence": {
    eyebrow: `${KB} · Raag timing`,
    title: "Raag timings, the sources side by side",
    sub: "Where the traditions agree and where they differ",
    social: "Where the sources for raag timing agree and where they differ, shown side by side.",
    ogTitle: "ੴ Sri Guru Granth Sahib Ji — Raag timing divergence",
  },
};

export const LEARN_EYEBROW = "Learn";
export const LEARN_SUB = "A short, sourced guide from Gurbani Soul";
