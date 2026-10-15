import { test, expect } from '@playwright/test';

// Every chart on Insights has a text alternative, and a chart's height follows the width it has.

test('the chord and stream charts each carry a data table', async ({ page }) => {
  await page.goto('/analytics');
  for (const id of ['#networkTable', '#chordTable', '#streamTable']) {
    const t = page.locator(id);
    await expect(t.locator('tbody tr').first()).toBeAttached({ timeout: 20_000 });
    await t.locator('summary').click();
    await expect(t.locator('table')).toBeVisible();
    await expect(t.locator('th[scope="col"]').first()).toBeVisible();
  }
});

test('the stream table follows the chosen raag', async ({ page }) => {
  await page.goto('/analytics');
  const first = page.locator('#streamTable tbody tr').first();
  await expect(first).toBeAttached({ timeout: 20_000 });
  const before = await page.locator('#streamTable p').textContent();
  const sel = page.locator('#progRaag');
  await sel.selectOption({ index: 1 });
  await expect(page.locator('#streamTable p')).not.toHaveText(before || '', { timeout: 15_000 });
});

test('chart heights shrink on a narrow screen', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'phone only');
  await page.goto('/analytics');
  await expect(page.locator('#stream svg')).toBeVisible({ timeout: 20_000 });
  for (const [sel, max] of [['#network svg', 560], ['#chord svg', 540], ['#stream svg', 360]] as const) {
    const h = await page.locator(sel).evaluate((e) => e.getBoundingClientRect().height);
    expect(h, sel).toBeLessThan(max);
  }
});
