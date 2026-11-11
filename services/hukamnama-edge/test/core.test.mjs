import assert from "node:assert/strict";
import { test } from "node:test";

import { amritsarDate, handle, parseDay } from "../src/core.js";

const SHA = "6197".padEnd(64, "a");
const FP = "0eff".padEnd(64, "b");

function record(day, ang = 680) {
  return {
    amritsar_date: day, status: "published", ang, first_line_id: 29497, last_line_id: 29498, comp_id: 2699,
    opening_line_id: 29498, opening_gurmukhi: "ਜਤਨ ਕਰੈ ਮਾਨੁਖ ਡਹਕਾਵੈ ਓਹੁ ਅੰਤਰਜਾਮੀ ਜਾਨੈ ॥", opening_translit: "jatan karai",
    line_count: 2, range_sha256: SHA, scripture_sha256: FP, citation: `Sri Guru Granth Sahib Ji · Ang ${ang}`,
    published_at: `${day}T00:25:03+00:00`, credit: "credit", url: `https://gurbanisoul.com/en/hukamnama/${day}`,
    lines: [
      { id: 29497, ang, gurmukhi: "ਧਨਾਸਰੀ ਮਹਲਾ ੫ ॥", translit: "dhanaasaree mahalaa", is_heading: true, is_rahao: false, author: "Guru Arjan Dev Ji (M5)", en: "Dhanaasaree, Fifth Mehl:" },
      { id: 29498, ang, gurmukhi: "ਜਤਨ ਕਰੈ ਮਾਨੁਖ ਡਹਕਾਵੈ ਓਹੁ ਅੰਤਰਜਾਮੀ ਜਾਨੈ ॥", translit: "jatan karai", is_heading: false, is_rahao: false, author: "Guru Arjan Dev Ji (M5)" },
    ],
    translation: { lang: "en", translator: "Dr. Sant Singh Khalsa", source: "ssk-shabados" },
  };
}

function bucket(days, extra = {}) {
  const files = { ...extra };
  for (const d of days) files[`v1/hukamnama/${d}.json`] = JSON.stringify(record(d));
  if (!("v1/hukamnama/index.json" in files)) {
    const sorted = [...days].sort().reverse();
    files["v1/hukamnama/index.json"] = JSON.stringify({
      scripture_sha256: FP, latest: sorted[0] ?? null, days: sorted.map((d) => ({ amritsar_date: d, ang: 680 })),
    });
  }
  const reads = [];
  return {
    reads,
    async get(key) {
      reads.push(key);
      return key in files && files[key] !== null ? { text: async () => files[key] } : null;
    },
  };
}

const at = (iso) => new Date(iso);
const AFTER = at("2026-11-11T02:00:00Z");          // 07:30 IST on 11 Nov
const BEFORE = at("2026-11-10T20:00:00Z");         // 01:30 IST on 11 Nov: before publication

async function get(path, env, now = AFTER, init = {}) {
  const res = await handle(new Request(`https://api.gurbanisoul.com${path}`, init), env, now);
  const text = await res.text();
  return { res, body: text ? JSON.parse(text) : null };
}

test("the Amritsar date turns over at 18:30 UTC", () => {
  assert.equal(amritsarDate(at("2026-11-10T18:29:59Z")), "2026-11-10");
  assert.equal(amritsarDate(at("2026-11-10T18:30:00Z")), "2026-11-11");
  assert.equal(amritsarDate(at("2026-12-31T18:30:00Z")), "2027-01-01");
});

test("only real dates in strict form parse", () => {
  assert.notEqual(parseDay("2026-11-11"), null);
  for (const bad of ["2026-02-30", "2026-13-01", "2026-1-1", "20261111", "today", "2026-11-11T00", ""]) {
    assert.equal(parseDay(bad), null, bad);
  }
});

test("today serves today's file, published", async () => {
  const { res, body } = await get("/v1/hukamnama/today", { BUCKET: bucket(["2026-11-10", "2026-11-11"]) });
  assert.equal(res.status, 200);
  assert.equal(body.amritsar_date, "2026-11-11");
  assert.equal(body.status, "published");
  assert.equal(body.lines.length, 2);
  assert.equal(res.headers.get("Cache-Control"), "public, max-age=60");
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
});

test("before publication today is pending and never yesterday's Hukamnama", async () => {
  const { res, body } = await get("/v1/hukamnama/today", { BUCKET: bucket(["2026-11-09", "2026-11-10"]) }, BEFORE);
  assert.equal(res.status, 200);
  assert.deepEqual(body, {
    amritsar_date: "2026-11-11", status: "pending", scripture_sha256: FP,
    expected_by: "2026-11-11T00:00:00+00:00", latest: "2026-11-10",
  });
  assert.equal(res.headers.get("Cache-Control"), "public, max-age=30");
});

test("a file that names another day is never served", async () => {
  const wrong = { "v1/hukamnama/2026-11-11.json": JSON.stringify(record("2026-11-10")) };
  const { res, body } = await get("/v1/hukamnama/today", { BUCKET: bucket([], wrong) });
  assert.equal(res.status, 503);
  assert.equal(body.code, "unavailable");
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  assert.equal(res.headers.get("Retry-After"), "30");
});

test("a file that is not a published record, or not JSON, is never served", async () => {
  const held = { ...record("2026-11-11"), status: "held" };
  const noLines = { ...record("2026-11-11"), lines: [] };
  for (const body of [JSON.stringify(held), JSON.stringify(noLines), "<html>"]) {
    const { res } = await get("/v1/hukamnama/today", { BUCKET: bucket([], { "v1/hukamnama/2026-11-11.json": body }) });
    assert.equal(res.status, 503);
  }
});

test("storage that cannot be read is a 503, not a crash", async () => {
  const env = { BUCKET: { get: async () => { throw new Error("r2 down"); } } };
  const { res, body } = await get("/v1/hukamnama/today", env);
  assert.equal(res.status, 503);
  assert.equal(typeof body.error, "string");
});

test("a past day is cached for a day; a day with no file is pending", async () => {
  const env = { BUCKET: bucket(["2026-11-08", "2026-11-11"]) };
  const past = await get("/v1/hukamnama/2026-11-08", env);
  assert.equal(past.body.status, "published");
  assert.equal(past.res.headers.get("Cache-Control"), "public, max-age=3600, s-maxage=86400");
  const gap = await get("/v1/hukamnama/2026-11-09", env);
  assert.equal(gap.res.status, 200);
  assert.equal(gap.body.status, "pending");
  assert.equal(gap.res.headers.get("Cache-Control"), "public, max-age=30");
});

test("dates: malformed is 400, before the archive or in the future is 404", async () => {
  const env = { BUCKET: bucket(["2026-11-11"]) };
  for (const [path, status, error] of [
    ["/v1/hukamnama/2026-02-30", 400, "date must be YYYY-MM-DD"],
    ["/v1/hukamnama/11-11-2026", 400, "date must be YYYY-MM-DD"],
    ["/v1/hukamnama/2026-10-31", 404, "no Hukamnama is archived before 2026-11-01"],
    ["/v1/hukamnama/2028-01-01", 404, "not yet"],
    ["/v1/hukamnama/2026-11-12", 404, "not yet"],
  ]) {
    const { res, body } = await get(path, env);
    assert.equal(res.status, status, path);
    assert.equal(body.error, error, path);
    assert.equal(typeof body.code, "string");
    assert.equal(typeof body.request_id, "string");
    assert.equal(res.headers.get("Cache-Control"), "no-store");
  }
});

test("the archive is permanent: a day years back is still served", async () => {
  const { res, body } = await get("/v1/hukamnama/2026-11-08", { BUCKET: bucket(["2026-11-08"]) }, at("2031-03-01T02:00:00Z"));
  assert.equal(res.status, 200);
  assert.equal(body.amritsar_date, "2026-11-08");
});

test("a future day is refused even when a file for it exists", async () => {
  const { res } = await get("/v1/hukamnama/2026-11-12", { BUCKET: bucket(["2026-11-12"]) });
  assert.equal(res.status, 404);
});

test("the list is newest first, without lines unless asked, and never ahead of today", async () => {
  const env = { BUCKET: bucket(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"]) };
  const { body } = await get("/v1/hukamnama?limit=2", env);
  assert.deepEqual(body.items.map((x) => x.amritsar_date), ["2026-11-11", "2026-11-10"]);
  assert.ok(!("lines" in body.items[0]) && !("translation" in body.items[0]));
  const full = await get("/v1/hukamnama?limit=1&include=lines", env);
  assert.equal(full.body.items[0].lines.length, 2);
  const def = await get("/v1/hukamnama", env);
  assert.equal(def.body.items.length, 3);
});

test("limit must be 1..30", async () => {
  const env = { BUCKET: bucket(["2026-11-11"]) };
  for (const q of ["0", "31", "-1", "abc", "1.5", "999", ""]) {
    const { res, body } = await get(`/v1/hukamnama?limit=${q}`, env);
    assert.equal(res.status, 400, q);
    assert.equal(body.error, "limit must be 1..30");
  }
});

test("an empty bucket answers: pending today, an empty list", async () => {
  const empty = { BUCKET: { get: async () => null } };
  const today = await get("/v1/hukamnama/today", empty);
  assert.equal(today.body.status, "pending");
  assert.equal(today.body.latest, null);
  assert.deepEqual((await get("/v1/hukamnama", empty)).body, { items: [] });
});

test("status reports today and the latest published date", async () => {
  const { body } = await get("/v1/status", { BUCKET: bucket(["2026-11-10"]) });
  assert.deepEqual(body, {
    ok: true, amritsar_date: "2026-11-11", status_today: "pending", published_at: null,
    latest: "2026-11-10", scripture_sha256: FP,
  });
});

test("ETag: a matching If-None-Match is a 304 with no body", async () => {
  const env = { BUCKET: bucket(["2026-11-11"]) };
  const first = await get("/v1/hukamnama/today", env);
  const etag = first.res.headers.get("ETag");
  assert.match(etag, /^"[0-9a-f]{32}"$/);
  const again = await handle(new Request("https://api.gurbanisoul.com/v1/hukamnama/today",
    { headers: { "If-None-Match": etag } }), env, AFTER);
  assert.equal(again.status, 304);
  assert.equal(await again.text(), "");
  const other = await get("/v1/hukamnama/today", env, AFTER, { headers: { "If-None-Match": '"nope"' } });
  assert.equal(other.res.status, 200);
});

test("HEAD has headers and no body; OPTIONS is a CORS preflight", async () => {
  const env = { BUCKET: bucket(["2026-11-11"]) };
  const head = await handle(new Request("https://api.gurbanisoul.com/v1/hukamnama/today", { method: "HEAD" }), env, AFTER);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.ok(head.headers.get("ETag"));
  const pre = await handle(new Request("https://api.gurbanisoul.com/v1/hukamnama/today", { method: "OPTIONS" }), env, AFTER);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("Access-Control-Allow-Methods"), "GET, HEAD, OPTIONS");
});

test("writes to the read API are refused", async () => {
  const env = { BUCKET: bucket(["2026-11-11"]) };
  for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
    const res = await handle(new Request("https://api.gurbanisoul.com/v1/hukamnama/today", { method }), env, AFTER);
    assert.equal(res.status, 405, method);
    assert.equal(res.headers.get("Allow"), "GET, HEAD, OPTIONS");
  }
});

test("unknown paths are 404 and never reach the service", async () => {
  let called = 0;
  const env = { BUCKET: bucket([]), ORIGIN_FETCH: async () => { called += 1; return new Response("x"); } };
  for (const path of ["/", "/v1", "/v1/hukamnamas", "/admin", "/v1/webpush/abc", "/healthz"]) {
    assert.equal((await get(path, env)).res.status, 404, path);
  }
  assert.equal(called, 0);
});

test("device registration and /health pass to the service with the origin secret, no CORS added", async () => {
  const seen = [];
  const env = {
    BUCKET: bucket([]), ORIGIN_SECRET: "s3",
    ORIGIN_FETCH: async (req) => { seen.push(req); return new Response('{"ok":true}', { status: 200 }); },
  };
  const put = await handle(new Request("https://api.gurbanisoul.com/v1/devices/" + "ab".repeat(32), {
    method: "PUT", body: '{"env":"production","mode":"asap"}', headers: { "X-Origin-Auth": "forged" },
  }), env, AFTER);
  assert.equal(put.status, 200);
  assert.equal(put.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal(seen[0].method, "PUT");
  assert.equal(seen[0].headers.get("X-Origin-Auth"), "s3");
  assert.equal(await seen[0].text(), '{"env":"production","mode":"asap"}');
  await handle(new Request("https://api.gurbanisoul.com/health"), env, AFTER);
  assert.equal(new URL(seen[1].url).pathname, "/health");
  assert.equal(env.BUCKET.reads.length, 0);
});

test("a forged origin secret is dropped when none is configured", async () => {
  const seen = [];
  const env = { BUCKET: bucket([]), ORIGIN_FETCH: async (req) => { seen.push(req); return new Response("{}"); } };
  await handle(new Request("https://api.gurbanisoul.com/health", { headers: { "X-Origin-Auth": "forged" } }), env, AFTER);
  assert.equal(seen[0].headers.get("X-Origin-Auth"), null);
});

test("the rate limiter, when bound, answers 429 by client address", async () => {
  const keys = [];
  const env = { BUCKET: bucket(["2026-11-11"]), RATE_LIMITER: { limit: async ({ key }) => { keys.push(key); return { success: false }; } } };
  const { res, body } = await get("/v1/hukamnama/today", env, AFTER, { headers: { "CF-Connecting-IP": "203.0.113.7" } });
  assert.equal(res.status, 429);
  assert.equal(body.code, "rate_limited");
  assert.equal(res.headers.get("Retry-After"), "60");
  assert.deepEqual(keys, ["203.0.113.7"]);
  assert.equal(env.BUCKET.reads.length, 0);
});

test("unknown query strings change nothing", async () => {
  const env = { BUCKET: bucket(["2026-11-11"]) };
  const a = await get("/v1/hukamnama/today", env);
  const b = await get("/v1/hukamnama/today?cachebust=123&x=y", env);
  assert.deepEqual(a.body, b.body);
});

test("the response is the file's record, byte for byte in its Gurmukhi", async () => {
  const { body } = await get("/v1/hukamnama/2026-11-11", { BUCKET: bucket(["2026-11-11"]) });
  assert.deepEqual(body, record("2026-11-11"));
});
