// "Ask ChatGPT" and "Ask Claude" in the page menu: plain outbound links that open the assistant with
// a short instruction and this page's public Markdown address. Nothing is generated on this site
// and nothing is recorded; the decision and its limits are in docs/adr/0013-outbound-assistant-links.md.
//
// The instruction is written to stand on its own — an assistant may send it the moment the tab
// opens — and to hold the scripture rule: answer only from the page, quote Gurbani only as the page
// prints it, with its Ang. Nothing here can make an assistant comply; the menu says so.
export const PROMPT_MAX = 600;        // characters, with a typical address and title
export const URL_MAX = 2000;          // the encoded link

const SERVICES = {
  chatgpt: (q) => `https://chatgpt.com/?hints=search&q=${q}`,
  claude: (q) => `https://claude.ai/new?q=${q}`,
};

/** The instruction for one page. `title` is left out when it is empty. */
export function assistantPrompt({ url, title }) {
  return [
    `Read this page before you answer: ${url}`,
    title ? `It is "${title}" from the Sri Guru Granth Sahib Ji — Knowledge Base wiki.` : 'It is a page of the Sri Guru Granth Sahib Ji — Knowledge Base wiki.',
    '1. Answer only from that page. If you cannot open it, say so and stop.',
    '2. Never quote, translate or transliterate Gurbani from memory. Quote only lines printed on the page, exactly, each with its "— Sri Guru Granth Sahib Ji · Ang N" line.',
    '3. If the page does not answer my question, say so.',
    'First confirm in one sentence that you opened the page, then ask for my question.',
  ].join('\n');
}

/** { chatgpt, claude }: the two links for a page. The title is dropped when it would make a link too long. */
export function assistantLinks({ url, title }) {
  const build = (t) => Object.fromEntries(Object.entries(SERVICES).map(([name, to]) => [name, to(encodeURIComponent(assistantPrompt({ url, title: t })))]));
  const links = build(title);
  if (Object.values(links).every((l) => l.length <= URL_MAX)) return links;
  const short = build('');
  for (const l of Object.values(short)) if (l.length > URL_MAX) throw new Error(`assistant link for ${url} is ${l.length} characters (max ${URL_MAX})`);
  return short;
}
