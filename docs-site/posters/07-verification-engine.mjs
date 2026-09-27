// Poster 07 — /api/verify (webapp/verify.py): from a claimed quotation to a verdict, rung by rung.
// Kit 2 (posters/kit2.mjs): the claim's three steps across the top, the verdict ladder as full-width
// rungs from the strongest verdict down, then the Ang modifier, the answer and the thresholds.
const V = { version: '1.3.10', date: '2026-09-27', commit: 'd85c2adc' };
export default {
  kit: 2,
  number: '07', slug: 'verification-engine',
  title: 'The verification engine',
  subtitle: 'Is this quotation really in the Granth? /api/verify answers with a verdict, a confidence and the canonical line — never a guess',
  description: 'The claim is NFC-normalised and its script detected. Gurmukhi claims are cleaned of dandas and numerals; Roman claims are folded with roman_norm. Candidate lines come from the FTS index (an exact phrase, then a looser OR). Each candidate is scored with difflib’s ratio against the claim. The ladder then decides: an exact byte match is VERIFIED_EXACT; a claim contained whole in a line is VERIFIED_PARTIAL; a best ratio of at least 0.95 is VERIFIED; at least 0.85 is PROBABLE, or AMBIGUOUS when the runner-up is within 0.05 and itself at least 0.80; anything lower is NOT_FOUND with no line asserted. A claimed Ang adds +ANG_MATCH or +ANG_MISMATCH with the actual Ang.',
  height: 1540, verified: V,
  sources: ['webapp/verify.py', 'webapp/romannorm.py', 'webapp/sggs/verification.py', 'contract/golden_verify.ndjson'],
  legendText: { gate: 'not found: no line is asserted' },
  groups: [
    { label: 'The verdict ladder — the first rung that fits wins', x: 40, y: 340, w: 1120, h: 788 },
  ],
  nodes: [
    { id: 'claim', x: 60, y: 196, w: 330, h: 96, lines: ['1 · Normalise', 'detect the script'], step: 'step-01' },
    { id: 'cand', kind: 'store', x: 435, y: 196, w: 330, h: 104, lines: ['2 · Candidates', 'from the fts index'], step: 'step-02' },
    { id: 'score', x: 810, y: 196, w: 330, h: 96, lines: ['2 · Score each', { text: 'SequenceMatcher', mono: true }], step: 'step-02' },
    { id: 'r3', kind: 'good', x: 60, y: 400, w: 1080, h: 96, lines: ['3 · VERIFIED_EXACT · confidence 1.0', 'the cleaned bytes equal a canonical line'], step: 'step-03' },
    { id: 'r4', kind: 'good', x: 60, y: 552, w: 1080, h: 96, lines: ['4 · VERIFIED_PARTIAL · confidence 0.95', 'the claim sits whole inside a canonical line'], step: 'step-04' },
    { id: 'r5', kind: 'good', x: 60, y: 704, w: 1080, h: 96, lines: ['5 · VERIFIED · confidence = the ratio', { text: 'best ratio ≥ 0.95', mono: true }], step: 'step-05' },
    { id: 'r6', x: 60, y: 856, w: 510, h: 96, lines: ['6 · PROBABLE', 'best ≥ 0.85, runner-up far'], step: 'step-06' },
    { id: 'r6b', x: 630, y: 856, w: 510, h: 96, lines: ['6 · AMBIGUOUS', 'two lines fit: no choice'], step: 'step-06' },
    { id: 'r7', kind: 'gate', x: 60, y: 1008, w: 1080, h: 96, lines: ['7 · NOT_FOUND · confidence 0.0', 'best ratio under 0.85, or no candidate at all'], step: 'step-07' },
    { id: 'ang', kind: 'note', x: 60, y: 1168, w: 510, h: 96, lines: ['7 · The Ang modifier', '+ANG_MATCH or +ANG_MISMATCH'], step: 'step-07' },
    { id: 'out', kind: 'note', x: 630, y: 1168, w: 510, h: 96, lines: ['The answer', 'verdict, confidence, the line'], step: 'step-07' },
    { id: 'thr', kind: 'note', x: 40, y: 1304, w: 1120, h: 96, lines: [{ text: '_THRESH_EXACT 0.95 · _THRESH_PROBABLE 0.85', mono: true }, { text: '_THRESH_AMBIG 0.80 · _THRESH_GAP 0.05', mono: true }], step: 'step-05' },
    { id: 'gold', kind: 'note', x: 40, y: 1440, w: 1120, h: 96, lines: ['contract/golden_verify.ndjson pins the verdicts', 'replayed against every deploy by contract_http.py'], step: 'step-07' },
  ],
  edges: [
    { from: 'claim', to: 'cand', step: 'step-02' },
    { from: 'cand', to: 'score', step: 'step-02' },
    { from: 'score', to: 'r3', step: 'step-03' },
    { from: 'r3', to: 'r4', label: 'no', step: 'step-04' },
    { from: 'r4', to: 'r5', label: 'no', step: 'step-05' },
    { from: 'r5', to: 'r6', label: 'no', step: 'step-06' },
    { from: 'r5', to: 'r6b', step: 'step-06' },
    { from: 'r6', to: 'r7', label: 'no', step: 'step-07' },
    { from: 'r6b', to: 'r7', step: 'step-07' },
    { from: 'ang', to: 'out', step: 'step-07' },
  ],
  steps: [
    { id: 'step-01', title: 'Normalise and detect the script', caption: 'The claim is trimmed and NFC-normalised. If it holds Gurmukhi, dandas, danda numerals and pipes are stripped to give the clean claim; if it is Roman, every word is folded with roman_norm — the same fold that built the translit_norm column — to give the claim key.', link: '/search/verification-engine/' },
    { id: 'step-02', title: 'Candidates, then a score for each', caption: 'The FTS index is asked for an exact phrase first (the text column for Gurmukhi, translit_norm for Roman; the skeleton as a second chance), then for a looser OR of the tokens. Every candidate line is scored with difflib’s SequenceMatcher ratio against the claim; the best, the runner-up and the gap between them decide the rung.', link: '/search/verification-engine/' },
    { id: 'step-03', title: 'VERIFIED_EXACT', caption: 'If the phrase query produced an exact hit — the cleaned bytes equal a canonical line — the verdict is VERIFIED_EXACT with confidence 1.0. Nothing fuzzy was needed.', link: '/search/verification-engine/' },
    { id: 'step-04', title: 'VERIFIED_PARTIAL', caption: 'People quote half a line constantly. If the claim is at least three words or twelve characters and sits whole inside a candidate line (but is not the whole line), the verdict is VERIFIED_PARTIAL with confidence 0.95 and that line is returned.', link: '/search/verification-engine/' },
    { id: 'step-05', title: 'VERIFIED', caption: 'A best ratio of at least 0.95 (_THRESH_EXACT) is VERIFIED; the confidence is the ratio itself. Small transliteration differences land here.', link: '/search/verification-engine/' },
    { id: 'step-06', title: 'PROBABLE or AMBIGUOUS', caption: 'A best ratio of at least 0.85 (_THRESH_PROBABLE) is PROBABLE — unless the runner-up is itself at least 0.80 (_THRESH_AMBIG) and within 0.05 (_THRESH_GAP), in which case two lines fit and the verdict is AMBIGUOUS: the engine reports both scores and refuses to choose.', link: '/search/verification-engine/' },
    { id: 'step-07', title: 'NOT_FOUND, the Ang modifier, the answer', caption: 'Below 0.85, or with no candidates at all, the verdict is NOT_FOUND with confidence 0.0 and no line is asserted — a percentage would only mislead. When the caller claimed an Ang and a line was matched, the verdict gains +ANG_MATCH or +ANG_MISMATCH(actual=N). The response carries the verdict, the confidence, the matched line id, the canonical Gurmukhi with its Ang, raag, author, comp_id and section, and distance_details. contract/golden_verify.ndjson pins these verdicts across every deploy and the iOS port.', link: '/search/harnesses-and-golden-vectors/' },
  ],
};
