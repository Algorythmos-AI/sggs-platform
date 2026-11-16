# -*- coding: utf-8 -*-
"""The Hukamnama sitemap: /sitemap-hukamnama.xml.

The site's own sitemap is a static file listing the static pages. The Hukamnama pages are filled
by this server and gain one URL per language every morning, so they have their own sitemap, built
here from the public Hukamnama API's list of published dates. Off unless ``HUKAMNAMA_API`` is set
and a page shell exists for at least one language (the same switch as the pages).

It lists, for every language that has a shell: the today page (``/{lang}/hukamnama``) and one URL
per published date, newest first. Only dates the API lists as published are included, and never a
date after the Amritsar date at that moment. ``lastmod`` is the time that day was published. Each
URL names its other-language versions, the same set its page's ``<head>`` carries. No scripture is
written here: a sitemap holds URLs and times only.
"""
import hashlib
import html
import os
import re
import sys
from datetime import datetime, timezone

import hukamnama_page as hp

PATH = '/sitemap-hukamnama.xml'
CACHE = 'public, max-age=300, s-maxage=300'
MAX_URLS = 45000                      # the protocol allows 50,000 per file; stop well before it


def languages():
    """The languages that have a usable page shell on this server, in a stable order."""
    try:
        names = sorted(os.listdir(hp.SHELL_DIR))
    except OSError:
        return []
    return [n[:-5] for n in names if re.fullmatch(r'[a-z]{2}\.html', n) and hp.load_shell(n[:-5])]


def _lastmod(day):
    try:
        t = datetime.fromisoformat(day['published_at'] or '')
        if t.tzinfo is not None:
            return t.astimezone(timezone.utc).isoformat(timespec='seconds')
    except (TypeError, ValueError):
        pass
    return day['date'].isoformat()


def build(days, langs):
    """The sitemap for these published days (oldest first) and languages."""
    e = html.escape
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']

    def url(suffix, lastmod, changefreq, priority):
        for lang in langs:
            out.append('  <url>')
            out.append(f'    <loc>{e(hp.SITE)}/{lang}/hukamnama{suffix}</loc>')
            if lastmod:
                out.append(f'    <lastmod>{e(lastmod)}</lastmod>')
            out.append(f'    <changefreq>{changefreq}</changefreq>')
            out.append(f'    <priority>{priority}</priority>')
            for other in langs:
                out.append(f'    <xhtml:link rel="alternate" hreflang="{other}" href="{e(hp.SITE)}/{other}/hukamnama{suffix}"/>')
            out.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{e(hp.SITE)}/"/>')
            out.append('  </url>')

    newest = list(reversed(days))[:max(0, MAX_URLS // max(1, len(langs)) - 1)]
    url('', _lastmod(newest[0]) if newest else None, 'daily', '0.9')
    for day in newest:
        url('/' + day['date'].isoformat(), _lastmod(day), 'yearly', '0.6')
    out.append('</urlset>')
    return '\n'.join(out) + '\n'


def sitemap_for(now):
    """(status, body, cache), or None when the Hukamnama pages are not served by this server."""
    if not hp.api_base():
        return None
    langs = languages()
    if not langs:
        return None
    try:
        days = hp.published_days(hp.amritsar_now(now).date())
    except hp.Unavailable:
        return 503, None, 'no-store'
    return 200, build(days, langs), CACHE


def respond(handler, url_path, now=None):
    """Serve the request if it is the Hukamnama sitemap and this server is configured for it.
    Returns True when a response was written; False leaves the path to the static site."""
    if url_path != PATH:
        return False
    try:
        result = sitemap_for(now or datetime.now(timezone.utc))
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
    handler.send_header('Content-Type', 'application/xml; charset=utf-8' if body is not None else 'text/plain; charset=utf-8')
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
