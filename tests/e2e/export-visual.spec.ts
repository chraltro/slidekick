import { test, type Page } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';

/**
 * Visual capture: render the export and screenshot a representative set of
 * slides so a human (or the agent) can eyeball that layouts, code, charts,
 * math, and diagrams look right. Not a pass/fail gate — it always "passes"
 * but writes PNGs to test-results/visual/.
 */

async function exportHtml(page: Page): Promise<string> {
  await page.goto('/');
  await page.locator('.cm-editor').waitFor();
  await page.locator('.slide-canvas').first().waitFor();
  await page.waitForTimeout(1500);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^export$/i }).click();
  await page.getByRole('button', { name: /HTML \(self-contained\)/i }).click();
  const download = await downloadPromise;
  return readFileSync(await download.path(), 'utf-8');
}

test('capture exported slides', async ({ page, context }) => {
  test.setTimeout(120000);
  mkdirSync('test-results/visual', { recursive: true });
  const html = await exportHtml(page);

  const exported = await context.newPage();
  await exported.setViewportSize({ width: 1600, height: 900 });
  await exported.setContent(html, { waitUntil: 'load' });
  await exported.waitForTimeout(1200);

  const total = await exported.locator('#scaler > .slide').count();
  for (let i = 0; i < total; i++) {
    await exported.evaluate((n) => {
      // Drive the runtime's slide navigation by simulating digit/Home then arrows.
      const ev = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key }));
      ev('Home');
      for (let k = 0; k < n; k++) ev('ArrowRight');
    }, i);
    await exported.waitForTimeout(250);
    const idx = String(i + 1).padStart(2, '0');
    await exported.screenshot({ path: `test-results/visual/export-${idx}.png` });
  }
});
