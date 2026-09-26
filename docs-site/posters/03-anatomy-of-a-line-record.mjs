// Poster 03 — one Ang, one unit, one row of the `lines` table (sggs-data: build_corpus.py, build_db.py).
// Kit 2 (posters/kit2.mjs): left, the pipeline that makes a row; right, the row's column families;
// below, the full-text index built over it. Left-to-right connectors use three lanes in the gutter.
const V = { version: '1.3.10', date: '2026-09-27', commit: '017091b1' };
export default {
  kit: 2,
  number: '03', slug: 'anatomy-of-a-line-record',
  title: 'Anatomy of a line record',
  subtitle: 'How a page of the source Bir becomes rows of the lines table — one display line per row — and which columns search reads',
  description: 'A PDF page (54–1483) is an Ang (1–1430). The page text is segmented into units on the double danda; a unit that is a heading carries the raag, section, author, ghar and comp_type for the lines that follow; comp_id groups a whole composition with its heading run and line_no counts within it. Each row keeps the verbatim Gurmukhi with its markers, a clean text form, search forms (translit, translit_norm, first letters, skeleton) and the v2 structural columns. The FTS5 index covers six search columns with bm25 weights 10, 5, 4, 3, 3, 1; English is a separate layer.',
  height: 1290, verified: V,
  sources: ['sggs-data/pipeline/build_corpus.py', 'sggs-data/pipeline/sggs_pipeline.py', 'webapp/sggs/search.py', 'webapp/sggs/core.py'],
  groups: [
    { label: 'One row of the lines table', x: 500, y: 186, w: 660, h: 924 },
  ],
  nodes: [
    // the pipeline (left)
    { id: 'pdf', kind: 'store', x: 40, y: 196, w: 400, h: 104, lines: ['Source Bir PDF', 'pages 54–1483, attested'], step: 'step-01' },
    { id: 'ang', x: 40, y: 350, w: 400, h: 96, lines: ['One page, one Ang', 'Angs 1–1430, borders gone'], step: 'step-01' },
    { id: 'units', x: 40, y: 496, w: 400, h: 124, lines: [{ text: 'segment_units', mono: true }, 'split on the double danda', 'one unit becomes one row'], step: 'step-02' },
    { id: 'hdr', x: 40, y: 670, w: 400, h: 124, lines: [{ text: 'detect_header', mono: true }, 'a heading carries raag,', 'section, author, form'], step: 'step-03' },
    { id: 'comp', x: 40, y: 844, w: 400, h: 124, lines: ['comp_id groups it', 'heading run + body: one id', 'body lines keep their id'], step: 'step-04' },
    { id: 'api', kind: 'note', x: 40, y: 1018, w: 400, h: 96, lines: [{ text: '/api/ang/{n}', mono: true }, '15 columns, verbatim'], step: 'step-05' },
    // the row (right)
    { id: 'flags', x: 520, y: 246, w: 620, h: 96, lines: ['Flags from segmentation', { text: 'is_rahao · is_header', mono: true }], step: 'step-02' },
    { id: 'meta', x: 520, y: 382, w: 620, h: 96, lines: ['From the heading', { text: 'raag · section · author · ghar', mono: true }], step: 'step-03' },
    { id: 'place', x: 520, y: 518, w: 620, h: 124, lines: ['Placement', { text: 'id · ang · pdf_page', mono: true }, { text: 'comp_id · line_no', mono: true }], step: 'step-04' },
    { id: 'v2', x: 520, y: 682, w: 620, h: 96, lines: ['Structure (enrich_v2)', { text: 'stanza_index · pada_total', mono: true }], step: 'step-07' },
    { id: 'text', kind: 'store', x: 520, y: 818, w: 620, h: 104, lines: ['The text: never edited', { text: 'gurmukhi · text · markers', mono: true }], step: 'step-05' },
    { id: 'search', x: 520, y: 962, w: 620, h: 124, lines: ['Search forms, derived', { text: 'translit · translit_norm', mono: true }, { text: 'fl_g · fl_r · skeleton', mono: true }], step: 'step-06' },
    // the index (below)
    { id: 'fts', kind: 'store', x: 520, y: 1160, w: 380, h: 104, lines: ['fts: the FTS5 index', { text: 'bm25 10·5·4·3·3·1', mono: true }], step: 'step-08' },
    { id: 'aux', kind: 'note', x: 940, y: 1160, w: 220, h: 124, lines: ['Beside it', { text: 'fts_en', mono: true }, { text: 'fts_shabad', mono: true }], step: 'step-08' },
  ],
  edges: [
    { from: 'pdf', to: 'ang', step: 'step-01' },
    { from: 'ang', to: 'units', step: 'step-01' },
    { from: 'units', to: 'hdr', step: 'step-03' },
    { from: 'hdr', to: 'comp', step: 'step-04' },
    { from: 'comp', to: 'api', dashed: true, step: 'step-05' },
    // pipeline → row, one lane each in the gutter (x 456 / 470 / 484), no two crossing
    { from: 'units', to: 'flags', step: 'step-02', via: [[456, 558], [456, 294]] },
    { from: 'hdr', to: 'meta', step: 'step-03', via: [[470, 732], [470, 430]] },
    { from: 'comp', to: 'place', step: 'step-04', via: [[484, 906], [484, 580]] },
    { from: 'text', to: 'search', step: 'step-06' },
    { from: 'search', to: 'fts', dashed: true, step: 'step-08' },
  ],
  steps: [
    { id: 'step-01', title: 'A page is an Ang', caption: 'The pipeline opens the attested source PDF and reads pages 54 to 1483. page_content strips the page borders and the page number, joins the wrapped lines, and maps each PDF page to its Ang: 1 to 1430. Both numbers are kept on every row (pdf_page, ang).', link: '/data/pipeline/' },
    { id: 'step-02', title: 'A page becomes units', caption: 'segment_units splits the page stream on the double danda. Numeral markers stay attached to the unit they close, and a rahao marker sets the rahao flag. One unit becomes one row: is_rahao is 1 on a refrain line, is_header is 1 on a heading.', link: '/data/line-record/' },
    { id: 'step-03', title: 'Headings carry the metadata', caption: 'detect_header decides whether a unit is a structural heading — a raag title, the invocation, a Mahalla or Bhagat label — and reads the raag, section, author, ghar and composition type (comp_type) from it. Those values are inherited by the lines that follow. A verse that merely contains a raag word or a form word is not a heading (the v1.1.4 weak-signal rule). Japji has no Mahalla line in the print, so its author is null.', link: '/data/line-record/' },
    { id: 'step-04', title: 'comp_id groups a composition', caption: 'A run of consecutive heading lines opens one composition together with the body that follows, so /api/shabad/{comp_id} returns the printed title. The run adopts its last heading’s id, so no body line ever changes comp_id and vacated ids become permanent gaps. line_no counts 1..N inside the composition; id is the row’s identity for ever.', link: '/data/architecture/database-schema/' },
    { id: 'step-05', title: 'The text, three ways', caption: 'gurmukhi is the line as printed, dandas and markers included — verbatim, proven character for character against the PDF, and never edited anywhere in the system. text is the same line without markers, for indexing. markers is the JSON list of the numerals that closed the unit. /api/ang/{n} returns 15 of the columns for every line, gurmukhi verbatim, never a rewritten form.', link: '/data/editorial-ledger/' },
    { id: 'step-06', title: 'Search forms are derived', caption: 'From the text the pipeline derives translit (Roman transliteration), translit_norm (the spelling-tolerant fold, built in the database), fl_g and fl_r (first letters in Gurmukhi and Roman, for first-letter search) and skeleton (the line with its vowel signs stripped). They are reading aids and search keys, not scripture.', link: '/architecture/search-waterfall/' },
    { id: 'step-07', title: 'Structure columns', caption: 'enrich_v2 adds stanza_index, pada_total and source_category — structural metadata the reader and the app use for layout — without touching any text column. comp_type is known to be mislabelled in places and is suppressed at the display layer; prefer comp_id and section.', link: '/data/architecture/database-schema/' },
    { id: 'step-08', title: 'The FTS index', caption: 'fts is an FTS5 table with external content over lines: text, translit, translit_norm, fl_g, fl_r and skeleton, tokenised so Gurmukhi signs stay inside tokens. Search ranks with bm25 and column weights 10, 5, 4, 3, 3, 1 — the verbatim text outranks a transliteration hit, which outranks a first-letter or skeleton hit. Beside it, fts_en serves the English tier and fts_shabad the passage tier; translations live in their own, labelled table. (The database also carries a trigram index, fts_tri, which no route reads.)', link: '/architecture/search-waterfall/' },
  ],
};
