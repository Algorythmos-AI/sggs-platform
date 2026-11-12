# -*- coding: utf-8 -*-
"""The Hukamnama pages: /{lang}/hukamnama (today) and /{lang}/hukamnama/YYYY-MM-DD (one day).

These are the only HTML pages this server renders. Every other page is a static file; these
change each morning, and a crawler or a share card must see the day's shabad in the first bytes,
so the page is filled here from a **shell** the site build produces (one per language) and the
day's record from the public Hukamnama API.

Off unless both are present: ``HUKAMNAMA_API`` (the public API's origin) and a shell for the
language under ``hukamnama_shells/``. Without them the paths are not handled here at all.

Fidelity (the rules this module exists to keep):

  * The API is asked for one **date**, never "today"; the answer must name that same date.
  * From the API's answer only the line-id range and its ``range_sha256`` are used. Every
    Gurmukhi line, its transliteration and (when the meaning layer is on upstream) its English
    come from **this server's own corpus**, and the page is rendered only after those lines
    hash to ``range_sha256``. A mismatch renders "unavailable" (503), never text.
  * Nothing is labelled "today" unless its date is the Amritsar date at render time. Before the
    morning's publication the page shows the most recent Hukamnama under that Hukamnama's own date.
  * Every value placed in the page is HTML-escaped; the JSON-LD is serialised with ``<`` escaped.

The shell contract (``frontend`` builds it; ``tests/fixtures/hukamnama-shell.html`` is a minimal one):

  ``__HK_<NAME>__``                      replaced with an escaped value (``values`` in ``render``);
                                         ``__HK_SUFFIX__`` is "" or "/YYYY-MM-DD", so the shell can
                                         write "/{lang}/hukamnama__HK_SUFFIX__" for its own URL
  ``__HK_IF_<FLAG>__ … __HK_ENDIF__``    kept when the flag is set, removed otherwise (may be nested)
  ``<script type="application/json" id="hk-strings">{…}</script>``   the language's words and
                                         patterns (removed from the output); keys in ``STRING_KEYS``,
                                         plus the optional ``date_first`` and ``name`` (the
                                         section's name, for the breadcrumb trail)
"""
import hashlib
import html
import json
import os
import re
import threading
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone

from sggs import core

HERE = os.path.dirname(os.path.abspath(__file__))
SHELL_DIR = os.path.join(HERE, 'hukamnama_shells')
SITE = 'https://gurbanisoul.com'
IST = timezone(timedelta(hours=5, minutes=30))        # Amritsar: a fixed offset, no DST
EARLIEST = date(2026, 11, 1)                          # no Hukamnama page exists before this date
NOT_TODAY_AFTER = 14                                  # IST hour after which "not published today" is said
MAX_LINES = 400
FETCH_TIMEOUT = 2.0
FRESH_TODAY, FRESH_PAST, FRESH_PENDING, NEGATIVE = 60.0, 3600.0, 20.0, 10.0   # memo lifetimes (seconds)

PATH_RE = re.compile(r'^/([a-z]{2})/hukamnama(?:/(\d{4}-\d{2}-\d{2}))?/?$')
HEX64 = re.compile(r'^[0-9a-f]{64}$')
# An innermost block (one holding no other block); applied until none is left, so blocks may nest.
IF_RE = re.compile(r'__HK_IF_([A-Z0-9]+(?:_[A-Z0-9]+)*)__((?:(?!__HK_IF_).)*?)__HK_ENDIF__', re.S)
TOKEN_RE = re.compile(r'__HK_([A-Z0-9]+(?:_[A-Z0-9]+)*)__')
STRINGS_RE = re.compile(r'<script type="application/json" id="hk-strings">(.*?)</script>', re.S)
STRING_KEYS = ('months', 'date', 'title_today', 'title_dated', 'h1_today', 'h1_dated', 'description',
               'description_none', 'status_before', 'status_not_today', 'status_none', 'status_missing',
               'citation', 'translation_label', 'rahao_label')

_days = {'memo': None, 'good': None}    # the published dates: (fetched monotonic, 'ok' | 'error', value), last good list
_memo = {}                 # date iso -> (fetched monotonic, kind, value)   kind: 'published' | 'pending' | 'error'
_good = {}                 # date iso -> proven day (never expires: it was proven against this corpus)
_shells = {}               # lang -> (mtime, html, strings)
_lock = threading.Lock()


class Unavailable(Exception):
    """The day cannot be shown: upstream unreachable, a malformed answer, or lines that do not prove."""


def api_base():
    base = (os.environ.get('HUKAMNAMA_API') or '').rstrip('/')
    ok = base.startswith('https://') or base.startswith(('http://127.0.0.1:', 'http://localhost:'))
    return base if ok else ''


def amritsar_now(now):
    return now.astimezone(IST)


# -- the shell ----------------------------------------------------------------------------------
def load_shell(lang):
    """(html, strings) for a language, or None when the build has not provided a usable shell."""
    if not re.fullmatch(r'[a-z]{2}', lang):
        return None
    path = os.path.join(SHELL_DIR, lang + '.html')
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        return None
    with _lock:
        hit = _shells.get(lang)
        if hit and hit[0] == mtime:
            return hit[1], hit[2]
    with open(path, encoding='utf-8') as f:
        text = f.read()
    m = STRINGS_RE.search(text)
    try:
        strings = json.loads(m.group(1)) if m else None
    except ValueError:
        strings = None
    if not isinstance(strings, dict) or any(k not in strings for k in STRING_KEYS) \
            or not isinstance(strings['months'], list) or len(strings['months']) != 12:
        return None                         # a shell without its words is not served
    text = text[:m.start()] + text[m.end():]
    with _lock:
        _shells[lang] = (mtime, text, strings)
    return text, strings


# -- the day's record ---------------------------------------------------------------------------
def _http_get(url):
    req = urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': 'gurbanisoul-web'})
    with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT) as r:
        return json.loads(r.read(2_000_000).decode('utf-8'))


FETCH = _http_get          # tests replace this


def _upstream(day):
    """('published', record) or ('pending', latest date or None) for one date, straight from the API."""
    try:
        body = FETCH(f'{api_base()}/v1/hukamnama/{day.isoformat()}')
    except urllib.error.HTTPError as e:
        if e.code == 404:                   # "not yet": the API's clock has not reached this date
            return 'pending', None
        raise
    if not isinstance(body, dict) or body.get('amritsar_date') != day.isoformat():
        raise Unavailable('the API answered for another date')
    if body.get('status') == 'pending':
        latest = body.get('latest')
        try:
            return 'pending', date.fromisoformat(latest) if isinstance(latest, str) else None
        except ValueError:
            raise Unavailable('malformed latest date')
    if body.get('status') != 'published':
        raise Unavailable('unknown status')
    return 'published', published_record(body, day)


def published_record(body, day):
    """What is used of a published day's API record: the line-id range, its hash and when it was
    published. Raises ``Unavailable`` when any of it is malformed."""
    first, last, digest = body.get('first_line_id'), body.get('last_line_id'), body.get('range_sha256')
    if type(first) is not int or type(last) is not int or not isinstance(digest, str) or not HEX64.match(digest) \
            or first < 1 or last < first or last - first >= MAX_LINES:
        raise Unavailable('malformed record')
    published_at, corrected_at = body.get('published_at'), body.get('corrected_at')
    return {'date': day, 'first': first, 'last': last, 'range_sha256': digest,
            'published_at': published_at if isinstance(published_at, str) else None,
            'corrected_at': corrected_at if isinstance(corrected_at, str) else None,
            'meaning': isinstance(body.get('translation'), dict)}


def _prove(rec):
    """The day, with its lines read from this server's corpus and proven against the range hash."""
    con = core.db()
    rows = con.execute('SELECT id, ang, is_header, is_rahao, gurmukhi, translit, author, raag FROM lines '
                       'WHERE id BETWEEN ? AND ? ORDER BY id', (rec['first'], rec['last'])).fetchall()
    if [r['id'] for r in rows] != list(range(rec['first'], rec['last'] + 1)):
        raise Unavailable('range missing from this corpus')
    joined = '\n'.join((r['gurmukhi'] or '') for r in rows).encode('utf-8')
    if hashlib.sha256(joined).hexdigest() != rec['range_sha256']:
        raise Unavailable('lines do not match range_sha256')
    english = {}
    if rec['meaning']:
        english = dict(con.execute("SELECT line_id, text FROM translations WHERE lang='en' AND "
                                   "source='ssk-shabados' AND line_id BETWEEN ? AND ?",
                                   (rec['first'], rec['last'])).fetchall())
    lines = [{'id': r['id'], 'ang': r['ang'], 'heading': bool(r['is_header']), 'rahao': bool(r['is_rahao']),
              'gurmukhi': r['gurmukhi'] or '', 'translit': r['translit'] or '', 'author': r['author'],
              'raag': r['raag'], 'en': english.get(r['id']) or ''} for r in rows]
    verses = [x for x in lines if not x['heading']]
    if not verses:
        raise Unavailable('range holds no verse')
    authors = {x['author'] for x in verses}
    return {'date': rec['date'], 'lines': lines, 'ang': verses[0]['ang'], 'ang_end': lines[-1]['ang'],
            'raag': verses[0]['raag'], 'author': authors.pop() if len(authors) == 1 else None,
            'range_sha256': rec['range_sha256'], 'published_at': rec['published_at'],
            'corrected_at': rec.get('corrected_at'),
            'meaning': any(x['en'] for x in lines)}


def day_state(day, today, clock=time.monotonic):
    """('published', proven day) | ('pending', latest date or None) for a date.

    Answers are remembered briefly so a burst of requests asks the API once. When the API cannot
    be reached, a day already proven here is still served (it was proven against this corpus);
    otherwise ``Unavailable`` is raised."""
    key, now = day.isoformat(), clock()
    with _lock:
        hit = _memo.get(key)
    if hit:
        age, kind = now - hit[0], hit[1]
        fresh = {'published': FRESH_TODAY if day == today else FRESH_PAST, 'pending': FRESH_PENDING,
                 'error': NEGATIVE}[kind]
        if age < fresh:
            if kind == 'error':
                good = _good.get(key)
                if good:
                    return 'published', good
                raise Unavailable(hit[2])
            return kind, hit[2]
    try:
        kind, value = _upstream(day)
        if kind == 'published':
            value = _prove(value)
    except Unavailable as e:
        problem = str(e)
    except (urllib.error.URLError, OSError, ValueError) as e:
        problem = type(e).__name__
    else:
        with _lock:
            _memo[key] = (now, kind, value)
            if kind == 'published':
                _good[key] = value
            else:
                _good.pop(key, None)        # the day was withdrawn (held): stop serving it
        return kind, value
    with _lock:
        _memo[key] = (now, 'error', problem)
        good = _good.get(key)
    if good:
        return 'published', good
    raise Unavailable(problem)


def _fetch_days(today):
    """Every published date the API lists, oldest first: [{'date', 'published_at'}]. No text."""
    try:
        items = (FETCH(f'{api_base()}/v1/hukamnama/index') or {}).get('days')
    except urllib.error.HTTPError as e:
        if e.code not in (400, 404):
            raise
        # an API that has no index yet: its list of the latest days (at most 30)
        items = [x for x in (FETCH(f'{api_base()}/v1/hukamnama?limit=30') or {}).get('items') or []
                 if isinstance(x, dict) and x.get('status') == 'published']
    if not isinstance(items, list):
        raise Unavailable('malformed index')
    days = {}
    for x in items:
        try:
            d = date.fromisoformat(x.get('amritsar_date') or '')
        except (AttributeError, TypeError, ValueError):
            continue
        if EARLIEST <= d <= today:           # never a day ahead of the Amritsar date, whatever is listed
            at = x.get('published_at')
            days[d] = {'date': d, 'published_at': at if isinstance(at, str) else None}
    return [days[d] for d in sorted(days)]


def published_days(today, clock=time.monotonic):
    """The published dates, oldest first, for the sitemap and the previous/next links. Remembered
    for a minute; when the API cannot be reached the last list is used. Raises ``Unavailable``
    when there is none."""
    now = clock()
    with _lock:
        hit, good = _days['memo'], _days['good']
    if hit and now - hit[0] < (FRESH_TODAY if hit[1] == 'ok' else NEGATIVE):
        if hit[1] == 'ok' or good is not None:
            return [x for x in (hit[2] if hit[1] == 'ok' else good) if x['date'] <= today]
        raise Unavailable(hit[2])
    try:
        days = _fetch_days(today)
    except Unavailable as e:
        problem = str(e)
    except (urllib.error.URLError, OSError, ValueError) as e:
        problem = type(e).__name__
    else:
        with _lock:
            _days['memo'], _days['good'] = (now, 'ok', days), days
        return days
    with _lock:
        _days['memo'] = (now, 'error', problem)
        good = _days['good']
    if good is not None:
        return [x for x in good if x['date'] <= today]
    raise Unavailable(problem)


def neighbours(day, today):
    """(the published date before ``day``, the one after it); None where there is none, or
    when the list of dates is not available (the page is then shown without these links)."""
    try:
        dates = [x['date'] for x in published_days(today)]
    except Unavailable:
        return None, None
    before, after = [d for d in dates if d < day], [d for d in dates if d > day]
    return (before[-1] if before else None), (after[0] if after else None)


def reset():
    """Forget everything remembered (tests)."""
    with _lock:
        _memo.clear(); _good.clear(); _shells.clear()
        _days['memo'] = _days['good'] = None


# -- rendering ----------------------------------------------------------------------------------
def _fmt(pattern, **kw):
    out = str(pattern)
    for k, v in kw.items():
        out = out.replace('{' + k + '}', str(v))
    return out


def _date_text(strings, d):
    # ``date_first`` (optional) is the pattern for the 1st of a month, where a language writes it
    # differently (French "1er novembre").
    pattern = strings.get('date_first') if d.day == 1 and strings.get('date_first') else strings['date']
    return _fmt(pattern, d=d.day, month=strings['months'][d.month - 1], y=d.year)


def _corrected_on(day):
    """The Amritsar date a day was corrected on, or None."""
    try:
        t = datetime.fromisoformat((day or {}).get('corrected_at') or '')
    except (TypeError, ValueError):
        return None
    return t.astimezone(IST).date() if t.tzinfo is not None else None


def _lines_html(day, strings):
    e = html.escape
    out = []
    for x in day['lines']:
        cls = 'hk-line' + (' hk-heading' if x['heading'] else '') + (' hk-rahao' if x['rahao'] else '')
        out.append(f'<div class="{cls}" data-line="{x["id"]}">')
        out.append(f'<p class="hk-gm gm" lang="pa" data-gm="{e(x["gurmukhi"], quote=True)}">{e(x["gurmukhi"])}</p>')
        if x['rahao']:
            out.append(f'<span class="hk-rahao-label">{e(strings["rahao_label"])}</span>')
        if x['translit']:
            out.append(f'<p class="hk-tl" lang="pa-Latn">{e(x["translit"])}</p>')
        if x['en']:
            out.append(f'<p class="hk-en" lang="en">{e(x["en"])}</p>')
        out.append('</div>')
    return ''.join(out)


def _jsonld(lang, canonical, title, description, day, name=None, dated=None):
    """The page's structured data. With the section's ``name`` (a shell string) a breadcrumb
    trail is added: the site, the Hukamnama page and, on a dated page, that date."""
    page = {'@context': 'https://schema.org', '@type': 'WebPage', 'url': canonical, 'name': title,
            'description': description, 'inLanguage': lang,
            'isPartOf': {'@type': 'WebSite', 'name': 'Gurbani Soul', 'url': SITE + '/'}}
    if day:
        page['datePublished'] = day['published_at'] or day['date'].isoformat()
        page['dateModified'] = page['datePublished']
        page['mainEntity'] = {'@type': 'CreativeWork', 'inLanguage': 'pa-Guru',
                              'isPartOf': {'@type': 'Book', 'name': 'Sri Guru Granth Sahib Ji'},
                              'position': f'Ang {day["ang"]}'}
    if name:
        trail = [('Gurbani Soul', f'{SITE}/{lang}'), (name, f'{SITE}/{lang}/hukamnama')] + ([(dated, canonical)] if dated else [])
        page = [page, {'@context': 'https://schema.org', '@type': 'BreadcrumbList',
                       'itemListElement': [{'@type': 'ListItem', 'position': i, 'name': n, 'item': url}
                                           for i, (n, url) in enumerate(trail, 1)]}]
    return json.dumps(page, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')


def render(shell, strings, lang, *, view, day, today, hour_ist, path, asked=None, around=(None, None)):
    """The page. ``view`` is 'today' | 'latest' | 'none' | 'dated' | 'missing' | 'unavailable';
    ``asked`` is the date in the URL of a dated page; ``around`` is the published dates before and
    after the day shown (each a link to that day's own page, labelled with its date)."""
    e = html.escape
    canonical = SITE + path
    shown = _date_text(strings, day['date']) if day else ''
    today_text = _date_text(strings, today)
    status = ''
    if view == 'latest':
        status = _fmt(strings['status_before' if hour_ist < NOT_TODAY_AFTER else 'status_not_today'], date=today_text)
    elif view == 'none':
        status = _fmt(strings['status_none'], date=today_text)
    elif view == 'missing':
        status = strings['status_missing']
    if day:
        title = _fmt(strings['title_today' if view == 'today' else 'title_dated'], date=shown)
        h1 = _fmt(strings['h1_today' if view == 'today' else 'h1_dated'], date=shown)
        description = _fmt(strings['description'], date=shown, ang=day['ang'], raag=day['raag'] or '',
                           author=day['author'] or '').strip()
    else:
        about = _date_text(strings, asked) if asked else today_text
        title = _fmt(strings['title_dated'], date=about)
        h1 = _fmt(strings['h1_dated'], date=about)
        description = strings['description_none']
    flags = {'SHABAD': bool(day), 'STATUS': bool(status), 'TODAY': view == 'today', 'LATEST': view == 'latest',
             'DATED': view == 'dated', 'MEANING': bool(day and day['meaning']),
             'UNAVAILABLE': view == 'unavailable', 'RAAG': bool(day and day['raag']),
             'AUTHOR': bool(day and day['author']),
             'PREV': bool(day and around[0]), 'NEXT': bool(day and around[1]),
             'DAYS': bool(day and (around[0] or around[1]))}
    # A day whose range was corrected after it was published says so, with the Amritsar date it
    # was corrected on. A correction time that is not a time shows nothing.
    corrected = _corrected_on(day)
    flags['CORRECTED'] = corrected is not None
    step = {k: (f'/{lang}/hukamnama/{d.isoformat()}', _date_text(strings, d)) if d else ('', '')
            for k, d in zip(('PREV', 'NEXT'), around)}
    values = {
        'TITLE': e(title), 'H1': e(h1), 'DESCRIPTION': e(description, quote=True),
        'CANONICAL': e(canonical, quote=True),
        'SUFFIX': e(f'/{asked.isoformat()}' if asked else '', quote=True),   # after "/{lang}/hukamnama" in every URL
        'ROBOTS': 'index, follow' if view in ('today', 'latest', 'dated') else 'noindex, follow',
        'STATUS': e(status), 'DATE': e(shown), 'DATE_ISO': e(day['date'].isoformat() if day else '', quote=True),
        'ANG': str(day['ang']) if day else '', 'RAAG': e(day['raag'] or '') if day else '',
        'AUTHOR': e(day['author'] or '') if day else '',
        'CITATION': e(_fmt(strings['citation'], ang=day['ang'])) if day else '',
        'READER_HREF': e(f'/reader?ang={day["ang"]}&line={day["lines"][0]["id"]}', quote=True) if day else '',
        'PERMALINK': e(f'/{lang}/hukamnama/{day["date"].isoformat()}', quote=True) if day else '',
        'RANGE_SHA': day['range_sha256'] if day else '',
        'TRANSLATION_LABEL': e(strings['translation_label']),
        'LINES': _lines_html(day, strings) if day else '',
        'CORRECTED_DATE': e(_date_text(strings, corrected)) if corrected else '',
        'PREV_HREF': e(step['PREV'][0], quote=True), 'PREV_DATE': e(step['PREV'][1]),
        'NEXT_HREF': e(step['NEXT'][0], quote=True), 'NEXT_DATE': e(step['NEXT'][1]),
        'JSONLD': _jsonld(lang, canonical, title, description, day, name=strings.get('name'),
                          dated=_date_text(strings, asked) if asked else None),
    }
    out, n = shell, 1
    while n:
        out, n = IF_RE.subn(lambda m: m.group(2) if flags.get(m.group(1)) else '', out)
    return TOKEN_RE.sub(lambda m: values.get(m.group(1), ''), out)


# -- the request --------------------------------------------------------------------------------
def _cache_for(view, now):
    if view == 'today':
        ist = amritsar_now(now)
        to_midnight = int((datetime.combine(ist.date() + timedelta(days=1), datetime.min.time(), IST) - ist).total_seconds())
        n = max(1, min(60, to_midnight))        # never cached past the Amritsar day it is "today" for
        return f'public, max-age={n}, s-maxage={n}'
    if view == 'dated':
        return 'public, max-age=300, s-maxage=86400'
    if view in ('latest', 'none', 'missing'):
        return 'public, max-age=20, s-maxage=20'
    return 'no-store'


def page_for(lang, day_arg, now):
    """(status, html, cache) for a matched path, or None when this module does not serve it."""
    if not api_base():
        return None
    loaded = load_shell(lang)
    if loaded is None:
        return None
    shell, strings = loaded
    ist = amritsar_now(now)
    today, hour = ist.date(), ist.hour
    path = f'/{lang}/hukamnama' + (f'/{day_arg}' if day_arg else '')

    asked = None

    def out(status, view, day=None):
        around = neighbours(day['date'], today) if day else (None, None)
        body = render(shell, strings, lang, view=view, day=day, today=today, hour_ist=hour, path=path, asked=asked,
                      around=around)
        return status, body, _cache_for(view, now) if status == 200 else 'no-store'

    try:
        if day_arg:
            try:
                want = date.fromisoformat(day_arg)
            except ValueError:
                return 404, None, 'no-store'
            if want > today or want < EARLIEST:
                return 404, None, 'no-store'
            asked = want
            kind, value = day_state(want, today)
            return out(200, 'dated', value) if kind == 'published' else out(200, 'missing')
        kind, value = day_state(today, today)
        if kind == 'published':
            return out(200, 'today', value)
        if value is None or value >= today or value < EARLIEST:
            return out(200, 'none')
        kind, latest = day_state(value, today)
        return out(200, 'latest', latest) if kind == 'published' else out(200, 'none')
    except Unavailable:
        return out(503, 'unavailable')


def respond(handler, url_path, now=None):
    """Serve the request if it is a Hukamnama page this server is configured for. Returns True
    when a response was written; False leaves the path to the static site."""
    m = PATH_RE.match(url_path)
    if not m:
        return False
    try:
        result = page_for(m.group(1), m.group(2), now or datetime.now(timezone.utc))
    except Exception:
        import sys, traceback
        traceback.print_exc(file=sys.stderr)
        result = (503, None, 'no-store')
    if result is None:
        return False
    status, body, cache = result
    if body is None:
        if status == 404:
            handler._static_error(404)
            return True
        body = '<!doctype html><title>Temporarily unavailable</title><p>Temporarily unavailable.</p>'
    raw = body.encode('utf-8')
    etag = None
    if status == 200:
        etag = '"' + hashlib.sha256(raw).hexdigest()[:32] + '"'
        if handler.headers.get('If-None-Match') == etag:
            status, raw = 304, b''
    handler.send_response(status)
    handler.send_header('Content-Type', 'text/html; charset=utf-8')
    handler.send_header('Content-Length', str(len(raw)))
    handler.send_header('Cache-Control', cache)
    if etag:
        handler.send_header('ETag', etag)
    if status == 503:
        handler.send_header('Retry-After', '30')
    handler._sec_headers()
    handler.end_headers()
    if handler.command != 'HEAD':
        handler.wfile.write(raw)
    return True
