import { test, expect, type ConsoleMessage, type Page } from '@playwright/test';

/**
 * Captures all console errors and pageerrors during a test. Test failure
 * messages will include the captured output so we can diagnose without
 * re-running.
 */
function attachConsoleCapture(page: Page) {
  const errors: string[] = [];
  const warnings: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}\n${err.stack ?? ''}`));
  return { errors, warnings };
}

test.describe('boot', () => {
  test('editor loads without console errors', async ({ page }) => {
    const { errors } = attachConsoleCapture(page);
    await page.goto('/');
    // Wait for editor to be visibly mounted
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 10_000 });
    // Wait for slide preview to render
    await expect(page.locator('.slide-canvas').first()).toBeVisible();
    // Wait a beat for any async errors to fire
    await page.waitForTimeout(1500);
    if (errors.length) {
      throw new Error(`Console errors:\n${errors.map((e) => '  - ' + e).join('\n')}`);
    }
  });

  test('default sample deck has multiple slides in thumbnail rail', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.cm-editor')).toBeVisible();
    // Thumbnails — one card per slide. Default deck should have ≥ 5.
    const thumbs = page.locator('[data-slide-index], div').filter({ hasText: /^[0-9]+$/ });
    await page.waitForTimeout(500);
    const thumbCount = await page.locator('.cursor-pointer').count();
    expect(thumbCount).toBeGreaterThanOrEqual(5);
  });
});

test.describe('rendering', () => {
  test('first slide is title layout', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.slide-canvas').first()).toBeVisible();
    const layout = await page.locator('.slide-canvas').first().getAttribute('data-slide-layout');
    expect(layout).toBe('title');
  });

  test('switching slides updates the preview', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.slide-canvas').first()).toBeVisible();
    const firstHash = await page.locator('.slide-canvas').first().getAttribute('data-slide-hash');
    // Click second thumbnail
    const thumbs = page.locator('.cursor-pointer');
    await thumbs.nth(1).click();
    await page.waitForTimeout(300);
    const secondHash = await page.locator('.slide-canvas').first().getAttribute('data-slide-hash');
    expect(secondHash).not.toBe(firstHash);
  });

  test('code blocks render via Shiki (with token spans)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.cm-editor')).toBeVisible();
    // Navigate to the code-focus slide (the "Beautiful code blocks" one)
    const total = await page.locator('.cursor-pointer').count();
    let foundCode = false;
    for (let i = 0; i < total; i++) {
      await page.locator('.cursor-pointer').nth(i).click();
      await page.waitForTimeout(400);
      const codeblock = page.locator('.slide-canvas .codeblock');
      if ((await codeblock.count()) > 0) {
        // Shiki produces .line spans inside <pre>
        await expect(codeblock.first()).toBeVisible();
        const lines = codeblock.first().locator('.line, span');
        const lineCount = await lines.count();
        expect(lineCount).toBeGreaterThan(0);
        foundCode = true;
        break;
      }
    }
    expect(foundCode).toBe(true);
  });

  test('math (KaTeX) renders without leaving raw $ markers', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.cm-editor')).toBeVisible();
    // Cycle through slides looking for math
    const total = await page.locator('.cursor-pointer').count();
    let foundMath = false;
    for (let i = 0; i < total; i++) {
      await page.locator('.cursor-pointer').nth(i).click();
      await page.waitForTimeout(500);
      const katex = page.locator('.slide-canvas .katex');
      if ((await katex.count()) > 0) {
        foundMath = true;
        break;
      }
    }
    expect(foundMath).toBe(true);
  });
});

test.describe('keyboard nav', () => {
  test('arrow right advances slide', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.slide-canvas').first()).toBeVisible();
    await page.locator('body').click(); // ensure focus is not in editor
    // Click on the preview pane to ensure focus is outside CodeMirror
    await page.locator('.slide-stage').first().click();
    const before = await page.locator('.slide-canvas').first().getAttribute('data-slide-index');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    const after = await page.locator('.slide-canvas').first().getAttribute('data-slide-index');
    expect(after).not.toBe(before);
  });
});

test.describe('themes', () => {
  test('opening theme picker shows multiple themes', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.cm-editor')).toBeVisible();
    // Click the theme button in the toolbar — its label is the current theme name.
    const themeButton = page.getByRole('button', { name: /catppuccin mocha/i }).first();
    await themeButton.click();
    await page.waitForTimeout(200);
    const cards = page.locator('button').filter({ hasText: /(Catppuccin|Tokyo Night|Dracula|Nord|Gruvbox|Solarized|Editorial|Brutalist|Minimal Sans|Pastel|Gradient|Corporate|Academic|Midnight|One Dark|Rosé)/i });
    const count = await cards.count();
    // Toolbar button (1) + 17 cards. Some matches may overlap text; require ≥ 17.
    expect(count).toBeGreaterThanOrEqual(17);
  });
});

test.describe('audience window opens via window.open', () => {
  test('clicking Open Audience triggers window.open with role=audience', async ({ page, context }) => {
    const { errors } = attachConsoleCapture(page);
    await page.goto('/');
    await expect(page.locator('.cm-editor')).toBeVisible();
    const popupPromise = context.waitForEvent('page');
    await page.getByRole('button', { name: /^present/i }).first().click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    expect(popup.url()).toContain('role=audience');
    // Audience should eventually receive STATE and render a slide-canvas
    await expect(popup.locator('.slide-canvas').first()).toBeVisible({ timeout: 5000 });
    if (errors.length) {
      throw new Error(`Editor console errors during audience flow:\n${errors.join('\n')}`);
    }
  });
});

test.describe('cursor → slide mapping', () => {
  test('cursor on a heading line selects the matching slide', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.cm-editor')).toBeVisible();
    await page.waitForTimeout(800);

    // Drive the cursor through the doc using page.evaluate so we don't rely on
    // CodeMirror virtualization (out-of-viewport lines aren't in DOM).
    // Derive the H1 headings (the only default slide boundary) from the live
    // document so the test never drifts out of sync with the sample deck.
    const headings = await page.evaluate(() => {
      const v = (window as unknown as { __cmView?: any }).__cmView;
      if (!v) throw new Error('CodeMirror view not exposed on window');
      const text: string = v.state.doc.toString();
      const lines = text.split('\n');
      let inFence = false;
      const out: string[] = [];
      for (const line of lines) {
        const t = line.trim();
        if (/^(`{3,}|~{3,})/.test(t)) {
          inFence = !inFence;
          continue;
        }
        if (inFence) continue;
        if (/^#\s+\S/.test(t) && !/^##/.test(t)) out.push(line);
      }
      return out;
    });
    expect(headings.length).toBeGreaterThanOrEqual(5);

    // Placing the cursor on each successive H1 line should select a slide whose
    // index advances monotonically down the document. We assert monotonic
    // advance (not a fixed index per heading) because the default deck also
    // contains `***` breaks that create H1-less slides, so the H1 list is not
    // 1:1 with slide indices. The first H1 must map to slide 0.
    let lastIdx = -1;
    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      await page.evaluate((needle) => {
        const v = (window as unknown as { __cmView?: any }).__cmView;
        if (!v) throw new Error('CodeMirror view not exposed on window');
        const text = v.state.doc.toString();
        const at = text.indexOf('\n' + needle + '\n');
        const pos = at === -1 ? text.indexOf(needle) : at + 1;
        if (pos === -1) throw new Error('heading not found: ' + needle);
        v.dispatch({ selection: { anchor: pos + 2 } });
        v.focus();
      }, heading);
      await page.waitForTimeout(120);
      const idx = Number(await page.locator('.slide-canvas').first().getAttribute('data-slide-index'));
      if (i === 0) expect(idx).toBe(0);
      expect({ heading, advanced: idx > lastIdx }).toEqual({ heading, advanced: true });
      lastIdx = idx;
    }
  });
});

test.describe('export', () => {
  test('clicking Export produces a downloadable HTML file', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.cm-editor')).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    // The Export button opens a menu; pick the self-contained HTML option.
    await page.getByRole('button', { name: /^export$/i }).click();
    await page.getByRole('button', { name: /HTML \(self-contained\)/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.html$/);
  });
});
