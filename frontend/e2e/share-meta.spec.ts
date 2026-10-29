import { test, expect } from '@playwright/test';
import { routes } from '../src/routes';

// Every route unfurls as a complete share card, as a link-preview crawler sees it: the served
// HTML carries the full Open Graph / Twitter set, and the card it points at is served as a
// 1200×630 PNG within budget. (The static gate ShareCardMeta in webapp/tests checks the built
// files; this checks what the server actually returns.) Crawlers do not run JavaScript, so the
// tags are read from the raw response, not the DOM.

const meta = (html: string, key: string) =>
  [...html.matchAll(/<meta (?:property|name)="([^"]+)" content="([^"]*)"/g)]
    .filter((m) => m[1] === key).map((m) => m[2]);

const pngSize = (b: Buffer) => {
  expect(b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

test.describe('share cards @smoke', () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'desktop', 'server output is the same for every device'));

  for (const { path } of routes) {
    test(`${path} unfurls as a complete card`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      const html = await res.text();
      for (const key of ['og:title', 'og:description', 'og:image', 'og:image:alt', 'og:image:width',
        'og:image:height', 'og:image:type', 'og:locale', 'twitter:card', 'twitter:image', 'twitter:image:alt']) {
        expect(meta(html, key), `${path}: ${key}`).toHaveLength(1);
      }
      expect(meta(html, 'og:description')[0].length).toBeLessThanOrEqual(125);
      const image = new URL(meta(html, 'og:image')[0]);
      expect(image.origin).toBe('https://gurbanisoul.com');
      expect(image.pathname).toMatch(/^\/og\/v\d+\/[a-z0-9-]+\.png$/);

      const card = await request.get(image.pathname);
      expect(card.status()).toBe(200);
      expect(card.headers()['content-type']).toContain('image/png');
      const body = await card.body();
      expect(pngSize(body)).toEqual([1200, 630]);
      expect(body.length).toBeLessThanOrEqual(100 * 1024);
    });
  }
});
