// overlay.ts — one stack for everything that opens over the page: the composition panel, the
// Saved drawer and the display sheet. An owner shows and hides its own element and tells the
// stack when. While anything is open: Escape closes the top one only, Tab stays inside it, and
// keys meant for the page (the Reader's arrow paging, Sehaj's Escape) stand down — a page script
// asks overlayOpen(). Closing returns focus to whatever opened it.
type Layer = { el: HTMLElement; close: () => void; opener: HTMLElement | null; fallback?: () => HTMLElement | null };
const stack: Layer[] = [];
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const shown = (el: Element | null): el is HTMLElement => !!el && document.contains(el) && el.getClientRects().length > 0;
// what Tab can reach inside `root`: an unchecked radio is skipped when its group has a checked one
function tabbable(root: HTMLElement): HTMLElement[] {
  return (Array.from(root.querySelectorAll(FOCUSABLE)) as HTMLElement[]).filter((el) => {
    if (!shown(el)) return false;
    if (el instanceof HTMLInputElement && el.type === 'radio' && !el.checked)
      return !root.querySelector(`input[type="radio"][name="${CSS.escape(el.name)}"]:checked`);
    return true;
  });
}

export const overlayOpen = () => stack.length > 0;

/** `el` has just been shown; `close` hides it again (and calls overlayClosed). Opening an overlay
    that is already open changes nothing, so it keeps its first opener. */
export function overlayOpened(el: HTMLElement, close: () => void,
  opts: { focus?: HTMLElement | null; fallback?: () => HTMLElement | null } = {}) {
  if (stack.some((l) => l.el === el)) return;
  const a = document.activeElement as HTMLElement | null;      // Safari does not focus a button on click
  stack.push({ el, close, opener: a && a !== document.body ? a : null, fallback: opts.fallback });
  const first = opts.focus ?? tabbable(el)[0];
  setTimeout(() => first?.focus(), 0);
}

/** `el` has just been hidden: focus goes back to its opener, or to the owner's fallback. */
export function overlayClosed(el: HTMLElement) {
  const i = stack.findIndex((l) => l.el === el);
  if (i === -1) return;
  const [layer] = stack.splice(i, 1);
  const back = shown(layer.opener) ? layer.opener : layer.fallback?.();
  if (shown(back ?? null)) back!.focus();
}

// capture phase: this runs before any page-level key handler
document.addEventListener('keydown', (e) => {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); top.close(); return; }
  if (e.key !== 'Tab') return;
  const f = tabbable(top.el);
  if (!f.length) { e.preventDefault(); return; }
  const first = f[0], last = f[f.length - 1], a = document.activeElement;
  if (!top.el.contains(a)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
  else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
}, true);
