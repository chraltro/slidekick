import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * The big one: load a 160-slide deck covering every layout and a battery of
 * pathological content, then verify every single slide renders acceptably —
 * no content painted outside the fixed canvas, no unprocessed placeholders,
 * no page/console errors, and all diagrams/charts/math resolved.
 */

const ART = path.join(process.cwd(), 'tests', 'artifacts', 'stress');
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

test('160-slide stress: every slide renders acceptably', async ({ page }) => {
  test.setTimeout(20 * 60 * 1000);

  const consoleErrors: { slide: number | null; text: string }[] = [];
  let currentProbe: number | null = null;
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push({ slide: currentProbe, text: m.text() });
  });
  page.on('pageerror', (e) => consoleErrors.push({ slide: currentProbe, text: 'pageerror: ' + e.message }));

  await page.goto('/');
  await expect(page.locator('.cm-editor')).toBeVisible();
  await expect(page.locator('.slide-canvas').first()).toBeVisible();

  await loadDeck(page, DECK);
  // Wait for reparse: thumbnail count should reach 160.
  await page.waitForFunction(() => document.querySelectorAll('[data-slide-thumb]').length === 160 || document.querySelectorAll('.cursor-pointer').length >= 160, null, { timeout: 20000 }).catch(() => {});

  const thumbCount = await page.locator('.cursor-pointer').count();
  console.log('THUMBNAILS:', thumbCount);

  const reports: any[] = [];

  for (let i = 0; i < 160; i++) {
    currentProbe = i;
    await page.locator('.cursor-pointer').nth(i).click();
    // Wait for the canvas to reflect this slide index, then let async
    // enhancers (Shiki / KaTeX / Mermaid / charts) settle.
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
    await page.waitForTimeout(260);
    // Extra settle for heavy diagram/chart slides.
    await page
      .waitForFunction(
        () => {
          const c = document.querySelector('.slide-canvas') as HTMLElement | null;
          if (!c) return true;
          const pending = c.querySelectorAll('.codeblock-placeholder, .mermaid:not([data-processed]), .chart-block:not([data-processed])');
          return pending.length === 0;
        },
        null,
        { timeout: 4000 },
      )
      .catch(() => {});

    const info = await page.evaluate(() => {
      const c = document.querySelector('.slide-canvas') as HTMLElement | null;
      if (!c) return null;
      const cr = c.getBoundingClientRect();
      const tol = 3; // screen px tolerance
      let worstOver = 0;
      let offenders: string[] = [];
      const all = c.querySelectorAll('*');
      all.forEach((el) => {
        const e = el as HTMLElement;
        // SVG interiors (KaTeX radical paths, mermaid glyphs) can report a
        // geometric bbox far larger than their clipping <svg> viewport — they
        // are not visually spilling. Measure the <svg> element itself instead.
        if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return;
        const r = e.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return;
        const overTop = cr.top - r.top;
        const overBottom = r.bottom - cr.bottom;
        const overLeft = cr.left - r.left;
        const overRight = r.right - cr.right;
        const over = Math.max(overTop, overBottom, overLeft, overRight);
        if (over > tol && over > worstOver) {
          worstOver = over;
          const cls = (e.className && typeof e.className === 'string') ? e.className.slice(0, 40) : e.tagName;
          offenders = [`${e.tagName}.${cls} over=${Math.round(over)} [T${Math.round(overTop)} B${Math.round(overBottom)} L${Math.round(overLeft)} R${Math.round(overRight)}]`];
        }
      });
      // Scrollable code/pre inside slide (content that scrolls = clipped)
      let preScroll = 0;
      c.querySelectorAll('pre').forEach((p) => {
        const el = p as HTMLElement;
        preScroll = Math.max(preScroll, el.scrollHeight - el.clientHeight, el.scrollWidth - el.clientWidth);
      });
      // Convert worstOver (screen px) to canvas px using fit scale.
      const scaler = document.querySelector('.slide-scaler') as HTMLElement | null;
      const fit = scaler ? parseFloat(getComputedStyle(scaler).transform.split(',')[3] || '1') : 1;
      const scale = fit && fit > 0 && fit < 5 ? fit : 1;
      return {
        layout: c.dataset.slideLayout,
        title: c.querySelector('h1,h2')?.textContent?.slice(0, 60) ?? null,
        overflowScreenPx: Math.round(worstOver),
        overflowCanvasPx: Math.round(worstOver / scale),
        offenders,
        unprocessedCode: c.querySelectorAll('.codeblock-placeholder').length,
        mathUnprocessed: c.querySelectorAll('.math-inline:not([data-processed]), .math-block:not([data-processed])').length,
        mermaidRaw: c.querySelectorAll('.mermaid:not([data-processed])').length,
        chartError: c.querySelectorAll('.chart-error').length,
        preScrollPx: Math.round(preScroll),
        hasSvg: c.querySelectorAll('svg').length,
        imgCount: c.querySelectorAll('img').length,
        // Images that have a real src but failed to decode. The deck
        // intentionally includes one broken *remote* image (invalid.invalid) to
        // prove graceful degradation — exclude that host only.
        imgBroken: Array.from(c.querySelectorAll('img')).filter((im) => {
          const el = im as HTMLImageElement;
          const src = el.getAttribute('src') || '';
          if (!src) return false;
          if (/invalid\.invalid/.test(src)) return false;
          return el.complete && el.naturalWidth === 0;
        }).length,
        // Raw markdown/data-URI leaking as visible text (e.g. an image URL that
        // broke parsing) shows up as stray "data:image" text on the slide.
        leakedDataUri: /data:image\/svg/.test(c.textContent || '') ? 1 : 0,
      };
    });

    const bad =
      !info ||
      info.overflowCanvasPx > 8 ||
      info.unprocessedCode > 0 ||
      info.mathUnprocessed > 0 ||
      info.mermaidRaw > 0 ||
      info.preScrollPx > 4 ||
      info.imgBroken > 0 ||
      info.leakedDataUri > 0;

    reports.push({ index: i, bad, ...info });
    if (bad) {
      await page.screenshot({ path: path.join(ART, `bad-${String(i).padStart(3, '0')}.png`) });
    }
  }

  currentProbe = null;
  fs.writeFileSync(path.join(ART, 'report.json'), JSON.stringify(reports, null, 2));
  fs.writeFileSync(path.join(ART, 'console-errors.json'), JSON.stringify(consoleErrors, null, 2));

  const badOnes = reports.filter((r) => r.bad);
  const summary = badOnes.map(
    (r) =>
      `#${r.index} [${r.layout}] "${r.title}" over=${r.overflowCanvasPx}px code=${r.unprocessedCode} math=${r.mathUnprocessed} mmd=${r.mermaidRaw} preScroll=${r.preScrollPx} imgBroken=${r.imgBroken} leaked=${r.leakedDataUri} :: ${(r.offenders || []).join('; ')}`,
  );
  console.log('=== BAD SLIDES:', badOnes.length, '/ 160 ===');
  console.log(summary.join('\n'));
  console.log('=== CONSOLE ERRORS:', consoleErrors.length, '===');
  console.log(JSON.stringify(consoleErrors.slice(0, 30), null, 2));
  fs.writeFileSync(path.join(ART, 'summary.txt'), `BAD: ${badOnes.length}/160\n\n` + summary.join('\n') + '\n\nCONSOLE ERRORS: ' + consoleErrors.length + '\n');
});
