// paharface.js — where the eight watches sit on an ordinary 12-hour clock face: the ONE scale the
// Raag Clock's ring and its analog face share, as in the app (gurbani-soul-ios PaharFace.swift).
//
// The face is 12 at the top, 3 right, 6 bottom, 9 left: 30° per hour, the angle the hour hand
// points at. A 12-hour face can show only half a day, so the ring shows the half the hour hand is
// in — 12 AM–12 PM or 12 PM–12 AM — with every watch clipped to it.
//
// Presentation geometry only: NOT part of the pahar.js contract (pahar.js stays the golden-vector
// source). Plain JS, DOM-free, integer minutes-since-local-midnight in, degrees clockwise from
// 12 o'clock out; gated by frontend/scripts/test-pahar.mjs.

const wrap = (m) => ((m % 1440) + 1440) % 1440;

/** The half of the day containing minute-of-day m: { key: 'am'|'pm', start: 0|720, end: 720|1440 }.
 *  Noon is PM, midnight is AM — the instant the hour hand passes 12 the face turns. */
export function halfOf(m) {
  const am = wrap(m) < 720;
  return { key: am ? 'am' : 'pm', start: am ? 0 : 720, end: am ? 720 : 1440 };
}

/** Degrees clockwise from 12 o'clock on a 12-hour face — exactly the hour hand's angle at that
 *  wall-clock minute (06:00 and 18:00 are both 180°; 08:18 is 249°). Result in [0, 360). */
export function faceDegrees(m) {
  const r = m % 720;
  return ((r < 0 ? r + 720 : r) / 720) * 360;
}

/** The part(s) of a watch window {start, end} (end may wrap past midnight) inside `half`, as
 *  non-wrapping spans {start, end} with half.start ≤ start < end ≤ half.end, in clock order.
 *  A watch crossing noon or midnight is cut there; a zero-length window is empty. */
export function clipToHalf(w, half) {
  const s = wrap(w.start), e0 = wrap(w.end);
  if (s === e0) return [];
  const e = e0 < s ? e0 + 1440 : e0;
  const out = [];
  for (const shift of [-1440, 0]) {          // the wrapped tail lands in tomorrow's AM half
    const a = Math.max(s + shift, half.start), b = Math.min(e + shift, half.end);
    if (a < b) out.push({ start: a, end: b });
  }
  return out.sort((x, y) => x.start - y.start);
}

/** The ring's labels for one half, at the dial's own 12 · 3 · 6 · 9 (minute-of-day → label):
 *  the half's name on the 12, then that half's 3 · 6 · 9 hours. */
export function halfLabels(half, h24) {
  const name = h24 ? (half.key === 'am' ? '00–12' : '12–24') : half.key.toUpperCase();
  const hours = [3, 6, 9].map((h) => {
    const h24v = half.start / 60 + h;
    return { minute: h24v * 60, label: h24 ? String(h24v).padStart(2, '0') : `${h} ${h24v < 12 ? 'AM' : 'PM'}` };
  });
  return [{ minute: half.start, label: name }, ...hours];
}

/** Spoken: "12 AM to 12 PM" / "00:00 to 12:00". */
export function halfSpoken(half, h24) {
  if (h24) return half.key === 'am' ? '00:00 to 12:00' : '12:00 to 24:00';
  return half.key === 'am' ? '12 AM to 12 PM' : '12 PM to 12 AM';
}
