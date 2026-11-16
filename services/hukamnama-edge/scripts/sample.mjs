// sample.mjs — what the Worker answers, for the OpenAPI generator (tools/gen_hukamnama_openapi.py).
//
//   node scripts/sample.mjs <snapshot-dir> < requests.json > responses.json
//
// <snapshot-dir> holds the files the Hukamnama service writes (v1/hukamnama/<date>.json and
// index.json). requests.json is [{ "path": "/v1/hukamnama/today", "now": "2026-11-11T02:00:00Z",
// "method": "GET" }]. Each request goes through the real handler (src/core.js `handle`) with a
// bucket that reads those files, so the generated spec describes what is served, not what
// someone remembers. No network, no dependencies.
import { readFile } from "node:fs/promises";
import path from "node:path";

import { handle } from "../src/core.js";

const root = path.resolve(process.argv[2] ?? "");
const bucket = {
  async get(key) {
    const file = path.resolve(root, key);
    if (!file.startsWith(root + path.sep)) return null;
    try {
      const text = await readFile(file, "utf8");
      return { text: async () => text };
    } catch (e) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
  },
};

let input = "";
for await (const chunk of process.stdin) input += chunk;
const out = [];
for (const r of JSON.parse(input)) {
  const res = await handle(new Request("https://api.gurbanisoul.com" + r.path, { method: r.method ?? "GET" }),
    { BUCKET: bucket }, new Date(r.now));
  const text = await res.text();
  out.push({
    path: r.path,
    status: res.status,
    cache: res.headers.get("Cache-Control"),
    etag: res.headers.has("ETag"),
    cors: res.headers.get("Access-Control-Allow-Origin"),
    retry_after: res.headers.get("Retry-After"),
    body: text ? JSON.parse(text) : null,
  });
}
process.stdout.write(JSON.stringify(out));
