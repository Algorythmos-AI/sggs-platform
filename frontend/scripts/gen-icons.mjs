// gen-icons.mjs — regenerate the favicons and the PWA / apple-touch icons.
//
// The Gurbani Soul mark, icon v2 ("Pothi & Naad"): ੴ in Sant Lipi above an open pothi, warm ink on
// a top-lit gold field, with rings rising from the pothi's spine. The outlines are vendored from
// the iOS repository (scripts/app-icon/, see its README), so no font is needed at build or view
// time and the sites carry exactly the app's mark. Rasterised with resvg, encoded with sharp;
// output is byte-deterministic across runs. Run:  node scripts/gen-icons.mjs
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(HERE, '..');
const REPO = join(FRONTEND, '..');
const OUT = join(FRONTEND, 'public', 'icons');
mkdirSync(OUT, { recursive: true });

// Colours and ring geometry MUST match ios/tools/make_app_icon.swift in gurbani-soul-ios.
const INK = '#171412';
const FIELD_TOP = '#FFCE45';
const FIELD_BOTTOM = '#F09A00';
const RING_TONE = 0.30;                       // white over the field, one even tone
const SPINE = { x: 512, y: 838 };             // top of the pothi's spine (y-down), the rings' centre
const RING_FIRST = 150, RING_STEP = 96, RING_LINE = 20;

const outline = (name) => readFileSync(join(HERE, 'app-icon', name), 'utf8').match(/ d="([^"]+)"/)[1];
const MARK = outline('mark.svg');
const POTHI = outline('pothi.svg');

// Everything above the top page edge; drawn far past the canvas so a scaled-down mark (the
// maskable icon) still has rings to every edge.
const HORIZON = 'M-3000 -3000 L4024 -3000 L4024 793 L812 793 C722 778 602 774 512 838 '
  + 'C422 774 302 778 212 793 L-3000 793 Z';

function rings() {
  let out = '';
  for (let r = RING_FIRST; r < 4200; r += RING_STEP) out += `<circle cx="${SPINE.x}" cy="${SPINE.y}" r="${r}"/>`;
  return `<g clip-path="url(#horizon)" fill="none" stroke="#fff" stroke-opacity="${RING_TONE}" stroke-width="${RING_LINE}">${out}</g>`;
}

// `scale` shrinks the artwork about the centre (the field stays full-bleed); `radius` rounds the
// tile (favicons only — iOS and Android apply their own mask); `detail` drops the rings.
function icon({ scale = 1, radius = 0, detail = true, label = '' } = {}) {
  const t = scale === 1 ? '' : ` transform="translate(512 512) scale(${scale}) translate(-512 -512)"`;
  const a11y = label ? ` role="img" aria-label="${label}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"${a11y}>
<defs>
<linearGradient id="field" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${FIELD_TOP}"/><stop offset="1" stop-color="${FIELD_BOTTOM}"/></linearGradient>
<clipPath id="horizon"><path d="${HORIZON}"/></clipPath>
</defs>
<rect width="1024" height="1024" rx="${radius}" fill="url(#field)"/>
<g${t}>${detail ? rings() : ''}
<path fill="${INK}" d="${POTHI}"/>
<path fill="${INK}" d="${MARK}"/>
</g>
</svg>
`;
}

async function png(name, size, opts) {
  const raw = new Resvg(icon(opts), { fitTo: { mode: 'width', value: size } }).render().asPng();
  const out = await sharp(raw).flatten({ background: FIELD_BOTTOM }).png({ compressionLevel: 9, palette: false }).toBuffer();
  return out;
}

async function write(path, size, opts) {
  const out = await png(path, size, opts);
  writeFileSync(path, out);
  console.log(`${path.replace(REPO + '/', '')}  ${out.length} bytes`);
}

await write(join(OUT, 'icon-192.png'), 192);
await write(join(OUT, 'icon-512.png'), 512);
await write(join(OUT, 'apple-touch-icon.png'), 180);                 // iOS applies its own rounding
await write(join(OUT, 'icon-maskable-512.png'), 512, { scale: 0.74 }); // artwork inside the 80% safe circle
await write(join(REPO, 'docs-site', 'public', 'apple-touch-icon.png'), 180);

// Favicons: the mark and the pothi only — the rings are noise at 16–32 px.
const favicon = (label) => icon({ radius: 224, detail: false, label });
writeFileSync(join(FRONTEND, 'public', 'favicon.svg'), favicon('Gurbani Soul'));
writeFileSync(join(REPO, 'docs-site', 'public', 'favicon.svg'), favicon('Sri Guru Granth Sahib Ji — Knowledge Base'));
console.log('favicons written');
