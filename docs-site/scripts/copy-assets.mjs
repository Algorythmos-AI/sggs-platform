// prebuild: the fonts the product already ships (frontend/public/fonts, with their OFL licences) and
// the diagram posters (docs/diagrams/posters) are copied into public/ so the wiki serves them itself.
// The share-card renderer (frontend/src/og/render.ts) and its variable fonts go to src/og for
// src/pages/og, so the wiki's cards are drawn by the same code as gurbanisoul.com's.
// Nothing is duplicated in git: public/fonts, public/posters, src/og/fonts and src/og/render.ts are ignored.
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const copies = [
  ['frontend/public/fonts', 'docs-site/public/fonts', ['SantLipi-VF.woff2', 'SourceSerif4-latin.woff2', 'OFL.txt', 'OFL-SourceSerif4.txt']],
  ['docs/diagrams/posters', 'docs-site/public/posters', null],
  ['frontend/src/og/fonts', 'docs-site/src/og/fonts', ['SourceSerif4-VF.ttf', 'SantLipi-VF.ttf', 'OFL.txt', 'OFL-SourceSerif4.txt']],
  ['frontend/src/og', 'docs-site/src/og', ['render.ts']],
];
for (const [from, to, only] of copies) {
  const src = path.join(root, from);
  if (!existsSync(src)) continue;
  mkdirSync(path.join(root, to), { recursive: true });
  const names = only ?? readdirSync(src).filter((n) => n.endsWith('.svg') || n.endsWith('.json'));
  for (const n of names) {
    if (!existsSync(path.join(src, n))) throw new Error(`copy-assets: ${from}/${n} is missing`);
    cpSync(path.join(src, n), path.join(root, to, n));
  }
  console.log(`copy-assets: ${names.length} file(s) ${from} -> ${to}`);
}
