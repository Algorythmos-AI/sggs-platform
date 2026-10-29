// landing.ts — the gurbanisoul.com landing's one client controller. A single idempotent init()
// runs on first load AND after every view-transition swap (astro:page-load); teardown() releases
// its observers/timers on astro:before-swap so nothing leaks across navigations. It NEVER imports
// core.ts (the Knowledge Base's DOM/API layer) — only the self-contained theme + pahar helpers.
import { initTheme, applyTheme, setDefaultTheme } from "./theme";
import { paharFixed, paharLabel, paharRange } from "./pahar.js";
import { wireNewsletter } from "./newsletter";

type Theme = "light" | "dark" | "system";

// gurbanisoul.com is LIGHT-FIRST: with no stored choice the marketing pages render light whatever
// the OS appearance (the Knowledge Base keeps its 'system' default — it never loads this module).
// Must run before initTheme(); the pre-paint script in Marketing.astro uses the same default.
const MARKETING_DEFAULT: Theme = "light";
setDefaultTheme(MARKETING_DEFAULT);

let observers: IntersectionObserver[] = [];
let cleanups: Array<() => void> = [];
let tick: number | undefined;

const motionOK = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: no-preference)").matches;

/** Lock page scroll under the open menu. `overflow: hidden` alone does not hold on iOS Safari, so
    the body is pinned at its current offset and the scroll position restored on release. */
function lockScroll(): () => void {
  const y = window.scrollY;
  const b = document.body.style;
  const prev = { position: b.position, top: b.top, left: b.left, right: b.right, width: b.width, overflow: b.overflow };
  Object.assign(b, { position: "fixed", top: `-${y}px`, left: "0", right: "0", width: "100%", overflow: "hidden" });
  return () => {
    Object.assign(b, prev);
    window.scrollTo(0, y);
  };
}

/** Mobile <dialog> sheet: open/close, aria-expanded sync, Esc (native), Tab wrap, backdrop tap,
    scroll lock, focus restore; closes on a link tap and when the window widens past the menu. */
function wireMobileMenu() {
  const burger = document.querySelector<HTMLButtonElement>(".burger");
  const dialog = document.getElementById("mobileMenu") as HTMLDialogElement | null;
  if (!burger || !dialog || typeof dialog.showModal !== "function") return;
  const close = dialog.querySelector<HTMLButtonElement>(".mm-close");
  let unlock: (() => void) | null = null;

  const open = () => {
    if (dialog.open) return;
    unlock = lockScroll();
    dialog.showModal();
    close?.focus();
    burger.setAttribute("aria-expanded", "true");
  };
  const shut = () => {
    if (dialog.open) dialog.close();
  };
  const onDialogClose = () => {
    burger.setAttribute("aria-expanded", "false");
    unlock?.();
    unlock = null;
    burger.focus({ preventScroll: true });
  };
  const onClick = (e: MouseEvent) => {
    // A tap on the transparent dialog layer (outside the sheet) or on any link dismisses it.
    if (e.target === dialog || (e.target as HTMLElement).closest("a")) shut();
  };
  // Tab wrap, done by hand in both directions: WebKit skips links on Tab by default, so relying on
  // the native order at the sheet's edges lets focus escape. Listens on the document while open so
  // a Tab from anywhere (focus can start on <body>) lands inside the sheet.
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Tab" || !dialog.open) return;
    const f = Array.from(dialog.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"))
      .filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    e.preventDefault();
    const i = f.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey ? f[i <= 0 ? f.length - 1 : i - 1] : f[i === -1 || i === f.length - 1 ? 0 : i + 1];
    next.focus();
  };
  const wide = matchMedia("(min-width: 1024px)");
  const onWide = () => { if (wide.matches) shut(); };

  burger.addEventListener("click", open);
  close?.addEventListener("click", shut);
  dialog.addEventListener("close", onDialogClose);
  dialog.addEventListener("click", onClick);
  document.addEventListener("keydown", onKey, true);
  wide.addEventListener("change", onWide);
  cleanups.push(() => {
    burger.removeEventListener("click", open);
    close?.removeEventListener("click", shut);
    dialog.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKey, true);
    wide.removeEventListener("change", onWide);
    shut();
    dialog.removeEventListener("close", onDialogClose);
    unlock?.();
    unlock = null;
  });
}

/** Secondary theme buttons (menu sheet, footer) drive the one #themeBtn that theme.ts owns, and
    mirror its state (glyph + aria-label) so their icon matches. */
function wireThemeProxies() {
  const main = document.getElementById("themeBtn");
  const proxies = document.querySelectorAll<HTMLButtonElement>("[data-theme-proxy]");
  if (!main || !proxies.length) return;
  const sync = () => proxies.forEach((p) => {
    p.textContent = main.textContent;
    p.setAttribute("aria-label", main.getAttribute("aria-label") || "Theme");
  });
  const onClick = () => { main.click(); sync(); };
  proxies.forEach((p) => p.addEventListener("click", onClick));
  sync();
  cleanups.push(() => proxies.forEach((p) => p.removeEventListener("click", onClick)));
}

/** Turn the bar into its frosted capsule once the page has scrolled past an 8px sentinel. */
function wireNavScrolled() {
  const nav = document.getElementById("mnav");
  if (!nav) return;
  const sentinel = document.createElement("div");
  sentinel.style.cssText = "position:absolute;top:0;left:0;height:8px;width:1px;pointer-events:none";
  document.body.prepend(sentinel);
  const io = new IntersectionObserver(
    ([e]) => nav.classList.toggle("scrolled", !e.isIntersecting),
    { threshold: 0 }
  );
  io.observe(sentinel);
  observers.push(io);
  cleanups.push(() => sentinel.remove());
}

/** aria-current="page" on the primary/mobile nav link whose route matches the current pathname.
    The server renders this correctly per page; this re-asserts it after each ClientRouter swap. */
function wireNavActive() {
  const here = (location.pathname || "/").replace(/\/+$/, "") || "/";
  document.querySelectorAll<HTMLAnchorElement>(".mnav-links a[href], .mnav-give[href], #mobileMenu a[href]").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (!href.startsWith("/") || href.startsWith("//")) return; // route links only
    const route = href.replace(/\/+$/, "") || "/";
    if (route === here) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

/** Reveal-on-scroll — only when motion is allowed; otherwise content stays visible (CSS default). */
function wireReveal() {
  const els = document.querySelectorAll<HTMLElement>(".reveal");
  if (!els.length || !motionOK()) return;
  document.documentElement.classList.add("js-motion");
  const io = new IntersectionObserver(
    (entries, obs) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          obs.unobserve(en.target);
        }
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
  );
  els.forEach((el) => io.observe(el));
  observers.push(io);
  cleanups.push(() => document.documentElement.classList.remove("js-motion"));
}

/** Live raag clock: mark the current pahar on the arc, rotate the hand, caption it, reveal its li. */
function wireRaagClock() {
  const svg = document.querySelector(".raag-arc");
  const caption = document.querySelector<HTMLElement>("[data-raag-now]");
  const lis = document.querySelectorAll<HTMLElement>("li[data-pahar]");
  // /watch's eight-pahar timeline cells (data-p, deliberately NOT data-pahar: they are never hidden).
  const cells = document.querySelectorAll<HTMLElement>(".pcell[data-p]");
  if (!svg && !caption && !lis.length && !cells.length) return;

  const render = () => {
    const p = paharFixed(new Date());
    svg?.querySelectorAll(".seg").forEach((s) => {
      s.classList.toggle("now", Number((s as HTMLElement).dataset.pahar) === p);
    });
    const hand = document.getElementById("arcHand");
    if (hand) hand.style.transform = `rotate(${(p - 1) * 45 + 22.5}deg)`;
    if (caption) caption.textContent = `It is the ${paharLabel(p)} — ${paharRange(p)}.`;
    lis.forEach((li) => {
      li.hidden = Number(li.dataset.pahar) !== p;
    });
    cells.forEach((c) => {
      if (Number(c.dataset.p) === p) c.setAttribute("data-now", "");
      else c.removeAttribute("data-now");
    });
  };
  render();
  tick = window.setInterval(render, 60_000);
  cleanups.push(() => {
    if (tick) window.clearInterval(tick);
    tick = undefined;
  });
}

/** Legal pages (LegalPage.astro): mark the contents-rail link of the section being read with
    aria-current. No-op when the page has no `.legal` article. */
function wireTocActive() {
  const sections = Array.from(document.querySelectorAll<HTMLElement>(".legal section[id]"));
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".legal-toc a[href^='#']"));
  if (!sections.length || !links.length) return;
  const mark = (id: string) => {
    links.forEach((a) => {
      if (a.getAttribute("href") === `#${id}`) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  };
  // The current section is the LAST one whose top has passed a reading line just below the
  // sticky nav (140px; a contents link lands its section at scroll-margin 92px, so the clicked
  // section is always the one marked, even when the next section is short). At the very bottom of the page the last section wins, even if it is too short to
  // reach the line. Driven by a passive scroll/resize listener, throttled to one rAF per frame.
  const update = () => {
    const line = 140;
    let cur = sections[0];
    for (const s of sections) if (s.getBoundingClientRect().top <= line) cur = s;
    const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    if (atEnd && sections[sections.length - 1].getBoundingClientRect().top < window.innerHeight) {
      cur = sections[sections.length - 1];
    }
    mark(cur.id);
  };
  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = window.requestAnimationFrame(() => { raf = 0; update(); });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();
  cleanups.push(() => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
    if (raf) window.cancelAnimationFrame(raf);
    links.forEach((a) => a.removeAttribute("aria-current"));
  });
}

/** Hero phone drift: the floating hero device lags the scroll by at most 12px (passive listener,
    one rAF per frame, idle once the hero is out of view). Motion-safe only; uses the individual
    `translate` property so it composes with the device's own rotate() transform. The photo's slower
    drift is CSS (a scroll-driven animation in index.astro): setting a transform on the 1920px
    artwork from script after first paint forced a ~2s re-raster on throttled phones (Lighthouse).
    Torn down on astro:before-swap. */
function wireHeroDrift() {
  const device = document.querySelector<HTMLElement>(".hero-device .device");
  const hero = device?.closest<HTMLElement>(".hero") ?? null;
  if (!device || !hero || !motionOK()) return;
  const MAX = 12;
  let frame = 0;
  const update = () => {
    frame = 0;
    const h = hero.offsetHeight || 1;
    if (window.scrollY > h) return;
    const p = Math.min(Math.max(window.scrollY / h, 0), 1);
    device.style.translate = `0 ${(p * MAX).toFixed(2)}px`;
  };
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  update();
  cleanups.push(() => {
    window.removeEventListener("scroll", onScroll);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    device.style.translate = "";
  });
}

/** Proof numerals count up once, the first time they are seen (900ms, ease-out). The real figure is
    in the HTML, so no-JS and reduced motion simply show it; tabular figures keep digits steady. */
function wireCountUp() {
  const els = Array.from(document.querySelectorAll<HTMLElement>("[data-count]"));
  if (!els.length || !motionOK()) return;
  const fmt = new Intl.NumberFormat("en-US");
  const raf: number[] = [];
  const run = (el: HTMLElement) => {
    const to = Number(el.dataset.count);
    if (!Number.isFinite(to) || to <= 0) return;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min((t - t0) / 900, 1);
      el.textContent = fmt.format(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf.push(requestAnimationFrame(step));
    };
    el.textContent = "0";
    raf.push(requestAnimationFrame(step));
  };
  const io = new IntersectionObserver((entries, obs) => {
    for (const en of entries) if (en.isIntersecting) { obs.unobserve(en.target); run(en.target as HTMLElement); }
  }, { threshold: 0.6 });
  els.forEach((el) => io.observe(el));
  observers.push(io);
  cleanups.push(() => {
    raf.forEach(cancelAnimationFrame);
    els.forEach((el) => { el.textContent = fmt.format(Number(el.dataset.count)); });
  });
}

function teardown() {
  observers.forEach((o) => o.disconnect());
  observers = [];
  cleanups.forEach((fn) => fn());
  cleanups = [];
}

function init() {
  teardown(); // idempotent — a re-run (page-load after a swap) starts from a clean slate
  initTheme();
  wireMobileMenu();
  wireThemeProxies();
  wireNavScrolled();
  wireNavActive();
  wireReveal();
  wireRaagClock();
  wireTocActive();
  wireHeroDrift();
  wireCountUp();
  const nl = wireNewsletter(); // no-op when the env-gated form is absent (this build)
  if (nl) cleanups.push(nl);
}

// Forward legacy /?q= bookmarks to /search after a client-side swap lands on `/`.
function forwardLegacyQuery() {
  try {
    const p = new URLSearchParams(location.search);
    if (p.has("q") && location.pathname === "/") location.replace("/search" + location.search);
  } catch {}
}
// Re-assert the resolved theme after a swap (the fresh document starts from the pre-paint value).
function reapplyTheme() {
  try {
    const t = (localStorage.getItem("theme") as Theme) || MARKETING_DEFAULT;
    applyTheme(t);
  } catch {
    applyTheme(MARKETING_DEFAULT);
  }
}

document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", teardown);
document.addEventListener("astro:after-swap", () => {
  reapplyTheme();
  forwardLegacyQuery();
});
