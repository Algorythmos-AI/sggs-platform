"""The Hukamnama pages (webapp/hukamnama_page.py): fidelity, dates, states, caching, escaping."""
import hashlib
import http.client
import os
import re
import shutil
import sqlite3
import sys
import tempfile
import threading
import unittest
import urllib.error
from datetime import date, datetime, timezone
from http.server import ThreadingHTTPServer
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import hukamnama_page as hp  # noqa: E402
import serve  # noqa: E402

DB = os.path.join(HERE, '..', '..', 'db', 'sggs.sqlite')
FIXTURE = os.path.join(HERE, 'fixtures', 'hukamnama-shell.html')
API = 'https://api.example.test'
R680, R673 = (29497, 29503), (29237, 29247)
AFTER = datetime(2026, 11, 11, 2, 0, tzinfo=timezone.utc)       # 07:30 IST, 11 Nov
BEFORE = datetime(2026, 11, 10, 20, 0, tzinfo=timezone.utc)     # 01:30 IST, 11 Nov
AFTERNOON = datetime(2026, 11, 11, 10, 0, tzinfo=timezone.utc)  # 15:30 IST, 11 Nov


def corpus_lines(first, last):
    con = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
    try:
        return con.execute('SELECT id, gurmukhi, translit FROM lines WHERE id BETWEEN ? AND ? ORDER BY id',
                           (first, last)).fetchall()
    finally:
        con.close()


def record(day, rng=R680, **over):
    digest = hashlib.sha256('\n'.join(g for _, g, _ in corpus_lines(*rng)).encode('utf-8')).hexdigest()
    rec = {'amritsar_date': day, 'status': 'published', 'first_line_id': rng[0], 'last_line_id': rng[1],
           'range_sha256': digest, 'published_at': f'{day}T00:25:03+00:00',
           # what the API also sends; none of it may reach the page
           'opening_gurmukhi': '<b>NOT FROM THE CORPUS</b>', 'lines': [{'id': rng[0], 'gurmukhi': 'ਗਲਤ <script>'}]}
    rec.update(over)
    return rec


class FakeApi:
    def __init__(self, days=None, latest=None):
        self.days, self.latest, self.calls, self.down = dict(days or {}), latest, [], False
        self.index_calls, self.index = [], None       # index: what /index answers (default: the published days)

    def __call__(self, url):
        if url == API + '/v1/hukamnama/index':        # the list of published dates (previous/next links)
            self.index_calls.append(url)
            if self.down:
                raise urllib.error.URLError('down')
            if self.index is not None:
                return self.index
            return {'days': [{'amritsar_date': d, 'published_at': r.get('published_at')}
                             for d, r in self.days.items() if r.get('status') == 'published']}
        self.calls.append(url)
        if self.down:
            raise urllib.error.URLError('down')
        assert url.startswith(API + '/v1/hukamnama/'), url
        day = url.rsplit('/', 1)[1]
        if day in self.days:
            return self.days[day]
        return {'amritsar_date': day, 'status': 'pending', 'latest': self.latest}


@unittest.skipUnless(os.path.isfile(DB), 'scripture DB not installed; run `make dataset`')
class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, True)
        shutil.copy(FIXTURE, os.path.join(self.tmp, 'en.html'))
        for p in (mock.patch.object(hp, 'SHELL_DIR', self.tmp), mock.patch.dict(os.environ, {'HUKAMNAMA_API': API})):
            p.start(); self.addCleanup(p.stop)
        hp.reset()
        self.addCleanup(hp.reset)

    def api(self, **kw):
        fake = FakeApi(**kw)
        p = mock.patch.object(hp, 'FETCH', fake)
        p.start(); self.addCleanup(p.stop)
        return fake

    def page(self, day_arg=None, now=AFTER, lang='en'):
        return hp.page_for(lang, day_arg, now)


class Fidelity(Base):
    def test_every_line_is_the_corpus_line_and_nothing_from_the_api_text_appears(self):
        self.api(days={'2026-11-11': record('2026-11-11')})
        status, html_, _ = self.page()
        self.assertEqual(status, 200)
        shown = re.findall(r'<p class="hk-gm gm" lang="pa" data-gm="[^"]*">([^<]*)</p>', html_)
        self.assertEqual(shown, [g for _, g, _ in corpus_lines(*R680)])
        self.assertEqual(re.findall(r'<p class="hk-tl" lang="pa-Latn">([^<]*)</p>', html_),
                         [t for _, _, t in corpus_lines(*R680)])
        self.assertNotIn('NOT FROM THE CORPUS', html_)
        self.assertNotIn('ਗਲਤ', html_)
        self.assertIn('Sri Guru Granth Sahib Ji · Ang 680', html_)
        self.assertIn('href="/reader?ang=680&amp;line=29497"', html_)

    def test_a_range_hash_that_does_not_match_the_corpus_shows_no_text(self):
        self.api(days={'2026-11-11': record('2026-11-11', range_sha256='f' * 64)})
        status, html_, cache = self.page()
        self.assertEqual((status, cache), (503, 'no-store'))
        self.assertIn('hk-unavailable', html_)
        self.assertNotIn('hk-gm', html_)
        self.assertIn('content="noindex, follow"', html_)

    def test_an_answer_for_another_date_is_refused(self):
        self.api(days={'2026-11-11': record('2026-11-10')})
        self.assertEqual(self.page()[0], 503)

    def test_malformed_records_are_refused(self):
        for over in ({'first_line_id': '29497'}, {'last_line_id': 29496}, {'last_line_id': 29497 + 400},
                     {'range_sha256': 'xyz'}, {'status': 'held'}, {'first_line_id': 0}, {'first_line_id': True}):
            hp.reset()
            self.api(days={'2026-11-11': record('2026-11-11', **over)})
            self.assertEqual(self.page()[0], 503, over)

    def test_a_range_missing_from_this_corpus_is_refused(self):
        self.api(days={'2026-11-11': record('2026-11-11', first_line_id=99_999_990, last_line_id=99_999_995)})
        self.assertEqual(self.page()[0], 503)

    def test_english_is_shown_only_when_the_meaning_layer_is_on_and_comes_from_this_corpus(self):
        self.api(days={'2026-11-11': record('2026-11-11')})
        off = self.page()[1]
        self.assertNotIn('hk-en', off)
        self.assertNotIn('Sant Singh Khalsa', off)
        hp.reset()
        self.api(days={'2026-11-11': record('2026-11-11', translation={'lang': 'en'},
                                             lines=[{'id': 29498, 'en': 'INJECTED ENGLISH'}])})
        on = self.page()[1]
        self.assertIn('English translation · Dr. Sant Singh Khalsa', on)
        self.assertIn('<p class="hk-en" lang="en">People try to deceive others', on)
        self.assertNotIn('INJECTED', on)
        strip = lambda h: re.findall(r'<p class="hk-gm[^>]*>([^<]*)</p>', h)
        self.assertEqual(strip(on), strip(off))             # the Gurmukhi is identical with the layer on

    def test_rahao_is_marked_in_words_not_only_by_style(self):
        self.api(days={'2026-11-11': record('2026-11-11')})
        html_ = self.page()[1]
        self.assertEqual(html_.count('hk-rahao-label'), 1)
        self.assertIn('data-line="29501"', html_)


class Corrections(Base):
    def test_a_corrected_day_says_when_in_amritsars_date(self):
        # corrected at 20:00 UTC on the 11th, which is already the 12th in Amritsar
        self.api(days={'2026-11-11': record('2026-11-11', corrected_at='2026-11-11T20:00:00+00:00')})
        _, page, _ = self.page('2026-11-11')
        self.assertIn('<p class="hk-corrected">Corrected on 12 November 2026.</p>', page)

    def test_an_uncorrected_day_says_nothing(self):
        self.api(days={'2026-11-11': record('2026-11-11')})
        self.assertNotIn('hk-corrected', self.page('2026-11-11')[1])

    def test_a_correction_time_that_is_not_a_time_shows_nothing(self):
        for bad in ('<b>now</b>', '2026-11-11T20:00:00', 12, ''):
            self.api(days={'2026-11-11': record('2026-11-11', corrected_at=bad)})
            page = self.page('2026-11-11')[1]
            self.assertNotIn('hk-corrected', page, bad)
            self.assertNotIn('<b>now', page)


class DatesAndStates(Base):
    def test_published_today_is_called_today(self):
        self.api(days={'2026-11-11': record('2026-11-11')})
        status, html_, _ = self.page()
        self.assertIn("<title>Today&#x27;s Hukamnama · Sri Harmandir Sahib (Golden Temple) · 11 November 2026</title>", html_)
        self.assertIn('content="index, follow"', html_)
        self.assertIn('href="https://gurbanisoul.com/en/hukamnama"', html_)
        self.assertNotIn('hk-status', html_)

    def test_before_publication_the_latest_is_shown_under_its_own_date_never_as_today(self):
        fake = self.api(days={'2026-11-10': record('2026-11-10', R673)}, latest='2026-11-10')
        status, html_, cache = self.page(now=BEFORE)
        self.assertEqual(status, 200)
        self.assertNotIn('Today', html_)
        self.assertIn('<title>Hukamnama 10 November 2026 · Sri Harmandir Sahib (Golden Temple)</title>', html_)
        self.assertIn('The Hukamnama for 11 November 2026 appears after about 05:30 IST.', html_)
        self.assertIn('<h2 class="hk-latest">10 November 2026</h2>', html_)
        self.assertIn('data-date="2026-11-10"', html_)
        self.assertIn('Ang 673', html_)
        self.assertIn('content="index, follow"', html_)
        self.assertEqual(cache, 'public, max-age=20, s-maxage=20')
        self.assertEqual([u.rsplit('/', 1)[1] for u in fake.calls], ['2026-11-11', '2026-11-10'])

    def test_after_two_pm_ist_it_says_not_published(self):
        self.api(days={'2026-11-10': record('2026-11-10', R673)}, latest='2026-11-10')
        html_ = self.page(now=AFTERNOON)[1]
        self.assertIn('The Hukamnama for 11 November 2026 has not been published.', html_)

    def test_the_api_is_asked_for_a_date_never_for_today(self):
        fake = self.api(days={'2026-11-11': record('2026-11-11')})
        self.page()
        self.assertEqual(fake.calls, [API + '/v1/hukamnama/2026-11-11'])

    def test_the_amritsar_date_turns_at_1830_utc(self):
        fake = self.api()
        self.page(now=datetime(2026, 11, 10, 18, 29, 59, tzinfo=timezone.utc))
        self.page(now=datetime(2026, 11, 10, 18, 30, 0, tzinfo=timezone.utc))
        self.assertEqual([u.rsplit('/', 1)[1] for u in fake.calls], ['2026-11-10', '2026-11-11'])

    def test_a_latest_that_is_today_or_later_or_garbage_is_not_followed(self):
        for latest in ('2026-11-11', '2026-11-12', '2026-10-01', 'yesterday', None, 5):
            hp.reset()
            fake = self.api(latest=latest)
            status, html_, _ = self.page()
            self.assertIn(status, (200, 503), latest)
            self.assertNotIn('hk-gm', html_, latest)
            self.assertEqual(len(fake.calls), 1, latest)

    def test_nothing_at_all_yet(self):
        self.api()
        status, html_, _ = self.page()
        self.assertEqual(status, 200)
        self.assertIn('No Hukamnama is available yet for 11 November 2026.', html_)
        self.assertIn('content="noindex, follow"', html_)

    def test_a_dated_page_is_permanent_and_dated(self):
        self.api(days={'2026-11-08': record('2026-11-08', R673)})
        status, html_, cache = self.page('2026-11-08')
        self.assertEqual((status, cache), (200, 'public, max-age=300, s-maxage=86400'))
        self.assertIn('<title>Hukamnama 8 November 2026 · Sri Harmandir Sahib (Golden Temple)</title>', html_)
        self.assertIn('href="https://gurbanisoul.com/en/hukamnama/2026-11-08"', html_)
        self.assertNotIn('Today', html_)

    def test_the_url_suffix_is_empty_for_today_and_the_date_for_a_dated_page(self):
        strings = hp.load_shell('en')[1]
        kw = dict(view='none', day=None, today=date(2026, 11, 11), hour_ist=7, path='/en/hukamnama')
        shell = 'href="/pa/hukamnama__HK_SUFFIX__"'
        self.assertEqual(hp.render(shell, strings, 'pa', **kw), 'href="/pa/hukamnama"')
        self.assertEqual(hp.render(shell, strings, 'pa', asked=date(2026, 11, 8), **kw), 'href="/pa/hukamnama/2026-11-08"')

    def test_a_language_may_write_the_first_of_the_month_its_own_way(self):
        strings = dict(hp.load_shell('en')[1], date_first='1er {month} {y}')
        self.assertEqual(hp._date_text(strings, date(2026, 12, 1)), '1er December 2026')
        self.assertEqual(hp._date_text(strings, date(2026, 12, 2)), '2 December 2026')
        self.assertEqual(hp._date_text(hp.load_shell('en')[1], date(2026, 12, 1)), '1 December 2026')

    def test_todays_dated_page_is_dated_not_today(self):
        self.api(days={'2026-11-11': record('2026-11-11')})
        self.assertNotIn('Today', self.page('2026-11-11')[1])

    def test_a_date_with_no_hukamnama_is_noindex(self):
        self.api()
        status, html_, _ = self.page('2026-11-09')
        self.assertEqual(status, 200)
        self.assertIn('content="noindex, follow"', html_)
        self.assertIn('No Hukamnama was published here for this date.', html_)
        self.assertIn('9 November 2026', html_)
        self.assertNotIn('hk-gm', html_)

    def test_future_too_early_and_impossible_dates_are_404_without_asking_the_api(self):
        fake = self.api()
        for arg in ('2026-11-12', '2026-10-31', '2026-02-30', '2026-13-01'):
            self.assertEqual(self.page(arg)[0], 404, arg)
        self.assertEqual(fake.calls, [])

    def test_not_yet_from_the_api_is_pending_not_an_error(self):
        def not_yet(url):
            raise urllib.error.HTTPError(url, 404, 'Not Found', {}, None)
        with mock.patch.object(hp, 'FETCH', not_yet):
            self.assertEqual(self.page()[0], 200)


class CachingAndOutages(Base):
    def test_today_is_never_cached_past_amritsar_midnight(self):
        self.api(days={'2026-11-11': record('2026-11-11')})
        self.assertEqual(self.page(now=AFTER)[2], 'public, max-age=60, s-maxage=60')
        hp.reset()
        late = datetime(2026, 11, 11, 18, 29, 45, tzinfo=timezone.utc)      # 15 s before midnight IST
        self.assertEqual(self.page(now=late)[2], 'public, max-age=15, s-maxage=15')

    def test_answers_are_remembered_briefly(self):
        fake = self.api(days={'2026-11-11': record('2026-11-11')})
        self.page(); self.page(); self.page('2026-11-11')
        self.assertEqual(len(fake.calls), 1)

    def test_an_outage_serves_a_day_already_proven_and_503s_one_that_was_not(self):
        fake = self.api(days={'2026-11-11': record('2026-11-11')})
        self.assertEqual(self.page()[0], 200)
        fake.down = True
        with mock.patch.object(hp, 'FRESH_TODAY', 0.0), mock.patch.object(hp, 'NEGATIVE', 0.0):
            status, html_, _ = self.page()
            self.assertEqual(status, 200)
            self.assertIn('data-date="2026-11-11"', html_)
            status, html_, cache = self.page('2026-11-08')
        self.assertEqual((status, cache), (503, 'no-store'))
        self.assertNotIn('hk-gm', html_)

    def test_an_outage_is_not_retried_on_every_request(self):
        fake = self.api()
        fake.down = True
        for _ in range(5):
            self.assertEqual(self.page()[0], 503)
        self.assertEqual(len(fake.calls), 1)

    def test_a_day_the_owner_withdraws_stops_being_served(self):
        fake = self.api(days={'2026-11-11': record('2026-11-11')})
        self.page()
        del fake.days['2026-11-11']
        with mock.patch.object(hp, 'FRESH_TODAY', 0.0):
            html_ = self.page()[1]
        self.assertNotIn('data-date="2026-11-11"', html_)
        fake.down = True
        with mock.patch.object(hp, 'FRESH_PENDING', 0.0), mock.patch.object(hp, 'NEGATIVE', 0.0):
            self.assertEqual(self.page()[0], 503)             # not resurrected from memory


class Escaping(Base):
    def test_shell_words_and_values_are_escaped(self):
        path = os.path.join(self.tmp, 'en.html')
        with open(path, encoding='utf-8') as f:
            text = f.read()
        text = text.replace('"citation":"Sri Guru Granth Sahib Ji · Ang {ang}"',
                            '"citation":"<img src=x onerror=1> Ang {ang} \\"q\\""')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
        self.api(days={'2026-11-11': record('2026-11-11')})
        html_ = self.page()[1]
        self.assertNotIn('<img', html_)
        self.assertIn('&lt;img src=x onerror=1&gt; Ang 680', html_)

    def test_jsonld_cannot_close_its_script(self):
        day = {'date': date(2026, 11, 11), 'published_at': None, 'ang': 680}
        out = hp._jsonld('en', 'https://gurbanisoul.com/x', '</script><script>alert(1)', 'a & b', day)
        self.assertNotIn('<', out)
        self.assertNotIn('&', out)

    def test_conditional_blocks_nest_and_adjacent_tokens_are_separate(self):
        strings = hp.load_shell('en')[1]
        shell = 'a__HK_IF_SHABAD__b__HK_IF_MEANING__c__HK_ENDIF__d__HK_IF_TODAY__e__HK_ENDIF____HK_ENDIF__f__HK_ANG____HK_H1__'
        kw = dict(view='unavailable', day=None, today=date(2026, 11, 11), hour_ist=7, path='/en/hukamnama')
        self.assertEqual(hp.render(shell, strings, 'en', **kw), 'afHukamnama · 11 November 2026')
        self.api(days={'2026-11-11': record('2026-11-11')})
        day = hp.day_state(date(2026, 11, 11), date(2026, 11, 11))[1]
        self.assertEqual(hp.render(shell, strings, 'en', **{**kw, 'view': 'today', 'day': day}),
                         "abdef680Today&#x27;s Hukamnama · 11 November 2026")

    def test_no_token_is_left_in_the_page(self):
        self.api(days={'2026-11-11': record('2026-11-11')})
        for arg, now in ((None, AFTER), (None, BEFORE), ('2026-11-09', AFTER)):
            self.assertNotIn('__HK_', self.page(arg, now)[1])
        self.assertNotIn('hk-strings', self.page()[1])


class Off(Base):
    def test_without_the_api_address_the_path_is_not_handled(self):
        with mock.patch.dict(os.environ, {'HUKAMNAMA_API': ''}):
            self.assertIsNone(self.page())
        with mock.patch.dict(os.environ, {'HUKAMNAMA_API': 'http://evil.example'}):
            self.assertIsNone(self.page())

    def test_without_a_shell_for_the_language_the_path_is_not_handled(self):
        self.api()
        self.assertIsNone(self.page(lang='pa'))
        self.assertIsNone(self.page(lang='..'))

    def test_a_shell_without_its_words_is_not_served(self):
        with open(os.path.join(self.tmp, 'fr.html'), 'w', encoding='utf-8') as f:
            f.write('<html>__HK_TITLE__</html>')
        self.api()
        self.assertIsNone(self.page(lang='fr'))

    def test_other_paths_never_match(self):
        for path in ('/en/hukamnama/2026-11-11/x', '/en/hukamnamas', '/hukamnama', '/en/hukamnama/today',
                     '/EN/hukamnama', '/en/hukamnama/2026-11-1'):
            self.assertIsNone(hp.PATH_RE.match(path), path)


class OverHttp(Base):
    def setUp(self):
        super().setUp()
        serve.DB = DB
        self.httpd = ThreadingHTTPServer(('127.0.0.1', 0), serve.H)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.addCleanup(self.httpd.shutdown)

    def get(self, path, headers=None, method='GET'):
        c = http.client.HTTPConnection('127.0.0.1', self.httpd.server_address[1], timeout=10)
        c.request(method, path, headers=headers or {})
        r = c.getresponse()
        body = r.read().decode('utf-8')
        c.close()
        return r, body

    def test_the_page_is_served_with_security_headers_and_an_etag(self):
        today = hp.amritsar_now(datetime.now(timezone.utc)).date().isoformat()
        self.api(days={today: record(today)})
        r, body = self.get('/en/hukamnama')
        self.assertEqual(r.status, 200)
        self.assertEqual(r.getheader('Content-Type'), 'text/html; charset=utf-8')
        self.assertEqual(r.getheader('X-Content-Type-Options'), 'nosniff')
        self.assertEqual(r.getheader('X-Frame-Options'), 'DENY')
        self.assertIn('hk-gm', body)
        etag = r.getheader('ETag')
        again, empty = self.get('/en/hukamnama', {'If-None-Match': etag})
        self.assertEqual((again.status, empty), (304, ''))
        head, nothing = self.get('/en/hukamnama', method='HEAD')
        self.assertEqual((head.status, nothing), (200, ''))

    def test_an_outage_is_a_503_with_retry_after(self):
        fake = self.api()
        fake.down = True
        r, body = self.get('/en/hukamnama')
        self.assertEqual((r.status, r.getheader('Retry-After'), r.getheader('Cache-Control')), (503, '30', 'no-store'))

    def test_when_off_the_static_site_answers_as_before(self):
        with mock.patch.dict(os.environ, {'HUKAMNAMA_API': ''}):
            r, _ = self.get('/en/hukamnama')
        self.assertEqual(r.status, 404)
        r, _ = self.get('/api/ang/1')
        self.assertEqual(r.status, 200)


class DaysAround(Base):
    """The previous/next links and the breadcrumb trail: built from the API's list of dates."""
    DAYS = {'2026-11-08': record('2026-11-08', R673), '2026-11-10': record('2026-11-10', R673),
            '2026-11-11': record('2026-11-11')}

    def links(self, html_):
        return dict(re.findall(r'<a rel="(prev|next)" href="([^"]*)">', html_))

    def test_a_dated_page_links_the_published_days_on_either_side_skipping_unpublished_ones(self):
        self.api(days=self.DAYS)
        _, html_, _ = self.page('2026-11-10')
        self.assertEqual(self.links(html_), {'prev': '/en/hukamnama/2026-11-08', 'next': '/en/hukamnama/2026-11-11'})
        self.assertIn('>8 November 2026</a>', html_)
        self.assertIn('>11 November 2026</a>', html_)

    def test_today_has_no_next_and_the_first_day_no_previous(self):
        self.api(days=self.DAYS)
        self.assertEqual(self.links(self.page()[1]), {'prev': '/en/hukamnama/2026-11-10'})
        self.assertEqual(self.links(self.page('2026-11-08')[1]), {'next': '/en/hukamnama/2026-11-10'})

    def test_a_listed_future_day_is_never_linked(self):
        fake = self.api(days=self.DAYS)
        fake.index = {'days': [{'amritsar_date': d} for d in ('2026-11-10', '2026-11-11', '2026-11-12', '2026-10-31')]}
        self.assertEqual(self.links(self.page()[1]), {'prev': '/en/hukamnama/2026-11-10'})

    def test_without_the_list_the_page_is_shown_without_the_links(self):
        for index in ({'days': 'x'}, {}, None):
            hp.reset()
            fake = self.api(days=self.DAYS)
            fake.index = index if index is not None else {'nothing': 1}
            status, html_, _ = self.page('2026-11-10')
            self.assertEqual((status, self.links(html_)), (200, {}))
            self.assertNotIn('hk-days', html_)

    def test_an_api_without_the_index_falls_back_to_its_list(self):
        fake = self.api(days=self.DAYS)
        real = fake.__call__

        def old_api(url):
            if url.endswith('/v1/hukamnama/index'):
                raise urllib.error.HTTPError(url, 400, 'Bad Request', None, None)
            if url.endswith('/v1/hukamnama?limit=30'):
                return {'items': list(self.DAYS.values()) + [{'amritsar_date': '2026-11-09', 'status': 'pending'}]}
            return real(url)
        with mock.patch.object(hp, 'FETCH', old_api):
            self.assertEqual(self.links(self.page('2026-11-10')[1]),
                             {'prev': '/en/hukamnama/2026-11-08', 'next': '/en/hukamnama/2026-11-11'})

    def test_the_list_is_asked_for_once_in_a_burst_and_the_last_one_survives_an_outage(self):
        fake = self.api(days=self.DAYS)
        for _ in range(4):
            self.page('2026-11-10'); self.page()
        self.assertEqual(len(fake.index_calls), 1)
        self.assertEqual(len(hp.published_days(date(2026, 11, 11), clock=lambda: 10_000.0)), 3)
        fake.down = True
        self.assertEqual(len(hp.published_days(date(2026, 11, 11), clock=lambda: 20_000.0)), 3)   # last good
        self.assertEqual(len(hp.published_days(date(2026, 11, 9), clock=lambda: 20_001.0)), 1)    # and never ahead

    def test_the_breadcrumb_trail_names_the_site_the_section_and_the_date(self):
        import json as _json
        shell, strings = hp.load_shell('en')
        day = hp._prove(hp.published_record(record('2026-11-10', R673), date(2026, 11, 10)))
        kw = dict(view='dated', day=day, today=date(2026, 11, 11), hour_ist=8, path='/en/hukamnama/2026-11-10',
                  asked=date(2026, 11, 10))
        unnamed = {k: v for k, v in strings.items() if k != 'name'}
        plain = re.search(r'<script type="application/ld\+json">(.*?)</script>', hp.render(shell, unnamed, 'en', **kw), re.S)
        self.assertEqual(_json.loads(plain.group(1))['@type'], 'WebPage')            # a shell without the name: as before
        named = dict(strings, name='Hukamnama · <Sri> Harmandir Sahib')
        block = re.search(r'<script type="application/ld\+json">(.*?)</script>', hp.render(shell, named, 'en', **kw), re.S).group(1)
        self.assertNotIn('<', block)
        page, crumbs = _json.loads(block)
        self.assertEqual((page['@type'], crumbs['@type']), ('WebPage', 'BreadcrumbList'))
        self.assertEqual([(x['position'], x['name'], x['item']) for x in crumbs['itemListElement']],
                         [(1, 'Gurbani Soul', 'https://gurbanisoul.com/en'),
                          (2, 'Hukamnama · <Sri> Harmandir Sahib', 'https://gurbanisoul.com/en/hukamnama'),
                          (3, '10 November 2026', 'https://gurbanisoul.com/en/hukamnama/2026-11-10')])
        today = _json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', hp.render(
            shell, named, 'en', view='today', day=day, today=date(2026, 11, 10), hour_ist=8, path='/en/hukamnama'), re.S).group(1))
        self.assertEqual(len(today[1]['itemListElement']), 2)


if __name__ == '__main__':
    unittest.main()
