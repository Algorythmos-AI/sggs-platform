// render.ts — the share-card renderer behind every Open Graph / Twitter image (src/pages/og/v2).
//
// Cards are SVG built here and rasterised by resvg. Text is shaped by HarfBuzz (harfbuzzjs, wasm)
// and emitted as glyph outlines, so Sant Lipi Gurmukhi gets real Indic shaping (pre-base ਿ, tippi,
// subjoined letters, Sant Lipi's variation-selector forms): satori, which the cards used before,
// has none. Fonts are the variable masters in src/og/fonts (the same files the iOS app ships).
// Output is byte-deterministic: no clocks, no randomness, fixed font files.
//
// Brand (docs/brand/gurbani-soul-brand-book.md): paper surface, ink text, Gurmukhi in ink, brand
// gold only as a fill (the app-icon field and the short rule, which carries a 1px accent edge on
// paper), never gold text and never red. The app mark is public/favicon.svg — the app icon's own
// outlines (scripts/app-icon). The bottom-left of every card stays free of anything essential,
// because X lays the page title over that corner.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import theme from "../theme";

// Read from the source tree relative to the build's working directory (frontend/): endpoints are
// bundled into dist/.prerender/, so import.meta.url would not point at src/og.
const root = (p: string) => resolve(process.cwd(), p);
const require = createRequire(import.meta.url);

type HB = any; // harfbuzzjs ships no types
let hbPromise: Promise<HB> | null = null;
const harfbuzz = (): Promise<HB> => (hbPromise ??= require("harfbuzzjs"));

export const W = 1200, H = 630;
export const C = {
  paper: theme.light.paper,          // #FBF7F0
  ink: theme.light.ink,              // warm ink
  muted: "#62584D",                  // tokens.json ink.muted[0] (AA on paper)
  fill: theme.light.accentFill,      // #FFBC0D — fills only
  edge: theme.light.accent,          // #A87900 — the 1px edge every light-mode gold fill carries
  deep: "#FFB81C",                   // tokens.json soul.accentDeep[0] — share-card rule gradient end
};

interface Face { face: any; upem: number }
let faces: { gm: Face; serif: Face } | null = null;
async function loadFaces() {
  if (faces) return faces;
  const hb = await harfbuzz();
  const load = (file: string): Face => {
    const face = hb.createFace(hb.createBlob(readFileSync(root(`src/og/fonts/${file}`))), 0);
    return { face, upem: face.upem };
  };
  faces = { gm: load("SantLipi-VF.ttf"), serif: load("SourceSerif4-VF.ttf") };
  return faces;
}

export interface Shaped { svg: string; width: number; missing: number }

// Shape one run of text into outline paths at the origin baseline. `missing` counts .notdef
// glyphs (gid 0): a card with a missing glyph must fail the build, never ship a tofu box.
export async function shape(script: "gm" | "serif", text: string, size: number, wght: number): Promise<Shaped> {
  const hb = await harfbuzz();
  const f = (await loadFaces())[script];
  const font = hb.createFont(f.face);
  font.setVariations(script === "serif" ? { wght, opsz: Math.min(60, Math.max(8, size)) } : { wght });
  const buf = hb.createBuffer();
  buf.addText(text);
  buf.guessSegmentProperties();
  hb.shape(font, buf);
  const glyphs: { g: number; ax: number; dx: number; dy: number }[] = buf.json();
  const k = size / f.upem;
  let x = 0, missing = 0;
  const parts: string[] = [];
  for (const g of glyphs) {
    if (g.g === 0) missing++;
    const d = font.glyphToPath(g.g);
    if (d) parts.push(`<path transform="translate(${r((x + g.dx) * k)} ${r(-g.dy * k)}) scale(${k.toFixed(5)} ${(-k).toFixed(5)})" d="${d}"/>`);
    x += g.ax;
  }
  buf.destroy();
  font.destroy();
  return { svg: parts.join(""), width: x * k, missing };
}
const r = (n: number) => n.toFixed(2);

// Wrap at spaces only: a line is never cut inside a word, and never shortened. Lines are balanced
// (the narrowest measure that keeps the greedy line count), so no title ends on a lone word.
export async function wrap(script: "gm" | "serif", text: string, size: number, wght: number, maxW: number) {
  const words = text.split(" ");
  const widths = new Map<string, number>();
  const width = async (t: string) => widths.get(t) ?? widths.set(t, (await shape(script, t, size, wght)).width).get(t)!;
  const greedy = async (limit: number) => {
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (cur && (await width(t)) > limit) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  };
  let best = await greedy(maxW);
  if (best.length < 2) return best;
  let lo = maxW / best.length, hi = maxW;
  while (hi - lo > 4) {
    const mid = (lo + hi) / 2;
    const l = await greedy(mid);
    if (l.length === best.length) { best = l; hi = mid; } else lo = mid;
  }
  return best;
}

class Card {
  parts: string[] = [];
  missing = 0;
  async text(script: "gm" | "serif", s: string, size: number, wght: number, x: number, y: number, fill: string, anchor: "start" | "end" = "start") {
    const t = await shape(script, s, size, wght);
    this.missing += t.missing;
    const dx = anchor === "end" ? x - t.width : x;
    this.parts.push(`<g fill="${fill}" transform="translate(${r(dx)} ${y})">${t.svg}</g>`);
    return t.width;
  }
  rule(x: number, y: number, w = 96) {
    this.parts.push(`<rect x="${x}" y="${y}" width="${w}" height="6" rx="3" fill="url(#rule)" stroke="${C.edge}" stroke-width="1"/>`);
  }
}

const ICON = readFileSync(root("public/favicon.svg")).toString("base64");
const DEFS = `<defs>
<linearGradient id="rule" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.fill}"/><stop offset="1" stop-color="${C.deep}"/></linearGradient>
<radialGradient id="glow" cx="0.92" cy="0.05" r="0.75"><stop offset="0" stop-color="${C.fill}" stop-opacity="0.13"/><stop offset="1" stop-color="${C.fill}" stop-opacity="0"/></radialGradient>
</defs>`;

const PADX = 80;

// Shared chrome: app mark + "Gurbani Soul" (ink) top-left, the host top-right (muted).
async function chrome(c: Card, host: string, w = W) {
  c.parts.push(`<image href="data:image/svg+xml;base64,${ICON}" x="${PADX}" y="64" width="64" height="64"/>`);
  await c.text("serif", "Gurbani Soul", 30, 600, PADX + 84, 108, C.ink);
  await c.text("serif", host, 22, 500, w - PADX, 106, C.muted, "end");
}

function finish(c: Card, w: number, h: number, glow: boolean): Uint8Array {
  if (c.missing) throw new Error(`share card: ${c.missing} glyph(s) missing from the font`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${DEFS}`
    + `<rect width="${w}" height="${h}" fill="${C.paper}"/>${glow ? `<rect width="${w}" height="${h}" fill="url(#glow)"/>` : ""}`
    + c.parts.join("") + `</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: "width", value: w }, background: C.paper, font: { loadSystemFonts: false } }).render().asPng();
  return Uint8Array.from(png);
}

export interface PageCard { eyebrow?: string; title: string; sub?: string; host?: string }

// Page card: eyebrow (small caps, muted), a Source Serif 4 title, the gold rule, one supporting line.
export async function pageCard({ eyebrow, title, sub, host = "gurbanisoul.com" }: PageCard): Promise<Uint8Array> {
  const c = new Card();
  await chrome(c, host);
  const size = title.length > 60 ? 54 : 64;
  const lines = await wrap("serif", title, size, 600, 940);
  if (lines.length > 3) throw new Error(`share card title too long for three lines: ${title}`);
  const lh = size * 1.16;
  const y0 = 316 - (lines.length - 1) * lh * 0.5;
  if (eyebrow) await c.text("serif", eyebrow.toUpperCase(), 20, 600, PADX, Math.round(y0 - size - 14), C.muted);
  for (const [i, l] of lines.entries()) await c.text("serif", l, size, 600, PADX, Math.round(y0 + i * lh), C.ink);
  const last = y0 + (lines.length - 1) * lh;
  c.rule(PADX, Math.round(last + 40));
  if (sub) await c.text("serif", sub, 28, 400, PADX, Math.round(last + 100), C.muted);
  return finish(c, W, H, true);
}

export interface VerseCard { gurmukhi: string; ang: number; author?: string | null; raag?: string | null; host?: string }

// Verse card: the verbatim line in ink, the rule, "Sri Guru Granth Sahib Ji · Ang N", the voice, and
// the raag (Gurmukhi, as stored) at the right. The line is passed through exactly as given.
export async function verseCard({ gurmukhi, ang, author, raag, host = "gurbanisoul.com" }: VerseCard): Promise<Uint8Array> {
  const c = new Card();
  await chrome(c, host);
  const size = gurmukhi.length > 44 ? 60 : 72;
  const lines = await wrap("gm", gurmukhi, size, 400, W - PADX * 2);
  if (lines.length > 3) throw new Error(`verse too long for a card (Ang ${ang})`);
  const lh = size * 1.45;
  const y0 = 330 - (lines.length * lh) / 2 + size * 0.75;
  for (const [i, l] of lines.entries()) await c.text("gm", l, size, 400, PADX, Math.round(y0 + i * lh), C.ink);
  const after = y0 + (lines.length - 1) * lh;
  c.rule(PADX, Math.round(after + 56));
  await c.text("serif", `Sri Guru Granth Sahib Ji · Ang ${ang}`, 30, 600, PADX, Math.round(after + 112), C.ink);
  if (raag) await c.text("gm", raag, 30, 400, W - PADX, Math.round(after + 112), C.muted, "end");
  if (author) await c.text("serif", author, 22, 400, PADX, Math.round(after + 150), C.muted);
  return finish(c, W, H, true);
}
