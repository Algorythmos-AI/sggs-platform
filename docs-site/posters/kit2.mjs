// Poster kit, version 2: one declarative spec -> one SVG poster + its steps sidecar, drawn so it
// reads at the size the wiki shows it. A spec opts in with `kit: 2`; kit.mjs hands it here.
//
// Why a second kit. Version 1 drew on a 1600-px canvas that the page shows 630–720 px wide, so
// 16-px text arrived at 6–7 px; its lines ran straight between box centres, so nothing stopped a line
// crossing a box's text; and its light-on-dark text was hard-coded white, which fails contrast in
// the dark theme. Version 2 fixes each at the source and refuses to build a poster that breaks
// them (lint(), below):
//   - a 1200-px canvas whose smallest text is ceil(13 * W / SHOWN) = 25 px: 13 px as shown on a
//     1280-px laptop screen (the page gives a poster ~630 px there; ~720 px on wider screens);
//   - right-angled connectors, routed from box side to box side, that may not cross a box, a group
//     title, a label or each other's track, and end in a fixed-size arrowhead on the target's edge;
//   - every colour a role with a light and a dark value from docs/brand/tokens.json, and every
//     text-on-fill pair at least 4.5:1 in both themes;
//   - the header and footer in their own bands, the legend built from what the poster uses.
//
// Spec (see posters/03-anatomy-of-a-line-record.mjs): { kit: 2, number, slug, title, subtitle,
// description, height (bottom of the content area), verified, sources, groups, nodes, edges, steps,
// legendText?, badges? }. Coordinates are canvas pixels; content lives between y = TOP and `height`.
import { BRAND, BRAND_DARK, contrast } from '../plugins/brand.mjs';

export const W = 1200;
// px: the poster's width in the content column of a 1280-px-wide screen (Starlight's 45rem column
// narrows when the sidebar and the table of contents both show) — measured by e2e/posters.spec.ts
export const SHOWN = 630;
export const MIN_TEXT = Math.ceil(13 * W / SHOWN);     // 25: the smallest canvas size that shows at ≥ 13 px
export const TOP = 176;                                // content starts below the header band
export const MARGIN = 40;
const HEADER_RULE = 156;
const ARROW = 14;                                      // arrowhead length (fixed, whatever the stroke)
const MIN_LAST = 32;                                   // a connector's last straight run, arrowhead included
const LH = 1.3;

const FONT_SERIF = '"Source Serif 4", Georgia, "Times New Roman", serif';
const FONT_SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const FONT_MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ----------------------------------------------------------------------------- colour roles
// Each role is a CSS custom property (the site sets the dark values: src/styles/widgets.css, tested
// against these) with the light value as the SVG's own fallback, so the file is right on GitHub too.
export const ROLES = {
  paper: ['--poster-paper', BRAND.paper, BRAND_DARK.paper],
  surface: ['--poster-paper-warm', BRAND.paperWarm, BRAND_DARK.card],
  canvas: ['--poster-canvas', BRAND.canvas, BRAND_DARK.canvas],
  ink: ['--poster-ink', BRAND.ink, BRAND_DARK.ink],
  onStrong: ['--poster-on-strong', '#FFFFFF', BRAND.ink],      // text on a saturated fill: white by day, ink by night
  accent: ['--poster-accent', BRAND.accent, BRAND_DARK.accent],
  accentText: ['--poster-accent-text', BRAND.accentText, BRAND_DARK.accentText],
  accentFill: ['--poster-accent-fill', BRAND.accentFill, BRAND_DARK.accentFill],
  kraft: ['--poster-kraft', BRAND.kraft, BRAND_DARK.kraft],
  storeInk: [null, BRAND.ink, BRAND.ink],                        // kraft is the same in both themes, so is its ink
  maroon: ['--poster-maroon', BRAND.maroon, BRAND_DARK.maroon],
  negative: ['--poster-negative', BRAND.negative, BRAND_DARK.negative],
  positive: ['--poster-positive', BRAND.positive, BRAND_DARK.positive],
  info: ['--poster-info', BRAND.info, BRAND_DARK.info],
  special: ['--poster-special', BRAND.special, BRAND_DARK.special],
};
export const color = (role) => { const [v, light] = ROLES[role]; return v ? `var(${v}, ${light})` : light; };
const hexOf = (role, dark) => ROLES[role][dark ? 2 : 1];

// Node kinds: fill, border and text roles, and what the legend calls them.
export const KINDS = {
  box:   { fill: 'surface', stroke: 'accent', text: 'ink', rx: 12, legend: 'component in this project' },
  store: { fill: 'kraft', stroke: 'accentText', text: 'storeInk', rx: 14, legend: 'data at rest' },
  actor: { fill: 'maroon', stroke: 'maroon', text: 'onStrong', rx: 40, legend: 'a person' },
  gate:  { fill: 'negative', stroke: 'negative', text: 'onStrong', rx: 10, legend: 'gate: fails the build or the deploy' },
  fail:  { fill: 'paper', stroke: 'negative', text: 'negative', rx: 10, legend: 'an outcome that stops here' },
  good:  { fill: 'positive', stroke: 'positive', text: 'onStrong', rx: 12, legend: 'proven, verified state' },
  pin:   { fill: 'canvas', stroke: 'special', text: 'ink', rx: 10, dash: '10 6', legend: 'pin: a reviewed lock file' },
  ext:   { fill: 'canvas', stroke: 'info', text: 'ink', rx: 12, legend: 'external system' },
  note:  { fill: 'paper', stroke: 'kraft', text: 'ink', rx: 8, legend: 'explanation' },
};
const LINES = { solid: 'flow: data or control moves this way', dashed: 'reference: pins, reads or derives from' };

// ----------------------------------------------------------------------------- geometry helpers
/** Rough width of a text run (sans ≈ 0.56 em per character, mono ≈ 0.62 em) — deliberately generous. */
export function textWidth(text, size, mono = false) { return String(text).length * size * (mono ? 0.62 : 0.56); }
const rect = (x, y, w, h) => ({ x, y, w, h });
const inflate = (r, d) => rect(r.x - d, r.y - d, r.w + 2 * d, r.h + 2 * d);
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const contains = (outer, r) => r.x >= outer.x && r.y >= outer.y && r.x + r.w <= outer.x + outer.w && r.y + r.h <= outer.y + outer.h;
/** Does the axis-aligned segment p–q pass through the rectangle's interior? */
function segHitsRect(p, q, r) {
  const [x1, x2] = [Math.min(p[0], q[0]), Math.max(p[0], q[0])], [y1, y2] = [Math.min(p[1], q[1]), Math.max(p[1], q[1])];
  return x1 < r.x + r.w && x2 > r.x && y1 < r.y + r.h && y2 > r.y;
}
const segLen = (p, q) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]);
const within = (v, lo, hi) => v >= lo && v <= hi;

/** The lines of a node, normalised: [{ text, size, mono, weight }]; the first line is its title. */
function nodeLines(n) {
  const raw = (n.lines ?? [n.label]).filter((l) => (typeof l === 'object' ? l.text : l) !== '' && l != null);
  return raw.map((l, i) => {
    const m = typeof l === 'object' ? l : { text: l };
    return { text: m.text, size: m.size ?? (i === 0 ? MIN_TEXT + 2 : MIN_TEXT), mono: m.mono ?? false, weight: m.weight ?? (i === 0 ? 600 : 400) };
  });
}
const blockHeight = (lines) => lines.reduce((h, l) => h + l.size * LH, 0);

// ----------------------------------------------------------------------------- routing
/**
 * An edge's polyline: right angles only, from a side of `a` to a side of `b`.
 * Without `via`: straight when the boxes share a column (or row) of at least 24 px, else a Z through
 * the gutter between them. With `via`: the first and last waypoints are projected onto the boxes.
 */
export function route(e, a, b) {
  const via = e.via ?? [];
  const exitFrom = (box, toward) => {
    const [tx, ty] = toward;
    if (within(tx, box.x + 12, box.x + box.w - 12)) return [tx, ty < box.y ? box.y : box.y + box.h];
    if (within(ty, box.y + 12, box.y + box.h - 12)) return [tx < box.x ? box.x : box.x + box.w, ty];
    return null;
  };
  if (via.length) {
    const s = exitFrom(a, via[0]), t = exitFrom(b, via[via.length - 1]);
    if (!s || !t) return { pts: null, why: `a waypoint is not level with ${!s ? e.from : e.to}` };
    return { pts: [s, ...via, t] };
  }
  const ox = [Math.max(a.x, b.x), Math.min(a.x + a.w, b.x + b.w)];
  const oy = [Math.max(a.y, b.y), Math.min(a.y + a.h, b.y + b.h)];
  if (ox[1] - ox[0] >= 24) {
    const x = e.x ?? Math.round((ox[0] + ox[1]) / 2);
    return b.y >= a.y + a.h ? { pts: [[x, a.y + a.h], [x, b.y]] } : { pts: [[x, a.y], [x, b.y + b.h]] };
  }
  if (oy[1] - oy[0] >= 24) {
    const y = e.y ?? Math.round((oy[0] + oy[1]) / 2);
    return b.x >= a.x + a.w ? { pts: [[a.x + a.w, y], [b.x, y]] } : { pts: [[a.x, y], [b.x + b.w, y]] };
  }
  const [acx, bcx] = [a.x + a.w / 2, b.x + b.w / 2];
  if (b.y >= a.y + a.h) {             // b below a: down, across in the gutter, down
    const gy = e.y ?? Math.round((a.y + a.h + b.y) / 2);
    return { pts: [[acx, a.y + a.h], [acx, gy], [bcx, gy], [bcx, b.y]] };
  }
  if (a.y >= b.y + b.h) {             // b above a
    const gy = e.y ?? Math.round((b.y + b.h + a.y) / 2);
    return { pts: [[acx, a.y], [acx, gy], [bcx, gy], [bcx, b.y + b.h]] };
  }
  const [acy, bcy] = [a.y + a.h / 2, b.y + b.h / 2];
  const gx = e.x ?? Math.round(b.x >= a.x + a.w ? (a.x + a.w + b.x) / 2 : (b.x + b.w + a.x) / 2);
  return b.x >= a.x + a.w
    ? { pts: [[a.x + a.w, acy], [gx, acy], [gx, bcy], [b.x, bcy]] }
    : { pts: [[a.x, acy], [gx, acy], [gx, bcy], [b.x + b.w, bcy]] };
}

/** Where a label chip sits: the middle of the longest segment (or segment `labelAt`). */
function labelBox(e, pts) {
  const lines = Array.isArray(e.label) ? e.label : [e.label];
  let i = e.labelAt ?? 0;
  if (e.labelAt == null) for (let k = 1; k < pts.length - 1; k++) if (segLen(pts[k], pts[k + 1]) > segLen(pts[i], pts[i + 1])) i = k;
  const [p, q] = [pts[i], pts[i + 1]];
  const size = MIN_TEXT;
  const w = Math.max(...lines.map((l) => textWidth(l, size))) + 20, h = lines.length * size * LH + 8;
  const cx = (p[0] + q[0]) / 2 + (e.dx ?? 0), cy = (p[1] + q[1]) / 2 + (e.dy ?? 0);
  return { lines, size, r: rect(cx - w / 2, cy - h / 2, w, h), cx, cy };
}

// ----------------------------------------------------------------------------- lint
/** Every rule a v2 poster must meet; returns problems (the build fails on any). */
export function lint(spec) {
  const P = [];
  const nodes = spec.nodes ?? [], edges = spec.edges ?? [], groups = spec.groups ?? [];
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const content = rect(MARGIN, TOP - 10, W - 2 * MARGIN, spec.height - (TOP - 10));
  const groupBands = groups.map((g) => ({ g, band: rect(g.x, g.y, textWidth(g.label, MIN_TEXT + 2) + 40, 48) }));

  for (const g of groups) if (!contains(content, g)) P.push(`group "${g.label}" leaves the content area (x ${MARGIN}–${W - MARGIN}, y ${TOP - 10}–${spec.height})`);

  for (const n of nodes) {
    const k = KINDS[n.kind ?? 'box'];
    if (!k) { P.push(`${n.id}: unknown kind "${n.kind}"`); continue; }
    if (!contains(content, n)) P.push(`${n.id}: leaves the content area`);
    const lines = nodeLines(n);
    for (const l of lines) {
      if (l.size < MIN_TEXT) P.push(`${n.id}: "${l.text}" is ${l.size}px — under ${MIN_TEXT}px, it shows below 13px on the page`);
      const over = textWidth(l.text, l.size, l.mono) - (n.w - 28);
      if (over > 0) P.push(`${n.id}: "${l.text}" is ~${Math.round(over)}px too wide for its ${n.w}px box — shorten it (detail belongs in the caption) or widen the box`);
    }
    if (lines.length && blockHeight(lines) + 20 > n.h) P.push(`${n.id}: ${lines.length} lines need ${Math.ceil(blockHeight(lines) + 20)}px; the box is ${n.h}px tall`);
    if (lines.length > 3) P.push(`${n.id}: ${lines.length} lines — at most 3 (a title and two); put the rest in the step caption`);
    for (const { g, band } of groupBands) {
      if (overlaps(n, g) && !contains(g, n)) P.push(`${n.id}: straddles the border of group "${g.label}"`);
      if (overlaps(n, band)) P.push(`${n.id}: covers the title of group "${g.label}"`);
    }
    if (n.href) P.push(`${n.id}: nodes cannot carry links (the poster is role="img"); put the link in the step's caption`);
    // contrast of the node's text on its fill, in both themes
    for (const dark of [false, true]) {
      const c = contrast(hexOf(k.text, dark), hexOf(k.fill, dark));
      if (c < 4.5) P.push(`${n.id}: ${n.kind ?? 'box'} text is ${c.toFixed(2)}:1 on its fill in the ${dark ? 'dark' : 'light'} theme (needs 4.5)`);
    }
  }
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    if (overlaps(nodes[i], nodes[j])) P.push(`${nodes[i].id} and ${nodes[j].id} overlap`);
  }

  // connectors
  const routed = [];
  for (const e of edges) {
    const a = byId[e.from], b = byId[e.to];
    if (!a || !b) { P.push(`edge ${e.from}→${e.to}: unknown node`); continue; }
    const { pts, why } = route(e, a, b);
    if (!pts) { P.push(`edge ${e.from}→${e.to}: ${why}`); continue; }
    routed.push({ e, pts });
    const name = `edge ${e.from}→${e.to}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const [p, q] = [pts[i], pts[i + 1]];
      if (p[0] !== q[0] && p[1] !== q[1] && !e.diagonal) P.push(`${name}: segment ${i + 1} is diagonal — connectors run at right angles`);
      for (const n of nodes) {
        const own = n.id === e.from || n.id === e.to;
        // a connector may touch its own boxes only at its two ends
        const hit = own ? segHitsRect(p, q, inflate(n, -1)) : segHitsRect(p, q, inflate(n, 6));
        if (hit) P.push(`${name}: segment ${i + 1} ${own ? `runs inside its own box ${n.id}` : `crosses ${n.id}`}`);
      }
      for (const { g, band } of groupBands) if (segHitsRect(p, q, band)) P.push(`${name}: crosses the title of group "${g.label}"`);
      for (const g of groups) {   // running along a group's border hides the line in the dashes
        const alongH = p[1] === q[1] && (Math.abs(p[1] - g.y) < 8 || Math.abs(p[1] - (g.y + g.h)) < 8) && Math.max(p[0], q[0]) > g.x && Math.min(p[0], q[0]) < g.x + g.w;
        const alongV = p[0] === q[0] && (Math.abs(p[0] - g.x) < 8 || Math.abs(p[0] - (g.x + g.w)) < 8) && Math.max(p[1], q[1]) > g.y && Math.min(p[1], q[1]) < g.y + g.h;
        if ((alongH || alongV) && segLen(p, q) > 12) P.push(`${name}: runs along the border of group "${g.label}"`);
      }
    }
    if (e.arrow !== false && segLen(pts[pts.length - 2], pts[pts.length - 1]) < MIN_LAST) {
      P.push(`${name}: its last straight run is ${segLen(pts[pts.length - 2], pts[pts.length - 1])}px — at least ${MIN_LAST}px so the arrowhead reads (move the boxes apart or add a waypoint)`);
    }
  }
  // tips, shared tracks, labels
  const tips = routed.filter(({ e }) => e.arrow !== false).map(({ e, pts }) => ({ e, p: pts[pts.length - 1] }));
  for (let i = 0; i < tips.length; i++) for (let j = i + 1; j < tips.length; j++) {
    if (Math.abs(tips[i].p[0] - tips[j].p[0]) + Math.abs(tips[i].p[1] - tips[j].p[1]) < 12) {
      P.push(`edges ${tips[i].e.from}→${tips[i].e.to} and ${tips[j].e.from}→${tips[j].e.to} end on the same point — give each its own entry (x/y or a waypoint)`);
    }
  }
  const segs = routed.flatMap(({ e, pts }) => pts.slice(1).map((q, i) => ({ e, p: pts[i], q })));
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const s = segs[i], t = segs[j];
    if (s.e === t.e || (s.e.share && t.e.share)) continue;
    const hs = s.p[1] === s.q[1], ht = t.p[1] === t.q[1];
    if (hs !== ht) continue;
    const off = hs ? Math.abs(s.p[1] - t.p[1]) : Math.abs(s.p[0] - t.p[0]);
    const [a0, a1] = hs ? [Math.min(s.p[0], s.q[0]), Math.max(s.p[0], s.q[0])] : [Math.min(s.p[1], s.q[1]), Math.max(s.p[1], s.q[1])];
    const [b0, b1] = hs ? [Math.min(t.p[0], t.q[0]), Math.max(t.p[0], t.q[0])] : [Math.min(t.p[1], t.q[1]), Math.max(t.p[1], t.q[1])];
    if (off < 10 && Math.min(a1, b1) - Math.max(a0, b0) > 16) {
      P.push(`edges ${s.e.from}→${s.e.to} and ${t.e.from}→${t.e.to} share a track — separate them by at least 10px (or mark both share: true for one drawn line)`);
    }
  }
  const labels = routed.filter(({ e }) => e.label).map(({ e, pts }) => ({ e, ...labelBox(e, pts) }));
  for (const l of labels) {
    for (const n of nodes) if (overlaps(l.r, n)) P.push(`edge ${l.e.from}→${l.e.to}: its label "${l.lines.join(' ')}" covers ${n.id}`);
    for (const { g, band } of groupBands) if (overlaps(l.r, band)) P.push(`edge ${l.e.from}→${l.e.to}: its label covers the title of group "${g.label}"`);
  }
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
    if (overlaps(labels[i].r, labels[j].r)) P.push(`the labels of ${labels[i].e.from}→${labels[i].e.to} and ${labels[j].e.from}→${labels[j].e.to} overlap`);
  }
  for (const l of labels) for (const { e, p, q } of segs) {
    if (e !== l.e && segHitsRect(p, q, l.r)) P.push(`edge ${e.from}→${e.to} crosses the label of ${l.e.from}→${l.e.to}`);
  }
  // header fit
  if (wrap(spec.subtitle, MIN_TEXT, W - 2 * MARGIN).length > 2) P.push('the subtitle runs past two lines — shorten it');
  if (textWidth(`${spec.number} · ${spec.title}`, 44) > W - 2 * MARGIN) P.push('the title is too long for one line');
  return P;
}

// ----------------------------------------------------------------------------- drawing
function wrap(text, size, width, mono = false) {
  const out = []; let cur = '';
  for (const word of String(text).split(/\s+/)) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && textWidth(next, size, mono) > width) { out.push(cur); cur = word; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

function textRun(x, y, t, { size, weight = 400, fill, mono = false, family, anchor = 'middle' }) {
  return `<text x="${x}" y="${y.toFixed(1)}" text-anchor="${anchor}" font-family='${mono ? FONT_MONO : family ?? FONT_SANS}' font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(t)}</text>`;
}

function drawNode(n) {
  const k = KINDS[n.kind ?? 'box'];
  const lines = nodeLines(n);
  const cx = n.x + n.w / 2;
  const dash = k.dash ? ` stroke-dasharray="${k.dash}"` : '';
  let shape;
  if (n.kind === 'store') {
    // a cylinder: the body (straight sides, a curved bottom), then the full top ellipse
    const ry = 12, rx = n.w / 2;
    shape = `<path class="pk-shape" d="M${n.x} ${n.y + ry} V${n.y + n.h - ry} A${rx} ${ry} 0 0 0 ${n.x + n.w} ${n.y + n.h - ry} V${n.y + ry}" fill="${color(k.fill)}" stroke="${color(k.stroke)}" stroke-width="2"/>` +
      `<ellipse class="pk-shape" cx="${cx}" cy="${n.y + ry}" rx="${rx}" ry="${ry}" fill="${color(k.fill)}" stroke="${color(k.stroke)}" stroke-width="2"/>`;
  } else if (n.kind === 'note') {
    shape = `<rect class="pk-shape" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${k.rx}" fill="${color(k.fill)}" stroke="${color(k.stroke)}" stroke-width="1.5"/>` +
      `<rect x="${n.x}" y="${n.y}" width="6" height="${n.h}" rx="3" fill="${color('accent')}"/>`;
  } else {
    shape = `<rect class="pk-shape" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${k.rx}" fill="${color(k.fill)}" stroke="${color(k.stroke)}" stroke-width="2"${dash}/>`;
  }
  const top = n.y + (n.kind === 'store' ? 20 : 0);   // below a cylinder's top ellipse
  let y = top + (n.y + n.h - top) / 2 - blockHeight(lines) / 2;
  const body = lines.map((l) => { y += l.size * LH; return textRun(cx, y - l.size * 0.32, l.text, { size: l.size, weight: l.weight, fill: color(k.text), mono: l.mono }); }).join('');
  // the tooltip belongs to this node's group (a <title> is the name of its parent)
  const title = `<title>${esc(n.title ?? lines.map((l) => l.text).join(' — '))}</title>`;
  return `<g class="pk-node" data-node="${esc(n.id)}">${title}${shape}${body}</g>`;
}

function drawGroup(g) {
  return `<g class="pk-group"><rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="16" fill="${color('paper')}" stroke="${color('kraft')}" stroke-width="1.5" stroke-dasharray="10 8"/>` +
    textRun(g.x + 20, g.y + 34, g.label, { size: MIN_TEXT + 2, weight: 600, fill: color('ink'), family: FONT_SERIF, anchor: 'start' }) + '</g>';
}

function drawEdge(e, pts) {
  // rounded corners: each bend becomes a short quadratic curve
  const R = 10;
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [p, q, r] = [pts[i - 1], pts[i], pts[i + 1]];
    if (!r) { d += ` L${q[0]} ${q[1]}`; break; }
    const inLen = segLen(p, q), outLen = segLen(q, r), rr = Math.min(R, inLen / 2, outLen / 2);
    const a = [q[0] - Math.sign(q[0] - p[0]) * rr, q[1] - Math.sign(q[1] - p[1]) * rr];
    const b = [q[0] + Math.sign(r[0] - q[0]) * rr, q[1] + Math.sign(r[1] - q[1]) * rr];
    d += ` L${a[0]} ${a[1]} Q${q[0]} ${q[1]} ${b[0]} ${b[1]}`;
  }
  const dash = e.dashed ? ' stroke-dasharray="9 7"' : '';
  const marker = e.arrow === false ? '' : ' marker-end="url(#pk2-arrow)"';
  let out = `<path class="pk-edge" d="${d}" fill="none" stroke="${color('accentText')}" stroke-width="2.5" stroke-linejoin="round"${dash}${marker}/>`;
  if (e.label) {
    const l = labelBox(e, pts);
    out += `<rect x="${l.r.x.toFixed(1)}" y="${l.r.y.toFixed(1)}" width="${l.r.w.toFixed(1)}" height="${l.r.h.toFixed(1)}" rx="6" fill="${color('paper')}"/>`;
    let y = l.r.y + 4;
    out += l.lines.map((t) => { y += l.size * LH; return textRun(l.cx, y - l.size * 0.32, t, { size: l.size, weight: 500, fill: color('ink') }); }).join('');
  }
  return out;
}

function drawBadge(n, number) {
  const cx = n.x + 2, cy = n.y + 2;
  return `<g class="pk-badge" aria-hidden="true"><circle cx="${cx}" cy="${cy}" r="19" fill="${color('accentFill')}" stroke="${color('accentText')}" stroke-width="2"/>` +
    textRun(cx, cy + 9, String(number), { size: MIN_TEXT, weight: 700, fill: '#2B1A05' }) + '</g>';
}

export function buildPoster2(spec) {
  if (spec.kit !== 2) throw new Error(`${spec.slug}: not a kit-2 spec`);
  const problems = lint(spec);
  if (problems.length) throw new Error(`${spec.slug}:\n  ${problems.join('\n  ')}`);
  const nodes = spec.nodes ?? [], edges = spec.edges ?? [], steps = spec.steps ?? [];
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const stepIds = new Set(steps.map((s) => s.id));
  for (const n of nodes) if (n.step && !stepIds.has(n.step)) throw new Error(`${spec.slug}: node ${n.id} names unknown ${n.step}`);
  for (const e of edges) if (e.step && !stepIds.has(e.step)) throw new Error(`${spec.slug}: edge ${e.from}->${e.to} names unknown ${e.step}`);
  const routedOf = (e) => route(e, byId[e.from], byId[e.to]).pts;

  const frame = (spec.groups ?? []).map(drawGroup).join('');
  const unstepped = [...edges.filter((e) => !e.step).map((e) => drawEdge(e, routedOf(e))), ...nodes.filter((n) => !n.step).map(drawNode)].join('');
  const stepGroups = steps.map((s, i) => {
    const own = nodes.filter((n) => n.step === s.id);
    const inner = [
      ...edges.filter((e) => e.step === s.id).map((e) => drawEdge(e, routedOf(e))),
      ...own.map(drawNode),
      ...(spec.badges === false || !own.length ? [] : [drawBadge(own[0], i + 1)]),
    ].join('');
    return `<g id="${s.id}" data-step="${s.id}" class="pk-step">${inner}</g>`;
  }).join('');

  // footer: legend (kinds used, then line styles used), sources, stamp — each in its own rows
  const H0 = spec.height;
  const kindsUsed = [...new Set(nodes.map((n) => n.kind ?? 'box'))];
  const text = { ...Object.fromEntries(kindsUsed.map((k) => [k, KINDS[k].legend])), ...(spec.legendText ?? {}) };
  const lineStyles = [...new Set(edges.map((e) => (e.dashed ? 'dashed' : 'solid')))];
  const items = [
    ...kindsUsed.map((k) => ({ w: 34 + textWidth(text[k], MIN_TEXT), svg: (x, y) => {
      const kk = KINDS[k];
      return `<rect x="${x}" y="${y - 18}" width="26" height="22" rx="5" fill="${color(kk.fill)}" stroke="${color(kk.stroke)}" stroke-width="2"${kk.dash ? ` stroke-dasharray="${kk.dash}"` : ''}/>` +
        textRun(x + 36, y, text[k], { size: MIN_TEXT, fill: color('ink'), anchor: 'start' });
    } })),
    ...lineStyles.map((st) => ({ w: 52 + textWidth(LINES[st], MIN_TEXT), svg: (x, y) =>
      `<line x1="${x}" y1="${y - 7}" x2="${x + 40}" y2="${y - 7}" stroke="${color('accentText')}" stroke-width="2.5"${st === 'dashed' ? ' stroke-dasharray="9 7"' : ''}/>` +
      textRun(x + 50, y, LINES[st], { size: MIN_TEXT, fill: color('ink'), anchor: 'start' }) })),
  ];
  let lx = MARGIN, ly = H0 + 66;
  const legend = items.map((it) => {
    if (lx > MARGIN && lx + it.w > W - MARGIN) { lx = MARGIN; ly += 42; }
    const out = it.svg(lx, ly); lx += it.w + 32; return out;
  }).join('');
  const srcLines = wrap(`Source of truth: ${spec.sources.join(' · ')}`, MIN_TEXT, W - 2 * MARGIN, true);
  if (srcLines.length > 3) throw new Error(`${spec.slug}: too many source files for the footer (three lines at most)`);
  let fy = ly + 54;
  const sources = srcLines.map((l) => { const t = textRun(MARGIN, fy, l, { size: MIN_TEXT, fill: color('ink'), mono: true, anchor: 'start' }); fy += 34; return t; }).join('');
  const stamp = `v${spec.verified.version} · verified ${spec.verified.date} · ${spec.verified.commit.slice(0, 7)}`;
  const stampRow = textRun(MARGIN, fy + 6, stamp, { size: MIN_TEXT, fill: color('accentText'), mono: true, anchor: 'start' }) +
    textRun(MARGIN, fy + 42, 'Sri Guru Granth Sahib Ji — Knowledge Base · engineering wiki', { size: MIN_TEXT, fill: color('ink'), anchor: 'start' });
  const H = Math.ceil(fy + 72);

  const desc = spec.description;
  if (!desc || desc.length < 40) throw new Error(`${spec.slug}: description must be at least 40 characters`);
  const sub = wrap(spec.subtitle, MIN_TEXT, W - 2 * MARGIN);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-labelledby="pk-title-${spec.slug} pk-desc-${spec.slug}" class="poster-svg" data-poster="${spec.slug}" data-kit="2">
<title id="pk-title-${spec.slug}">${esc(spec.title)}</title>
<desc id="pk-desc-${spec.slug}">${esc(desc)}</desc>
<defs>
  <marker id="pk2-arrow" viewBox="0 0 14 14" refX="14" refY="7" markerWidth="${ARROW}" markerHeight="${ARROW}" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 1 L14 7 L0 13 z" fill="${color('accentText')}"/></marker>
</defs>
<style>
  .poster-svg { font-family: ${FONT_SANS}; }
  .pk-step { transition: opacity 240ms ease; }
  .pk-step.is-past { opacity: 0.45; }
  .pk-step.is-future { opacity: 0.1; }
  .pk-step.is-active .pk-shape { stroke: ${color('accentFill')}; stroke-width: 4; }
  .pk-step.is-active .pk-edge { stroke-width: 4; }
  @media (prefers-reduced-motion: reduce) { .pk-step { transition: none; } }
</style>
<rect x="0" y="0" width="${W}" height="${H}" rx="24" fill="${color('paper')}"/>
${textRun(MARGIN, 70, `${spec.number} · ${spec.title}`, { size: 44, weight: 600, fill: color('ink'), family: FONT_SERIF, anchor: 'start' })}
${sub.map((l, i) => textRun(MARGIN, 106 + i * 32, l, { size: MIN_TEXT, fill: color('ink'), anchor: 'start' })).join('')}
<line x1="${MARGIN}" y1="${HEADER_RULE}" x2="${W - MARGIN}" y2="${HEADER_RULE}" stroke="${color('kraft')}" stroke-width="1"/>
${frame}
${unstepped}
${stepGroups}
<line x1="${MARGIN}" y1="${H0 + 24}" x2="${W - MARGIN}" y2="${H0 + 24}" stroke="${color('kraft')}" stroke-width="1"/>
<g class="pk-legend">${legend}</g>
${sources}
${stampRow}
</svg>
`;
  const sidecar = steps.map(({ id, title, caption, link }) => ({ id, title, caption, ...(link ? { link } : {}) }));
  return { svg, steps: sidecar };
}
