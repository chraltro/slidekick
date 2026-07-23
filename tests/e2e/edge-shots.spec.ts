import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const ART = path.join(process.cwd(), 'tests', 'artifacts', 'edge-shots');
fs.mkdirSync(ART, { recursive: true });
const DECK = fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'edge-deck.md'), 'utf8');
async function loadDeck(page: Page, src: string) {
  await page.waitForFunction(() => !!(window as any).__cmView, null, { timeout: 15000 });
  await page.evaluate((d) => { const v = (window as any).__cmView; v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: d } }); }, src);
}
// Zalgo, bidi, emoji-zwj, escape-soup, raw-html, xss-img, quote+code(kitchen),
// long-line-code, ragged-table, 40-col-table, mermaid-unicode, chart-negatives,
// many-tiny-images, callout-nested, hr-variants, many-inline.
const PICKS = [0, 1, 3, 10, 30, 32, 24, 36, 27, 32, 47, 55, 66, 70, 84, 86];
test('edge visual sampling', async ({ page }) => {
  test.setTimeout(6 * 60 * 1000);
  await page.goto('/'); await page.locator('.cm-editor').waitFor(); await page.locator('.slide-canvas').first().waitFor();
  await loadDeck(page, DECK); await page.waitForTimeout(1200);
  const total = await page.locator('.cursor-pointer').count();
  for (const i of PICKS) {
    if (i >= total) continue;
    await page.locator('.cursor-pointer').nth(i).click();
    await page.waitForFunction((idx) => { const c = document.querySelector('.slide-canvas') as HTMLElement | null; return !!c && c.dataset.slideIndex === String(idx); }, i, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600);
    await page.locator('.slide-canvas').first().screenshot({ path: path.join(ART, `edge-${String(i).padStart(3, '0')}.png`) });
  }
  console.log('edge shots done');
});
