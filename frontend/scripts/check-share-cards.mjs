// check-share-cards.mjs — runs after `astro build` (npm run build): every share card in dist/ is a
// 1200×630 PNG within its budget, and every Ang has its page and its card. A failure stops the
// deploy, so a link can never unfurl to a missing or oversized image. The per-Ang cards never
// reach webapp/static (sync-to-webapp.mjs), so this is where they are checked.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(FRONTEND, 'dist');
const angs = Object.keys(JSON.parse(readFileSync(join(FRONTEND, 'src/generated/ang-cards.json'), 'utf8')).angs);

const errors = [];
function card(path, budget) {
  if (!existsSync(path)) return errors.push(`missing ${path}`);
  const b = readFileSync(path);
  const png = b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!png || b.readUInt32BE(16) !== 1200 || b.readUInt32BE(20) !== 630) errors.push(`${path}: not a 1200x630 PNG`);
  if (b.length > budget) errors.push(`${path}: ${b.length} bytes, over the ${budget}-byte budget`);
}

const pages = readdirSync(join(DIST, 'og/v2')).filter((f) => f.endsWith('.png'));
for (const f of pages) card(join(DIST, 'og/v2', f), 100 * 1024);
for (const n of angs) {
  card(join(DIST, 'og/v2/ang', `${n}.png`), 60 * 1024);
  const html = join(DIST, 'ang', n, 'index.html');
  if (!existsSync(html)) errors.push(`missing ${html}`);
  else if (!readFileSync(html, 'utf8').includes(`content="https://gurbanisoul.com/og/v2/ang/${n}.png"`)) errors.push(`${html}: og:image is not its own card`);
}
if (errors.length) {
  console.error(`share cards: ${errors.length} problem(s)\n  ` + errors.slice(0, 20).join('\n  '));
  process.exit(1);
}
console.log(`share cards: ${pages.length} page cards and ${angs.length} Ang cards OK`);
