"""The Hukamnama feeds (webapp/hukamnama_feed.py): fidelity, dates, layers, escaping, failure."""
import hashlib
import html
import http.client
import json
import os
import re
import sys
import threading
import unittest
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import hukamnama_feed as hf  # noqa: E402
import hukamnama_page as hp  # noqa: E402
import serve  # noqa: E402
from test_hukamnama_page import API, DB, R673, R680, corpus_lines, record  # noqa: E402

NOW = datetime(2026, 11, 11, 2, 0, tzinfo=timezone.utc)          # 07:30 IST, 11 Nov
ATOM = '{http://www.w3.org/2005/Atom}'
GURMUKHI = re.compile('[਀-੿]')


class FakeList:
    def __init__(self, items):
        self.items, self.calls, self.down = list(items), [], False

    def __call__(self, url):
        self.calls.append(url)
        if self.down:
            raise urllib.error.URLError('down')
        assert url == f'{API}/v1/hukamnama?limit=30', url
        return {'items': self.items}


def gurmukhi_of(content):
    """The Gurmukhi block of an entry's content, as the lines it holds."""
    block = re.search(r'<div lang="pa">\n(.*?)\n</div>', content, re.S).group(1)
    return [html.unescape(x) for x in re.findall(r'<p>(.*?)</p>', block, re.S)]


@unittest.skipUnless(os.path.isfile(DB), 'scripture DB not installed; run `make dataset`')
class Base(unittest.TestCase):
    def setUp(self):
        p = mock.patch.dict(os.environ, {'HUKAMNAMA_API': API})
        p.start(); self.addCleanup(p.stop)
        for m in (hf, hp):
            m.reset(); self.addCleanup(m.reset)

    def api(self, *items):
        fake = FakeList(items)
        p = mock.patch.object(hp, 'FETCH', fake)
        p.start(); self.addCleanup(p.stop)
        return fake

    def atom(self, now=NOW):
        status, body, cache = hf.feed_for('atom', now)
        self.assertEqual(status, 200)
        return ET.fromstring(body.encode('utf-8')), body, cache

    def json(self, now=NOW):
        status, body, _ = hf.feed_for('json', now)
        self.assertEqual(status, 200)
        return json.loads(body), body


class Fidelity(Base):
    def test_every_entrys_gurmukhi_is_the_corpus_and_hashes_to_the_published_range(self):
        self.api(record('2026-11-11'), record('2026-11-10', R673))
        feed, _, _ = self.atom()
        entries = feed.findall(ATOM + 'entry')
        self.assertEqual(len(entries), 2)
        for entry, rng in zip(entries, (R680, R673)):
            lines = gurmukhi_of(entry.find(ATOM + 'content').text)
            self.assertEqual(lines, [g for _, g, _ in corpus_lines(*rng)])
            digest = hashlib.sha256('\n'.join(lines).encode('utf-8')).hexdigest()
            self.assertEqual(digest, record('2026-11-11', rng)['range_sha256'])

    def test_the_json_feed_carries_the_same_proven_text(self):
        self.api(record('2026-11-11'))
        doc, _ = self.json()
        self.assertEqual(doc['version'], 'https://jsonfeed.org/version/1.1')
        item, = doc['items']
        self.assertEqual(gurmukhi_of(item['content_html']), [g for _, g, _ in corpus_lines(*R680)])
        self.assertEqual((item['id'], item['url']), ('https://gurbanisoul.com/en/hukamnama/2026-11-11',) * 2)
        self.assertEqual(item['date_published'], '2026-11-11T00:25:03+00:00')

    def test_nothing_the_api_sends_as_text_reaches_a_feed(self):
        self.api(record('2026-11-11'))
        for body in (self.atom()[1], self.json()[1]):
            self.assertNotIn('NOT FROM THE CORPUS', body)
            self.assertNotIn('ਗਲਤ', body)

    def test_a_day_that_does_not_prove_is_left_out_not_shown(self):
        self.api(record('2026-11-11', range_sha256='0' * 64), record('2026-11-10', R673))
        with mock.patch('sys.stderr'):
            feed, body, _ = self.atom()
        ids = [e.find(ATOM + 'id').text for e in feed.findall(ATOM + 'entry')]
        self.assertEqual(ids, ['https://gurbanisoul.com/en/hukamnama/2026-11-10'])
        self.assertNotIn(corpus_lines(*R680)[1][1], body)

    def test_a_malformed_item_is_left_out(self):
        self.api(record('2026-11-11', first_line_id='29497'), record('2026-11-10', R673, status='held'),
                 {'amritsar_date': 'yesterday', 'status': 'published'}, 'x', record('2026-11-09', R673))
        with mock.patch('sys.stderr'):
            feed, _, _ = self.atom()
        self.assertEqual(len(feed.findall(ATOM + 'entry')), 1)


class Dates(Base):
    def test_a_day_after_the_amritsar_date_is_never_listed(self):
        self.api(record('2026-11-12'), record('2026-11-11', R673))
        feed, _, _ = self.atom()
        self.assertEqual([e.find(ATOM + 'id').text[-10:] for e in feed.findall(ATOM + 'entry')], ['2026-11-11'])
        before_midnight_ist = datetime(2026, 11, 10, 18, 0, tzinfo=timezone.utc)      # 23:30 IST, 10 Nov
        hf.reset()
        feed, _, _ = self.atom(before_midnight_ist)
        self.assertEqual(feed.findall(ATOM + 'entry'), [])

    def test_a_remembered_list_also_drops_a_day_that_is_not_yet(self):
        self.api(record('2026-11-11'))
        self.assertEqual(len(self.atom()[0].findall(ATOM + 'entry')), 1)
        earlier = datetime(2026, 11, 10, 10, 0, tzinfo=timezone.utc)
        self.assertEqual(self.atom(earlier)[0].findall(ATOM + 'entry'), [])          # served from memory

    def test_newest_first_one_entry_per_date_and_none_before_the_first_day(self):
        self.api(record('2026-11-09', R673), record('2026-11-11'), record('2026-11-11', R673), record('2026-10-31'))
        feed, _, _ = self.atom()
        self.assertEqual([e.find(ATOM + 'id').text[-10:] for e in feed.findall(ATOM + 'entry')],
                         ['2026-11-11', '2026-11-09'])
        self.assertEqual(feed.find(ATOM + 'updated').text, '2026-11-11T00:25:03+00:00')

    def test_an_empty_feed_is_valid_and_its_bytes_do_not_change(self):
        self.api()
        feed, body, _ = self.atom()
        self.assertEqual(feed.findall(ATOM + 'entry'), [])
        self.assertEqual(feed.find(ATOM + 'updated').text, hf.EPOCH)
        self.assertEqual(self.json()[0]['items'], [])

    def test_an_unusable_publication_time_falls_back_to_the_days_date(self):
        self.api(record('2026-11-11', published_at='soon'), record('2026-11-10', R673, published_at='2026-11-10T06:00:00'))
        feed, _, _ = self.atom()
        self.assertEqual([e.find(ATOM + 'updated').text for e in feed.findall(ATOM + 'entry')],
                         ['2026-11-11T00:00:00+00:00', '2026-11-10T00:00:00+00:00'])

    def test_a_corrected_day_reaches_feed_readers_as_an_updated_entry(self):
        self.api(record('2026-11-11'), record('2026-11-10', R673, corrected_at='2026-11-11T09:30:00+00:00'))
        feed, _, _ = self.atom()
        self.assertEqual([e.find(ATOM + 'updated').text for e in feed.findall(ATOM + 'entry')],
                         ['2026-11-11T00:25:03+00:00', '2026-11-11T09:30:00+00:00'])
        self.assertEqual(feed.find(ATOM + 'updated').text, '2026-11-11T09:30:00+00:00')
        # a correction time that is not a time is ignored, never shown
        self.api(record('2026-11-11', corrected_at='<b>now</b>'))
        feed, body, _ = self.atom()
        self.assertEqual(feed.find(ATOM + 'entry').find(ATOM + 'updated').text, '2026-11-11T00:25:03+00:00')
        self.assertNotIn('<b>now', body)


class Layers(Base):
    def test_titles_and_summaries_never_carry_scripture(self):
        self.api(record('2026-11-11'), record('2026-11-10', R673))
        feed, _, _ = self.atom()
        for el in [feed.find(ATOM + 'title'), feed.find(ATOM + 'subtitle')] + \
                [e.find(ATOM + t) for e in feed.findall(ATOM + 'entry') for t in ('title', 'summary')]:
            self.assertIsNone(GURMUKHI.search(el.text), el.text)
        first = feed.find(ATOM + 'entry')
        self.assertEqual(first.find(ATOM + 'title').text, 'Hukamnama · Sri Harmandir Sahib · 11 November 2026')
        self.assertEqual(first.find(ATOM + 'summary').text, 'Sri Guru Granth Sahib Ji · Ang 680')
        for item in self.json()[0]['items']:
            self.assertIsNone(GURMUKHI.search(item['title'] + item['summary']))

    def test_gurmukhi_comes_first_and_alone_then_each_layer_under_its_label(self):
        self.api(record('2026-11-11', translation={'lang': 'en'}))
        content = self.atom()[0].find(ATOM + 'entry').find(ATOM + 'content').text
        block = re.search(r'<div lang="pa">.*?</div>', content, re.S).group(0)
        self.assertTrue(content.startswith('<div lang="pa">'))
        self.assertIsNone(re.search('[A-Za-z]{4,}', re.sub(r'<[^>]+>', '', block)))      # no Latin text inside it
        rest = content[len(block):]
        self.assertLess(rest.index('Transliteration'), rest.index('<div lang="pa-Latn">'))
        self.assertLess(rest.index(hf.TRANSLATION_LABEL), rest.index('<div lang="en">'))
        self.assertIsNone(GURMUKHI.search(rest.split('<div lang="pa-Latn">')[1]))        # nothing blended back in
        self.assertIn('Not affiliated with SGPC', rest)
        self.assertNotIn('official', content.lower())

    def test_no_translation_unless_the_meaning_layer_is_on_upstream(self):
        self.api(record('2026-11-11'))
        content = self.atom()[0].find(ATOM + 'entry').find(ATOM + 'content').text
        self.assertNotIn('English translation', content)
        self.assertNotIn('<div lang="en">', content)

    def test_text_is_escaped_for_both_formats(self):
        day = {'date': datetime(2026, 11, 11).date(), 'ang': 1, 'ang_end': 2, 'published_at': None, 'meaning': True,
               'lines': [{'gurmukhi': 'ੴ <b>&</b>', 'translit': 'a "q" </content>', 'en': '</script><script>x'}]}
        feed = ET.fromstring(hf.atom([day]).encode('utf-8'))                             # still well-formed
        content = feed.find(ATOM + 'entry').find(ATOM + 'content').text
        self.assertIn('<p>ੴ &lt;b&gt;&amp;&lt;/b&gt;</p>', content)
        self.assertEqual(gurmukhi_of(content), ['ੴ <b>&</b>'])
        self.assertNotIn('<script>', content)
        self.assertEqual(feed.find(ATOM + 'entry').find(ATOM + 'summary').text, 'Sri Guru Granth Sahib Ji · Ang 1–2')
        raw = hf.json_feed([day])
        self.assertNotIn('<', raw)
        self.assertEqual(json.loads(raw)['items'][0]['content_html'], hf.content_html(day))

    def test_a_character_xml_cannot_carry_keeps_the_day_out(self):
        self.assertTrue(hf._xml_safe('ੴ ਸਤਿ ਨਾਮੁ\n\t𝄞'))
        for bad in ('\x00', '\x0b', '\x1f', '￾', '\ud800'):
            self.assertFalse(hf._xml_safe('a' + bad), repr(bad))


class Failure(Base):
    def test_off_without_the_api(self):
        with mock.patch.dict(os.environ, {'HUKAMNAMA_API': ''}):
            self.assertIsNone(hf.feed_for('atom', NOW))

    def test_api_down_and_nothing_remembered_is_503(self):
        fake = self.api(record('2026-11-11'))
        fake.down = True
        self.assertEqual(hf.feed_for('atom', NOW), (503, None, 'no-store'))
        self.assertEqual(hf.feed_for('json', NOW)[0], 503)
        self.assertEqual(len(fake.calls), 1)                                             # not asked again at once

    def test_api_down_serves_the_last_proven_list(self):
        fake = self.api(record('2026-11-11'))
        self.assertEqual(len(hf.recent(NOW.date(), clock=lambda: 0.0)), 1)
        fake.down = True
        self.assertEqual(len(hf.recent(NOW.date(), clock=lambda: 100.0)), 1)             # asked, failed, last good
        self.assertEqual(len(hf.recent(NOW.date(), clock=lambda: 105.0)), 1)             # within the pause: not asked
        self.assertEqual(len(fake.calls), 2)
        self.assertEqual(len(hf.recent(NOW.date(), clock=lambda: 120.0)), 1)             # after it: asked again
        self.assertEqual(len(fake.calls), 3)

    def test_a_burst_asks_the_api_once(self):
        fake = self.api(record('2026-11-11'))
        for _ in range(5):
            hf.feed_for('atom', NOW); hf.feed_for('json', NOW)
        self.assertEqual(len(fake.calls), 1)

    def test_a_malformed_list_is_unavailable(self):
        fake = self.api()
        fake.items = None
        self.assertEqual(hf.feed_for('atom', NOW)[0], 503)


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

    def test_both_feeds_are_served_with_their_types_cache_and_etag(self):
        self.api(record(datetime.now(timezone.utc).astimezone(hp.IST).date().isoformat()))
        for path, ctype, start in (('/feeds/hukamnama.xml', 'application/atom+xml; charset=utf-8', b'<?xml'),
                                   ('/feeds/hukamnama.json', 'application/feed+json; charset=utf-8', b'{')):
            r, body = self.get(path)
            self.assertEqual((r.status, r.getheader('Content-Type')), (200, ctype))
            self.assertTrue(body.startswith(start))
            self.assertEqual(r.getheader('Cache-Control'), hf.CACHE)
            self.assertEqual(r.getheader('Access-Control-Allow-Origin'), '*')
            self.assertEqual(r.getheader('X-Content-Type-Options'), 'nosniff')
            r2, body2 = self.get(path, {'If-None-Match': r.getheader('ETag')})
            self.assertEqual((r2.status, body2), (304, b''))
            r3, body3 = self.get(path, method='HEAD')
            self.assertEqual((r3.status, body3), (200, b''))

    def test_unavailable_is_503_with_retry_after_and_no_text(self):
        self.api().down = True
        r, body = self.get('/feeds/hukamnama.xml')
        self.assertEqual((r.status, r.getheader('Retry-After'), r.getheader('Cache-Control')), (503, '30', 'no-store'))
        self.assertIsNone(GURMUKHI.search(body.decode('utf-8')))

    def test_other_feed_paths_and_an_unconfigured_server_are_left_to_the_static_site(self):
        self.api(record('2026-11-11'))
        self.assertEqual(self.get('/feeds/other.xml')[0].status, 404)
        with mock.patch.dict(os.environ, {'HUKAMNAMA_API': ''}):
            self.assertEqual(self.get('/feeds/hukamnama.xml')[0].status, 404)


if __name__ == '__main__':
    unittest.main()
