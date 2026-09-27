// Poster 13 — Angs 1–1430 as one bar: the opening banis, the 31 raags in order, the closing sections;
// the 22 Vaars marked; the voices. Every number is read from the pinned database (/api/meta,
// /api/analytics/vaars) — the spans are the raags and sections tables' first_ang..last_ang.
// Layout (posters/kit.mjs): the bar to scale with square segments in two strong shades, the Vaars as
// thin ticks in two lanes (adjacent Vaars share an Ang), then every raag named in a two-column list.
const V = { version: '1.3.10', date: '2026-09-27', commit: 'd85c2adc' };
// [seq, roman name, first Ang, last Ang, shabads]
const RAAGS = [
  [1, 'Sireeraag', 14, 93, 208], [2, 'Maajh', 94, 150, 177], [3, 'Gaurhee', 151, 346, 740], [4, 'Aasaa', 347, 488, 448], [5, 'Goojaree', 489, 526, 194],
  [6, 'Devagandhaaree', 527, 536, 47], [7, 'Bihaagarhaa', 537, 556, 79], [8, 'Vadahans', 557, 594, 119], [9, 'Sorath', 595, 659, 243], [10, 'Dhanaasaree', 660, 695, 105],
  [11, 'Jaitasaree', 696, 710, 75], [12, 'Todee', 711, 718, 33], [13, 'Bairaarhee', 719, 720, 7], [14, 'Tilang', 721, 727, 19], [15, 'Soohee', 728, 794, 207],
  [16, 'Bilaaval', 795, 858, 230], [17, 'Gond', 859, 875, 49], [18, 'Raamakalee', 876, 974, 270], [19, 'Nat', 975, 983, 25], [20, 'Maalee Gaurhaa', 984, 988, 15],
  [21, 'Maaroo', 989, 1106, 311], [22, 'Tukhaaree', 1107, 1117, 11], [23, 'Kedaaraa', 1118, 1124, 20], [24, 'Bhairau', 1125, 1167, 105], [25, 'Basant', 1168, 1196, 81],
  [26, 'Saarang', 1197, 1253, 282], [27, 'Malaar', 1254, 1293, 161], [28, 'Kaanarhaa', 1294, 1318, 115], [29, 'Kaliaan', 1319, 1327, 24], [30, 'Prabhaatee', 1328, 1351, 65], [31, 'Jaijaavantee', 1352, 1353, 4],
];
// the 22 Vaars: first Ang of each (raag, first, last)
const VAARS = [[83, 91], [137, 150], [300, 317], [318, 323], [462, 475], [508, 517], [517, 524], [548, 556], [585, 594], [642, 653], [705, 710], [785, 792], [849, 855], [947, 956], [957, 966], [966, 968], [1086, 1094], [1094, 1102], [1193, 1193], [1237, 1251], [1278, 1291], [1312, 1318]];
const X0 = 60, X1 = 1140, ANGS = 1430;
const ax = (ang) => X0 + ((ang - 1) / ANGS) * (X1 - X0);
const BAR_Y = 246, BAR_H = 90, LANE = [BAR_Y + BAR_H + 12, BAR_Y + BAR_H + 34];
const label = (id, x, y, w, text, step, extra = {}) => ({ id, kind: 'label', x, y, w, h: 54, lines: [{ text, size: 25, weight: 400 }], step, ...extra });

const nodes = [];
// the opening (1–13) and closing (1353–1430) sections
nodes.push({ id: 'open', kind: 'actor', x: ax(1), y: BAR_Y, w: ax(14) - ax(1), h: BAR_H, lines: [''], title: 'Opening banis · Angs 1–13', step: 'step-02' });
nodes.push({ id: 'close', kind: 'good', x: ax(1354), y: BAR_Y, w: ax(1431) - ax(1354), h: BAR_H, lines: [''], title: 'After the raags · Angs 1353–1430', step: 'step-04' });
// the 31 raags, in two strong alternating shades
RAAGS.forEach(([seq, name, a, b]) => {
  nodes.push({ id: `r${seq}`, kind: seq % 2 ? 'band' : 'band2', x: ax(a), y: BAR_Y, w: Math.max(1.5, ax(b + 1) - ax(a)), h: BAR_H, lines: [''], title: `${seq} · ${name} · Angs ${a}–${b}`, step: 'step-03' });
});
// the Vaars as ticks, alternating between two lanes so Vaars that share an Ang stay apart
VAARS.forEach(([a, b], i) => {
  nodes.push({ id: `v${i + 1}`, kind: 'tick', x: ax(a), y: LANE[i % 2], w: Math.max(4, ax(b + 1) - ax(a)), h: 14, lines: [''], title: `Vaar ${i + 1} · Angs ${a}–${b}`, step: 'step-05' });
});
// the ruler
nodes.push(label('ang1', X0, 398, 170, 'Ang 1', 'step-01', { align: 'start' }));
nodes.push(label('ang715', ax(715) - 85, 398, 170, 'Ang 715', 'step-01'));
nodes.push(label('ang1430', X1 - 170, 398, 170, 'Ang 1430', 'step-01'));
// every raag, named, in printed order: two columns of sixteen and fifteen
RAAGS.forEach(([seq, name, a, b], i) => {
  const col = i < 16 ? 0 : 1, row = i < 16 ? i : i - 16;
  nodes.push(label(`n${seq}`, col ? 610 : 60, 520 + row * 56, 530, `${seq} · ${name} · ${a}–${b}`, 'step-03', { align: 'start' }));
});
export default {
  kit: 2,
  number: '13', slug: 'structure-of-the-granth',
  title: 'The structure of the Granth',
  subtitle: 'Angs 1 to 1430 as one bar to scale — the opening, the thirty-one raags in printed order, the closing sections; the twenty-two Vaars marked',
  description: 'Sri Guru Granth Sahib Ji opens with Japji Sahib, So Dar, So Purakh and Sohila on Angs 1–13, is ordered by thirty-one raags from Sireeraag on Ang 14 to Jaijaavantee on Ang 1353, and closes with the Sahaskriti saloks, Gatha, Phunhe, Chaubole, the Bhatts’ Swaiyye, the saloks beyond the Vaars, Guru Tegh Bahadur Ji’s saloks, Mundavani and Raagmala on Angs 1353–1430. Twenty-two Vaars sit inside the raags. Six Gurus, fifteen Bhagats, eleven Bhatts and three others wrote it; 60,658 lines in 4,527 compositions.',
  height: 1700, verified: V,
  sources: ['webapp/sggs/reader.py', 'webapp/sggs/insights.py', 'docs/scripture/structure.md'],
  badges: false,
  legendHide: ['band2', 'label'],
  legendText: { actor: 'the opening, Angs 1–13', band: 'a raag (the shades alternate)', good: 'after the raags, Angs 1353–1430', tick: 'a Vaar, under the bar' },
  groups: [
    { label: 'The thirty-one raags, in printed order', x: 40, y: 456, w: 1120, h: 976 },
  ],
  nodes: [
    ...nodes,
    { id: 'vaarlbl', kind: 'note', x: 40, y: 1472, w: 550, h: 96, lines: ['22 Vaars, marked under the bar', 'pauris by one voice, saloks by many'], step: 'step-05' },
    { id: 'voices', kind: 'note', x: 610, y: 1472, w: 550, h: 96, lines: ['The voices', 'Gurus, Bhagats, Bhatts and others'], step: 'step-06' },
    { id: 'count', kind: 'note', x: 40, y: 1604, w: 1120, h: 96, lines: ['60,658 lines · 4,527 compositions · 1,430 Angs', '31 raags · 22 Vaars · 54 themes — every number from the pinned database'], step: 'step-06' },
  ],
  edges: [],
  steps: [
    { id: 'step-01', title: 'One bar, 1,430 Angs', caption: 'The whole scripture drawn to scale: every Ang is the same width, from Ang 1 at the left to Ang 1430 at the right. Hover a segment for its name and span. Every number on this poster comes from the pinned database, the same one the site and the app serve.', link: '/scripture/structure/' },
    { id: 'step-02', title: 'The opening: Angs 1–13', caption: 'The Granth opens with the Mool Mantar and Japji Sahib (Angs 1–8, 385 lines, no author line in the print), then So Dar, So Purakh and Sohila — the evening and night prayers — before the first raag begins on Ang 14.', link: '/scripture/what-sggs-is/' },
    { id: 'step-03', title: 'Thirty-one raags: Angs 14–1353', caption: 'From Ang 14 the hymns are arranged by raag, the musical mode they are sung in — Sireeraag first, Jaijaavantee last on Ang 1353. Inside a raag the compositions follow the Gurus in order, then the Bhagats. A raag’s span in the database is the longest run of Angs where it is the majority, so a liturgical mention elsewhere never drags a raag’s start. Gaurhee, Maaroo and Raamakalee are the largest.', link: '/scripture/structure/' },
    { id: 'step-04', title: 'After the raags: Angs 1353–1430', caption: 'The closing sections leave the raag framework: the Sahaskriti saloks, Gatha, Phunhe and Chaubole (Guru Arjan Dev Ji), the Bhatts’ Swaiyye in praise of the Gurus (1385–1409), the saloks beyond the Vaars, Guru Tegh Bahadur Ji’s saloks, Mundavani — the seal — and Raagmala. The database clears the raag column here and detects these sections from their headings.', link: '/scripture/bhatts-and-swaiyye/' },
    { id: 'step-05', title: 'The twenty-two Vaars', caption: 'Twenty-two Vaars sit inside the raags, marked under the bar: ballads of pauris by one author with saloks interleaved from several Gurus. The pipeline detects them by their title headers, and a Vaar’s pauris keep the Vaar’s author even where the interleaved saloks carry other ਮਃ headers.', link: '/scripture/vaars-saloks-pauris/' },
    { id: 'step-06', title: 'The voices, and the numbers', caption: 'Six Gurus, fifteen Bhagats, eleven Bhatts, Satta and Balwand, and Bhai Mardana: 29 attributed authors, with Japji carrying no author line. 60,658 lines in 4,527 compositions; 13 named sections outside the raags; 54 themes in the concept index. Every figure is read from the database — the structure page lists them all.', link: '/scripture/structure/' },
  ],
};
