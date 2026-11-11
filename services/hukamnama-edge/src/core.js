// The public Hukamnama API, served at the edge from the service's snapshot files.
//
//   GET /v1/hukamnama/today            the current Amritsar day (published | pending)
//   GET /v1/hukamnama/YYYY-MM-DD       one day, from the first archived date up to today
//   GET /v1/hukamnama?limit=N          the latest published days, N in 1..30 (default 7);
//                                      &include=lines adds every line of each day
//   GET /v1/hukamnama/index            every published day, newest first (date, Ang, range hash,
//                                      when; no text): what a sitemap or an archive lists
//   GET /v1/status                     today's status and the latest published date
//
// The Hukamnama service (services/hukamnama, `public.py`) writes one file per published day and
// an index. This Worker only reads those files: it holds no scripture, computes no text and never
// talks to the service for a read, so public traffic cannot reach the process that polls SGPC and
// sends the pushes.
//
// Rules it enforces by itself:
//   * "today" is the Amritsar date computed here, at request time. A day's file is served only
//     when its own `amritsar_date` equals the date asked for; anything else is an error, never a
//     different day's Hukamnama.
//   * A day without a file is `pending`. Held days have no file, so they read as pending too.
//   * Reads are open to any origin (CORS) and carry a strong ETag. Device registration and
//     /health are passed to the service unchanged, with no CORS headers added here.

export const PREFIX = "v1/hukamnama/";
export const INDEX = PREFIX + "index.json";
export const EARLIEST = "2026-11-01";      // the archive is permanent: any date from here to today
export const DEFAULT_LIMIT = 7;
export const MAX_LIMIT = 30;

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;      // Amritsar is a fixed UTC+05:30: no DST
const EXPECTED_BY_UTC = "T00:00:00+00:00";            // 05:30 IST on the Amritsar date, in UTC
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const HEX64 = /^[0-9a-f]{64}$/;

const CACHE = {
  today: "public, max-age=60",
  past: "public, max-age=3600, s-maxage=86400",
  pending: "public, max-age=30",
  list: "public, max-age=60",
  none: "no-store",
};

const SECURITY = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "If-None-Match",
  "Access-Control-Expose-Headers": "ETag",
  "Access-Control-Max-Age": "86400",
};

/** The Amritsar calendar date ("YYYY-MM-DD") at an instant. */
export function amritsarDate(now) {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** A real calendar date in strict YYYY-MM-DD form, or null. */
export function parseDay(s) {
  if (!DAY_RE.test(s)) return null;
  const t = Date.parse(s + "T00:00:00Z");
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s) return null;
  return t;
}

async function readJson(bucket, key) {
  const obj = await bucket.get(key);
  if (obj === null || obj === undefined) return null;
  return JSON.parse(await obj.text());
}

class Corrupt extends Error {}

/** A day's file, only if it is what its name says it is. Null when there is no file. */
async function readDay(bucket, day) {
  const rec = await readJson(bucket, `${PREFIX}${day}.json`);
  if (rec === null) return null;
  if (rec.amritsar_date !== day || rec.status !== "published" || !HEX64.test(rec.range_sha256 || "")
      || !Array.isArray(rec.lines) || rec.lines.length === 0) {
    throw new Corrupt(`snapshot for ${day} is not a published record for that day`);
  }
  return rec;
}

async function readIndex(bucket) {
  const idx = await readJson(bucket, INDEX);
  if (idx === null) return { scripture_sha256: null, latest: null, days: [] };
  if (!Array.isArray(idx.days)) throw new Corrupt("index has no days");
  return idx;
}

function pending(day, idx) {
  return {
    amritsar_date: day,
    status: "pending",
    scripture_sha256: idx.scripture_sha256,
    expected_by: day + EXPECTED_BY_UTC,
    latest: idx.latest,
  };
}

function summary(rec) {
  const { lines, translation, ...rest } = rec;
  return rest;
}

async function etagOf(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `"${hex.slice(0, 32)}"`;
}

function requestId(request) {
  return request.headers.get("cf-ray") || crypto.randomUUID();
}

async function json(request, status, body, cache) {
  const text = JSON.stringify(body);
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": status === 200 ? cache : CACHE.none,
    ...SECURITY,
    ...CORS,
  });
  if (status === 200) {
    const etag = await etagOf(text);
    headers.set("ETag", etag);
    const seen = request.headers.get("If-None-Match");
    if (seen && seen.split(",").map((s) => s.trim().replace(/^W\//, "")).includes(etag)) {
      return new Response(null, { status: 304, headers });
    }
  }
  return new Response(request.method === "HEAD" ? null : text, { status, headers });
}

function fail(request, status, code, message, extra = {}) {
  // `error` stays a plain string: it is what the first clients of this API read.
  const res = json(request, status, { error: message, code, request_id: requestId(request) }, CACHE.none);
  return res.then((r) => {
    for (const [k, v] of Object.entries(extra)) r.headers.set(k, v);
    return r;
  });
}

async function limited(request, env) {
  if (!env.RATE_LIMITER) return false;
  const key = request.headers.get("CF-Connecting-IP") || "unknown";
  const { success } = await env.RATE_LIMITER.limit({ key });
  return !success;
}

async function day(request, env, today, arg) {
  let want = today;
  if (arg !== "today") {
    if (parseDay(arg) === null) return fail(request, 400, "invalid_request", "date must be YYYY-MM-DD");
    if (arg > today) return fail(request, 404, "not_found", "not yet");
    if (arg < EARLIEST) return fail(request, 404, "not_found", "no Hukamnama is archived before " + EARLIEST);
    want = arg;
  }
  const rec = await readDay(env.BUCKET, want);
  if (rec !== null) return json(request, 200, rec, want === today ? CACHE.today : CACHE.past);
  return json(request, 200, pending(want, await readIndex(env.BUCKET)), CACHE.pending);
}

async function list(request, env, today, query) {
  const raw = query.get("limit") ?? String(DEFAULT_LIMIT);
  if (!/^\d{1,2}$/.test(raw) || Number(raw) < 1 || Number(raw) > MAX_LIMIT) {
    return fail(request, 400, "invalid_request", `limit must be 1..${MAX_LIMIT}`);
  }
  const withLines = query.get("include") === "lines";
  const idx = await readIndex(env.BUCKET);
  // Never list a day ahead of the Amritsar date, whatever the files say.
  const days = idx.days.map((d) => d.amritsar_date).filter((d) => parseDay(d) !== null && d <= today)
    .slice(0, Number(raw));
  const records = await Promise.all(days.map((d) => readDay(env.BUCKET, d)));
  const items = records.filter((r) => r !== null).map((r) => (withLines ? r : summary(r)));
  return json(request, 200, { items }, CACHE.list);
}

async function index(request, env, today) {
  const idx = await readIndex(env.BUCKET);
  // Never a day ahead of the Amritsar date, whatever the file says.
  const days = idx.days.filter((d) => d && parseDay(d.amritsar_date) !== null && d.amritsar_date <= today
    && d.amritsar_date >= EARLIEST);
  return json(request, 200, {
    scripture_sha256: idx.scripture_sha256 ?? null,
    latest: days.length ? days[0].amritsar_date : null,
    days,
  }, CACHE.list);
}

async function status(request, env, today) {
  const idx = await readIndex(env.BUCKET);
  const rec = await readDay(env.BUCKET, today);
  return json(request, 200, {
    ok: true,
    amritsar_date: today,
    status_today: rec ? "published" : "pending",
    published_at: rec ? rec.published_at : null,
    latest: idx.latest,
    scripture_sha256: idx.scripture_sha256,
    // true while the owner has paused the service: nothing is served until it is resumed
    paused: idx.paused === true,
  }, CACHE.pending);
}

/** Device registration and /health belong to the service; everything else unknown is a 404. */
function isOriginPath(path) {
  return path === "/health" || path.startsWith("/v1/devices/");
}

async function toOrigin(request, env) {
  const headers = new Headers(request.headers);
  // The service trusts the client address only on requests that carry this secret, so a caller
  // cannot forge it; a value sent by the client is always replaced.
  headers.delete("X-Origin-Auth");
  // The address the service limits by. Only this Worker may say it: whatever the caller sent is
  // replaced by the address Cloudflare saw, and the service believes it only with the secret.
  headers.delete("X-Client-IP");
  if (env.ORIGIN_SECRET) {
    headers.set("X-Origin-Auth", env.ORIGIN_SECRET);
    const ip = request.headers.get("CF-Connecting-IP");
    if (ip) headers.set("X-Client-IP", ip);
  }
  return (env.ORIGIN_FETCH || fetch)(new Request(request, { headers }));
}

export async function handle(request, env, now = new Date()) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (isOriginPath(path)) return toOrigin(request, env);

  const isRead = path === "/v1/hukamnama" || path.startsWith("/v1/hukamnama/") || path === "/v1/status";
  if (!isRead) return fail(request, 404, "not_found", "not found");
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...CORS, ...SECURITY, "Cache-Control": "public, max-age=86400" } });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return fail(request, 405, "method_not_allowed", "method not allowed", { Allow: "GET, HEAD, OPTIONS" });
  }
  try {
    if (await limited(request, env)) {
      return fail(request, 429, "rate_limited", "slow down", { "Retry-After": "60" });
    }
    const today = amritsarDate(now);
    if (path === "/v1/status") return await status(request, env, today);
    if (path === "/v1/hukamnama") return await list(request, env, today, url.searchParams);
    if (path === "/v1/hukamnama/index") return await index(request, env, today);
    return await day(request, env, today, path.slice("/v1/hukamnama/".length));
  } catch (e) {
    // A file that is not what it should be, or storage that cannot be read: say so, serve nothing.
    return fail(request, 503, "unavailable", "temporarily unavailable", { "Retry-After": "30" });
  }
}
