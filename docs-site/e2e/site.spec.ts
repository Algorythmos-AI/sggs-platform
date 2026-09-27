import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockApi } from './helpers';

const PAGES = ['/', '/architecture/overview/', '/engineering/invariants/', '/process/runbooks/deploy/', '/glossary/', '/adr/0007-three-repositories/'];

test.describe('the wiki', () => {
  test('home page identifies the build and the scripture', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await expect(page).toHaveTitle(/Sri Guru Granth Sahib Ji/);
    const commit = await page.locator('meta[name="sggs-docs-commit"]').getAttribute('content');
    expect(commit).toMatch(/^[0-9a-f]{7,40}$|^unknown$/);
  });

  test('the live status strip renders from /api/health and degrades on an outage', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    const status = page.locator('sggs-status .status');
    await expect(status).toContainText('v1.3.9');
    await expect(status).toContainText('7/7 health checks');
    await expect(status.locator('.chip--ok')).toHaveCount(1);

    await mockApi(page, { '/api/health': null });
    await page.goto('/');
    await expect(page.locator('sggs-status .status')).toContainText('unavailable');
  });

  test('while the status strip is still checking, it is readable (axe on the pending state)', async ({ page }) => {
    // a slow API is when readers see "checking /api/health…": that state must meet contrast too
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    await page.route('**/api/health', async (route) => { await gate; await route.fulfill({ status: 503, body: '{}' }); });
    await page.goto('/');
    await expect(page.locator('sggs-status .status--pending')).toBeVisible();
    const results = await new AxeBuilder({ page }).include('sggs-status').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 1)).toEqual([]);
    release();
  });

  test('the sidebar reaches every section: no empty group, this page current, previous and next', async ({ page }, testInfo) => {
    await mockApi(page);
    await page.goto('/onboarding/run-it-locally/');
    const nav = page.locator('nav[aria-label="Main"]');
    const groups = nav.locator('details');
    const n = await groups.count();
    expect(n, 'the sidebar has its sections').toBeGreaterThan(10);
    for (let i = 0; i < n; i++) {
      const label = (await groups.nth(i).locator('> summary').innerText()).trim();
      expect(await groups.nth(i).locator('a').count(), `the "${label}" group links pages`).toBeGreaterThan(0);
    }
    await expect(nav.locator('a[aria-current="page"]')).toHaveAttribute('href', '/onboarding/run-it-locally/');
    await expect(page.locator('.pagination-links a[rel="prev"]')).toContainText('How the repositories fit');
    await expect(page.locator('.pagination-links a[rel="next"]')).toContainText('Your first pull request');
    if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Menu' }).click();
    // a collapsed section opens onto its pages
    const arch = nav.locator('details', { has: page.locator('> summary', { hasText: /^\s*Architecture\s*$/ }) });
    await arch.locator('> summary').click();
    await expect(arch.locator('a', { hasText: 'Request lifecycle' })).toBeVisible();
  });

  test('a section index is "Overview" in the sidebar and named after its section in previous/next', async ({ page }) => {
    await mockApi(page);
    await page.goto('/data/line-record/');
    await expect(page.locator('.pagination-links a[rel="prev"]')).toContainText('Data overview');
    // …while the sidebar entry itself stays "Overview" (pagination must not rename it)
    await expect(page.locator('nav[aria-label="Main"] a[href="/data/"]')).toHaveText(/^\s*Overview\s*$/);
  });

  test('every page says where it sits and when it last changed; the footer names the site', async ({ page }) => {
    await mockApi(page);
    await page.goto('/process/runbooks/rollback/');
    await expect(page.locator('.page-eyebrow')).toHaveText(/Ship & operate · Runbooks/);
    const updated = page.locator('.page-meta time');
    await expect(updated).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T/);
    await expect(updated).toHaveText(/^\d{1,2} [A-Z][a-z]+ \d{4}$/);
    const footer = page.locator('nav.site-footer');
    await expect(footer.getByRole('link', { name: 'gurbanisoul.com' })).toHaveAttribute('href', 'https://gurbanisoul.com/');
    await expect(footer).toContainText('quoted verbatim, cited by Ang, and never altered');
    await expect(page).toHaveTitle('Runbook: Rollback · Sri Guru Granth Sahib Ji — Knowledge Base');   // one name, once
  });

  test('a pinned page says where it comes from, and its problems are reported there', async ({ page }) => {
    await mockApi(page);
    await page.goto('/data/process/runbooks/rebuild-db/');
    await expect(page.locator('.page-eyebrow')).toContainText('pinned from sggs-data');
    await expect(page.locator('.page-meta time')).toHaveCount(1);          // dated by when the pin last moved
    await expect(page.getByRole('link', { name: 'Report a problem with this page' })).toHaveAttribute('href', /github\.com\/Algorythmos-AI\/sggs-data\/issues\/new/);
  });

  test('"On this page" is left out when a page has fewer than two headings', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the table of contents is a desktop sidebar');
    await mockApi(page);
    await page.goto('/data/answer-protocol/');
    await expect(page.locator('starlight-toc')).toHaveCount(0);
    await page.goto('/process/ci-gates/');
    await expect(page.locator('starlight-toc')).toHaveCount(1);
  });

  test('overflowing code and tables are keyboard-scrollable', async ({ page }) => {
    await mockApi(page);
    await page.goto('/process/runbooks/deploy/');
    const focusable = page.locator('.sl-markdown-content :is(pre, table)[tabindex="0"]');
    await expect(focusable.first()).toBeVisible();
    await focusable.first().focus();
    await expect(focusable.first()).toBeFocused();
  });

  test('Mermaid diagrams are inline, accessible SVG — never a code block', async ({ page }) => {
    await mockApi(page);
    await page.goto('/architecture/overview/');
    const figures = page.locator('figure[data-diagram="mermaid"]');
    await expect(figures).toHaveCount(3);
    // drawn in both palettes; exactly one is shown (the light one in a light scheme), one title read out
    await expect(figures.first().locator('.mmd--light svg')).toBeVisible();
    await expect(figures.first().locator('.mmd--dark svg')).toBeHidden();
    await expect(figures.first().locator('svg:visible title')).toHaveCount(1);
    await expect(page.locator('pre code.language-mermaid')).toHaveCount(0);
  });

  test('in the dark scheme the diagrams are drawn in the dark palette', async ({ page }) => {
    await mockApi(page);
    await page.addInitScript(() => { try { localStorage.setItem('starlight-theme', 'dark'); } catch { /* private window */ } });
    await page.goto('/architecture/overview/');
    const first = page.locator('figure[data-diagram="mermaid"]').first();
    await expect(first.locator('.mmd--dark svg')).toBeVisible();
    await expect(first.locator('.mmd--light svg')).toBeHidden();
    const bg = await first.evaluate((f) => getComputedStyle(f).backgroundColor);
    expect(bg).toBe('rgb(30, 26, 23)');   // the ink card, not a cream card on a dark page
  });

  test('relative links written for GitHub resolve on the site', async ({ page }) => {
    await mockApi(page);
    await page.goto('/engineering/');
    const link = page.locator('.sl-markdown-content a[href="/engineering/invariants/"]').first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/engineering\/invariants\/$/);
    // a link to a file that is not a wiki page goes to GitHub at the trunk
    await page.goto('/engineering/');
    await expect(page.locator('.sl-markdown-content a[href^="https://github.com/Algorythmos-AI/sggs-platform/blob/integration/"]').first()).toBeVisible();
  });

  test('search is indexed and finds a technical term', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the search dialog is exercised on desktop');
    await mockApi(page);
    await page.goto('/');
    const open = page.locator('button[data-open-modal]');
    await expect(open).toBeEnabled({ timeout: 15_000 });   // enabled once Pagefind has loaded
    await open.click();
    await page.locator('dialog input[type="search"], dialog input.pagefind-ui__search-input').first().fill('comp_id');
    await expect(page.locator('dialog .pagefind-ui__result-link').first()).toBeVisible({ timeout: 15_000 });
  });

  // axe beyond the default view: the dark theme, the phone menu open, the search dialog open
  for (const path of ['/', '/data/line-record/', '/adr/0007-three-repositories/', '/process/runbooks/rollback/']) {
    test(`no accessibility violations in the dark theme: ${path}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await mockApi(page);
      await page.goto(path);
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 1)).toEqual([]);
    });
  }

  test('no accessibility violations with the phone menu open', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the menu is the phone sidebar');
    await mockApi(page);
    await page.goto('/data/line-record/');
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.locator('nav[aria-label="Main"] a[aria-current="page"]')).toBeVisible();
    const results = await new AxeBuilder({ page }).include('nav[aria-label="Main"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 1)).toEqual([]);
  });

  test('no accessibility violations with the search dialog open', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the search dialog is exercised on desktop');
    await mockApi(page);
    await page.goto('/');
    const open = page.locator('button[data-open-modal]');
    await expect(open).toBeEnabled({ timeout: 15_000 });
    await open.click();
    await page.locator('dialog input[type="search"], dialog input.pagefind-ui__search-input').first().fill('rollback');
    await expect(page.locator('dialog .pagefind-ui__result-link').first()).toBeVisible({ timeout: 15_000 });
    // Pagefind's own result markup is third-party; the dialog, its input and the site around it are ours
    const results = await new AxeBuilder({ page }).include('dialog').exclude('.pagefind-ui__results-area').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 1)).toEqual([]);
  });

  test('search finds a runbook and a data page by name', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the search dialog is exercised on desktop');
    await mockApi(page);
    await page.goto('/');
    const open = page.locator('button[data-open-modal]');
    await expect(open).toBeEnabled({ timeout: 15_000 });
    for (const [q, href] of [['rollback', '/process/runbooks/rollback/'], ['dataset pin', '/data/dataset-pin/']]) {
      await open.click();
      const input = page.locator('dialog input[type="search"], dialog input.pagefind-ui__search-input').first();
      await input.fill(q);
      await expect(page.locator(`dialog .pagefind-ui__result-link[href^="${href}"]`).first()).toBeVisible({ timeout: 15_000 });
      await page.keyboard.press('Escape');
    }
  });

  test('dark and light themes both set an explicit page background', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    for (const theme of ['dark', 'light']) {
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    }
  });

  test('edit link points at the page\'s real home in the repository', async ({ page }) => {
    await mockApi(page);
    await page.goto('/architecture/overview/');
    const edit = page.locator('a.edit-link', { hasText: 'Edit this page' });
    await expect(edit).toHaveAttribute('href', 'https://github.com/Algorythmos-AI/sggs-platform/edit/integration/docs/architecture/overview.md');
  });

  for (const path of PAGES) {
    test(`no accessibility violations, no console errors: ${path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(e.message));
      await mockApi(page, { '/api/health': 'health.json', '/api/search': 'search-sat-nam.json' });   // the home page runs a first search
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 1)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
});
