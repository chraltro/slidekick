import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * End-to-end validation of the self-contained HTML export. We trigger the real
 * export from the running app, read the downloaded file, then load it in a
 * fresh page (via data: URL) and assert it renders correctly with no network.
 */

async function exportHtml(page: Page): Promise<string> {
  await page.goto('/');
  await expect(page.locator('.cm-editor')).toBeVisible();
  await expect(page.locator('.slide-canvas').first()).toBeVisible();
  // Give Shiki/KaTeX/Mermaid a beat to be ready in the editor.
  await page.waitForTimeout(1200);

  const downloadPromise = page.waitForEvent('download');
  // Open the export menu, then pick HTML.
  await page.getByRole('button', { name: /^export$/i }).click();
  await page.getByRole('button', { name: /HTML \(self-contained\)/i }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const html = readFileSync(path, 'utf-8');
  try {
    writeFileSync('test-results/last-export.html', html);
  } catch {
    /* ignore */
  }
  return html;
}

test.describe('html export', () => {
  test('produces a self-contained, well-formed document', async ({ page }) => {
    const html = await exportHtml(page);

    expect(html).toContain('<!doctype html>');
    expect(html.toLowerCase()).toContain('</html>');
    // No unreplaced template tokens.
    expect(html).not.toMatch(/__[A-Z_]+__/);
    // Theme + base CSS inlined.
    expect(html).toContain('.slide-canvas');
    expect(html).toContain('--accent');
    // Local assets (IndexedDB images) must always be inlined.
    expect(html).not.toMatch(/asset:[a-f0-9]/);
    // Remote images are inlined best-effort; in this offline-capable export
    // the default deck's Unsplash images should embed as data: URIs.
    expect(html).toMatch(/src="data:image\//);
    // No leftover raw placeholders, and charts rendered to inline SVG.
    expect(html).not.toContain('codeblock-placeholder');
    expect(html).toMatch(/class="chart-block[^"]*">\s*<svg/); // charts rendered
    expect(html).not.toMatch(/data-chart=/); // source data stripped
  });

  test('renders layouts, code, and math when opened standalone', async ({ page, context }) => {
    const html = await exportHtml(page);

    const exported = await context.newPage();
    const errors: string[] = [];
    exported.on('pageerror', (e) => errors.push(String(e)));
    exported.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await exported.setContent(html, { waitUntil: 'load' });
    await exported.waitForTimeout(800);

    // Exactly one active slide is visible.
    const active = exported.locator('#scaler > .slide.is-active');
    await expect(active).toHaveCount(1);
    await expect(active).toBeVisible();

    // Title slide should have its split-out h1.
    await expect(exported.locator('.slide.is-active .layout-title h1, .slide.is-active h1').first()).toBeVisible();

    // Code blocks pre-rendered via Shiki (token spans), not placeholders.
    const total = await exported.locator('#scaler > .slide').count();
    expect(total).toBeGreaterThanOrEqual(5);

    // Navigate to the end with ArrowRight; should land on the last slide.
    for (let i = 0; i < total + 2; i++) {
      await exported.keyboard.press('ArrowRight');
      await exported.waitForTimeout(40);
    }
    const idx = await exported.locator('#scaler > .slide.is-active').getAttribute('data-slide-index');
    expect(Number(idx)).toBe(total - 1);

    // Code somewhere in the deck rendered with Shiki .line spans.
    expect(await exported.locator('.codeblock pre .line, .codeblock pre span').count()).toBeGreaterThan(0);

    // Math rendered (KaTeX) — no raw $ left in a math span.
    const katexCount = await exported.locator('.katex').count();
    expect(katexCount).toBeGreaterThan(0);

    // Mermaid rendered to inline SVG.
    expect(await exported.locator('.mermaid svg').count()).toBeGreaterThan(0);

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('preserves $ sequences in CSS and content (no String.replace corruption)', async ({ page, context }) => {
    test.setTimeout(120000);
    await page.goto('/');
    await expect(page.locator('.cm-editor')).toBeVisible();
    await expect(page.locator('.slide-canvas').first()).toBeVisible();

    // Author a deck that puts `$`-bearing replacement specials ($&, $$, $1) into
    // customCss, body text, and a code block — all paths that flow through the
    // template token fill.
    const md = [
      '---',
      'theme: catppuccin-mocha',
      'customCss: |',
      '  .slide h1 { --probe: "$$ $& $1 end"; }',
      '---',
      '',
      '# Dollar $& test $1',
      '',
      'Body with $$ and $& and price $5.',
    ].join('\n');

    await page.evaluate((text) => {
      const v = (window as unknown as { __cmView?: any }).__cmView;
      const cur: string = v.state.doc.toString();
      v.dispatch({ changes: { from: 0, to: cur.length, insert: text } });
    }, md);
    await page.waitForTimeout(800);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /^export$/i }).click();
    await page.getByRole('button', { name: /HTML \(self-contained\)/i }).click();
    const html = readFileSync(await (await downloadPromise).path(), 'utf-8');
    try {
      writeFileSync('test-results/dollar-export.html', html);
    } catch {
      /* ignore */
    }

    // The literal sequences must survive verbatim — corruption from String.replace
    // would drop or duplicate them (e.g. `$&` expanding to the whole match).
    expect(html).toContain('--probe: "$$ $& $1 end"'); // customCss path
    expect(html).toContain('Body with $$ and $&amp; and price $5.'); // __SLIDES__ path

    const exported = await context.newPage();
    const errors: string[] = [];
    exported.on('pageerror', (e) => errors.push(String(e)));
    await exported.setContent(html, { waitUntil: 'load' });
    await exported.waitForTimeout(400);
    await expect(exported.locator('#scaler > .slide.is-active')).toHaveCount(1);
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('overview grid and blank modes work', async ({ page, context }) => {
    const html = await exportHtml(page);
    const exported = await context.newPage();
    await exported.setContent(html, { waitUntil: 'load' });
    await exported.waitForTimeout(400);

    // Open overview with O.
    await exported.keyboard.press('o');
    await expect(exported.locator('#overview')).toBeVisible();
    // Each slide has a cell.
    const cells = exported.locator('#overview > button');
    expect(await cells.count()).toBe(await exported.locator('#scaler > .slide').count());
    await exported.keyboard.press('Escape');
    await expect(exported.locator('#overview')).toBeHidden();

    // Blank black.
    await exported.keyboard.press('b');
    expect(await exported.evaluate(() => document.body.dataset.blank)).toBe('black');
    await exported.keyboard.press('b');
    expect(await exported.evaluate(() => document.body.dataset.blank ?? 'off')).toBe('off');
  });
});
