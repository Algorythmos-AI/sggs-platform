// Decision records read as documents on the site: `**Context.** …`, `**Decision.** …`,
// `**Consequences.** …` become sections with headings (so "On this page" lists them and each has a
// link), and the `**Status:** …` line becomes a status badge. At render time only: the Markdown in
// docs/adr/ (and a sibling repository's docs/adr/) is not edited — an accepted ADR's text is never
// rewritten, and GitHub keeps showing it exactly as written.
import { toString } from 'mdast-util-to-string';

const ADR_PATH = /[\\/]adr[\\/]\d{4}-[^\\/]+\.md$/;
const SECTION = /^(Context|Decision|Consequences|Alternatives(?: considered)?|Options)\.$/;
const STATUS = /^Status:$/;

/** The status word of a `**Status:** accepted (…)` paragraph: accepted, proposed, superseded, … */
export function statusOf(paragraph) {
  const rest = toString({ type: 'root', children: paragraph.children.slice(1) }).trim().toLowerCase();
  return (rest.match(/^[a-z]+/) ?? ['unknown'])[0];
}

export function remarkAdr() {
  return (tree, file) => {
    if (!ADR_PATH.test(file.path ?? '')) return;
    const out = [];
    for (const node of tree.children) {
      const first = node.type === 'paragraph' ? node.children[0] : null;
      const label = first?.type === 'strong' ? toString(first).trim() : '';
      if (SECTION.test(label)) {
        out.push({ type: 'heading', depth: 2, children: [{ type: 'text', value: label.replace(/\.$/, '') }] });
        const rest = node.children.slice(1);
        if (rest[0]?.type === 'text') rest[0] = { ...rest[0], value: rest[0].value.replace(/^\s+/, '') };
        out.push({ ...node, children: rest });
      } else if (STATUS.test(label)) {
        const status = statusOf(node);
        out.push({ ...node, data: { ...(node.data ?? {}), hProperties: { className: ['adr-status', `adr-status--${status}`] } } });
      } else {
        out.push(node);
      }
    }
    tree.children = out;
  };
}
