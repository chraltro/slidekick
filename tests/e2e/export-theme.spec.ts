import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';

/**
 * Verify the export holds up under a light theme: theme CSS must be inlined and
 * the slide must not fall back to the default dark palette.
 */
test('export respects a light theme', async ({ page, context }) => {
  test.setTimeout(120000);
  mkdirSync('test-results/visual', { recursive: true });

  await page.goto('/');
  await expect(page.locator('.cm-editor')).toBeVisible();
  await expect(page.locator('.slide-canvas').first()).toBeVisible();

  // Switch the deck to a light theme by editing frontmatter via the store.
  await page.evaluate(() => {
    const v = (window as unknown as { __cmView?: any }).__cmView;
    const text: string = v.state.doc.toString();
    const next = text.replace(/^theme:.*$/m, 'theme: solarized-light');
    v.dispatch({ changes: { from: 0, to: text.length, insert: next } });
  });
  await page.waitForTimeout(800);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^export$/i }).click();
  await page.getByRole('button', { name: /HTML \(self-contained\)/i }).click();
  const html = readFileSync(await (await downloadPromise).path(), 'utf-8');

  // The solarized-light theme CSS must be present.
  expect(html).toContain('.theme-solarized-light');

  const exported = await context.newPage();
  await exported.setViewportSize({ width: 1600, height: 900 });
  await exported.setContent(html, { waitUntil: 'load' });
  await exported.waitForTimeout(600);

  // The active slide's background must be light (solarized base is #fdf6e3).
  const bg = await exported.evaluate(() => {
    const el = document.querySelector('#scaler > .slide.is-active') as HTMLElement;
    return getComputedStyle(el).backgroundColor;
  });
  // Parse rgb and assert it's a light colour (all channels high).
  const m = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)/);
  expect(m, `bg was ${bg}`).not.toBeNull();
  const [r, g, b] = [Number(m![1]), Number(m![2]), Number(m![3])];
  expect(r + g + b, `bg=${bg}`).toBeGreaterThan(600); // light background

  await exported.screenshot({ path: 'test-results/visual/export-light-theme.png' });
});
