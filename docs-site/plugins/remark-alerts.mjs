// Callouts. A blockquote is how the wiki cites scripture, so a note written as a blockquote looked
// like a citation. On the site, two kinds of blockquote render as Starlight asides instead:
//   - GitHub alerts: `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`
//     (GitHub renders these natively too);
//   - a blockquote that opens with bold text and carries no Gurmukhi — the wiki's existing notes
//     ("**Prime directive:** …", "**Explanation, not scripture.** …"). Rules about the text itself
//     ("never altered", "sacred", "hard rule") are cautions; the rest are notes.
// A blockquote with Gurmukhi in it is a quotation and stays a blockquote. Render time only.
import { toString } from 'mdast-util-to-string';
import { visit } from 'unist-util-visit';

const GITHUB = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/;
const KIND = { NOTE: 'note', TIP: 'tip', IMPORTANT: 'caution', WARNING: 'caution', CAUTION: 'danger' };
const GURMUKHI = /[਀-੿]/;
const RULE = /(prime directive|hard rule|never altered|sacred|never edited)/i;

const aside = (kind, children) => ({
  type: 'alert',
  data: { hName: 'aside', hProperties: { className: ['starlight-aside', `starlight-aside--${kind}`], 'aria-label': kind === 'note' ? 'Note' : kind === 'tip' ? 'Tip' : 'Caution' } },
  children: [{ type: 'alertContent', data: { hName: 'div', hProperties: { className: ['starlight-aside__content'] } }, children }],
});

/** The aside kind for a blockquote, or null to keep it a blockquote. */
export function alertKind(blockquote) {
  const first = blockquote.children[0];
  if (first?.type !== 'paragraph') return null;
  const head = first.children[0];
  if (head?.type === 'text' && GITHUB.test(head.value)) return KIND[GITHUB.exec(head.value)[1]];
  const text = toString(blockquote);
  if (head?.type === 'strong' && !GURMUKHI.test(text)) return RULE.test(toString(head)) || RULE.test(text.slice(0, 160)) ? 'caution' : 'note';
  return null;
}

export function remarkAlerts() {
  return (tree) => {
    visit(tree, 'blockquote', (node, index, parent) => {
      const kind = alertKind(node);
      if (!kind || !parent) return;
      const first = node.children[0];
      const head = first.children[0];
      if (head.type === 'text' && GITHUB.test(head.value)) {
        head.value = head.value.replace(GITHUB, '');
        if (!head.value) first.children.shift();
        if (first.children[0]?.type === 'break') first.children.shift();
      }
      parent.children[index] = aside(kind, node.children);
    });
  };
}
