// <sggs-page-actions>: the script half of the page menu (src/components/PageActions.astro). The
// links in the menu already work; this reveals and drives the two things that need script — copying
// (the page as Markdown, or its address) and printing — and gives the panel its manners: Escape and
// an outside click close it, and focus goes back to where it was.
//
// Copying the Markdown means fetching it first, and Safari only lets a page write to the clipboard
// inside the click itself. So the write is started in the click with a ClipboardItem whose value is
// the pending fetch; where that form is not supported, the text is written after the fetch; where
// there is no clipboard at all, the reader is told how to copy it by hand. Nothing is recorded.
const SLOW = 400;        // ms before a copy says "Copying…"
const SHOWN = 2000;      // ms "Copied" stays

const MESSAGES = {
  'copy-md': { done: 'Page copied as Markdown', fail: "Couldn't copy. Open the Markdown and copy it from there." },
  'copy-link': { done: 'Link copied', fail: "Couldn't copy. The link is in your address bar." },
  load: "Couldn't load the page's Markdown. Check your connection and try again.",
} as const;

export class SggsPageActions extends HTMLElement {
  private details: HTMLDetailsElement | null = null;
  private status: HTMLElement | null = null;
  private pending: Promise<string> | null = null;
  private loadFailed = false;
  private readonly onDocumentPointer = (e: Event) => { if (this.details?.open && !this.contains(e.target as Node)) this.close(false); };

  connectedCallback() {
    this.details = this.querySelector('details');
    this.status = this.querySelector('.pa__status');
    const canPrint = typeof window.print === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    for (const b of this.querySelectorAll<HTMLButtonElement>('button[data-action]')) {
      if (b.dataset.action === 'print' && !canPrint) continue;     // printing from a phone is the PDF's job
      b.hidden = false;
      b.addEventListener('click', () => this.run(b));
    }
    for (const group of this.querySelectorAll<HTMLElement>('.pa__group')) {
      if (group.querySelector(':scope > li > :not([hidden])')) group.hidden = false;
    }
    if (location.hostname !== this.dataset.production) this.querySelector<HTMLElement>('.pa__note--preview')?.removeAttribute('hidden');
    this.querySelector('summary')?.setAttribute('aria-label', 'More page actions');
    this.dataset.ready = '';

    this.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.details?.open) { e.stopPropagation(); this.close(true); } });
    this.addEventListener('focusout', (e) => { const to = (e as FocusEvent).relatedTarget as Node | null; if (to && !this.contains(to)) this.close(false); });
    document.addEventListener('pointerdown', this.onDocumentPointer);
    // warm the fetch when the reader reaches for the control, so the copy is instant
    const warm = () => { if (this.dataset.md) void this.markdown().catch(() => {}); };
    this.addEventListener('pointerenter', warm, { once: true });
    this.addEventListener('focusin', warm, { once: true });
  }

  disconnectedCallback() { document.removeEventListener('pointerdown', this.onDocumentPointer); }

  private close(refocus: boolean) {
    if (!this.details?.open) return;
    this.details.open = false;
    if (refocus) this.details.querySelector<HTMLElement>('summary')?.focus();
  }

  /** The page's Markdown, fetched once; a failed fetch is forgotten so the next click tries again. */
  private markdown(): Promise<string> {
    this.pending ??= fetch(this.dataset.md!, { headers: { Accept: 'text/plain' } })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
      .catch((e) => { this.pending = null; this.loadFailed = true; throw e; });
    return this.pending;
  }

  private async run(button: HTMLButtonElement) {
    const action = button.dataset.action as 'copy-md' | 'copy-link' | 'print';
    if (action === 'print') { this.close(false); window.print(); return; }
    if (button.getAttribute('aria-busy') === 'true') return;
    const label = button.querySelector<HTMLElement>('.pa__label')!;
    button.style.minInlineSize = `${button.offsetWidth}px`;        // "Copied" never moves the layout
    button.setAttribute('aria-busy', 'true');
    const slow = window.setTimeout(() => { label.textContent = 'Copying…'; }, SLOW);
    this.loadFailed = false;
    let ok = false;
    try {
      await (action === 'copy-link' ? this.write(() => Promise.resolve(location.href.split('#')[0])) : this.write(() => this.markdown()));
      ok = true;
    } catch { ok = false; }
    window.clearTimeout(slow);
    button.removeAttribute('aria-busy');
    if (ok) {
      label.textContent = 'Copied';
      button.dataset.state = 'done';
      this.say(MESSAGES[action].done, false);
      window.setTimeout(() => { label.textContent = button.dataset.label!; delete button.dataset.state; }, SHOWN);
    } else {
      label.textContent = button.dataset.label!;
      this.say(this.loadFailed ? MESSAGES.load : MESSAGES[action].fail, true);
    }
  }

  /** Put text on the clipboard, starting inside the click that asked for it. */
  private async write(text: () => Promise<string>) {
    const clip = navigator.clipboard;
    if (!clip) { await text(); throw new Error('no clipboard'); }
    if (typeof ClipboardItem !== 'undefined' && typeof clip.write === 'function') {
      try {
        await clip.write([new ClipboardItem({ 'text/plain': text().then((t) => new Blob([t], { type: 'text/plain' })) })]);
        return;
      } catch (e) {
        if (this.loadFailed) throw e;                            // the fetch failed: nothing to fall back to
      }
    }
    await clip.writeText(await text());
  }

  private say(message: string, isError: boolean) {
    if (!this.status) return;
    this.status.textContent = message;
    this.status.classList.toggle('pa__status--error', isError);
    if (!isError) window.setTimeout(() => { if (this.status?.textContent === message) this.status.textContent = ''; }, SHOWN + 1000);
  }
}
