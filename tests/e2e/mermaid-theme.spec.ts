import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const ART = path.join(process.cwd(), 'tests', 'artifacts', 'mermaid-theme');
fs.mkdirSync(ART, { recursive: true });
async function load(page: Page, src: string) {
  await page.waitForFunction(() => !!(window as any).__cmView, null, { timeout: 15000 });
  await page.evaluate((d) => { const v = (window as any).__cmView; v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: d } }); }, src);
}
const mmd = '```mermaid\ngraph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Do the thing]\n  B -->|No| D[Skip it]\n  C --> E[End]\n  D --> E\n```';

// [theme, expectedDark] — a mermaid node's fill must track the deck's light/dark
// palette, not a hard-coded dark theme (which rendered unreadable on light).
const CASES: [string, boolean][] = [
  ['solarized-light', false],
  ['catppuccin-latte', false],
  ['corporate-clean', false],
  ['catppuccin-mocha', true],
];

for (const [theme, expectDark] of CASES) {
  test(`mermaid palette matches ${theme}`, async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/'); await page.locator('.cm-editor').waitFor(); await page.locator('.slide-canvas').first().waitFor();
    await load(page, `---\ntitle: M\ntheme: ${theme}\n---\n\n# Flow\n\n${mmd}`);
    await page.waitForTimeout(2000);
    await page.locator('.slide-canvas').first().screenshot({ path: path.join(ART, `${theme}.png`) });
    const lum = await page.evaluate(() => {
      const rect = document.querySelector('.slide-canvas .mermaid svg .node rect, .slide-canvas .mermaid svg rect');
      if (!rect) return null;
      const fill = getComputedStyle(rect as Element).fill || (rect as Element).getAttribute('fill') || '';
      const m = fill.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
      if (!m) return null;
      return (0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3]) / 255;
    });
    expect(lum, `node fill luminance for ${theme}`).not.toBeNull();
    if (expectDark) expect(lum!).toBeLessThan(0.5);
    else expect(lum!).toBeGreaterThan(0.5);
  });
}
