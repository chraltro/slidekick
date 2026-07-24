import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const ART = path.join(process.cwd(), 'tests', 'artifacts', 'shiki');
fs.mkdirSync(ART, { recursive: true });
async function load(page: Page, src: string) {
  await page.waitForFunction(() => !!(window as any).__cmView, null, { timeout: 15000 });
  await page.evaluate((d) => { const v = (window as any).__cmView; v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: d } }); }, src);
}
// [fence-lang, code] — one representative snippet per supported alias.
const LANGS: [string, string][] = [
  ['ts', 'const x: number = 42;\ntype T = { a: string };'],
  ['tsx', 'const A = () => <div className="x">hi</div>;'],
  ['js', 'function f(a) { return a * 2; }'],
  ['jsx', 'const A = () => <p>hi</p>;'],
  ['python', 'def f(x):\n    return x * 2'],
  ['rust', 'fn main() { let v = vec![1, 2, 3]; }'],
  ['go', 'package main\nfunc main() { println("hi") }'],
  ['java', 'class A { void m() { System.out.println(1); } }'],
  ['c', '#include <stdio.h>\nint main() { return 0; }'],
  ['cpp', '#include <vector>\nint main() { std::vector<int> v; }'],
  ['csharp', 'class A { void M() { Console.WriteLine(1); } }'],
  ['html', '<div class="x">hello</div>'],
  ['css', '.slide { color: red; width: 100%; }'],
  ['json', '{ "name": "slidekick", "n": 17 }'],
  ['yaml', 'name: slidekick\nlist:\n  - a\n  - b'],
  ['toml', '[pkg]\nname = "slidekick"'],
  ['bash', '#!/usr/bin/env bash\nfor f in *; do echo "$f"; done'],
  ['sql', 'SELECT id, name FROM users WHERE id > 10;'],
  ['diff', '- old line\n+ new line'],
  ['md', '# Title\n\n- a **bold** item'],
];

for (const theme of ['catppuccin-mocha', 'solarized-light']) {
  test(`shiki highlights every language on ${theme}`, async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    await page.goto('/'); await page.locator('.cm-editor').waitFor(); await page.locator('.slide-canvas').first().waitFor();
    const deck = `---\ntitle: L\ntheme: ${theme}\n---\n\n` +
      LANGS.map(([lang, code]) => `# ${lang}\n\n\`\`\`${lang}\n${code}\n\`\`\``).join('\n\n');
    await load(page, deck);
    await page.waitForTimeout(1500);
    const results: { lang: string; colors: number; hasCode: boolean }[] = [];
    for (let i = 0; i < LANGS.length; i++) {
      await page.locator('.cursor-pointer').nth(i).click();
      await page.waitForFunction((idx) => { const c = document.querySelector('.slide-canvas') as HTMLElement | null; return !!c && c.dataset.slideIndex === String(idx); }, i, { timeout: 5000 }).catch(() => {});
      await page.waitForFunction(() => { const c = document.querySelector('.slide-canvas'); return c && c.querySelectorAll('.codeblock-placeholder').length === 0 && c.querySelector('.codeblock pre'); }, null, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(120);
      const info = await page.evaluate(() => {
        const pre = document.querySelector('.slide-canvas .codeblock pre');
        if (!pre) return { colors: 0, hasCode: false };
        const spans = Array.from(pre.querySelectorAll('span[style*="color"]'));
        const colors = new Set(spans.map((s) => (s.getAttribute('style') || '').match(/color:[^;]+/)?.[0]));
        return { colors: colors.size, hasCode: true };
      });
      results.push({ lang: LANGS[i][0], ...info });
    }
    fs.writeFileSync(path.join(ART, `${theme}.json`), JSON.stringify({ results, consoleErrors }, null, 2));
    if (theme === 'catppuccin-mocha') await page.locator('.slide-canvas').first().screenshot({ path: path.join(ART, 'sample.png') });
    // Every language must produce a real (multi-color) highlight, not plaintext.
    const notHighlighted = results.filter((r) => !r.hasCode || r.colors < 2);
    console.log(`${theme}:`, JSON.stringify(results));
    expect(notHighlighted, `languages not highlighted: ${JSON.stringify(notHighlighted)}`).toEqual([]);
    // No "language not found" / missing-grammar console errors.
    expect(consoleErrors.filter((e) => /lang|grammar|not found|not loaded/i.test(e))).toEqual([]);
  });
}
