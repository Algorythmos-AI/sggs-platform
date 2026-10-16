/* ============================================================================
   saroop.ts — optional, DISPLAY-ONLY "traditional saroop" rendering toggle.
   ----------------------------------------------------------------------------
   The corpus stores the subjoined yayya exactly as the source PDF's font encoded
   it: a doubled  ੍ਯ੍ਯ  (268 words on 78 Angs; a single  ੍ਯ  never occurs). The
   printed Bir draws that as ONE yayya tucked under the letter — Unicode's
   GURMUKHI SIGN YAKASH  ੵ  (U+0A75), which the bundled Sant Lipi draws as that
   deep subscript in every context, sihari included (checked against the source
   PDF on Angs 1354, 1359 and 1400).

   This module rewrites the *rendered* Gurmukhi glyphs ONLY. It never mutates the
   stored corpus, the DB, the API payloads, full-text search, or the explicit
   "Copy verse" action (which copies from the data model, not the DOM). A copy
   interceptor turns any selected text back into verbatim Unicode, so the
   clipboard never carries the display form. The corpus contains no  ੵ  at all
   (webapp/tests/test_saroop_invariant.py), so  ੵ  on the page can only be ours
   and maps back without ambiguity. Default ON since v2.10.1; the reader can turn
   it off, persisted in localStorage. Scripture bytes are never touched.

   Transform rule: every subjoined-ya run  (੍ਯ)+  becomes  ੵ . Pairin haha/rara/
   vava, ੴ and everything else are untouched.
   ============================================================================ */

const VIRAMA = 0x0a4d, YA = 0x0a2f, YAKASH = 0x0a75;
const VS_LO = 0xfe00, VS_HI = 0xfe0f;                 // Variation Selectors 1–16 (older builds' markup)
const KEY = 'sggs_saroop';
const SUBJOINED_YA = '੍ਯ';                            // ੍ + ਯ
const VERBATIM_YA = '੍ਯ੍ਯ';                           // how the corpus stores every subjoined yayya

/** Draw each subjoined-ya run as the printed Bir does: one yakash under the letter. Pure; display only. */
export function toTraditional(s: string): string {
  if (s.indexOf(SUBJOINED_YA) === -1) return s;               // fast path: nothing to do
  const cp = Array.from(s, c => c.codePointAt(0) as number);
  const n = cp.length; const out: string[] = []; let i = 0;
  while (i < n) {
    if (cp[i] === VIRAMA && i + 1 < n && cp[i + 1] === YA) {
      let j = i;                                              // consume the whole (virama+ya)+ run
      while (j + 1 < n && cp[j] === VIRAMA && cp[j + 1] === YA) j += 2;
      out.push(String.fromCodePoint(YAKASH));
      i = j;
    } else { out.push(String.fromCodePoint(cp[i])); i++; }
  }
  return out.join('');
}

const isVS = (c: number) => c >= VS_LO && c <= VS_HI;
const isDisplayOnly = (c: number) => c === YAKASH || isVS(c);
const hasDisplayMarks = (s: string) => { for (const ch of s) if (isDisplayOnly(ch.codePointAt(0) as number)) return true; return false; };
/** A painted fragment back to verbatim Unicode: yakash → the stored doubled form, selectors dropped. */
const toVerbatim = (s: string) => {
  let o = '';
  for (const ch of s) {
    const c = ch.codePointAt(0) as number;
    if (c === YAKASH) o += VERBATIM_YA; else if (!isVS(c)) o += ch;
  }
  return o;
};

// Default ON — the Granth shows the traditional saroop unless the reader turns it off.
let ON = true;
try { if (localStorage.getItem(KEY) === '0') ON = false; } catch {}

const orig = new WeakMap<Text, string>();                     // text node → verbatim original
let busy = false;                                             // re-entrancy guard for the observer

function gmRoots(root: ParentNode | HTMLElement): HTMLElement[] {
  const list: HTMLElement[] = [];
  const el = root as HTMLElement;
  if (el.matches && el.matches('.gm')) list.push(el);
  if ((root as ParentNode).querySelectorAll)
    (root as ParentNode).querySelectorAll<HTMLElement>('.gm').forEach(e => list.push(e));
  return list;
}

/** Transform (on) or restore (off) the text nodes inside every .gm under root. */
function paint(root: ParentNode | HTMLElement, on: boolean): void {
  for (const el of gmRoots(root)) {
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = tw.nextNode())) {
      const tn = node as Text;
      let base = orig.get(tn);
      if (base === undefined) { base = tn.nodeValue || ''; orig.set(tn, base); }
      const next = on ? toTraditional(base) : base;
      if (tn.nodeValue !== next) tn.nodeValue = next;
    }
  }
}

/** Reconstruct verbatim Unicode for a selection: a wholly-selected transformed .gm text
    node is restored byte-for-byte from its stored original; a partial selection is mapped
    back mark by mark. Keeps copied sacred text verbatim. */
function verbatimSelection(sel: Selection): string {
  const parts: string[] = [];
  for (let i = 0; i < sel.rangeCount; i++) {
    const range = sel.getRangeAt(i);
    const anc = range.commonAncestorContainer;
    const nodes: Text[] = [];
    if (anc.nodeType === 3) nodes.push(anc as Text);
    else {
      const tw = document.createTreeWalker(anc, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = tw.nextNode())) if (range.intersectsNode(n)) nodes.push(n as Text);
    }
    for (const node of nodes) {
      const v = node.nodeValue || '';
      const a = node === range.startContainer ? range.startOffset : 0;
      const b = node === range.endContainer ? range.endOffset : v.length;
      const base = orig.get(node);
      parts.push(base !== undefined && a === 0 && b === v.length ? base : toVerbatim(v.slice(a, b)));
    }
  }
  return parts.join('');
}

function reflect(): void {
  document.documentElement.classList.toggle('saroop-on', ON);
  const b = document.getElementById('saroopBtn');
  if (b) { b.classList.toggle('on', ON); b.setAttribute('aria-pressed', ON ? 'true' : 'false'); }
  busy = true; paint(document, ON); busy = false;
}
function setSaroop(on: boolean): void {
  ON = on;
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch {}   // record the reader's explicit choice
  reflect();
}

function init(): void {
  const b = document.getElementById('saroopBtn');
  if (b) b.addEventListener('click', () => setSaroop(!ON));
  reflect();   // apply the initial (default-on) saroop state without persisting until the reader chooses

  // Re-apply to scripture rendered after load (search results, reader pages, trail, the
  // composition modal #panel and the study-trail drawer — both siblings of #main, so the
  // observer must watch the whole body).
  const target = document.body;
  const mo = new MutationObserver(muts => {
    if (!ON || busy) return;
    busy = true;
    for (const m of muts)
      for (const added of Array.from(m.addedNodes))
        if (added.nodeType === 1) paint(added as HTMLElement, true);
    busy = false;
  });
  mo.observe(target, { childList: true, subtree: true });

  // Clipboard safety: any copied scripture comes out as verbatim Unicode — wholly-selected verses
  // are restored byte-for-byte from the original, and partial selections are mapped back.
  document.addEventListener('copy', e => {
    if (!ON) return;
    const sel = document.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !hasDisplayMarks(sel.toString())) return;
    (e as ClipboardEvent).clipboardData?.setData('text/plain', verbatimSelection(sel));
    e.preventDefault();
  });
}

if (document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init);
