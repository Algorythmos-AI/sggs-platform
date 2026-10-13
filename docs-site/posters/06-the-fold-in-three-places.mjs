// Poster 06 — roman_norm, the one fold that must be byte-identical in three repositories.
// Layout (posters/kit.mjs): the five steps as a zig-zag, then the three homes side by side, all
// bound to one set of golden vectors.
const V = { version: '1.3.10', date: '2026-09-27', commit: 'd85c2adc' };
export default {
  kit: 2,
  number: '06', slug: 'the-fold-in-three-places',
  title: 'The fold in three places',
  subtitle: 'roman_norm turns many spellings into one key — and it lives in three repositories that 24,719 golden vectors hold byte-identical',
  description: 'Seekers spell the same word many ways. roman_norm folds a Roman word in five steps — letter substitutions, digraphs, voicing pairs, the y glide, vowels dropped and doubles collapsed — into a key such as vhgr. The data repository applies it when it builds the translit_norm column; the platform applies it at query time in search and verification; the iOS app carries a Swift port. The contract file golden_roman_norm.ndjson records 24,719 input and output pairs generated from the platform, and every repository asserts against it.',
  height: 1490, verified: V,
  sources: ['webapp/romannorm.py', 'contract/golden_roman_norm.ndjson', 'tools/gen_golden_vectors.py', 'contract/_meta.json'],
  groups: [
    { label: 'One fold, five steps', x: 40, y: 340, w: 1120, h: 452 },
    { label: 'Three homes, one contract', x: 40, y: 844, w: 1120, h: 508 },
  ],
  nodes: [
    { id: 'in', x: 40, y: 196, w: 1120, h: 96, lines: ['Many spellings, one word', 'waheguru · vaahiguroo · wahegurooh → the same key'], step: 'step-01' },
    { id: 's1', x: 60, y: 400, w: 510, h: 96, lines: ['1 · Substitute letters', { text: 'w→v  z→j  q→k  x→k', mono: true }], step: 'step-02' },
    { id: 's2', x: 630, y: 400, w: 510, h: 96, lines: ['2 · Digraphs', 'sh, ch, kh, th … → one letter'], step: 'step-02' },
    { id: 's3', x: 630, y: 536, w: 510, h: 96, lines: ['3 · Voicing pairs', { text: 'b→v  k→g  t→d  p→v', mono: true }], step: 'step-02' },
    { id: 's4', x: 60, y: 536, w: 510, h: 96, lines: ['4 · The y glide', 'gyan ~ giaan'], step: 'step-02' },
    { id: 's5', x: 60, y: 672, w: 510, h: 96, lines: ['5 · Vowels and doubles', 'vowels dropped, doubles collapse'], step: 'step-02' },
    { id: 'out', kind: 'good', x: 630, y: 672, w: 510, h: 96, lines: ['The key', { text: 'vhgr · jsd · krsn · gn', mono: true }], step: 'step-02' },
    { id: 'h1', x: 60, y: 904, w: 330, h: 124, lines: ['Home 1 · sggs-data', 'at build time', { text: 'sggs_pipeline.py', mono: true }], step: 'step-03' },
    { id: 'h2', x: 435, y: 904, w: 330, h: 124, lines: ['Home 2 · platform', 'at query time', { text: 'romannorm.py', mono: true }], step: 'step-04' },
    { id: 'h3', x: 810, y: 904, w: 330, h: 124, lines: ['Home 3 · the app', 'on the device', { text: 'RomanNorm.swift', mono: true }], step: 'step-05' },
    { id: 'pin', kind: 'pin', x: 60, y: 1068, w: 1080, h: 124, lines: [{ text: 'contract/golden_roman_norm.ndjson', mono: true }, '24,719 input → output pairs, generated from home 2'], step: 'step-05' },
    { id: 'gate', kind: 'good', x: 60, y: 1232, w: 1080, h: 96, lines: ['Checked everywhere', 'make contract · the app’s vendor lock · byte-parity tests'], step: 'step-05' },
    { id: 'why', kind: 'note', x: 40, y: 1392, w: 1120, h: 96, lines: ['If the two folds ever differ', 'search breaks silently: no error, just missing lines'], step: 'step-01' },
  ],
  edges: [
    { from: 'in', to: 's1', x: 400, step: 'step-02' },
    { from: 's1', to: 's2', step: 'step-02' },
    { from: 's2', to: 's3', step: 'step-02' },
    { from: 's3', to: 's4', step: 'step-02' },
    { from: 's4', to: 's5', step: 'step-02' },
    { from: 's5', to: 'out', step: 'step-02' },
    { from: 'h1', to: 'pin', dashed: true, step: 'step-05' },
    { from: 'h2', to: 'pin', dashed: true, step: 'step-05' },
    { from: 'h3', to: 'pin', dashed: true, step: 'step-05' },
    { from: 'pin', to: 'gate', step: 'step-05' },
  ],
  steps: [
    { id: 'step-01', title: 'The problem', caption: 'Seekers type a Gurmukhi word in Roman letters the way they hear it: waheguru, vaahiguroo, wahegurooh. A search that demanded one spelling would miss most of them. The fold makes every spelling of a word land on one key — and it must be exactly the same fold wherever it runs, or the query key will not match the index key and lines silently go missing.', link: '/search/the-roman-fold/' },
    { id: 'step-02', title: 'Five steps to one key', caption: 'Lower-case each word. Substitute w→v, z→j, q→k, x→k. Reduce the digraphs (sh, chh, ch, kh, gh, jh, th, dh, bh, ph, rh) to their first letter and f to p. Merge the voicing pairs b→v, k→g, t→d, p→v. Turn a leading y into j and drop a medial y. Keep a leading vowel, drop every other vowel, collapse doubled letters. waheguru becomes vhgr; yashoda and jasodaa become jsd; gyan and giaan become gn.', link: '/search/the-roman-fold/' },
    { id: 'step-03', title: 'Home 1: the data repository, at build time', caption: 'sggs-data’s pipeline applies roman_norm to every line’s transliteration and stores the result in the translit_norm column of the lines table. That column is what the fold tier and the verification engine search.', link: '/data/line-record/' },
    { id: 'step-04', title: 'Home 2: the platform, at query time', caption: 'webapp/romannorm.py is the one copy in this repository: serve.py re-exports it and verify.py imports it (verify cannot import serve, which imports verify). Search tier 11 folds the query with it; the verification engine folds a Roman claim with it before scoring.', link: '/search/verification-engine/' },
    { id: 'step-05', title: 'Home 3, and the contract that binds all three', caption: 'The iOS app carries a Swift port, RomanNorm.swift. tools/gen_golden_vectors.py drives the platform’s function and records 24,719 input and output pairs in contract/golden_roman_norm.ndjson; make contract fails here if the file drifts, the app pins the file by sha256 in vendor.lock.json and runs byte-parity tests, and the data repository’s copy is held to the same vectors. Three copies, one truth.', link: '/search/harnesses-and-golden-vectors/' },
  ],
};
