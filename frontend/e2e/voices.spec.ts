import { test, expect } from '@playwright/test';

// How the contributors are named and counted on /lineage and /analytics: full names (never a bare
// "(M5)"), counts in the right number, the Swaiyye said as outside the raag framework, no measure
// computed on the English translation passed off as the voice's own, and Granth order by default.

const node = (name: string) => `#timeline .tl-node[data-name="${name}"]`;

test('the contributors open in Granth order, with full names and honest counts', async ({ page }) => {
  await page.goto('/lineage');
  await expect(page.locator('#timeline .tl-node').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#linGroup [data-g="granth"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#timeline .tl-node').first()).toHaveAttribute('data-name', 'Guru Nanak Dev Ji (M1)');
  expect(await page.locator('#timeline .tl-name').allTextContents()).not.toContainEqual(expect.stringMatching(/\(M\d\)/));
  const bands = await page.locator('#timeline .tl-band-n').allTextContents();
  for (const b of bands) expect(b).toMatch(/^1 voice$|^\d+ voices$/);
  // dataset 1.3.0 credits Bhagat Surdas Ji with his single line (G3 ruling, 2026-10-28): one line, one Ang
  const surdas = page.locator(node('Bhagat Surdas Ji'));
  await expect(surdas.locator('.tl-lines')).toHaveText('1 line · Ang 1253');
  // the attribution repair credits Bhagat Dhanna Ji with his own Bani, on the Angs that print it
  const dhanna = page.locator(node('Bhagat Dhanna Ji'));
  await expect(dhanna.locator('.tl-lines')).toHaveText(/^\d+ lines · Angs 487–695$/);
});

test('a Bhatt\'s profile names the Swaiyye and shows only counts of the Bani', async ({ page }) => {
  await page.goto('/lineage');
  await page.locator(node('Bhatt Bhal (ਭਟ)')).click();
  const panel = page.locator('#panel.on .ld');
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await expect(panel.locator('.ld-statgrid')).toContainText('Swaiyye');
  await expect(panel.locator('.ld-statgrid')).toContainText('Outside the raag framework');
  await expect(panel.locator('.ld-statgrid')).not.toContainText(/lexical|vocabulary|words \/ line/i);
  await expect(panel.locator('.ld-sources li').first()).toBeVisible();
});

test('the Insights voices are listed by full name in Granth order', async ({ page }) => {
  await page.goto('/analytics');
  const opts = page.locator('#authA option');
  await expect(opts.first()).toBeAttached({ timeout: 15_000 });
  const labels = await opts.allTextContents();
  expect(labels[0]).toBe('Guru Nanak Dev Ji · M1');
  for (const l of labels) expect(l).not.toMatch(/\(M\d\)/);
});

test('a roster entry awaiting scholar review shows its short blurb, never its draft context (G3)', async ({ page, request }) => {
  const roster = await (await request.get('/contributors.json')).json();
  const list: any[] = roster.contributors ?? roster;
  const draft = list.find((c) => c.review?.status !== 'approved' && c.context && c.blurb && c.context !== c.blurb);
  test.skip(!draft, 'no draft entry with distinct context in this roster');
  await page.goto('/lineage');
  await page.locator(node(draft.name)).click();
  const panel = page.locator('#panel.on .ld');
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await expect(panel.locator('.ld-blurb')).toHaveText(draft.blurb);
  await expect(panel).not.toContainText(draft.context.slice(0, 60));
  await expect(panel.locator('.ld-sources')).toContainText('awaiting scholar review');
});
