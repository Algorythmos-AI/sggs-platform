# -*- coding: utf-8 -*-
"""The Hukamnama feeds: /feeds/hukamnama.xml (Atom) and /feeds/hukamnama.json (JSON Feed 1.1).

The most recent published days, newest first, for feed readers and for sites that follow a feed.
Like the pages (``hukamnama_page``), a feed is built here from the public Hukamnama API's records
and **this server's own corpus**, and it is off unless ``HUKAMNAMA_API`` is set.

Fidelity (the same rules as the pages):

  * From the API only each day's date, line-id range, ``range_sha256`` and publication time are
    used. Every Gurmukhi line, its transliteration and (when the meaning layer is on upstream) its
    English come from this server's corpus, and a day enters the feed only after its lines hash to
    ``range_sha256``. A day that does not prove is left out; it is never shown as text.
  * A day dated after the Amritsar date at that moment is left out, whatever the API lists.
  * Titles carry the name and the date only, never scripture. The shabad is in the entry's
    content: the Gurmukhi first, in its own block; transliteration and translation after it, each
    under its own label.
  * Every value is escaped for the format it is written into.
"""
import hashlib
import html
import json
import sys
import threading
import time
import urllib.error
from datetime import date, datetime, timezone

import hukamnama_page as hp

PATHS = {'/feeds/hukamnama.xml': 'atom', '/feeds/hukamnama.json': 'json'}
TYPES = {'atom': 'application/atom+xml; charset=utf-8', 'json': 'application/feed+json; charset=utf-8'}
LIMIT = 30                             # the API's largest page: about a month of days
FRESH, NEGATIVE = 60.0, 10.0           # how long an answer, or a failure, is remembered (seconds)
CACHE = 'public, max-age=120, s-maxage=120'
NAME = 'Hukamnama · Sri Harmandir Sahib'
SUBTITLE = ('The daily Hukamnama from Sri Harmandir Sahib, Amritsar: the verbatim Gurmukhi from '
            'Sri Guru Granth Sahib Ji, cited by Ang.')
CREDIT = ('Located by Ang from the Hukamnama published by SGPC (hs.sgpc.net); text from Sri Guru Granth '
          'Sahib Ji. Not affiliated with SGPC.')
TRANSLATION_LABEL = 'English translation · Dr Sant Singh Khalsa'
MONTHS = ('January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
          'November', 'December')
EPOCH = '2026-11-01T00:00:00+00:00'    # an empty feed's "updated": fixed, so its bytes do not change

_memo = None               # (fetched monotonic, 'ok' | 'error', days | problem)
_good = None               # the last list that was fetched and proven
_lock = threading.Lock()


def reset():
    """Forget everything remembered (tests)."""
    global _memo, _good
    with _lock:
        _memo = _good = None


def _xml_safe(text):
    """True when every character may appear in an XML 1.0 document."""
    return all(c in '\t\n\r' or ' ' <= c <= '퟿' or '' <= c <= '�' or c >= '\U00010000' for c in text)


def _fetch(today):
    """The API's latest published days, each proven against this corpus; newest first."""
    body = hp.FETCH(f'{hp.api_base()}/v1/hukamnama?limit={LIMIT}')
    if not isinstance(body, dict) or not isinstance(body.get('items'), list):
        raise hp.Unavailable('malformed list')
    days = {}
    for item in body['items'][:LIMIT]:
        if not isinstance(item, dict) or item.get('status') != 'published':
            continue
        try:
            day = date.fromisoformat(item.get('amritsar_date') or '')
        except (TypeError, ValueError):
            continue
        if day > today or day < hp.EARLIEST or day in days:
            continue
        try:
            proven = hp._prove(hp.published_record(item, day))
        except hp.Unavailable as e:          # left out, and said so; never shown as text
            print(f'hukamnama feed: {day} left out: {e}', file=sys.stderr)
            continue
        if not all(_xml_safe(x['gurmukhi'] + x['translit'] + x['en']) for x in proven['lines']):
            print(f'hukamnama feed: {day} left out: a character XML cannot carry', file=sys.stderr)
            continue
        days[day] = proven
    return [days[d] for d in sorted(days, reverse=True)]


def recent(today, clock=time.monotonic):
    """The proven days for the feed. Remembered briefly; when the API cannot be reached the last
    proven list is served, without any day that is now in the future. Raises ``Unavailable``
    when there is nothing to serve."""
    global _memo, _good
    now = clock()
    with _lock:
        hit, good = _memo, _good
    if hit and now - hit[0] < (FRESH if hit[1] == 'ok' else NEGATIVE):
        if hit[1] == 'ok':
            return [d for d in hit[2] if d['date'] <= today]
        if good is not None:
            return [d for d in good if d['date'] <= today]
        raise hp.Unavailable(hit[2])
    try:
        days = _fetch(today)
    except hp.Unavailable as e:
        problem = str(e)
    except (urllib.error.URLError, OSError, ValueError) as e:
        problem = type(e).__name__
    else:
        with _lock:
            _memo, _good = (now, 'ok', days), days
        return days
    with _lock:
        _memo = (now, 'error', problem)
        good = _good
    if good is not None:
        return [d for d in good if d['date'] <= today]
    raise hp.Unavailable(problem)


# -- what a day says ----------------------------------------------------------------------------
def _when(day):
    """The day's publication time as RFC 3339, or midnight UTC of its date when the API's is unusable."""
    try:
        t = datetime.fromisoformat(day['published_at'] or '')
        if t.tzinfo is not None:
            return t.astimezone(timezone.utc).isoformat(timespec='seconds')
    except (TypeError, ValueError):
        pass
    return f"{day['date'].isoformat()}T00:00:00+00:00"


def title(day):
    d = day['date']
    return f'{NAME} · {d.day} {MONTHS[d.month - 1]} {d.year}'


def citation(day):
    angs = str(day['ang']) if day['ang_end'] == day['ang'] else f"{day['ang']}–{day['ang_end']}"
    return f'Sri Guru Granth Sahib Ji · Ang {angs}'


def permalink(day):
    return f"{hp.SITE}/en/hukamnama/{day['date'].isoformat()}"


def content_html(day):
    """The entry's body: the Gurmukhi block, the citation, then each other layer under its label."""
    e = html.escape
    out = ['<div lang="pa">']
    out += [f"<p>{e(x['gurmukhi'])}</p>" for x in day['lines']]
    out += ['</div>', f'<p>{e(citation(day))}</p>']
    if any(x['translit'] for x in day['lines']):
        out += ['<p><strong>Transliteration</strong></p>', '<div lang="pa-Latn">']
        out += [f"<p>{e(x['translit'])}</p>" for x in day['lines'] if x['translit']]
        out.append('</div>')
    if day['meaning']:
        out += [f'<p><strong>{e(TRANSLATION_LABEL)}</strong></p>', '<div lang="en">']
        out += [f"<p>{e(x['en'])}</p>" for x in day['lines'] if x['en']]
        out.append('</div>')
    out += [f'<p><a href="{e(permalink(day))}">Read this Hukamnama on Gurbani Soul</a></p>', f'<p>{e(CREDIT)}</p>']
    return '\n'.join(out)


def atom(days):
    e = html.escape
    updated = max((_when(d) for d in days), default=EPOCH)
    out = ['<?xml version="1.0" encoding="utf-8"?>',
           '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">',
           f'<title>{e(NAME)}</title>',
           f'<subtitle>{e(SUBTITLE)}</subtitle>',
           f'<id>{e(hp.SITE)}/feeds/hukamnama.xml</id>',
           f'<link rel="self" type="application/atom+xml" href="{e(hp.SITE)}/feeds/hukamnama.xml"/>',
           f'<link rel="alternate" type="text/html" href="{e(hp.SITE)}/en/hukamnama"/>',
           f'<updated>{e(updated)}</updated>',
           f'<author><name>Gurbani Soul</name><uri>{e(hp.SITE)}</uri></author>',
           f'<rights>{e(CREDIT)}</rights>']
    for d in days:
        link, when = e(permalink(d)), e(_when(d))
        out += ['<entry>',
                f'<id>{link}</id>',
                f'<title>{e(title(d))}</title>',
                f'<link rel="alternate" type="text/html" href="{link}"/>',
                f'<published>{when}</published>',
                f'<updated>{when}</updated>',
                f'<summary>{e(citation(d))}</summary>',
                f'<content type="html" xml:lang="pa">{e(content_html(d))}</content>',
                '</entry>']
    out.append('</feed>')
    return '\n'.join(out) + '\n'


def json_feed(days):
    doc = {'version': 'https://jsonfeed.org/version/1.1', 'title': NAME, 'description': SUBTITLE,
           'home_page_url': f'{hp.SITE}/en/hukamnama', 'feed_url': f'{hp.SITE}/feeds/hukamnama.json',
           'language': 'en', 'authors': [{'name': 'Gurbani Soul', 'url': hp.SITE}],
           'items': [{'id': permalink(d), 'url': permalink(d), 'title': title(d), 'summary': citation(d),
                      'content_html': content_html(d), 'date_published': _when(d), 'language': 'pa'}
                     for d in days]}
    # "<" is escaped so the document is safe wherever it is embedded; a JSON parser reads it back the same
    return json.dumps(doc, ensure_ascii=False, indent=1).replace('<', '\\u003c') + '\n'


def feed_for(kind, now):
    """(status, body, cache) for a feed, or None when feeds are not configured on this server."""
    if not hp.api_base():
        return None
    try:
        days = recent(hp.amritsar_now(now).date())
    except hp.Unavailable:
        return 503, None, 'no-store'
    return 200, atom(days) if kind == 'atom' else json_feed(days), CACHE


def respond(handler, url_path, now=None):
    """Serve the request if it is a Hukamnama feed this server is configured for. Returns True
    when a response was written; False leaves the path to the static site."""
    kind = PATHS.get(url_path)
    if kind is None:
        return False
    try:
        result = feed_for(kind, now or datetime.now(timezone.utc))
    except Exception:
        import traceback
        traceback.print_exc(file=sys.stderr)
        result = (503, None, 'no-store')
    if result is None:
        return False
    status, body, cache = result
    raw = (body if body is not None else 'Temporarily unavailable.\n').encode('utf-8')
    etag = None
    if status == 200:
        etag = '"' + hashlib.sha256(raw).hexdigest()[:32] + '"'
        if handler.headers.get('If-None-Match') == etag:
            status, raw = 304, b''
    handler.send_response(status)
    handler.send_header('Content-Type', TYPES[kind] if body is not None else 'text/plain; charset=utf-8')
    handler.send_header('Content-Length', str(len(raw)))
    handler.send_header('Cache-Control', cache)
    handler.send_header('Access-Control-Allow-Origin', '*')      # a feed is public data for any reader
    if etag:
        handler.send_header('ETag', etag)
    if status == 503:
        handler.send_header('Retry-After', '30')
    handler._sec_headers()
    handler.end_headers()
    if handler.command != 'HEAD':
        handler.wfile.write(raw)
    return True
