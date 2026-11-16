# -*- coding: utf-8 -*-
"""The Hukamnama embed: /embed/hukamnama, a small page another site shows in an ``<iframe>``.

    <iframe src="https://gurbanisoul.com/embed/hukamnama?lang=en&theme=auto" …></iframe>

It shows the day's Hukamnama (the same day, by the same rules, as ``/{lang}/hukamnama``): the name,
the date, every Gurmukhi line, the citation as a link to that day's page, and the credit. It is
off unless ``HUKAMNAMA_API`` is set and the language has a page shell carrying the embed's words.

What it is allowed to be (it runs inside other people's pages):

  * No script, no form, no button, no image, no request to any other host: one HTML document with
    its styles inline, plus the site's own Gurmukhi font. Its Content-Security-Policy says so.
  * ``lang`` and ``theme`` are the only parameters; each takes a listed value or its default.
    Nothing from the query string is ever written into the page.
  * It is the one page of the site that may be framed, and it is never indexed (``noindex``).
  * Every link opens in a new tab and goes to this site.

Fidelity is the page's: the lines come from this server's corpus and are shown only after they
hash to the published ``range_sha256`` (``hukamnama_page.day_state``); the date shown is always the
Hukamnama's own date, never "today" by assumption.
"""
import hashlib
import html
import sys
from datetime import datetime, timezone
from urllib.parse import parse_qs

import hukamnama_page as hp

PATH = '/embed/hukamnama'
THEMES = ('auto', 'light', 'dark')
EMBED_KEYS = ('name', 'credit', 'unavailable')      # shell strings the embed needs beyond hp.STRING_KEYS
# What the document may load: its own inline styles and this site's font. Nothing else, from anywhere.
CSP = ("default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; frame-ancestors *; "
       "base-uri 'none'; form-action 'none'")

LIGHT = '--paper:#FBF7F0;--ink:#201A12;--soft:#6B5E4B;--link:#8A6100;--line:rgba(43,26,5,.14)'
DARK = '--paper:#171412;--ink:#F3ECDD;--soft:#B9AC95;--link:#FFC72C;--line:rgba(255,255,255,.14)'
STYLE = (
    '@font-face{font-family:"Sant Lipi";src:url("/fonts/SantLipi-VF.woff2") format("woff2");font-weight:100 900;'
    'font-display:swap;unicode-range:U+0964-0965,U+0A00-0A7F,U+200C-200D,U+FE00-FE0F}'
    ':root{color-scheme:light dark;%(light)s}'
    '@media (prefers-color-scheme:dark){:root:not([data-theme=light]){%(dark)s}}'
    ':root[data-theme=dark]{%(dark)s}'
    ':root[data-theme=light]{color-scheme:light}:root[data-theme=dark]{color-scheme:dark}'
    '*{box-sizing:border-box}'
    'body{margin:0;padding:18px 18px 14px;background:var(--paper);color:var(--ink);'
    'font:15px/1.5 "Sant Lipi",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}'
    'p{margin:0}a{color:var(--link);text-underline-offset:2px}'
    'a:focus-visible{outline:2px solid var(--link);outline-offset:2px;border-radius:2px}'
    '.n{font-size:13px;font-weight:650;letter-spacing:.02em}.n a{text-decoration:none}'
    '.d{margin-top:2px;font-size:13px;color:var(--soft)}'
    '.s{margin-top:12px;padding-left:12px;border-left:2px solid var(--link);color:var(--soft);font-size:14px}'
    '.g{margin:14px 0 10px}.g p{font-size:21px;line-height:1.85;color:var(--ink);overflow-wrap:anywhere}'
    '.g p+p{margin-top:6px}'
    '.c{font-size:13.5px;font-weight:600}'
    '.f{margin-top:12px;padding-top:10px;border-top:1px solid var(--line);font-size:11.5px;line-height:1.45;color:var(--soft)}'
) % {'light': LIGHT, 'dark': DARK}


def options(query):
    """(lang, theme) from the query string: listed values only, the default otherwise."""
    q = parse_qs(query or '', keep_blank_values=False, max_num_fields=8) if len(query or '') <= 200 else {}
    lang = (q.get('lang') or ['en'])[-1]
    theme = (q.get('theme') or ['auto'])[-1]
    return (lang if strings_for(lang) else 'en'), (theme if theme in THEMES else 'auto')


def strings_for(lang):
    """The language's words when its shell carries everything the embed says, else None."""
    loaded = hp.load_shell(lang) if isinstance(lang, str) else None
    if not loaded or any(not isinstance(loaded[1].get(k), str) or not loaded[1][k] for k in EMBED_KEYS):
        return None
    return loaded[1]


def render(strings, lang, theme, *, view, day, today, hour_ist):
    """The document. ``view`` is 'today' | 'latest' | 'none' | 'unavailable' (as for the page)."""
    e = html.escape
    here = f'/{lang}/hukamnama'
    shown = hp._date_text(strings, day['date']) if day else ''
    today_text = hp._date_text(strings, today)
    status = ''
    if view == 'latest':
        status = hp._fmt(strings['status_before' if hour_ist < hp.NOT_TODAY_AFTER else 'status_not_today'], date=today_text)
    elif view == 'none':
        status = hp._fmt(strings['status_none'], date=today_text)
    elif view == 'unavailable':
        status = strings['unavailable']
    link = 'target="_blank" rel="noopener"'
    out = ['<!doctype html>',
           f'<html lang="{e(lang, quote=True)}"' + (f' data-theme="{theme}"' if theme != 'auto' else '') + '>',
           '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
           '<meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer">',
           f'<title>{e(strings["name"])}{" · " + e(shown) if shown else ""}</title>',
           f'<style>{STYLE}</style></head>',
           '<body><article>',
           f'<p class="n"><a href="{here}" {link}>{e(strings["name"])}</a></p>']
    if day:
        out.append(f'<p class="d"><time datetime="{day["date"].isoformat()}">{e(shown)}</time></p>')
    if status:
        out.append(f'<p class="s">{e(status)}</p>')
    if day:
        out.append('<div class="g" lang="pa">')
        out += [f'<p>{e(x["gurmukhi"])}</p>' for x in day['lines']]
        out.append('</div>')
        out.append(f'<p class="c"><a href="{here}/{day["date"].isoformat()}" {link}>'
                   f'{e(hp._fmt(strings["citation"], ang=day["ang"]))}</a></p>')
    out.append(f'<p class="f">{e(strings["credit"])}</p>')
    out.append('</article></body></html>')
    return '\n'.join(out) + '\n'


def embed_for(query, now):
    """(status, html, cache), or None when the embed is not served by this server."""
    if not hp.api_base():
        return None
    lang, theme = options(query)
    strings = strings_for(lang)
    if strings is None:
        return None
    ist = hp.amritsar_now(now)
    today, hour = ist.date(), ist.hour

    def out(status, view, day=None):
        body = render(strings, lang, theme, view=view, day=day, today=today, hour_ist=hour)
        return status, body, hp._cache_for(view, now) if status == 200 else 'no-store'

    try:
        kind, value = hp.day_state(today, today)
        if kind == 'published':
            return out(200, 'today', value)
        if value is None or value >= today or value < hp.EARLIEST:
            return out(200, 'none')
        kind, latest = hp.day_state(value, today)
        return out(200, 'latest', latest) if kind == 'published' else out(200, 'none')
    except hp.Unavailable:
        return out(503, 'unavailable')


def respond(handler, url_path, query='', now=None):
    """Serve the request if it is the embed and this server is configured for it. Returns True
    when a response was written; False leaves the path to the static site."""
    if url_path != PATH:
        return False
    try:
        result = embed_for(query, now or datetime.now(timezone.utc))
    except Exception:
        import traceback
        traceback.print_exc(file=sys.stderr)
        result = (503, '<!doctype html><title>Temporarily unavailable</title><p>Temporarily unavailable.</p>', 'no-store')
    if result is None:
        return False
    status, body, cache = result
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
    handler.send_header('Content-Security-Policy', CSP)
    handler.send_header('X-Robots-Tag', 'noindex, nofollow')
    if etag:
        handler.send_header('ETag', etag)
    if status == 503:
        handler.send_header('Retry-After', '30')
    handler._sec_headers(framable=True)       # the one response that does not forbid framing
    handler.end_headers()
    if handler.command != 'HEAD':
        handler.wfile.write(raw)
    return True
