// Values filled from the code (tools/gen_facts.py): a page writes `<!--fact:routes-->29<!--/fact-->`
// so the number can be checked and rewritten from its source. The comments are invisible on GitHub;
// here they are dropped from the tree, so the HTML carries only the number — no comment a reader's
// "view source", a copy or a feed reader could pick up. The value between them is ordinary text.
export const FACT_MARKER = /^<!--\/?fact(?::[a-z][a-z0-9_]*(?::[a-z]+)?)?-->$/;

export function remarkFacts() {
  const walk = (node) => {
    if (!node.children) return;
    node.children = node.children.filter((c) => !(c.type === 'html' && FACT_MARKER.test(c.value.trim())));
    for (const c of node.children) walk(c);
  };
  return (tree) => walk(tree);
}
