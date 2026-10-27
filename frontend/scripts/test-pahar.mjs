#!/usr/bin/env node
// Gate tests for pahar computation (repo style: standalone script, exit 1 on
// failure — no test-runner dependency). Run: node frontend/scripts/test-pahar.mjs
import {
  paharFromMinutes, paharFixed, paharWindow, paharLabel, paharRange, fmt12,
  sunTimes, paharSolar, paharSolarWindow, nextPaharBoundary, raagsForPahar,
} from '../src/scripts/pahar.js';
import { halfOf, faceDegrees, clipToHalf, halfLabels, halfSpoken } from '../src/scripts/paharface.js';

let pass = 0, fail = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}` + (ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));
}
function near(name, got, want, tol) {
  const ok = Math.abs(got - want) <= tol;
  ok ? pass++ : fail++;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}` + (ok ? '' : ` — got ${got}, want ${want}±${tol}`));
}

console.log('— fixed-clock boundaries (half-open [start,end), 6 AM anchor) —');
eq('06:00 -> pahar 1', paharFromMinutes(360), 1);
eq('05:59 -> pahar 8', paharFromMinutes(359), 8);
eq('08:59 -> pahar 1', paharFromMinutes(539), 1);
eq('09:00 -> pahar 2', paharFromMinutes(540), 2);
eq('12:00 -> pahar 3', paharFromMinutes(720), 3);
eq('15:00 -> pahar 4', paharFromMinutes(900), 4);
eq('18:00 -> pahar 5', paharFromMinutes(1080), 5);
eq('21:00 -> pahar 6', paharFromMinutes(1260), 6);
eq('23:59 -> pahar 6', paharFromMinutes(1439), 6);
eq('00:00 (midnight wrap) -> pahar 7', paharFromMinutes(0), 7);
eq('02:59 -> pahar 7', paharFromMinutes(179), 7);
eq('03:00 -> pahar 8', paharFromMinutes(180), 8);
eq('paharFixed uses wall clock', paharFixed(new Date(2026, 6, 11, 6, 0)), 1);

console.log('— DST days are wall-clock by design —');
// On a spring-forward day 02:30 never exists on the wall; the mapping stays
// total and consistent for every minute value regardless.
eq('02:00 -> 7 on any day incl. DST-forward', paharFromMinutes(120), 7);
eq('03:00 -> 8 on any day incl. DST-forward', paharFromMinutes(180), 8);
// Fall-back day: 01:30 occurs twice on the wall; both occurrences are pahar 7.
eq('01:30 -> 7 (fall-back repeat is consistent)', paharFromMinutes(90), 7);

console.log('— windows / labels / ranges —');
eq('window of pahar 1', paharWindow(1), { start: 360, end: 540 });
eq('window of pahar 8 wraps to 06:00', paharWindow(8), { start: 180, end: 360 });
eq('label pahar 4', paharLabel(4), '4th pahar of day');
eq('label pahar 5', paharLabel(5), '1st pahar of night');
eq('label pahar 8', paharLabel(8), '4th pahar of night');
eq('range pahar 4', paharRange(4), '3–6 PM');
eq('range pahar 6 crosses meridiem', paharRange(6), '9 PM–12 AM');
eq('fmt12 15:00', fmt12('15:00'), '3 PM');
eq('fmt12 00:30', fmt12('00:30'), '12:30 AM');

console.log('— NOAA solar (Amritsar 31.63N 74.87E, tz IST=-330) — invariant-based —');
const IST = -330;
const eqx = sunTimes(new Date(2026, 2, 20), 31.63, 74.87, IST);   // March equinox
near('equinox day length ≈ 12h', eqx.sunset - eqx.sunrise, 720, 12);
// solar noon ≈ 12:00 + (82.5°E IST meridian − 74.87°E)·4 min ≈ 12:31 IST (±eqtime)
near('equinox solar noon ≈ 12:31 IST', (eqx.sunrise + eqx.sunset) / 2, 751, 12);
const jun = sunTimes(new Date(2026, 5, 21), 31.63, 74.87, IST);   // June solstice
const dec = sunTimes(new Date(2026, 11, 21), 31.63, 74.87, IST);  // December solstice
near('June day length ≈ 14h04m', jun.sunset - jun.sunrise, 844, 15);
near('December day length ≈ 10h12m', dec.sunset - dec.sunrise, 612, 15);
eq('summer day longer than winter', jun.sunset - jun.sunrise > dec.sunset - dec.sunrise, true);
eq('polar guard: Longyearbyen (78.2N) June never sets', sunTimes(new Date(2026, 5, 21), 78.22, 15.65, -120).polar, true);
eq('polar guard: Longyearbyen December never rises', sunTimes(new Date(2026, 11, 21), 78.22, 15.65, -60).polar, true);

console.log('— solar pahars (unequal day/night watches) —');
const { sunrise: sr, sunset: ss } = jun;                          // long day: 4 long day-pahars
eq('sunrise itself -> pahar 1', paharSolar(sr, sr, ss), 1);
eq('minute before sunrise -> pahar 8', paharSolar(sr - 1, sr, ss), 8);
eq('sunset itself -> pahar 5', paharSolar(ss, sr, ss), 5);
eq('minute before sunset -> pahar 4', paharSolar(ss - 1, sr, ss), 4);
const dayLen = ss - sr, nightLen = 1440 - dayLen;
eq('solar mid-morning -> pahar 2', paharSolar(sr + Math.floor(dayLen * 3 / 8), sr, ss), 2);
eq('solar deep night wraps past midnight -> pahar 7',
   paharSolar((ss + Math.floor(nightLen * 5 / 8)) % 1440, sr, ss), 7);
const w1 = paharSolarWindow(1, sr, ss), w4 = paharSolarWindow(4, sr, ss);
eq('solar windows tile the day', w1.start === sr && w4.end === ss % 1440, true);
near('solar day-pahar ≈ dayLen/4', ((w1.end - w1.start) + 1440) % 1440, dayLen / 4, 1);

console.log('— next boundary countdown —');
eq('fixed: 05:00 -> 60 min to pahar 1', nextPaharBoundary(300, 'fixed'), { nextPahar: 1, minutes: 60 });
eq('fixed: 23:59 -> 1 min to pahar 7 (midnight)', nextPaharBoundary(1439, 'fixed'), { nextPahar: 7, minutes: 1 });
eq('fixed: exactly at boundary -> full 180', nextPaharBoundary(360, 'fixed').minutes, 180);
const nb = nextPaharBoundary(sr + 1, 'solar', sr, ss);
near('solar: just after sunrise -> ~dayLen/4 to pahar 2', nb.minutes, dayLen / 4 - 1, 1);

console.log('— raagsForPahar —');
const clock = { claims: { primary: [{ raag_name: 'ਆਸਾ', pahar: 8 }, { raag_name: 'ਬਿਲਾਵਲੁ', pahar: 1 }] } };
eq('pahar 8 raags', raagsForPahar(clock, 8).map(c => c.raag_name), ['ਆਸਾ']);
eq('pahar 7 is empty (deliberate)', raagsForPahar(clock, 7), []);
eq('handles missing payload', raagsForPahar(null, 1), []);

console.log('— the 12-hour face (ring and hands on one scale; presentation, not the contract) —');
eq('12 AM at the 12', faceDegrees(0), 0);
eq('6 AM at the 6, never beside the 9', faceDegrees(360), 180);
eq('9 AM at the 9', faceDegrees(540), 270);
eq('12 PM at the 12', faceDegrees(720), 0);
eq('6 PM at the 6', faceDegrees(1080), 180);
eq('wraps below zero', faceDegrees(-60), 330);
{
  let bad = 0;
  for (let m = 0; m < 1440; m++) {
    const hand = ((Math.floor(m / 60) % 12) + (m % 60) / 60) * 30;      // the hour hand at that minute
    if (Math.abs(faceDegrees(m) - hand) > 1e-9) bad++;
  }
  eq('every minute sits under the hour hand', bad, 0);
}
near('08:18 boundary = hour hand at 08:18', faceDegrees(498), (8 + 18 / 60) * 30, 1e-9);
eq('half: 11:59 is AM', halfOf(719).key, 'am');
eq('half: noon is PM', halfOf(720).key, 'pm');
eq('half: 23:59 is PM', halfOf(1439).key, 'pm');
eq('half: midnight is AM', halfOf(1440).key, 'am');
const AM = halfOf(0), PM = halfOf(720);
eq('fixed: AM half holds P7 P8 P1 P2', [1, 2, 3, 4, 5, 6, 7, 8].filter(p => clipToHalf(paharWindow(p), AM).length), [1, 2, 7, 8]);
eq('fixed: PM half holds P3–P6', [1, 2, 3, 4, 5, 6, 7, 8].filter(p => clipToHalf(paharWindow(p), PM).length), [3, 4, 5, 6]);
eq('fixed P6 ends on the 12 (1440), not 0', clipToHalf(paharWindow(6), PM), [{ start: 1260, end: 1440 }]);
{
  const ws = [1, 2, 3, 4, 5, 6, 7, 8].map(p => paharSolarWindow(p, 351, 1067));
  const p3 = ws[2];
  eq('solar P3 cut at noon (AM part)', clipToHalf(p3, AM), [{ start: p3.start, end: 720 }]);
  eq('solar P3 cut at noon (PM part)', clipToHalf(p3, PM), [{ start: 720, end: p3.end }]);
  const x = ws.find(w => w.end < w.start);
  eq('solar watch over midnight: PM part', clipToHalf(x, PM), [{ start: x.start, end: 1440 }]);
  eq('solar watch over midnight: AM tail', clipToHalf(x, AM), [{ start: 0, end: x.end }]);
  for (const h of [AM, PM]) {
    const sp = ws.flatMap(w => clipToHalf(w, h)).sort((a, b) => a.start - b.start);
    eq(`solar ${h.key} half tiles 720 min`, sp.reduce((t, s) => t + s.end - s.start, 0), 720);
    eq(`solar ${h.key} half has no gaps`, sp.every((s, i) => i === 0 ? s.start === h.start : s.start === sp[i - 1].end), true);
  }
}
eq('zero-length window is empty', clipToHalf({ start: 300, end: 300 }, AM), []);
eq('labels, 12-h AM', halfLabels(AM, false).map(l => l.label), ['AM', '3 AM', '6 AM', '9 AM']);
eq('labels, 24-h PM', halfLabels(PM, true).map(l => l.label), ['12–24', '15', '18', '21']);
eq('labels sit at the 12 · 3 · 6 · 9', halfLabels(PM, false).map(l => faceDegrees(l.minute)), [0, 90, 180, 270]);
eq('spoken PM half', halfSpoken(PM, false), '12 PM to 12 AM');

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
