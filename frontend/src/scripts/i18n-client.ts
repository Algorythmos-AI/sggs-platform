// i18n-client.ts — strings a client script shows, in the page's language. A page that needs them
// emits <script type="application/json" id="i18n-client"> (components/ClientStrings.astro) with
// only its own keys, rendered at build time from the message catalog. Scripts read it on every
// astro:page-load (never once at module load), so a view-transition swap never leaves stale text.
// Missing or malformed data returns null and the script keeps its English fallback.
export function clientStrings<T>(): T | null {
  try {
    const el = document.getElementById("i18n-client");
    return el?.textContent ? (JSON.parse(el.textContent) as T) : null;
  } catch {
    return null;
  }
}
