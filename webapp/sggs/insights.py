# -*- coding: utf-8 -*-
"""Insights context: precomputed analytics — theme network, author/raag stylometry, progression,
resonance, Vaars, constellation, related compositions, line concepts, semantic neighbours."""
import json, sqlite3, math
from .core import _FALLTHROUGH, _ID_MAX, ApiError, _int, attach_translations, db, rows_to_list

# Tables this context reads (precomputed analytics plus verse text). The platform split cuts each service's database
# slice from this declaration; webapp/tests/test_declared_tables.py runs every route of the
# context under an SQLite authorizer that denies anything undeclared.
TABLES = frozenset({
    'analytics_meta',
    'author_analytics',
    'author_distinctive_terms',
    'author_resonance',
    'authors',
    'concept_lines',
    'concepts',
    'line_neighbors',
    'lines',
    'raag_analytics',
    'raags',
    'shabad_neighbors',
    'theme_fingerprint',
    'theme_network',
    'translations',
    'vaar_units',
    'vaars',
})


def _route_themes_network(p, qs):
    concept = qs.get('concept', [None])[0]
    try:
        min_ppmi = float(qs.get('min_ppmi', ['0'])[0])
    except (TypeError, ValueError):
        min_ppmi = 0.0
    if not math.isfinite(min_ppmi):     # NaN/inf survive max(min()) (compare False) -> clamp explicitly
        min_ppmi = 0.0
    min_ppmi = max(0.0, min(1.0, min_ppmi))
    lim = _int(qs, 'limit', 200, 1, 2000)
    try:
        if concept:
            rows = db().execute(
                "SELECT source, target, shabad_count, ppmi, jaccard FROM theme_network "
                "WHERE source=? AND ppmi>=? ORDER BY ppmi DESC, jaccard DESC LIMIT ?",
                (concept, min_ppmi, lim)).fetchall()
        else:
            rows = db().execute(
                "SELECT source, target, shabad_count, ppmi, jaccard FROM theme_network "
                "WHERE source < target AND ppmi>=? ORDER BY ppmi DESC LIMIT ?",
                (min_ppmi, lim)).fetchall()
        return {'concept': concept, 'edges': rows_to_list(rows), 'metric': 'ppmi+jaccard',
                'note': 'theme co-occurrence within shabads; PPMI controls base-rate bias'}
    except sqlite3.OperationalError:
        return {'edges': [], 'note': 'analytics tables not present in this DB build'}
    return _FALLTHROUGH


def _route_analytics_author(p, qs):
    author = qs.get('author', [None])[0]
    try:
        if not author:
            rows = db().execute(
                "SELECT author, n_lines, n_shabads, n_raags, mattr_100, avg_words_line, "
                "is_reliable FROM author_analytics ORDER BY n_lines DESC").fetchall()
            return {'authors': rows_to_list(rows)}
        st = db().execute("SELECT * FROM author_analytics WHERE author=?", (author,)).fetchone()
        out = dict(st) if st else {}
        if out.get('top_themes'):
            try: out['top_themes'] = json.loads(out['top_themes'])
            except Exception: pass
        fp_lim = 60 if qs.get('full', [None])[0] else 12   # full=1 -> every concept (for radar axes)
        fp = db().execute("SELECT concept, n_tagged, entity_rate, corpus_rate, lift FROM theme_fingerprint "
                          "WHERE entity_type='author' AND entity_id=? ORDER BY lift DESC LIMIT ?", (author, fp_lim)).fetchall()
        dt = db().execute("SELECT term, z_score, rank FROM author_distinctive_terms "
                          "WHERE author=? ORDER BY rank LIMIT 12", (author,)).fetchall()
        return {'author': author, 'stylometry': out, 'theme_fingerprint': rows_to_list(fp),
                'distinctive_terms': rows_to_list(dt),
                'note': 'theme emphasis = lift vs corpus baseline; stylometry on the English '
                        'translation; descriptive only, never a ranking of scripture'}
    except sqlite3.OperationalError:
        return {'author': author, 'note': 'analytics tables not present in this DB build'}
    return _FALLTHROUGH


def _route_analytics_raag(p, qs):
    raag = qs.get('raag', [None])[0]
    try:
        if not raag:
            return {'raags': rows_to_list(db().execute(
                "SELECT * FROM raag_analytics ORDER BY n_lines DESC").fetchall())}
        st = db().execute("SELECT * FROM raag_analytics WHERE raag=?", (raag,)).fetchone()
        out = dict(st) if st else {}
        if out.get('top_themes'):
            try: out['top_themes'] = json.loads(out['top_themes'])
            except Exception: pass
        fp = db().execute("SELECT concept, lift, n_tagged FROM theme_fingerprint "
                          "WHERE entity_type='raag' AND entity_id=? ORDER BY lift DESC LIMIT 12", (raag,)).fetchall()
        return {'raag': raag, 'analytics': out, 'theme_fingerprint': rows_to_list(fp)}
    except sqlite3.OperationalError:
        return {'raag': raag, 'note': 'analytics tables not present in this DB build'}
    return _FALLTHROUGH


def _route_analytics_progression(p, qs):   # /api/analytics/progression?raag=X
    raag = qs.get('raag', [None])[0]
    bins = _int(qs, 'bins', 36, 8, 80)
    top = _int(qs, 'top', 7, 2, 10)
    if not raag:
        raise ValueError('progression requires a raag')
    try:
        ordered = db().execute(
            "SELECT id, ang FROM lines WHERE raag=? ORDER BY ang, id", (raag,)).fetchall()
        M = len(ordered)
        if M == 0:
            return {'raag': raag, 'concepts': [], 'series': {}, 'bins': 0, 'note': 'no lines in this raag'}
        bins = min(bins, M)
        pos = {r['id']: i for i, r in enumerate(ordered)}
        angs = [r['ang'] for r in ordered]
        # the raag's most-present concepts (volume → readable bands)
        concepts = [r[0] for r in db().execute(
            "SELECT cl.concept, COUNT(*) c FROM concept_lines cl JOIN lines l ON l.id=cl.line_id "
            "WHERE l.raag=? GROUP BY cl.concept ORDER BY c DESC LIMIT ?", (raag, top)).fetchall()]
        series = {c: [0] * bins for c in concepts}
        cset = set(concepts)
        for lid, concept in db().execute(
                "SELECT cl.line_id, cl.concept FROM concept_lines cl JOIN lines l ON l.id=cl.line_id "
                "WHERE l.raag=?", (raag,)):
            if concept in cset and lid in pos:
                series[concept][min(bins - 1, pos[lid] * bins // M)] += 1
        lines_per_bin = [0] * bins
        for i in range(M):
            lines_per_bin[min(bins - 1, i * bins // M)] += 1
        ang_axis = [angs[min(M - 1, int((b + 0.5) * M / bins))] for b in range(bins)]
        roman = db().execute("SELECT roman FROM raags WHERE name=?", (raag,)).fetchone()
        return {'raag': raag, 'roman': (roman[0] if roman else ''), 'n_lines': M, 'bins': bins,
                'concepts': concepts, 'series': series, 'lines_per_bin': lines_per_bin,
                'ang_axis': ang_axis,
                'note': 'concept-tag density along the raag in reading order; descriptive only'}
    except sqlite3.OperationalError:
        return {'raag': raag, 'concepts': [], 'series': {}, 'note': 'analytics tables not present'}
    return _FALLTHROUGH


def _route_analytics_resonance(p, qs):   # /api/analytics/resonance
    min_lines = _int(qs, 'min_lines', 250, 1, _ID_MAX)
    try:
        min_lift = float(qs.get('min_lift', ['1.0'])[0])
    except (TypeError, ValueError):
        min_lift = 1.0
    if not math.isfinite(min_lift):     # NaN/inf survive max(min()) — same guard as min_ppmi
        min_lift = 1.0
    min_lift = max(0.0, min(100.0, min_lift))
    min_edges = _int(qs, 'min_edges', 8, 1, _ID_MAX)
    try:
        nodes = rows_to_list(db().execute(
            "SELECT name AS author, n_lines, first_ang FROM authors WHERE n_lines >= ? "
            "ORDER BY n_lines DESC", (min_lines,)).fetchall())
        names = [n['author'] for n in nodes]
        if not names:
            return {'nodes': [], 'edges': [], 'note': 'no voices meet the size threshold'}
        ph = ','.join('?' * len(names))
        edges = rows_to_list(db().execute(
            f"SELECT src_author AS source, dst_author AS target, edges, mean_score, lift "
            f"FROM author_resonance WHERE src_author <> dst_author AND lift >= ? AND edges >= ? "
            f"AND src_author IN ({ph}) AND dst_author IN ({ph}) ORDER BY lift DESC",
            [min_lift, min_edges] + names + names).fetchall())
        return {'nodes': nodes, 'edges': edges, 'metric': 'lift',
                'note': 'how often a voice’s lines land semantically nearest another voice’s, '
                        'relative to corpus share (lift); descriptive, never a ranking of scripture'}
    except sqlite3.OperationalError:
        return {'nodes': [], 'edges': [], 'note': 'resonance table not present in this DB build'}
    return _FALLTHROUGH


def _route_analytics_vaars(p, qs):   # /api/analytics/vaars (list)
    try:
        rows = rows_to_list(db().execute(
            "SELECT vaar_id, raag, roman, first_ang, last_ang, n_pauris, n_saloks, "
            "pauri_author, salok_authors, cross_author, title FROM vaars ORDER BY first_ang"))
        for r in rows:
            try: r['salok_authors'] = json.loads(r['salok_authors'] or '[]')
            except Exception: r['salok_authors'] = []
        return {'vaars': rows,
                'note': 'the Vaars — heroic ballads of numbered pauris with flanking saloks; '
                        'structural metadata only, never a ranking of scripture'}
    except sqlite3.OperationalError:
        return {'vaars': [], 'note': 'vaar tables not present in this DB build'}
    return _FALLTHROUGH


def _route_analytics_vaar(p, qs):   # /api/analytics/vaar?id=N (anatomy)
    try: vid = _int(qs, 'id', 0, 0, _ID_MAX)
    except ValueError: return {'vaar': None, 'units': []}
    try:
        head = db().execute("SELECT * FROM vaars WHERE vaar_id=?", (vid,)).fetchone()
        if not head:
            return {'vaar': None, 'units': []}
        head = dict(head)
        try: head['salok_authors'] = json.loads(head['salok_authors'] or '[]')
        except Exception: head['salok_authors'] = []
        units = rows_to_list(db().execute(
            "SELECT seq, kind, author, n_lines, pauri_no, first_line_id, ang, theme "
            "FROM vaar_units WHERE vaar_id=? ORDER BY seq", (vid,)))
        return {'vaar': head, 'units': units,
                'note': 'salok + pauri anatomy in reading order; saloks by a different Guru than the '
                        'pauris are the famous cross-voice editorial structure'}
    except sqlite3.OperationalError:
        return {'vaar': None, 'units': []}
    return _FALLTHROUGH


ANG_BIN = 100      # Ang strip: 15 bins of 100 Angs (the last holds Angs 1401-1430)
ANG_BINS = 15


def _lens(qs):
    """The Constellation lens: optional filters every constellation query shares, compiled into
    one parameterised WHERE fragment over `lines l`. Echoed back so a client can show what is on.
    author / raag: one voice or raag · raags: a comma list (the "This hour" lens) · rahao=1: refrains
    only · min_themes=N: verses carrying at least N themes · ang_min/ang_max: an Ang-strip bin."""
    au = qs.get('author', [''])[0].strip()
    rg = qs.get('raag', [''])[0].strip()
    rgs = [r.strip() for r in qs.get('raags', [''])[0].split(',') if r.strip()][:40]
    rahao = qs.get('rahao', [''])[0].strip() in ('1', 'true')
    min_themes = _int(qs, 'min_themes', 0, 0, 8)
    ang_min = _int(qs, 'ang_min', 1, 1, 1430)
    ang_max = _int(qs, 'ang_max', 1430, 1, 1430)
    where, params = [], []
    if au:
        where.append("l.author=?"); params.append(au)
    if rg:
        where.append("l.raag=?"); params.append(rg)
    if rgs:
        where.append(f"l.raag IN ({','.join('?' * len(rgs))})"); params += rgs
    if rahao:
        where.append("l.is_rahao=1")
    if min_themes > 1:
        where.append("(SELECT COUNT(*) FROM concept_lines x WHERE x.line_id=l.id)>=?"); params.append(min_themes)
    if ang_min > 1 or ang_max < 1430:
        where.append("l.ang BETWEEN ? AND ?"); params += [ang_min, ang_max]
    echo = {'author': au, 'raag': rg, 'raags': rgs, 'rahao': rahao, 'min_themes': min_themes,
            'ang_min': ang_min, 'ang_max': ang_max}
    return (' AND ' + ' AND '.join(where) if where else ''), params, echo


def _route_analytics_constellation(p, qs):   # Concept Constellation
    # No ?concept= → the dropdown list (every concept + its verse count).
    # ?concept=X → X's verses grouped into sub-constellations by each verse's co-themes (`clusters`,
    # v1: a verse sits in every co-theme bucket it shares, so cluster counts overlap), plus the v2
    # Focus model: an additive split (total = solo + shared), every companion with its verse count
    # and the corpus bond (PPMI, Jaccard over shabads), and the 15-bin Ang strip. Read-only.
    c = qs.get('concept', [''])[0].strip()
    try:
        if not c:
            concepts = rows_to_list(db().execute(
                "SELECT concept, n FROM ("
                "  SELECT concept, COUNT(DISTINCT line_id) n FROM concept_lines GROUP BY concept"
                ") ORDER BY n DESC"))
            authors = [r[0] for r in db().execute(
                "SELECT DISTINCT author FROM lines WHERE author IS NOT NULL AND author <> '' ORDER BY author")]
            raags = rows_to_list(db().execute("SELECT name, roman FROM raags ORDER BY rowid"))
            return {'concepts': concepts, 'authors': authors, 'raags': raags,
                    'note': 'corpus-verified theme tags; counts are descriptive only'}
        lw, lp, lens = _lens(qs)
        au, rg = lens['author'], lens['raag']
        where, params = "cl.concept=?" + lw, [c] + lp
        total = db().execute(
            f"SELECT COUNT(DISTINCT cl.line_id) FROM concept_lines cl JOIN lines l ON l.id=cl.line_id WHERE {where}",
            params).fetchone()[0]
        if not total:
            return {'concept': c, 'author': au, 'raag': rg, 'lens': lens, 'total': 0, 'solo': 0, 'shared': 0,
                    'clusters': [], 'companions': [], 'ang_bins': [0] * ANG_BINS}
        MAX_CLUSTERS, PER = 9, 40
        rows = db().execute(
            "SELECT co.concept co, l.id, l.ang, l.comp_id, l.gurmukhi "
            "FROM concept_lines cl JOIN concept_lines co ON co.line_id=cl.line_id AND co.concept<>cl.concept "
            f"JOIN lines l ON l.id=cl.line_id WHERE {where} ORDER BY co.concept, l.id", params).fetchall()
        buckets, shared_ids = {}, set()
        for r in rows:
            shared_ids.add(r['id'])
            buckets.setdefault(r['co'], []).append(
                {'id': r['id'], 'ang': r['ang'], 'comp_id': r['comp_id'], 'gurmukhi': r['gurmukhi']})
        clusters = sorted(({'co': k, 'n': len(v), 'verses': v[:PER]} for k, v in buckets.items()),
                          key=lambda x: x['n'], reverse=True)[:MAX_CLUSTERS]
        bonds = {r['target']: r for r in db().execute(
            "SELECT target, ppmi, jaccard, shabad_count FROM theme_network WHERE source=?", (c,))}
        companions = []
        for co, vs in buckets.items():
            b = bonds.get(co)
            companions.append({'co': co, 'n': len(vs),
                               'ppmi': b['ppmi'] if b else 0.0, 'jaccard': b['jaccard'] if b else 0.0,
                               'shabad_count': b['shabad_count'] if b else 0})
        companions.sort(key=lambda x: (-x['n'], x['co']))
        bins = [0] * ANG_BINS
        for (ang,) in db().execute(
                f"SELECT l.ang FROM concept_lines cl JOIN lines l ON l.id=cl.line_id WHERE {where}", params):
            bins[min(ANG_BINS - 1, (ang - 1) // ANG_BIN)] += 1
        shared = len(shared_ids)
        return {'concept': c, 'author': au, 'raag': rg, 'lens': lens, 'total': total,
                'solo': total - shared, 'shared': shared, 'clusters': clusters,
                'companions': companions, 'ang_bins': bins,
                'note': 'total = solo + shared: a verse is "shared" when it also carries another theme. A '
                        'companion\'s n counts the verses carrying both themes, so companion counts overlap '
                        'by design (a verse with three themes counts under two companions). PPMI and Jaccard '
                        'are the corpus bond between the two themes over shabads. Descriptive structure, '
                        'never a ranking of scripture'}
    except sqlite3.OperationalError:
        return {'concepts': [], 'clusters': [], 'note': 'concept tables not present in this DB build'}
    return _FALLTHROUGH


def _route_analytics_sky(p, qs):   # /api/analytics/sky — the whole theme network at once
    try:
        min_ppmi = float(qs.get('min_ppmi', ['0.7'])[0])
    except (TypeError, ValueError):
        min_ppmi = 0.7
    if not math.isfinite(min_ppmi):
        min_ppmi = 0.7
    min_ppmi = max(0.0, min(4.0, min_ppmi))
    try:
        nodes = rows_to_list(db().execute(
            "SELECT concept, COUNT(DISTINCT line_id) n FROM concept_lines GROUP BY concept ORDER BY concept"))
        edges = rows_to_list(db().execute(
            "SELECT source, target, ppmi, jaccard, shabad_count FROM theme_network "
            "WHERE source < target AND ppmi>=? ORDER BY source, target", (min_ppmi,)))
        return {'nodes': nodes, 'edges': edges, 'min_ppmi': min_ppmi,
                'note': 'every theme with its verse count; edges are theme pairs whose PPMI (co-occurrence '
                        'within shabads, base-rate controlled) clears min_ppmi. Descriptive only'}
    except sqlite3.OperationalError:
        return {'nodes': [], 'edges': [], 'note': 'analytics tables not present in this DB build'}
    return _FALLTHROUGH


def _route_analytics_pair(p, qs):   # /api/analytics/pair?concept=a&with=b — verses carrying both themes
    # alone=1 instead of with=b: the theme's solo verses (no other theme), the Focus view's halo.
    a = qs.get('concept', [''])[0].strip()
    b = qs.get('with', [''])[0].strip()
    alone = qs.get('alone', [''])[0].strip() in ('1', 'true')
    if not a or (alone and b) or (not alone and (not b or a == b)):
        raise ValueError('pair requires a concept and either a different theme (with) or alone=1')
    off = _int(qs, 'offset', 0, 0, 100000)
    lim = _int(qs, 'limit', 50, 1, 200)
    lw, lp, lens = _lens(qs)
    try:
        if alone:
            base = ("FROM concept_lines ca JOIN lines l ON l.id=ca.line_id WHERE ca.concept=? AND NOT EXISTS "
                    f"(SELECT 1 FROM concept_lines o WHERE o.line_id=ca.line_id AND o.concept<>ca.concept){lw}")
            params, cols = [a] + lp, "ca.term term_a, NULL term_b"
        else:
            base = ("FROM concept_lines ca JOIN concept_lines cb ON cb.line_id=ca.line_id AND cb.concept=? "
                    f"JOIN lines l ON l.id=ca.line_id WHERE ca.concept=?{lw}")
            params, cols = [b, a] + lp, "ca.term term_a, cb.term term_b"
        total = db().execute(f"SELECT COUNT(*) {base}", params).fetchone()[0]
        rows = db().execute(
            f"SELECT l.id, l.ang, l.comp_id, l.raag, l.author, l.is_rahao, l.gurmukhi, l.translit, {cols} "
            f"{base} ORDER BY l.id LIMIT ? OFFSET ?", params + [lim, off]).fetchall()
        shabads = []
        for r in rows:   # consecutive verses of one shabad share a group (ids are in reading order)
            if not shabads or shabads[-1]['comp_id'] != r['comp_id']:
                shabads.append({'comp_id': r['comp_id'], 'ang': r['ang'], 'raag': r['raag'],
                                'author': r['author'], 'verses': []})
            shabads[-1]['verses'].append({'id': r['id'], 'ang': r['ang'], 'is_rahao': r['is_rahao'],
                                          'gurmukhi': r['gurmukhi'], 'translit': r['translit'],
                                          'terms': [r['term_a']] if alone else [r['term_a'], r['term_b']]})
        bond = None if alone else db().execute(
            "SELECT ppmi, jaccard, shabad_count FROM theme_network WHERE source=? AND target=?", (a, b)).fetchone()
        return {'concept': a, 'with': None if alone else b, 'alone': alone, 'lens': lens, 'total': total,
                'offset': off, 'limit': lim, 'bond': dict(bond) if bond else None, 'shabads': shabads,
                'note': 'each verse carries one verified Gurmukhi word of each theme (terms, in the order '
                        'concept, with; alone=1: the one word, and no other theme): a word match, not an '
                        'interpretation. Text is verbatim'}
    except sqlite3.OperationalError:
        return {'concept': a, 'with': b, 'total': 0, 'shabads': [], 'note': 'concept tables not present in this DB build'}
    return _FALLTHROUGH


def _route_analytics_theme(p, qs):   # /api/analytics/theme?concept=x — the theme card
    c = qs.get('concept', [''])[0].strip()
    if not c:
        raise ValueError('theme requires a concept')
    try:
        row = db().execute("SELECT concept, gurmukhi_terms, description FROM concepts WHERE concept=?", (c,)).fetchone()
        if not row:
            raise ApiError(404, 'unknown theme')
        try:
            terms = json.loads(row['gurmukhi_terms'] or '[]')
        except ValueError:
            terms = []
        n_verses, n_shabads, n_rahao = db().execute(
            "SELECT COUNT(DISTINCT cl.line_id), COUNT(DISTINCT l.comp_id), "
            "COUNT(DISTINCT CASE WHEN l.is_rahao=1 THEN l.id END) "
            "FROM concept_lines cl JOIN lines l ON l.id=cl.line_id WHERE cl.concept=?", (c,)).fetchone()

        def fp(kind):
            return rows_to_list(db().execute(
                "SELECT entity_id, n_tagged, entity_rate, corpus_rate, lift FROM theme_fingerprint "
                "WHERE entity_type=? AND concept=? AND is_reliable=1 AND lift>1 "
                "ORDER BY lift DESC, entity_id LIMIT 5", (kind, c)))
        return {'concept': c, 'description': row['description'], 'terms': terms,
                'n_verses': n_verses, 'n_shabads': n_shabads, 'n_rahao': n_rahao,
                'raags': fp('raag'), 'authors': fp('author'),
                'note': 'raags and authors where this theme concentrates: lift = the entity\'s rate over the '
                        'corpus rate, shown only where the sample is reliable. Descriptive, never a ranking'}
    except sqlite3.OperationalError:
        return {'concept': c, 'note': 'concept tables not present in this DB build'}
    return _FALLTHROUGH


def _route_related(p, qs):   # /api/related?comp_id=N
    cid = _int(qs, 'comp_id', 0, 0, _ID_MAX)
    try:
        rows = db().execute(
            "SELECT n.neighbor_comp_id AS comp_id, n.rank, n.score, "
            "(SELECT ang FROM lines WHERE comp_id=n.neighbor_comp_id ORDER BY id LIMIT 1) AS ang, "
            "(SELECT raag FROM lines WHERE comp_id=n.neighbor_comp_id AND raag IS NOT NULL LIMIT 1) AS raag, "
            "(SELECT gurmukhi FROM lines WHERE comp_id=n.neighbor_comp_id AND is_header=0 ORDER BY id LIMIT 1) AS first_line "
            "FROM shabad_neighbors n WHERE n.comp_id=? ORDER BY n.rank", (cid,)).fetchall()
        return {'comp_id': cid, 'related': rows_to_list(rows),
                'note': 'shabads with the most similar theme profile (corpus-verified themes)'}
    except sqlite3.OperationalError:
        return {'comp_id': cid, 'related': [], 'note': 'analytics tables not present in this DB build'}
    return _FALLTHROUGH


def _route_line_concepts(p, qs):   # /api/line_concepts?ids=1,2,3  (Study Trail)
    raw = qs.get('ids', [''])[0]
    ids = [int(x) for x in raw.split(',') if x.strip().isdigit() and len(x.strip()) <= 12][:300]
    out = {}
    if ids:
        ph = ','.join('?' * len(ids))
        try:
            for lid, concept in db().execute(
                    f"SELECT line_id, concept FROM concept_lines WHERE line_id IN ({ph})", ids):
                out.setdefault(str(lid), []).append(concept)
        except sqlite3.OperationalError:
            pass
    return {'concepts': out, 'note': 'corpus-verified theme tags per line; descriptive only'}
    return _FALLTHROUGH


def _route_neighbors(p, qs):   # /api/neighbors?line_id=N  (Phase 2: semantic)
    lid = _int(qs, 'line_id', 0, 0, _ID_MAX)
    lim = _int(qs, 'limit', 10, 1, 50)
    srow = db().execute("SELECT id, ang, raag, author, comp_id, gurmukhi, translit "
                        "FROM lines WHERE id=?", (lid,)).fetchone()
    src_line = attach_translations([dict(srow)])[0] if srow else None   # the queried verse itself
    try:                                                 # preferred: line-level embedding neighbours
        rows = db().execute(
            "SELECT n.neighbor_id AS id, n.score, l.ang, l.raag, l.author, l.comp_id, "
            "l.gurmukhi, l.translit FROM line_neighbors n JOIN lines l ON l.id = n.neighbor_id "
            "WHERE n.line_id = ? ORDER BY n.score DESC LIMIT ?", (lid, lim)).fetchall()
        if rows:
            src = db().execute(
                "SELECT value FROM analytics_meta WHERE key='line_neighbors_source'").fetchone()
            return {'line_id': lid, 'level': 'line', 'source': (src[0] if src else 'unknown'),
                    'line': src_line, 'neighbors': attach_translations(rows_to_list(rows)),
                    'note': 'lines whose English meaning is closest by embedding cosine; '
                            'descriptive, never a ranking of scripture'}
    except sqlite3.OperationalError:
        pass
    try:                                                 # fallback: composition-level theme profile
        row = db().execute("SELECT comp_id FROM lines WHERE id=?", (lid,)).fetchone()
        if not row:
            return {'line_id': lid, 'level': 'none', 'neighbors': []}
        cid = row[0]
        rows = db().execute(
            "SELECT n.neighbor_comp_id AS comp_id, n.rank, n.score, "
            "(SELECT ang FROM lines WHERE comp_id=n.neighbor_comp_id ORDER BY id LIMIT 1) AS ang, "
            "(SELECT raag FROM lines WHERE comp_id=n.neighbor_comp_id AND raag IS NOT NULL LIMIT 1) AS raag, "
            "(SELECT gurmukhi FROM lines WHERE comp_id=n.neighbor_comp_id AND is_header=0 ORDER BY id LIMIT 1) AS gurmukhi "
            "FROM shabad_neighbors n WHERE n.comp_id=? ORDER BY n.rank LIMIT ?", (cid, lim)).fetchall()
        return {'line_id': lid, 'level': 'composition', 'source': 'shabad-theme-profile',
                'line': src_line, 'neighbors': rows_to_list(rows),
                'note': 'line-level semantic vectors not built yet — showing compositions with the '
                        'closest theme profile. Run pipeline/build_semantic_vectors.py for line-level results'}
    except sqlite3.OperationalError:
        return {'line_id': lid, 'level': 'none', 'line': src_line, 'neighbors': []}
    return _FALLTHROUGH
