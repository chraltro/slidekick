import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ART = path.join(process.cwd(), 'tests', 'artifacts', 'shots');
fs.mkdirSync(ART, { recursive: true });
const DECK = fs.readFileSync(
  path.join(process.cwd(), 'tests', 'fixtures', 'stress-deck.md'),
  'utf8',
);

async function loadDeck(page: Page, src: string) {
  await page.waitForFunction(() => !!(window as any).__cmView, null, { timeout: 15000 });
  await page.evaluate((deck) => {
    const view = (window as any).__cmView;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: deck } });
  }, src);
}

// Representative normals + every graceful-degradation / extreme slide (0-based).
const PICKS = [
  0, 1, 5, 6, 11, 12, 13, 26, 27, 38, 49, 50, 53, 54, 55, 69, 70, 71, 74, 79,
  80, 87, 91, 92, 96, 103, 104, 109, 113, 117, 124, 126, 127, 128, 129, 130,
  138, 139, 142, 146, 152, 156, 159,
];

test('screenshot representative + edge slides', async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);
  await page.goto('/');
  await page.locator('.cm-editor').waitFor();
  await page.locator('.slide-canvas').first().waitFor();
  await loadDeck(page, DECK);
  await page.waitForTimeout(1500);

  for (const i of PICKS) {
    await page.locator('.cursor-pointer').nth(i).click();
    await page
      .waitForFunction(
        (idx) => {
          const c = document.querySelector('.slide-canvas') as HTMLElement | null;
          return !!c && c.dataset.slideIndex === String(idx);
        },
        i,
        { timeout: 5000 },
      )
      .catch(() => {});
    await page.waitForTimeout(700);
    const el = page.locator('.slide-canvas').first();
    await el.screenshot({ path: path.join(ART, `slide-${String(i).padStart(3, '0')}.png`) });
  }
  console.log('shots written for', PICKS.length, 'slides');
});
