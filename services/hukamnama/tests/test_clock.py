import unittest
from datetime import date, datetime, timedelta

from hukamnama import clock
from tests.helpers import utc


class ClockTests(unittest.TestCase):
    def test_amritsar_midnight_is_1830_utc(self):
        self.assertEqual(clock.amritsar_date(utc(2026, 11, 8, 18, 29, 59)), date(2026, 11, 8))
        self.assertEqual(clock.amritsar_date(utc(2026, 11, 8, 18, 30, 0)), date(2026, 11, 9))

    def test_publish_instant_is_still_the_previous_utc_day(self):
        # 05:00 IST on 9 Nov = 23:30 UTC on 8 Nov: a UTC date here would name the wrong day
        self.assertEqual(clock.amritsar_date(utc(2026, 11, 8, 23, 30)), date(2026, 11, 9))

    def test_naive_datetimes_are_refused(self):
        with self.assertRaises(ValueError):
            clock.amritsar_date(datetime(2026, 11, 9, 5, 0))

    def test_poll_windows(self):
        self.assertIsNone(clock.poll_interval(utc(2026, 11, 8, 23, 29)))          # 04:59 IST
        self.assertEqual(clock.poll_interval(utc(2026, 11, 8, 23, 30)), timedelta(minutes=1))
        self.assertEqual(clock.poll_interval(utc(2026, 11, 9, 3, 30)), timedelta(minutes=10))   # 09:00
        self.assertIsNone(clock.poll_interval(utc(2026, 11, 9, 8, 30)))           # 14:00 IST

    def test_parse_day_is_strict(self):
        self.assertEqual(clock.parse_day("2026-11-09"), date(2026, 11, 9))
        for bad in ("2026-1-09", "20261109", "2026-11-09x", "2026-13-01", "２０２６-11-09", "2026/11/09"):
            with self.assertRaises(ValueError, msg=bad):
                clock.parse_day(bad)

    def test_expected_by_is_0530_ist(self):
        self.assertEqual(clock.at_ist(date(2026, 11, 9), clock.EXPECTED_BY), utc(2026, 11, 9, 0, 0))


if __name__ == "__main__":
    unittest.main()
