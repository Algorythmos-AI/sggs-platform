// posters/kit2.mjs: a poster reads at the size the wiki shows it, and the kit refuses one that
// would not — each rule is shown catching the defect it exists for (several were live on kit 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KINDS, MIN_TEXT, ROLES, SHOWN, W, buildPoster2, lint, route } from '../../posters/kit2.mjs';
import { BRAND, BRAND_DARK, contrast } from '../brand.mjs';
import poster03 from '../../posters/03-anatomy-of-a-line-record.mjs';

const V = { version: '1.3.10', date: '2026-09-27', commit: '017091b1' };
const base = (over = {}) => ({
  kit: 2, number: '99', slug: 'test', title: 'Test poster', subtitle: 'A poster used by the tests',
  description: 'A poster used by the kit tests to prove each lint rule catches its defect.',
  height: 700, verified: V, sources: ['webapp/serve.py'], groups: [], nodes: [], edges: [], steps: [], ...over,
});
const box = (id, x, y, w = 300, h = 96, extra = {}) => ({ id, x, y, w, h, lines: ['A box'], ...extra });
const problems = (over) => lint(base(over));
const has = (ps, re) => assert.ok(ps.some((p) => re.test(p)), `expected a problem matching ${re}; got:\n  ${ps.join('\n  ')}`);

test('the smallest text shows at 13 px or more in the wiki\'s content column', () => {
  assert.equal(MIN_TEXT, 25);
  assert.ok(MIN_TEXT * SHOWN / W >= 13);
  has(problems({ nodes: [box('a', 40, 200, 300, 96, { lines: ['Title', { text: 'small', size: 18 }] })] }), /a: "small" is 18px — under 25px/);
});

test('text that overflows its box, or more than three lines, is refused', () => {
  has(problems({ nodes: [box('a', 40, 200, 200, 96, { lines: ['A title far too long for this box'] })] }), /too wide for its 200px box/);
  has(problems({ nodes: [box('a', 40, 200, 400, 200, { lines: ['One', 'two', 'three', 'four'] })] }), /4 lines — at most 3/);
  has(problems({ nodes: [box('a', 40, 200, 400, 60, { lines: ['One', 'two', 'three'] })] }), /3 lines need \d+px; the box is 60px/);
});

test('a line through a box is refused (poster 03 and 09 had one through box text)', () => {
  // a over b over c in one column; an edge a→c would run straight down through b
  const nodes = [box('a', 40, 200), box('b', 40, 340), box('c', 40, 480)];
  has(problems({ nodes, edges: [{ from: 'a', to: 'c' }] }), /edge a→c: segment 1 crosses b/);
  // routed round it through a waypoint lane, it passes
  assert.deepEqual(problems({ nodes, edges: [{ from: 'a', to: 'c', via: [[380, 248], [380, 528]] }] }), []);
});

test('diagonal segments, short last runs and a bend inside its own box are refused', () => {
  const nodes = [box('a', 40, 200), box('b', 600, 400)];
  has(problems({ nodes, edges: [{ from: 'a', to: 'b', via: [[380, 248], [620, 380]] }] }), /diagonal/);
  const close = [box('a', 40, 200), box('b', 40, 316)];                 // a 20 px gap: all arrowhead
  has(problems({ nodes: close, edges: [{ from: 'a', to: 'b' }] }), /last straight run is 20px/);
  // a waypoint inside the source box: the line doubles back through it (poster 02's reversed arrow)
  has(problems({ nodes, edges: [{ from: 'a', to: 'b', via: [[190, 248], [190, 448], [600, 448]] }] }), /runs inside its own box a/);
});

test('two arrows on one point, or two lines on one track, are refused (poster 09 stacked two arrowheads)', () => {
  const nodes = [box('a', 40, 200), box('b', 440, 200), box('c', 240, 440)];
  has(problems({ nodes, edges: [{ from: 'a', to: 'c', x: 330 }, { from: 'b', to: 'c', x: 332 }] }), /end on the same point/);
  const lanes = [box('a', 40, 200, 300, 96), box('b', 40, 360, 300, 96), box('c', 700, 200, 300, 96), box('d', 700, 360, 300, 96)];
  has(problems({ nodes: lanes, edges: [
    { from: 'a', to: 'd', via: [[500, 248], [500, 408]] },
    { from: 'b', to: 'c', via: [[504, 408], [504, 248]] },
  ] }), /share a track/);
});

test('a label over a box, a line over a group title, and boxes that overlap or straddle a group are refused', () => {
  const nodes = [box('a', 40, 200), box('b', 40, 400), box('c', 360, 290, 200, 96)];
  has(problems({ nodes, edges: [{ from: 'a', to: 'b', label: 'a label wide enough to reach the next box' }] }), /its label ".*" covers c/);
  has(problems({ nodes: [box('a', 40, 200), box('b', 200, 250)] }), /a and b overlap/);
  const g = { label: 'A group', x: 400, y: 200, w: 500, h: 300 };
  has(problems({ groups: [g], nodes: [box('a', 300, 300)] }), /a: straddles the border of group "A group"/);
  has(problems({ groups: [g], nodes: [box('a', 440, 400), box('b', 440, 210, 300, 60, { lines: ['Hidden'] })] }), /b: covers the title of group "A group"/);
});

test('every node kind meets 4.5:1 for its text in both themes (kit 1 had 2.06:1 in the dark)', () => {
  const hex = (role, dark) => ROLES[role][dark ? 2 : 1];
  for (const [kind, k] of Object.entries(KINDS)) {
    for (const dark of [false, true]) {
      const c = contrast(hex(k.text, dark), hex(k.fill, dark));
      assert.ok(c >= 4.5, `${kind} in the ${dark ? 'dark' : 'light'} theme: ${c.toFixed(2)}:1`);
    }
  }
});

test('every colour is a brand token, and the site\'s dark values are the ones the kit checks contrast against', () => {
  const tokens = new Set([...Object.values(BRAND), ...Object.values(BRAND_DARK), '#FFFFFF'].map((h) => h.toUpperCase()));
  for (const [role, [, light, dark]] of Object.entries(ROLES)) {
    assert.ok(tokens.has(light.toUpperCase()), `${role} light ${light} is not a token`);
    assert.ok(tokens.has(dark.toUpperCase()), `${role} dark ${dark} is not a token`);
  }
  const css = readFileSync(new URL('../../src/styles/widgets.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('--poster-paper:'), css.indexOf('background: #171412;'));
  const dark = Object.fromEntries([...block.matchAll(/(--poster-[a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2].toUpperCase()]));
  for (const [v, value] of Object.entries(dark)) assert.ok(tokens.has(value), `${v}: ${value} is not a brand token`);
  for (const [role, [v, , darkHex]] of Object.entries(ROLES)) {
    if (v) assert.equal(dark[v], darkHex.toUpperCase(), `widgets.css ${v} must equal the kit's dark ${role}`);
  }
});

test('routing: boxes sharing a column get one straight line; others bend through the gap between them', () => {
  assert.deepEqual(route({}, box('a', 40, 200), box('b', 40, 360)).pts, [[190, 296], [190, 360]]);
  assert.deepEqual(route({}, box('a', 40, 200), box('b', 500, 200)).pts, [[340, 248], [500, 248]]);
  const z = route({}, box('a', 40, 200), box('b', 600, 400)).pts;
  assert.equal(z.length, 4);
  for (let i = 1; i < z.length; i++) assert.ok(z[i][0] === z[i - 1][0] || z[i][1] === z[i - 1][1], 'right angles only');
});

test('poster 03 is built on kit 2 and meets every rule', () => {
  assert.deepEqual(lint(poster03), []);
  const { svg, steps } = buildPoster2(poster03);
  assert.match(svg, /viewBox="0 0 1200 \d+"/);
  assert.match(svg, /data-kit="2"/);
  assert.equal(steps.length, 8);
  assert.equal((svg.match(/class="pk-badge"/g) ?? []).length, 8, 'one numbered badge per step');
  const sizes = [...svg.matchAll(/font-size="(\d+)"/g)].map((m) => Number(m[1]));
  assert.ok(Math.min(...sizes) >= MIN_TEXT);
  // every node's tooltip is its own: the <title> is the first child of the node's group
  assert.equal((svg.match(/<g class="pk-node"[^>]*><title>/g) ?? []).length, poster03.nodes.length);
});

test('a kit-2 build fails loudly, naming the node and the rule', () => {
  assert.throws(() => buildPoster2(base({ nodes: [box('a', 40, 200, 300, 96, { lines: ['Title', { text: 'x', size: 12 }] })] })), /test:\n {2}a: "x" is 12px/);
});
