// Getting a page ready for paper, and putting it back. Inline addresses after every link would wreck
// the line length, so in print each external link gets a small number and the addresses are listed
// once, at the end, under "Links". Collapsed sections are opened, the light theme is used whatever
// the reader's, and the colophon says when the page was printed. All of it is undone after printing.
//
// The same two functions prepare a page for the pre-built PDFs (docs-site/scripts/build-pdfs.mjs
// calls window.sggsPrint.prepare()), so the browser's Print and the downloaded PDF read alike.
// Without script, src/styles/print.css prints each external address after its link instead.
const CONTENT = '.sl-markdown-content';

type State = { opened: HTMLDetailsElement[]; added: Element[]; theme: string | undefined };
let state: State | null = null;

/** External links in the page body, in reading order, each address once: [{ href, links }]. */
export function externalLinks(root: ParentNode, origin = location.origin) {
  const seen = new Map<string, HTMLAnchorElement[]>();
  for (const a of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (a.closest('.print-links, .sl-anchor-link, nav, .pa')) continue;
    let url: URL;
    try { url = new URL(a.getAttribute('href')!, origin); } catch { continue; }
    if (!/^https?:$/.test(url.protocol) || url.origin === origin) continue;
    if (a.textContent?.trim() === url.href || a.textContent?.trim() === a.getAttribute('href')) continue;   // the address is already the text
    seen.set(url.href, [...(seen.get(url.href) ?? []), a]);
  }
  return [...seen].map(([href, links]) => ({ href, links }));
}

export function prepare(printedOn: Date | null = new Date()) {
  if (state) return;
  const root = document.documentElement;
  state = { opened: [], added: [], theme: root.dataset.theme };
  // code blocks choose their colours from this attribute, which a stylesheet cannot override
  root.dataset.theme = 'light';
  const body = document.querySelector(CONTENT);
  for (const d of document.querySelectorAll<HTMLDetailsElement>(`${CONTENT} details:not([open])`)) { d.open = true; state.opened.push(d); }
  if (body) {
    const refs = externalLinks(body);
    if (refs.length) {
      const list = document.createElement('ol');
      refs.forEach(({ href, links }, i) => {
        for (const a of links) {
          const sup = document.createElement('sup');
          sup.className = 'print-ref';
          sup.textContent = String(i + 1);
          a.after(sup);
          state!.added.push(sup);
        }
        const li = document.createElement('li');
        li.textContent = href;
        list.append(li);
      });
      const section = document.createElement('section');
      section.className = 'print-links';
      const h = document.createElement('h2');
      h.textContent = 'Links';
      section.append(h, list);
      body.append(section);
      state.added.push(section);
    }
  }
  const stamp = document.querySelector<HTMLElement>('.print-colophon__printed');
  if (stamp && printedOn) stamp.textContent = ` Printed ${printedOn.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`;
  document.documentElement.dataset.printRefs = '';
}

export function restore() {
  if (!state) return;
  for (const d of state.opened) d.open = false;
  for (const n of state.added) n.remove();
  const stamp = document.querySelector<HTMLElement>('.print-colophon__printed');
  if (stamp) stamp.textContent = '';
  delete document.documentElement.dataset.printRefs;
  if (state.theme === undefined) delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = state.theme;
  state = null;
}

declare global { interface Window { sggsPrint?: { prepare: typeof prepare; restore: typeof restore } } }

export function watchPrint() {
  window.sggsPrint = { prepare, restore };
  window.addEventListener('beforeprint', () => prepare());
  window.addEventListener('afterprint', () => restore());
}
