// Marks every run of Gurmukhi in a page's prose as Punjabi: <span lang="pa" class="pa">…</span>.
//
// Why: the page is lang="en", so without this a screen reader reads Gurmukhi with English rules or
// skips it (WCAG 3.1.2, Language of Parts). The text is never changed: a text node is cut at the
// run's edges and the pieces, joined, are the node it was — plugins/test/lang-pa.test.mjs holds
// that for every page. Left alone: code blocks (<pre>), drawings (<svg>), scripts and styles, and
// anything already inside an element that names its language.
const SKIP = new Set(['pre', 'svg', 'script', 'style', 'textarea', 'title']);
// A run starts and ends on a Gurmukhi character or a danda; words in it may be joined by spaces,
// ZWJ/ZWNJ and dandas. A danda alone is not a run (Devanagari and others share it).
const RUN = /[\u0A00-\u0A7F](?:[\u0A00-\u0A7F\u0964\u0965\u200C\u200D ]*[\u0A00-\u0A7F\u0964\u0965])?/g;

/** Cut a string into plain and Gurmukhi pieces, in order. Joined, they are the string. */
export function splitRuns(value) {
  const parts = [];
  let at = 0;
  for (const m of value.matchAll(RUN)) {
    if (m.index > at) parts.push({ pa: false, value: value.slice(at, m.index) });
    parts.push({ pa: true, value: m[0] });
    at = m.index + m[0].length;
  }
  if (at < value.length) parts.push({ pa: false, value: value.slice(at) });
  return parts;
}

const span = (value) => ({ type: 'element', tagName: 'span', properties: { lang: 'pa', className: ['pa'] }, children: [{ type: 'text', value }] });

function walk(node) {
  if (!node.children) return;
  const out = [];
  for (const child of node.children) {
    if (child.type === 'text') {
      const parts = splitRuns(child.value);
      if (parts.some((p) => p.pa)) { for (const p of parts) out.push(p.pa ? span(p.value) : { type: 'text', value: p.value }); continue; }
    } else if (child.type === 'element' && !SKIP.has(child.tagName) && child.properties?.lang == null) {
      walk(child);
    }
    out.push(child);
  }
  node.children = out;
}

export function rehypeLangPa() {
  return (tree) => walk(tree);
}
