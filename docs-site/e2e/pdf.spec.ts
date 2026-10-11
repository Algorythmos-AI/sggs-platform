import { test, expect } from '@playwright/test';
import { mockApi } from './helpers';

// "Download PDF" and the files behind it. They exist only in a build made with DOCS_PDF=1 (CI's);
// a quick local build announces no "pdf1" and these tests are skipped.
test.describe('the pre-built PDFs', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'once');
    await mockApi(page);
    await page.goto('/api/quickstart/');
    const features = (await page.locator('meta[name="sggs-docs-features"]').getAttribute('content')) ?? '';
    test.skip(!features.split(/\s+/).includes('pdf1'), 'this build was made without DOCS_PDF=1');
  });

  test('the menu offers the page as a PDF, as a plain link with a sensible file name', async ({ page }) => {
    await expect(page.locator('sggs-page-actions[data-ready]')).toBeVisible();
    await page.locator('.pa summary').click();
    const link = page.getByRole('link', { name: 'Download PDF' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/pdf/api/quickstart.pdf');
    expect(await link.getAttribute('download')).toMatch(/^sggs-kb_api-quickstart(_\d{4}-\d{2}-\d{2})?\.pdf$/);
  });

  test('every exported page has its PDF, served as a PDF and kept out of search engines', async ({ request }) => {
    const { pages } = await (await request.get('/md-manifest.json')).json();
    expect(pages.length).toBeGreaterThan(130);
    for (const p of pages) expect(p.pdf, p.id).toBe(`https://docs.gurbanisoul.com/pdf/${p.id}.pdf`);
    const res = await request.get('/pdf/scripture/what-sggs-is.pdf');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('application/pdf');
    expect(res.headers()['x-robots-tag']).toBe('noindex');
    expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
    expect((await request.get('/pdf/api/reference.pdf')).status()).toBe(404);   // the generated reference has none
  });
});
