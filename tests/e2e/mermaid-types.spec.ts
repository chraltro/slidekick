import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const ART = path.join(process.cwd(), 'tests', 'artifacts', 'mermaid-types');
fs.mkdirSync(ART, { recursive: true });
async function load(page: Page, src: string) {
  await page.waitForFunction(() => !!(window as any).__cmView, null, { timeout: 15000 });
  await page.evaluate((d) => { const v = (window as any).__cmView; v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: d } }); }, src);
}
const diagrams = [
  '```mermaid\nsequenceDiagram\n  participant Editor\n  participant Audience\n  Editor->>Audience: patch\n  Audience-->>Editor: ack\n```',
  '```mermaid\npie title Share\n  "A" : 40\n  "B" : 30\n  "C" : 30\n```',
  '```mermaid\nclassDiagram\n  class Deck { +slides\n +parse() }\n  Deck --> Slide\n  class Slide { +layout }\n```',
  '```mermaid\nstateDiagram-v2\n  [*] --> Editing\n  Editing --> Presenting\n  Presenting --> [*]\n```',
];
test('mermaid diagram types on a light theme', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/'); await page.locator('.cm-editor').waitFor(); await page.locator('.slide-canvas').first().waitFor();
  const deck = `---\ntitle: T\ntheme: solarized-light\n---\n\n` + diagrams.map((d, i) => `# D${i}\n\n${d}`).join('\n\n');
  await load(page, deck); await page.waitForTimeout(1500);
  for (let i = 0; i < diagrams.length; i++) {
    await page.locator('.cursor-pointer').nth(i).click();
    await page.waitForFunction((idx) => { const c = document.querySelector('.slide-canvas') as HTMLElement | null; return !!c && c.dataset.slideIndex === String(idx); }, i, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.locator('.slide-canvas').first().screenshot({ path: path.join(ART, `type-${i}.png`) });
    if (i === 1) {
      // Pie slices must be visually distinct — the base-theme change once made
      // every slice inherit primaryColor, collapsing the pie to one color.
      const distinct = await page.evaluate(() => {
        const paths = Array.from(document.querySelectorAll('.slide-canvas .mermaid svg path'));
        const fills = new Set(paths.map((p) => getComputedStyle(p as Element).fill).filter((f) => f && f !== 'none'));
        return fills.size;
      });
      expect(distinct, 'distinct pie slice colors').toBeGreaterThanOrEqual(3);
    }
  }
});
