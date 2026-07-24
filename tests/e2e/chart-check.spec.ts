import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const ART = path.join(process.cwd(), 'tests', 'artifacts', 'chart-check');
fs.mkdirSync(ART, { recursive: true });
async function load(page: Page, src: string) {
  await page.waitForFunction(() => !!(window as any).__cmView, null, { timeout: 15000 });
  await page.evaluate((d) => { const v = (window as any).__cmView; v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: d } }); }, src);
}
const DECK = `---
title: Chart Check
theme: catppuccin-mocha
---

# Negatives

\`\`\`chart
type: bar
title: Net by quarter
data:
  Gain: 50
  Loss: -30
  Net: 20
  Deep: -60
\`\`\`

# All Positive

\`\`\`chart
type: bar
data:
  A: 10
  B: 25
  C: 15
\`\`\`

# All Zero

\`\`\`chart
type: bar
data:
  A: 0
  B: 0
\`\`\`

# Non Numeric

\`\`\`chart
type: bar
data:
  A: hello
  B: 20
  C: world
\`\`\`
`;
test('bar chart correctness', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/'); await page.locator('.cm-editor').waitFor(); await page.locator('.slide-canvas').first().waitFor();
  await load(page, DECK); await page.waitForTimeout(1000);
  for (let i = 0; i < 4; i++) {
    await page.locator('.cursor-pointer').nth(i).click();
    await page.waitForFunction((idx) => { const c = document.querySelector('.slide-canvas') as HTMLElement | null; return !!c && c.dataset.slideIndex === String(idx); }, i, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    const info = await page.evaluate(() => {
      const svg = document.querySelector('.slide-canvas .chart-block svg');
      const err = document.querySelector('.slide-canvas .chart-error');
      const rects = svg ? Array.from(svg.querySelectorAll('rect')).map((r) => ({ h: Math.round(parseFloat(r.getAttribute('height') || '0')), y: Math.round(parseFloat(r.getAttribute('y') || '0')) })) : [];
      return { hasSvg: !!svg, err: err?.textContent || null, rects };
    });
    console.log(`CHART ${i}:`, JSON.stringify(info));
    await page.locator('.slide-canvas').first().screenshot({ path: path.join(ART, `chart-${i}.png`) });
    expect(info.hasSvg, `chart ${i} rendered`).toBe(true);
    if (i === 0) {
      // Negatives deck has 4 bars (two negative). The bug rendered negative
      // bars at height 0; every bar must now have visible height.
      expect(info.rects.length).toBe(4);
      expect(info.rects.every((r) => r.h > 0), `all bars visible: ${JSON.stringify(info.rects)}`).toBe(true);
    }
  }
});
