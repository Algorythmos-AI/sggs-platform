import { test, expect, type Page } from '@playwright/test';

// The traditional saroop is a display layer. The corpus stores every subjoined yayya as the
// source font encoded it, a doubled ੍ਯ੍ਯ; the printed Bir draws one yayya tucked under the letter,
// which is the yakash sign ੵ (U+0A75). The page draws ੵ, and nothing that leaves the page —
// a copied selection, whole or partial — may carry it.

async function ang1400(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/reader?ang=1400');
  await expect(page.locator('#angOut .sline').first()).toBeVisible({ timeout: 15_000 });
}
const verse = (page: Page) => page.locator('#angOut .sline .g').filter({ hasText: 'ਜਲੵਨ' }).first();

// Select the text inside `el` from `from` to `to` (whole text when omitted), fire a copy event
// the way a browser does, and return what the page put on the clipboard.
const copyOf = (page: Page, from?: number, to?: number) => verse(page).evaluate((el, [a, b]) => {
  const node = el.firstChild as Text;
  const r = document.createRange();
  r.setStart(node, a ?? 0); r.setEnd(node, b ?? (node.nodeValue || '').length);
  const s = getSelection()!; s.removeAllRanges(); s.addRange(r);
  const dt = new DataTransfer();
  el.dispatchEvent(new ClipboardEvent('copy', { clipboardData: dt, bubbles: true, cancelable: true }));
  return dt.getData('text/plain') || s.toString();
}, [from, to] as const);

test('Ang 1400 draws the subjoined yayya under the letter, as the printed Bir does', async ({ page }) => {
  await ang1400(page);
  await expect(page.locator('html')).toHaveClass(/saroop-on/);
  await expect(verse(page)).toBeVisible();
  const painted = (await page.locator('#angOut .g').allTextContents()).join(' ');
  expect(painted).toContain('ਧਰੵਉ');
  expect(painted).not.toContain('੍ਯ');                               // no doubled form left on the page
  expect(painted).not.toMatch(/[︀-️]/);                     // nor an older build's selectors
});

test('turning the saroop off shows the stored characters again', async ({ page }) => {
  await ang1400(page);
  await page.evaluate(() => (document.getElementById('saroopBtn') as HTMLElement).click());
  await expect(page.locator('html')).not.toHaveClass(/saroop-on/);
  const shown = (await page.locator('#angOut .g').allTextContents()).join(' ');
  expect(shown).toContain('ਜਲ੍ਯ੍ਯਨ');
  expect(shown).not.toContain('ੵ');
});

test('a copied verse, whole or in part, is the stored text, never the drawn form', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'synthetic ClipboardEvent data is Chromium-only');
  await ang1400(page);
  const d = await (await page.request.get('/api/ang/1400')).json();
  const line = d.lines.find((l: any) => l.gurmukhi.includes('ਜਲ੍ਯ੍ਯਨ'));
  expect(await copyOf(page)).toBe(line.gurmukhi);                     // whole verse: byte for byte
  const text = (await verse(page).textContent()) || '';
  const i = text.indexOf('ਜਲੵਨ');
  expect(await copyOf(page, i, i + 'ਜਲੵਨ'.length)).toBe('ਜਲ੍ਯ੍ਯਨ');  // one word: mapped back
});
