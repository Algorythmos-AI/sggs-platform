"""The Hukamnama embed (webapp/hukamnama_embed.py): what it shows, what it may load, its headers."""
import hashlib
import html
import http.client
import os
import re
import shutil
import sys
import tempfile
import threading
import unittest
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import hukamnama_embed as he  # noqa: E402
import hukamnama_page as hp  # noqa: E402
import serve  # noqa: E402
from test_hukamnama_page import AFTER, AFTERNOON, API, BEFORE, DB, FIXTURE, FakeApi, R673, R680, corpus_lines, record  # noqa: E402

GURMUKHI = re.compile('[਀-੿]')


def lines_of(doc):
    return [html.unescape(x) for x in re.findall(r'<p>(.*?)</p>', re.search(r'<div class="g" lang="pa">(.*?)</div>', doc, re.S).group(1))]


@unittest.skipUnless(os.path.isfile(DB), 'scripture DB not installed; run `make dataset`')
class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, True)
        with open(FIXTURE, encoding='utf-8') as f:
            shell = f.read()
        for lang in ('en', 'pa'):
            with open(os.path.join(self.tmp, f'{lang}.html'), 'w', encoding='utf-8') as f:
                f.write(shell.replace('<html lang="en">', f'<html lang="{lang}">'))
        with open(os.path.join(self.tmp, 'fr.html'), 'w', encoding='utf-8') as f:      # a shell from before the embed
            f.write(re.sub(r',"name":.*?\}</script>', '}</script>', shell))
        for p in (mock.patch.object(hp, 'SHELL_DIR', self.tmp), mock.patch.dict(os.environ, {'HUKAMNAMA_API': API})):
            p.start(); self.addCleanup(p.stop)
        hp.reset()
        self.addCleanup(hp.reset)

    def api(self, **kw):
        fake = FakeApi(**kw)
        p = mock.patch.object(hp, 'FETCH', fake)
        p.start(); self.addCleanup(p.stop)
        return fake

    def embed(self, query='', now=AFTER):
        return he.embed_for(query, now)


class Shows(Base):
    def test_every_line_is_the_corpus_line_proven_and_nothing_from_the_api_text_appears(self):
        self.api(days={'2026-11-11': record('2026-11-11')})
        status, doc, _ = self.embed()
        self.assertEqual(status, 200)
        shown = lines_of(doc)
        self.assertEqual(shown, [g for _, g, _ in corpus_lines(*R680)])
        self.assertEqual(hashlib.sha256('\n'.join(shown).encode('utf-8')).hexdigest(), record('2026-11-11')['range_sha256'])
        self.assertNotIn('NOT FROM THE CORPUS', doc)
        self.assertNotIn('ਗਲਤ', doc)

    def test_the_name_the_days_own_date_the_citation_and_the_credit(self):
        self.api(days={'2026-11-11': record('2026-11-11')})
        _, doc, _ = self.embed()
        self.assertIn('<time datetime="2026-11-11">11 November 2026</time>', doc)
        self.assertIn('>Hukamnama · Sri Harmandir Sahib, Amritsar</a>', doc)
        self.assertIn('<a href="/en/hukamnama/2026-11-11" target="_blank" rel="noopener">Sri Guru Granth Sahib Ji · Ang 680</a>', doc)
        self.assertIn('not affiliated with SGPC', doc)
        self.assertNotIn('official', doc.lower())
        self.assertNotIn("Today", doc)                                  # the date, never a claim about today

    def test_a_mismatched_range_shows_no_text(self):
        self.api(days={'2026-11-11': record('2026-11-11', range_sha256='0' * 64)})
        status, doc, cache = self.embed()
        self.assertEqual((status, cache), (503, 'no-store'))
        self.assertIn('cannot be shown right now', doc)
        self.assertIsNone(GURMUKHI.search(doc))

    def test_before_publication_the_latest_is_shown_under_its_own_date(self):
        self.api(days={'2026-11-10': record('2026-11-10', R673)}, latest='2026-11-10')
        status, doc, cache = self.embed(now=BEFORE)
        self.assertEqual(status, 200)
        self.assertIn('<time datetime="2026-11-10">10 November 2026</time>', doc)
        self.assertIn('The Hukamnama for 11 November 2026 appears after about 05:30 IST.', doc)
        self.assertEqual(lines_of(doc), [g for _, g, _ in corpus_lines(*R673)])
        self.assertIn('max-age=20', cache)
        _, afternoon, _ = self.embed(now=AFTERNOON)
        self.assertIn('has not been published', afternoon)

    def test_nothing_published_yet_says_so_without_text(self):
        self.api()
        status, doc, _ = self.embed()
        self.assertEqual(status, 200)
        self.assertIn('No Hukamnama is available yet for 11 November 2026.', doc)
        self.assertNotIn('class="g"', doc)

    def test_todays_embed_is_never_cached_past_amritsar_midnight(self):
        self.api(days={'2026-11-11': record('2026-11-11')})
        late = datetime(2026, 11, 11, 18, 29, 50, tzinfo=timezone.utc)      # 23:59:50 IST
        self.assertEqual(self.embed(now=late)[2], 'public, max-age=10, s-maxage=10')


class Parameters(Base):
    def test_only_listed_values_are_taken_and_nothing_from_the_query_reaches_the_page(self):
        self.api(days={'2026-11-11': record('2026-11-11')})
        self.assertEqual(he.options(''), ('en', 'auto'))
        self.assertEqual(he.options('lang=pa&theme=dark'), ('pa', 'dark'))
        for q in ('lang=de', 'lang=../../etc', 'lang=%3Cscript%3E', 'theme=red', 'theme="><script>', 'lang=EN',
                  'lang=fr',                                # its shell lacks the embed's words
                  'x=' + 'a' * 500, 'lang=pa&' * 60):
            self.assertEqual(he.options(q), ('en', 'auto'), q)
        evil = 'lang=%22%3E%3Cscript%3Ealert(1)%3C/script%3E&theme=%22onload%3D1&x=%3Cimg%3E'
        _, doc, _ = self.embed(evil)
        self.assertNotIn('script', doc.split('</style>')[1])
        self.assertNotIn('onload', doc)
        self.assertNotIn('<img', doc)
        self.assertEqual(doc, self.embed('')[1])

    def test_language_and_theme(self):
        self.api(days={'2026-11-11': record('2026-11-11')})
        _, pa, _ = self.embed('lang=pa&theme=dark')
        self.assertIn('<html lang="pa" data-theme="dark">', pa)
        self.assertIn('href="/pa/hukamnama/2026-11-11"', pa)
        self.assertIn('<html lang="en" data-theme="light">', self.embed('theme=light')[1])
        self.assertIn('<html lang="en">', self.embed('theme=auto')[1])


class Contained(Base):
    """It runs inside other people's pages: it may carry nothing that acts or phones anywhere."""

    def test_no_script_form_button_image_or_other_host(self):
        self.api(days={'2026-11-11': record('2026-11-11')})
        for q in ('', 'lang=pa&theme=dark'):
            _, doc, _ = self.embed(q)
            for tag in ('<script', '<form', '<button', '<input', '<img', '<iframe', '<link', '<object', '<base', ' on'):
                self.assertNotIn(tag, doc.replace(' one', '').replace(' on ', ' '), tag)
            self.assertEqual(re.findall(r'https?://[^\s"\')<]+', doc), [])           # no absolute URL at all
            self.assertEqual(re.findall(r'url\(([^)]*)\)', doc), ['"/fonts/SantLipi-VF.woff2"'])
            self.assertIn('<meta name="robots" content="noindex, nofollow">', doc)

    def test_every_link_stays_on_this_site_and_opens_in_a_new_tab(self):
        self.api(days={'2026-11-11': record('2026-11-11')})
        _, doc, _ = self.embed()
        anchors = re.findall(r'<a ([^>]*)>', doc)
        self.assertEqual(len(anchors), 2)
        for a in anchors:
            self.assertRegex(a, r'^href="/en/hukamnama(/2026-11-11)?" target="_blank" rel="noopener"$')

    def test_the_gurmukhi_block_holds_only_the_lines_and_text_is_escaped(self):
        day = {'date': datetime(2026, 11, 11).date(), 'ang': 1, 'lines': [{'gurmukhi': 'ੴ <b>&</b>"'}]}
        strings = dict(he.strings_for('en'), credit='a <i>b</i>', name='N & <n>')
        doc = he.render(strings, 'en', 'auto', view='today', day=day, today=day['date'], hour_ist=8)
        self.assertIn('<p>ੴ &lt;b&gt;&amp;&lt;/b&gt;&quot;</p>', doc)
        self.assertEqual(lines_of(doc), ['ੴ <b>&</b>"'])
        self.assertIn('a &lt;i&gt;b&lt;/i&gt;', doc)
        self.assertIn('<title>N &amp; &lt;n&gt; · 11 November 2026</title>', doc)

    def test_the_policy_allows_inline_style_and_the_sites_font_and_nothing_else(self):
        parts = dict(d.strip().split(' ', 1) for d in he.CSP.split(';'))
        self.assertEqual(parts, {'default-src': "'none'", 'style-src': "'unsafe-inline'", 'font-src': "'self'",
                                 'frame-ancestors': '*', 'base-uri': "'none'", 'form-action': "'none'"})


class Off(Base):
    def test_off_without_the_api_or_without_a_shell_that_carries_its_words(self):
        self.api(days={'2026-11-11': record('2026-11-11')})
        with mock.patch.dict(os.environ, {'HUKAMNAMA_API': ''}):
            self.assertIsNone(self.embed())
        os.remove(os.path.join(self.tmp, 'en.html'))
        hp.reset()
        self.assertIsNone(self.embed('lang=pa'.replace('pa', 'fr')))       # falls to en, which has no shell now
        self.assertIsNotNone(self.embed('lang=pa'))


class Http(Base):
    def setUp(self):
        super().setUp()
        self.srv = ThreadingHTTPServer(('127.0.0.1', 0), serve.H)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.addCleanup(self.srv.server_close)
        self.addCleanup(self.srv.shutdown)

    def get(self, path, headers=None, method='GET'):
        c = http.client.HTTPConnection('127.0.0.1', self.srv.server_address[1], timeout=10)
        self.addCleanup(c.close)
        c.request(method, path, headers=headers or {})
        r = c.getresponse()
        return r, r.read()

    def today(self):
        return datetime.now(timezone.utc).astimezone(hp.IST).date().isoformat()

    def test_the_embed_may_be_framed_and_every_other_response_may_not(self):
        self.api(days={self.today(): record(self.today())})
        r, body = self.get('/embed/hukamnama?lang=pa&theme=dark')
        self.assertEqual((r.status, r.getheader('Content-Type')), (200, 'text/html; charset=utf-8'))
        self.assertIsNone(r.getheader('X-Frame-Options'))
        self.assertEqual(r.getheader('Content-Security-Policy'), he.CSP)
        self.assertEqual(r.getheader('X-Robots-Tag'), 'noindex, nofollow')
        self.assertEqual(r.getheader('X-Content-Type-Options'), 'nosniff')
        self.assertEqual(r.getheader('Referrer-Policy'), 'no-referrer')
        self.assertIn(b'<html lang="pa" data-theme="dark">', body)
        for path in ('/en/hukamnama', '/sitemap-hukamnama.xml', '/api/health', '/embed/other',
                     '/embed/hukamnama/x', '/embed/hukamnamas'):
            self.assertEqual(self.get(path)[0].getheader('X-Frame-Options'), 'DENY', path)

    def test_etag_head_and_unavailable(self):
        fake = self.api(days={self.today(): record(self.today())})
        r, _ = self.get('/embed/hukamnama')
        r2, body2 = self.get('/embed/hukamnama', {'If-None-Match': r.getheader('ETag')})
        self.assertEqual((r2.status, body2), (304, b''))
        self.assertEqual(self.get('/embed/hukamnama', method='HEAD')[1], b'')
        hp.reset()
        fake.down = True
        r3, body3 = self.get('/embed/hukamnama')
        self.assertEqual((r3.status, r3.getheader('Retry-After'), r3.getheader('Cache-Control')), (503, '30', 'no-store'))
        self.assertIsNone(r3.getheader('X-Frame-Options'))
        self.assertIsNone(GURMUKHI.search(body3.decode('utf-8')))

    def test_an_unconfigured_server_leaves_it_to_the_static_site(self):
        with mock.patch.dict(os.environ, {'HUKAMNAMA_API': ''}):
            r, _ = self.get('/embed/hukamnama')
            self.assertEqual((r.status, r.getheader('X-Frame-Options')), (404, 'DENY'))


if __name__ == '__main__':
    unittest.main()
