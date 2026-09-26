import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockApi } from './helpers';

test.describe('posters', () => {
  test('a poster is inlined as an accessible SVG with its steps', async ({ page }) => {
    await mockApi(page);
    await page.goto('/architecture/request-lifecycle/');
    const poster = page.locator('figure.poster[data-poster="08-request-lifecycle"]');
    await expect(poster.locator('svg[role="img"]')).toBeVisible();
    await expect(poster.locator('svg title')).toHaveCount(1);
    await expect(poster.locator('g[data-step]')).toHaveCount(8);
    await expect(poster.locator('figcaption a[href="/posters/08-request-lifecycle.svg"]')).toBeVisible();
  });

  test('the walkthrough steps with buttons and arrow keys and dims later steps', async ({ page }) => {
    await mockApi(page);
    await page.goto('/architecture/request-lifecycle/');
    const wt = page.locator('sggs-walkthrough[data-poster="08-request-lifecycle"]');
    await expect(wt.locator('.wt__counter')).toHaveText('8 steps');
    await wt.locator('.wt__next').click();
    await expect(wt.locator('.wt__counter')).toHaveText('Step 1 of 8');
    await expect(wt.locator('.wt__caption')).toContainText('Same-origin call');
    await expect(wt.locator('g[data-step].is-dim')).toHaveCount(7);
    await expect(wt.locator('g[data-step].is-active')).toHaveCount(1);
    await wt.focus();
    await page.keyboard.press('ArrowRight');
    await expect(wt.locator('.wt__counter')).toHaveText('Step 2 of 8');
    await page.keyboard.press('Home');
    await expect(wt.locator('.wt__counter')).toHaveText('8 steps');
    await expect(wt.locator('g[data-step].is-dim')).toHaveCount(0);
    await wt.locator('.wt__item').nth(4).click();
    await expect(wt.locator('.wt__caption a.wt__link')).toHaveAttribute('href', '/engineering/invariants/');
  });

  test('the lightbox opens full size, zooms, and closes with Escape returning focus', async ({ page }) => {
    await mockApi(page);
    await page.goto('/architecture/overview/');
    const wt = page.locator('sggs-walkthrough[data-poster="01-system-landscape"]');
    await wt.locator('.wt__zoom').click();
    const dlg = page.locator('dialog.lightbox');
    await expect(dlg).toBeVisible();
    await expect(dlg.locator('svg')).toBeVisible();
    await dlg.getByRole('button', { name: 'Zoom in' }).click();
    await expect(dlg.locator('svg')).toHaveAttribute('style', /scale\(1\.25\)/);
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await expect(wt.locator('.wt__zoom')).toBeFocused();
  });

  test('a kit-2 poster keeps earlier steps half-lit and later ones faint; the lightbox steps with its caption', async ({ page }) => {
    await mockApi(page);
    await page.goto('/data/line-record/');
    const wt = page.locator('sggs-walkthrough[data-poster="03-anatomy-of-a-line-record"]');
    await expect(wt.locator('svg[data-kit="2"]')).toBeVisible();
    await expect(wt.locator('g.pk-badge')).toHaveCount(8);          // the order survives as a picture
    await wt.locator('.wt__next').click();
    await wt.locator('.wt__next').click();
    await expect(wt.locator('.wt__counter')).toHaveText('Step 2 of 8');
    await expect(wt.locator('g[data-step].is-past')).toHaveCount(1);
    await expect(wt.locator('g[data-step].is-active')).toHaveCount(1);
    await expect(wt.locator('g[data-step].is-future')).toHaveCount(6);
    await expect(wt.locator('g[data-step].is-dim')).toHaveCount(0);  // kit 1's state is not used on kit 2
    // each node names itself (its own tooltip)
    await expect(wt.locator('g.pk-node[data-node="units"] > title')).toHaveText(/segment_units/);

    await wt.locator('.wt__zoom').click();
    const dlg = page.locator('dialog.lightbox');
    await expect(dlg.locator('.lightbox__caption')).toContainText('2. A page becomes units');
    await expect(dlg.locator('svg g[data-step].is-active')).toHaveCount(1);
    await dlg.getByRole('button', { name: 'Next step' }).click();
    await expect(dlg.locator('.lightbox__caption')).toContainText('3. Headings carry the metadata');
    await expect(wt.locator('.wt__counter')).toHaveText('Step 3 of 8');   // the page follows
    await page.keyboard.press('ArrowLeft');
    await expect(dlg.locator('.lightbox__caption')).toContainText('2. A page becomes units');
    // the full-size copy renames its ids: no id appears twice in the page
    const dupes = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('[id]')).map((n) => n.id);
      return ids.filter((id, i) => ids.indexOf(id) !== i);
    });
    expect(dupes).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
  });

  test('a kit-2 poster reads at the size shown: no text under 13 px in the page', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'measured at the desktop column width');
    await mockApi(page);
    await page.goto('/data/line-record/');
    const smallest = await page.locator('svg[data-kit="2"]').evaluate((svg: SVGSVGElement) => {
      const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      return Math.min(...Array.from(svg.querySelectorAll('text')).map((t) => Number(t.getAttribute('font-size')) * scale));
    });
    expect(smallest).toBeGreaterThanOrEqual(12.9);
  });

  for (const path of ['/architecture/request-lifecycle/', '/architecture/bounded-contexts-and-gateway/', '/diagrams/', '/data/line-record/']) {
    test(`no accessibility violations: ${path}`, async ({ page }) => {
      await mockApi(page);
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 1)).toEqual([]);
    });
  }
});
