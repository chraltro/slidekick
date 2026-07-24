import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const ART = path.join(process.cwd(), 'tests', 'artifacts', 'audit');
fs.mkdirSync(ART, { recursive: true });

test('editor a11y: every interactive control has an accessible name', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PE:' + e.message));
  await page.goto('/');
  await page.locator('.cm-editor').waitFor();
  await page.locator('.slide-canvas').first().waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(ART, 'editor.png') });

  const a11y = await page.evaluate(() => {
    const accessibleName = (el: Element): string => {
      const aria = el.getAttribute('aria-label');
      if (aria) return aria.trim();
      const labelledby = el.getAttribute('aria-labelledby');
      if (labelledby) {
        const t = labelledby.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ').trim();
        if (t) return t;
      }
      const title = el.getAttribute('title');
      if (title) return title.trim();
      const text = (el.textContent || '').trim();
      if (text) return text;
      const img = el.querySelector('img[alt]');
      if (img) return (img.getAttribute('alt') || '').trim();
      return '';
    };
    const interactive = Array.from(document.querySelectorAll('button, a[href], [role="button"], input, select, textarea'));
    const unnamed: any[] = [];
    interactive.forEach((el) => {
      // skip CodeMirror internals + hidden
      if (el.closest('.cm-editor')) return;
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      if (!accessibleName(el)) {
        unnamed.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 50), html: (el as HTMLElement).outerHTML.slice(0, 120) });
      }
    });
    const imgsNoAlt = Array.from(document.querySelectorAll('img')).filter((i) => !i.hasAttribute('alt')).length;
    // Buttons that are tiny (touch target < 24px)
    return {
      interactiveCount: interactive.length,
      unnamedCount: unnamed.length,
      unnamed: unnamed.slice(0, 25),
      imgsNoAlt,
      lang: document.documentElement.lang || '(none)',
      title: document.title,
      hasMain: !!document.querySelector('main'),
      hasH1: !!document.querySelector('h1'),
    };
  });
  fs.writeFileSync(path.join(ART, 'a11y.json'), JSON.stringify({ a11y, errors }, null, 2));
  console.log('A11Y:', JSON.stringify(a11y, null, 2));

  // Every visible button/link/input must expose an accessible name, and every
  // image must have an alt attribute — otherwise the control is invisible to
  // assistive tech.
  expect(a11y.unnamed, `unnamed controls: ${JSON.stringify(a11y.unnamed)}`).toEqual([]);
  expect(a11y.imgsNoAlt, 'images without alt').toBe(0);
  expect(a11y.lang).toBe('en');
  expect(a11y.hasMain, 'a <main> landmark is present').toBe(true);
});
