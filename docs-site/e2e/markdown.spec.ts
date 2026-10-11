import { test, expect } from '@playwright/test';

// Every page as portable Markdown (/md/<id>.md), the manifest and llms.txt — as served.
test.describe('the Markdown export', () => {
  test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'requests only: desktop once'); });

  test('a page is served as readable text, not indexed, with its header', async ({ request }) => {
    const res = await request.get('/md/index.md');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('text/plain; charset=utf-8');
    expect(res.headers()['x-robots-tag']).toBe('noindex');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    const text = await res.text();
    expect(text.startsWith('# ')).toBe(true);
    expect(text).toContain('- Page: <https://docs.gurbanisoul.com/>');
    expect(text).toContain('quoted verbatim, cited by Ang, and never altered');
  });

  test('a nested page resolves what only the site understands', async ({ request }) => {
    const text = await (await request.get('/md/api/versioning-and-caching.md')).text();
    expect(text).toContain('](https://docs.gurbanisoul.com/api/errors/)');     // a relative .md link, now absolute
    expect(text).toContain('```python');                                        // a code excerpt, read from the source
    expect(text).not.toMatch(/<!--\s*sggs:/);
    expect(text).not.toMatch(/\]\((?!https?:|#|mailto:)[^)]*\.md[)#]/);
  });

  test('the manifest lists every exported page, and each one is there', async ({ request }) => {
    const { pages } = await (await request.get('/md-manifest.json')).json();
    expect(pages.length).toBeGreaterThan(130);
    expect(new Set(pages.map((p: { id: string }) => p.id)).size).toBe(pages.length);
    for (const p of pages) {
      expect(p.markdown).toBe(`https://docs.gurbanisoul.com/md/${p.id}.md`);
      expect(p.readingMinutes).toBeGreaterThanOrEqual(1);
      const res = await request.get(`/md/${p.id}.md`);
      expect(res.status(), p.id).toBe(200);
    }
    expect((await request.get('/md/no/such/page.md')).status()).toBe(404);
  });

  test('llms.txt and robots.txt are served', async ({ request }) => {
    const llms = await request.get('/llms.txt');
    expect(llms.status()).toBe(200);
    expect(llms.headers()['content-type']).toBe('text/plain; charset=utf-8');
    const text = await llms.text();
    expect(text.startsWith('# Sri Guru Granth Sahib Ji — Knowledge Base wiki')).toBe(true);
    expect(text).toContain('](https://docs.gurbanisoul.com/md/api/quickstart.md)');
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Sitemap: https://docs.gurbanisoul.com/sitemap-index.xml');
    expect(robots).not.toMatch(/Disallow:\s*\/md/);
  });

  test('pages link to their Markdown; the 404 page and the API reference have none', async ({ page }) => {
    await page.goto('/api/quickstart/');
    await expect(page.locator('link[rel="alternate"][type="text/markdown"]')).toHaveAttribute('href', '/md/api/quickstart.md');
    await page.goto('/');
    await expect(page.locator('link[rel="alternate"][type="text/markdown"]')).toHaveAttribute('href', '/md/index.md');
    await page.goto('/api/reference/');
    await expect(page.locator('link[rel="alternate"][type="text/markdown"]')).toHaveCount(0);
    await page.goto('/no-such-page/');
    await expect(page.locator('link[rel="alternate"][type="text/markdown"]')).toHaveCount(0);
  });

  test('a quotation reads the same in the export as on the page', async ({ page, request }) => {
    await page.goto('/scripture/what-sggs-is/');
    const quoted = page.locator('.sl-markdown-content blockquote [lang="pa"], .sl-markdown-content blockquote').first();
    const shown = ((await quoted.innerText()).split('\n')[0] ?? '').trim();
    expect(shown.length).toBeGreaterThan(10);
    const text = await (await request.get('/md/scripture/what-sggs-is.md')).text();
    expect(text).toContain(shown);
    expect(text).toMatch(/— Sri Guru Granth Sahib Ji · Ang \d+/);
  });
});
