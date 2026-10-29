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
//
// This file is shared: docs-site copies it at prebuild (docs-site/scripts/copy-assets.mjs) and
// draws the wiki's cards with it, so it imports nothing from the frontend; paths resolve against
// the building package (src/og/fonts, public/favicon.svg).
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";

// Read from the source tree relative to the build's working directory (frontend/): endpoints are
// bundled into dist/.prerender/, so import.meta.url would not point at src/og.
const root = (p: string) => resolve(process.cwd(), p);
const require = createRequire(import.meta.url);

type HB = any; // harfbuzzjs ships no types
let hbPromise: Promise<HB> | null = null;
const harfbuzz = (): Promise<HB> => (hbPromise ??= require("harfbuzzjs"));

export const W = 1200, H = 630;
// Light legs of docs/brand/tokens.json (and src/theme.ts, which the WebThemeMatchesTokens gate pins).
export const C = {
  paper: "#FBF7F0",                  // surfaces.paper[0]
  ink: "#201A12",                    // warm ink (theme.ts light.ink)
  muted: "#62584D",                  // ink.muted[0] (AA on paper)
  fill: "#FFBC0D",                   // soul.accentFill[0] — fills only
  edge: "#A87900",                   // soul.accent[0] — the 1px edge every light-mode gold fill carries
  deep: "#FFB81C",                   // soul.accentDeep[0] — share-card rule gradient end
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

const GURMUKHI = /([\u0A00-\u0A7F]+(?:\s+[\u0A00-\u0A7F]+)*)/;
// Shape text in its own script: Gurmukhi runs inside English text (a title naming a bani, say)
// are set in Sant Lipi, the rest in Source Serif 4; "gm" text is Sant Lipi throughout.
export async function shapeText(script: "gm" | "serif", text: string, size: number, wght: number): Promise<Shaped> {
  if (script === "gm" || !GURMUKHI.test(text)) return shape(script, text, size, wght);
  let x = 0, missing = 0;
  const parts: string[] = [];
  for (const [i, run] of text.split(GURMUKHI).entries()) {
    if (!run) continue;
    const t = await shape(i % 2 ? "gm" : "serif", run, size, i % 2 ? 400 : wght);
    parts.push(`<g transform="translate(${r(x)} 0)">${t.svg}</g>`);
    x += t.width; missing += t.missing;
  }
  return { svg: parts.join(""), width: x, missing };
}

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
  const width = async (t: string) => widths.get(t) ?? widths.set(t, (await shapeText(script, t, size, wght)).width).get(t)!;
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
    const t = await shapeText(script, s, size, wght);
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

function finish(c: Card, w: number, h: number, glow: boolean): Uint8Array<ArrayBuffer> {
  if (c.missing) throw new Error(`share card: ${c.missing} glyph(s) missing from the font`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${DEFS}`
    + `<rect width="${w}" height="${h}" fill="${C.paper}"/>${glow ? `<rect width="${w}" height="${h}" fill="url(#glow)"/>` : ""}`
    + c.parts.join("") + `</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: "width", value: w }, background: C.paper, font: { loadSystemFonts: false } }).render().asPng();
  return Uint8Array.from(png);
}

export interface PageCard { eyebrow?: string; title: string; sub?: string; host?: string }

// Page card: eyebrow (small caps, muted), a Source Serif 4 title, the gold rule, one supporting line.
export async function pageCard({ eyebrow, title, sub, host = "gurbanisoul.com" }: PageCard): Promise<Uint8Array<ArrayBuffer>> {
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

export interface AngCard { ang: number; raag?: string | null; gurmukhi: string; host?: string }

// Ang card (/ang/N): "ANG", the numeral, the raag (Gurmukhi, as stored) and the citation on the
// left; the Ang's opening line, verbatim, on the right. No glow: 1430 of these ship per deploy.
export async function angCard({ ang, raag, gurmukhi, host = "gurbanisoul.com" }: AngCard): Promise<Uint8Array<ArrayBuffer>> {
  const c = new Card();
  await chrome(c, host);
  await c.text("serif", "ANG", 22, 600, PADX, 236, C.muted);
  await c.text("serif", String(ang), 168, 600, PADX - 6, 392, C.ink);
  if (raag) await c.text("gm", raag, 44, 400, PADX, 460, C.ink);
  const ruleY = raag ? 492 : 430;
  c.rule(PADX, ruleY);
  await c.text("serif", `Sri Guru Granth Sahib Ji · Ang ${ang}`, 26, 600, PADX, ruleY + 56, C.ink);
  // the opening line: as large as fits in three lines of the right column, never cut
  const colX = 560, colW = W - PADX - colX;
  let size = 48, lines = await wrap("gm", gurmukhi, size, 400, colW);
  while (lines.length > 3 && size > 32) lines = await wrap("gm", gurmukhi, (size -= 4), 400, colW);
  if (lines.length > 4) throw new Error(`Ang ${ang}: opening line too long for the card`);
  const lh = size * 1.45, top = 330 - (lines.length * lh) / 2 + size * 0.75;
  for (const [i, l] of lines.entries()) await c.text("gm", l, size, 400, colX, Math.round(top + i * lh), C.ink);
  return finish(c, W, H, false);
}
