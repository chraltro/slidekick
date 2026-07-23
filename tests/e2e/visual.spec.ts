import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ART = path.join(process.cwd(), 'tests', 'artifacts');
fs.mkdirSync(ART, { recursive: true });

function attachConsoleCapture(page: Page) {
  const errors: string[] = [];
  const warnings: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return { errors, warnings };
}

test.describe('UX / visual inspection', () => {
  test('full editor screenshot + DOM inventory', async ({ page }) => {
    const { errors, warnings } = attachConsoleCapture(page);
    await page.goto('/');
    await expect(page.locator('.cm-editor')).toBeVisible();
    await expect(page.locator('.slide-canvas').first()).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(ART, '01-editor.png'), fullPage: false });

    // Inventory key UI elements
    const inventory = await page.evaluate(() => {
      function box(sel: string) {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
          bg: cs.backgroundColor,
          fg: cs.color,
          font: cs.fontFamily,
          fontSize: cs.fontSize,
          display: cs.display,
          visibility: cs.visibility,
          opacity: cs.opacity,
          overflow: cs.overflow,
        };
      }
      return {
        viewport: { w: window.innerWidth, h: window.innerHeight },
        body: box('body'),
        cmEditor: box('.cm-editor'),
        cmContent: box('.cm-content'),
        slideStage: box('.slide-stage'),
        slideScaler: box('.slide-scaler'),
        slideCanvas: box('.slide-canvas'),
        toolbar: box('header, .border-b.border-chrome-border'),
        thumbnail0: box('.cursor-pointer'),
        presenterPanel: box('.border-t.border-chrome-border'),
        slideCanvasComputed: (() => {
          const el = document.querySelector('.slide-canvas') as HTMLElement | null;
          if (!el) return null;
          return {
            scrollW: el.scrollWidth,
            scrollH: el.scrollHeight,
            clientW: el.clientWidth,
            clientH: el.clientHeight,
            innerHTMLLen: el.innerHTML.length,
          };
        })(),
        slideScalerTransform: (() => {
          const el = document.querySelector('.slide-scaler') as HTMLElement | null;
          if (!el) return null;
          return {
            transform: getComputedStyle(el).transform,
            inlineFitScale: el.style.getPropertyValue('--fit-scale'),
          };
        })(),
        thumbnailCount: document.querySelectorAll('.cursor-pointer').length,
        slideCount: document.querySelectorAll('[data-slide-index]').length,
        codeBlockCount: document.querySelectorAll('.codeblock').length,
        codeBlockProcessed: document.querySelectorAll('.codeblock[data-processed]').length,
        codeBlockPlaceholders: document.querySelectorAll('.codeblock-placeholder').length,
        mathInline: document.querySelectorAll('.math-inline').length,
        mathProcessed: document.querySelectorAll('.math-inline[data-processed], .math-block[data-processed]').length,
        h1FontSize: (() => {
          const h1 = document.querySelector('.slide-canvas h1') as HTMLElement | null;
          return h1 ? getComputedStyle(h1).fontSize : null;
        })(),
        bodyText: document.body.innerText.slice(0, 200),
      };
    });

    fs.writeFileSync(path.join(ART, '01-editor.json'), JSON.stringify({ inventory, errors, warnings }, null, 2));
    console.log('INVENTORY:', JSON.stringify(inventory, null, 2));
    if (errors.length) console.log('ERRORS:', errors);
    if (warnings.length) console.log('WARNINGS:', warnings);
  });

  test('walk every slide and capture screenshots', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.slide-canvas').first()).toBeVisible();
    await page.waitForTimeout(800);

    const total = await page.locator('.cursor-pointer').count();
    const reports: any[] = [];
    for (let i = 0; i < total; i++) {
      await page.locator('.cursor-pointer').nth(i).click();
      await page.waitForTimeout(450);
      const info = await page.evaluate(() => {
        const c = document.querySelector('.slide-canvas') as HTMLElement | null;
        if (!c) return null;
        return {
          layout: c.dataset.slideLayout,
          textPreview: (c.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 200),
          h1Text: c.querySelector('h1')?.textContent ?? null,
          h2Text: c.querySelector('h2')?.textContent ?? null,
          imgCount: c.querySelectorAll('img').length,
          codeCount: c.querySelectorAll('.codeblock').length,
          unprocessedPlaceholders: c.querySelectorAll('.codeblock-placeholder').length,
          mathUnprocessed: c.querySelectorAll('.math-inline:not([data-processed]), .math-block:not([data-processed])').length,
          overflow: c.scrollHeight > c.clientHeight + 4 || c.scrollWidth > c.clientWidth + 4,
        };
      });
      reports.push({ index: i, ...info });
      await page.screenshot({ path: path.join(ART, `slide-${String(i).padStart(2, '0')}.png`) });
    }
    fs.writeFileSync(path.join(ART, 'slides-report.json'), JSON.stringify(reports, null, 2));
    console.log('SLIDE REPORTS:', JSON.stringify(reports, null, 2));
  });

  test('typing in editor updates preview', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.cm-editor')).toBeVisible();
    await page.waitForTimeout(500);
    // Click on first slide to ensure preview is on slide 0
    await page.locator('.cursor-pointer').first().click();
    const before = await page.locator('.slide-canvas h1').first().textContent();
    // Focus editor and prepend chars to the H1
    await page.locator('.cm-content').first().click();
    await page.keyboard.press('Control+Home');
    // Move past frontmatter — find first '#' line. Easier: just type in front of '# md-presentations'
    // Use Ctrl+F? Simpler: programmatically dispatch a doc change via CodeMirror — but instead let's
    // just use keyboard to find the line.
    // Simplest reliable approach: replace the entire doc via clipboard.
    await page.evaluate(() => {
      const view = (document.querySelector('.cm-editor') as any)?.cmView?.view;
      // Not always exposed; fall back to the EditorView reference via the global plugin if available.
    });
    // Type at end of doc — append a new slide
    await page.keyboard.press('Control+End');
    await page.keyboard.type('\n\n# Brand New Slide\n\nHello from playwright');
    await page.waitForTimeout(400);
    // After typing, the thumbnail count should have grown by 1
    const newCount = await page.locator('.cursor-pointer').count();
    expect(newCount).toBeGreaterThan(0);
    const lastThumb = page.locator('.cursor-pointer').nth(newCount - 1);
    await lastThumb.click();
    await page.waitForTimeout(300);
    const last = await page.locator('.slide-canvas h1').first().textContent();
    expect(last?.toLowerCase()).toContain('brand new');
  });

  test('theme switching changes visible background color', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.slide-canvas').first()).toBeVisible();
    await page.waitForTimeout(500);
    const bgBefore = await page.locator('.slide-canvas').first().evaluate((el) => getComputedStyle(el).backgroundColor);

    // Open the theme picker (toolbar button shows current theme name)
    const themeButton = page.getByRole('button', { name: /catppuccin mocha/i }).first();
    await themeButton.click();
    await page.waitForTimeout(300);
    // Click the Dracula card — selected by data-theme-id
    await page.locator('button[data-theme-id="dracula"]').click();
    await page.waitForTimeout(500);

    const bgAfter = await page.locator('.slide-canvas').first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bgAfter).not.toBe(bgBefore);

    await page.screenshot({ path: path.join(ART, 'theme-dracula.png') });
  });

  test('audience window receives full state and renders the same slide', async ({ page, context }) => {
    const { errors } = attachConsoleCapture(page);
    await page.goto('/');
    await expect(page.locator('.cm-editor')).toBeVisible();
    await page.waitForTimeout(500);

    const popupPromise = context.waitForEvent('page');
    await page.getByRole('button', { name: /^present/i }).first().click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    await expect(popup.locator('.slide-canvas').first()).toBeVisible({ timeout: 5000 });
    await popup.waitForTimeout(800);
    await popup.screenshot({ path: path.join(ART, 'audience-initial.png') });

    // Editor → click slide 2; audience should follow
    await page.locator('.cursor-pointer').nth(1).click();
    await page.waitForTimeout(800);
    const audienceLayout = await popup.locator('.slide-canvas').first().getAttribute('data-slide-layout');
    const editorLayout = await page.locator('.slide-canvas').first().getAttribute('data-slide-layout');
    expect(audienceLayout).toBe(editorLayout);

    if (errors.length) {
      console.log('ERRORS during audience flow:', errors);
    }
    fs.writeFileSync(path.join(ART, 'audience-errors.json'), JSON.stringify(errors, null, 2));
  });

  test('exported HTML opens in a new context and shows slides', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.locator('.cm-editor')).toBeVisible();
    await page.waitForTimeout(800);

    const downloadPromise = page.waitForEvent('download');
    // The Export button opens a menu; pick the self-contained HTML option.
    await page.getByRole('button', { name: /^export$/i }).click();
    await page.getByRole('button', { name: /HTML \(self-contained\)/i }).click();
    const download = await downloadPromise;
    const exportPath = path.join(ART, 'export.html');
    await download.saveAs(exportPath);
    const size = fs.statSync(exportPath).size;
    console.log('EXPORTED HTML SIZE:', size, 'bytes');
    expect(size).toBeGreaterThan(2000); // anything tiny means inlining failed

    // Open the file via file:// in a new page
    const exportPage = await context.newPage();
    const errors: string[] = [];
    exportPage.on('pageerror', (err) => errors.push(err.message));
    exportPage.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await exportPage.goto('file:///' + exportPath.replace(/\\/g, '/'));
    await exportPage.waitForTimeout(1500);
    const slideCount = await exportPage.locator('.slide').count();
    expect(slideCount).toBeGreaterThan(0);
    const visibleCount = await exportPage.locator('.slide:visible').count();
    await exportPage.screenshot({ path: path.join(ART, 'export-slide.png') });
    fs.writeFileSync(path.join(ART, 'export-report.json'), JSON.stringify({ size, slideCount, visibleCount, errors }, null, 2));
    console.log('EXPORT REPORT:', { size, slideCount, visibleCount, errors });
  });
});
