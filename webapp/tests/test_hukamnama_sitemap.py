"""The Hukamnama sitemap (webapp/hukamnama_sitemap.py): what is listed, dates, languages, failure."""
import http.client
import os
import re
import shutil
import sys
import tempfile
import threading
import unittest
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import hukamnama_page as hp  # noqa: E402
import hukamnama_sitemap as hs  # noqa: E402
import serve  # noqa: E402
from test_hukamnama_page import API, DB, FIXTURE, FakeApi, R673, record  # noqa: E402

NOW = datetime(2026, 11, 11, 2, 0, tzinfo=timezone.utc)          # 07:30 IST, 11 Nov
SM = '{http://www.sitemaps.org/schemas/sitemap/0.9}'
XH = '{http://www.w3.org/1999/xhtml}'
DAYS = {'2026-11-08': record('2026-11-08', R673), '2026-11-10': record('2026-11-10', R673),
        '2026-11-11': record('2026-11-11')}


@unittest.skipUnless(os.path.isfile(DB), 'scripture DB not installed; run `make dataset`')
class Base(unittest.TestCase):
    LANGS = ('en', 'pa')

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, True)
        for lang in self.LANGS:
            shutil.copy(FIXTURE, os.path.join(self.tmp, f'{lang}.html'))
        with open(os.path.join(self.tmp, 'xx.html'), 'w', encoding='utf-8') as f:
            f.write('<html>not a shell</html>')
        with open(os.path.join(self.tmp, 'notes.txt'), 'w', encoding='utf-8') as f:
            f.write('x')
        for p in (mock.patch.object(hp, 'SHELL_DIR', self.tmp), mock.patch.dict(os.environ, {'HUKAMNAMA_API': API})):
            p.start(); self.addCleanup(p.stop)
        hp.reset()
        self.addCleanup(hp.reset)

    def api(self, days=DAYS):
        fake = FakeApi(days=days)
        p = mock.patch.object(hp, 'FETCH', fake)
        p.start(); self.addCleanup(p.stop)
        return fake

    def urls(self, now=NOW):
        status, body, _ = hs.sitemap_for(now)
        self.assertEqual(status, 200)
        root = ET.fromstring(body.encode('utf-8'))
        return [(u.find(SM + 'loc').text, getattr(u.find(SM + 'lastmod'), 'text', None), u) for u in root.findall(SM + 'url')], body


class Listing(Base):
    def test_today_and_every_published_day_for_every_language_with_a_shell_newest_first(self):
        self.api()
        urls, _ = self.urls()
        self.assertEqual([loc.replace('https://gurbanisoul.com', '') for loc, _, _ in urls], [
            '/en/hukamnama', '/pa/hukamnama',
            '/en/hukamnama/2026-11-11', '/pa/hukamnama/2026-11-11',
            '/en/hukamnama/2026-11-10', '/pa/hukamnama/2026-11-10',
            '/en/hukamnama/2026-11-08', '/pa/hukamnama/2026-11-08'])
        self.assertEqual(hs.languages(), ['en', 'pa'])                 # the broken shell and the stray file are not languages

    def test_lastmod_is_when_the_day_was_published_and_the_today_page_takes_the_latest(self):
        self.api()
        urls, _ = self.urls()
        mods = {loc.rsplit('gurbanisoul.com', 1)[1]: mod for loc, mod, _ in urls}
        self.assertEqual(mods['/en/hukamnama'], '2026-11-11T00:25:03+00:00')
        self.assertEqual(mods['/pa/hukamnama/2026-11-08'], '2026-11-08T00:25:03+00:00')

    def test_an_unusable_publication_time_falls_back_to_the_date(self):
        fake = self.api()
        fake.index = {'days': [{'amritsar_date': '2026-11-10', 'published_at': 'soon'}, {'amritsar_date': '2026-11-09'}]}
        mods = [mod for _, mod, _ in self.urls()[0]]
        self.assertEqual(sorted(set(mods)), ['2026-11-09', '2026-11-10'])

    def test_every_url_names_each_language_version_and_x_default_like_its_page(self):
        self.api()
        for loc, _, el in self.urls()[0]:
            links = {x.get('hreflang'): x.get('href') for x in el.findall(XH + 'link')}
            self.assertEqual(set(links), {'en', 'pa', 'x-default'})
            self.assertEqual(links['x-default'], 'https://gurbanisoul.com/')
            suffix = re.sub(r'^https://gurbanisoul.com/[a-z]{2}', '', loc)
            self.assertEqual((links['en'], links['pa']),
                             (f'https://gurbanisoul.com/en{suffix}', f'https://gurbanisoul.com/pa{suffix}'))

    def test_never_a_day_ahead_of_the_amritsar_date_or_before_the_first_day(self):
        fake = self.api()
        fake.index = {'days': [{'amritsar_date': d} for d in ('2026-11-12', '2026-11-11', '2026-10-31', 'x', None)] + ['y', 5]}
        locs = [loc for loc, _, _ in self.urls()[0]]
        self.assertEqual(sum('/2026-' in loc for loc in locs), 2)
        self.assertTrue(all('2026-11-11' in loc for loc in locs if '/2026-' in loc))
        hp.reset()
        late_on_the_10th = datetime(2026, 11, 10, 18, 0, tzinfo=timezone.utc)      # 23:30 IST, 10 Nov
        self.assertEqual(len(self.urls(late_on_the_10th)[0]), 2)                    # only the today pages

    def test_no_published_day_is_still_a_valid_sitemap_of_the_today_pages(self):
        self.api(days={})
        urls, _ = self.urls()
        self.assertEqual([(loc[-12:], mod) for loc, mod, _ in urls], [('en/hukamnama', None), ('pa/hukamnama', None)])

    def test_it_holds_urls_and_times_only(self):
        self.api()
        body = self.urls()[1]
        self.assertIsNone(re.search('[਀-੿]', body))
        self.assertNotIn('NOT FROM THE CORPUS', body)

    def test_a_very_long_archive_stops_before_the_protocol_limit(self):
        from datetime import date, timedelta
        days = [{'date': date(2026, 11, 1) + timedelta(days=i), 'published_at': None} for i in range(40)]
        with mock.patch.object(hs, 'MAX_URLS', 20):
            root = ET.fromstring(hs.build(days, ['en', 'pa']).encode('utf-8'))
        locs = [u.find(SM + 'loc').text for u in root.findall(SM + 'url')]
        self.assertLessEqual(len(locs), 20)
        self.assertIn('https://gurbanisoul.com/en/hukamnama/2026-12-10', locs)      # the newest are the ones kept


class Failure(Base):
    def test_off_without_the_api_or_without_any_shell(self):
        self.api()
        with mock.patch.dict(os.environ, {'HUKAMNAMA_API': ''}):
            self.assertIsNone(hs.sitemap_for(NOW))
        with mock.patch.object(hp, 'SHELL_DIR', os.path.join(self.tmp, 'none')):
            self.assertIsNone(hs.sitemap_for(NOW))

    def test_api_down_with_nothing_remembered_is_503_then_the_last_list_is_served(self):
        fake = self.api()
        fake.down = True
        self.assertEqual(hs.sitemap_for(NOW), (503, None, 'no-store'))
        hp.reset()
        fake.down = False
        self.assertEqual(len(self.urls()[0]), 8)
        fake.down = True
        self.assertEqual(len(self.urls()[0]), 8)


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

    def test_served_as_xml_with_cache_and_etag(self):
        self.api()
        r, body = self.get(hs.PATH)
        self.assertEqual((r.status, r.getheader('Content-Type'), r.getheader('Cache-Control')),
                         (200, 'application/xml; charset=utf-8', hs.CACHE))
        self.assertTrue(body.startswith(b'<?xml'))
        r2, body2 = self.get(hs.PATH, {'If-None-Match': r.getheader('ETag')})
        self.assertEqual((r2.status, body2), (304, b''))
        self.assertEqual(self.get(hs.PATH, method='HEAD')[1], b'')

    def test_unavailable_is_503_and_an_unconfigured_server_leaves_it_to_the_static_site(self):
        fake = self.api()
        fake.down = True
        r, _ = self.get(hs.PATH)
        self.assertEqual((r.status, r.getheader('Retry-After')), (503, '30'))
        with mock.patch.dict(os.environ, {'HUKAMNAMA_API': ''}):
            self.assertEqual(self.get(hs.PATH)[0].status, 404)
        self.assertEqual(self.get('/sitemap-other.xml')[0].status, 404)


if __name__ == '__main__':
    unittest.main()
