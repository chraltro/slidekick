import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ART = path.join(process.cwd(), 'tests', 'artifacts');

test('dump math slide HTML', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.slide-canvas');
  await page.waitForTimeout(800);
  // Slide index 4 = Math + diagrams
  await page.locator('.cursor-pointer').nth(4).click();
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const c = document.querySelector('.slide-canvas') as HTMLElement;
    if (!c) return null;
    const layout = c.querySelector('[class*="layout-"]') as HTMLElement;
    return {
      slideHtml: c.outerHTML,
      layoutClass: layout?.className,
      layoutHtml: layout?.innerHTML,
      mathInlineHtml: Array.from(c.querySelectorAll('.math-inline')).map((e) => e.outerHTML),
      mathBlockHtml: Array.from(c.querySelectorAll('.math-block')).map((e) => e.outerHTML),
      pComputedFontSize: (c.querySelector('p') as HTMLElement | null)
        ? getComputedStyle(c.querySelector('p') as HTMLElement).fontSize
        : null,
      mathBlockComputedFontSize: (c.querySelector('.math-block') as HTMLElement | null)
        ? {
            fontSize: getComputedStyle(c.querySelector('.math-block') as HTMLElement).fontSize,
            display: getComputedStyle(c.querySelector('.math-block') as HTMLElement).display,
            width: (c.querySelector('.math-block') as HTMLElement).getBoundingClientRect().width,
            height: (c.querySelector('.math-block') as HTMLElement).getBoundingClientRect().height,
          }
        : null,
      katexComputedFontSize: (c.querySelector('.katex') as HTMLElement | null)
        ? getComputedStyle(c.querySelector('.katex') as HTMLElement).fontSize
        : null,
    };
  });
  fs.writeFileSync(path.join(ART, 'math-slide.html'), info?.slideHtml ?? '');
  fs.writeFileSync(path.join(ART, 'math-slide.json'), JSON.stringify(info, null, 2));
  console.log('MATH SLIDE:', JSON.stringify(info, null, 2));
});

test('dump mermaid edge label DOM', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.slide-canvas');
  await page.waitForTimeout(800);
  // Diagrams slide is index 11 in the new deck
  await page.locator('.cursor-pointer').nth(11).click();
  await page.waitForTimeout(2000);
  const info = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('.mermaid .edgeLabel, .mermaid .edgeLabels, .mermaid .label-container'));
    const result = labels.map((el) => ({
      cls: el.className.baseVal ?? el.className,
      tag: el.tagName,
      html: (el as Element).outerHTML.slice(0, 1500),
    }));
    // Also dump all <rect>s in the mermaid SVG to find what's drawing the dark box
    const rects = Array.from(document.querySelectorAll('.mermaid svg rect')).map((r) => {
      const cs = getComputedStyle(r);
      return {
        cls: r.getAttribute('class'),
        fill: r.getAttribute('fill'),
        style: r.getAttribute('style'),
        computedFill: cs.fill,
        computedOpacity: cs.opacity,
        bbox: (r as SVGRectElement).getBoundingClientRect(),
      };
    });
    // Look at node label / text alignment
    const nodeLabels = Array.from(document.querySelectorAll('.mermaid .nodeLabel')).map((n) => {
      const cs = getComputedStyle(n as HTMLElement);
      const r = (n as HTMLElement).getBoundingClientRect();
      return {
        text: (n as HTMLElement).textContent,
        display: cs.display,
        align: cs.alignItems,
        justify: cs.justifyContent,
        bbox: { w: r.width, h: r.height },
        html: (n as HTMLElement).outerHTML.slice(0, 800),
      };
    });
    return { labels: result, rects, nodeLabels };
  });
  console.log('LABELS:', JSON.stringify(info.labels, null, 2));
  console.log('RECTS:', JSON.stringify(info.rects, null, 2));
  console.log('NODE_LABELS:', JSON.stringify(info.nodeLabels, null, 2));
});

test('dump mermaid slide computed styles', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.slide-canvas');
  await page.waitForTimeout(800);
  await page.locator('.cursor-pointer').nth(5).click();
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const c = document.querySelector('.slide-canvas') as HTMLElement;
    if (!c) return null;
    const layout = c.querySelector('.layout-code-focus') as HTMLElement;
    const wrapper = layout?.firstElementChild as HTMLElement;
    const mermaid = c.querySelector('.mermaid') as HTMLElement;
    const svg = c.querySelector('.mermaid svg') as SVGElement | null;
    function dump(el: Element | null) {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = (el as HTMLElement).getBoundingClientRect();
      return {
        h: Math.round(r.height),
        w: Math.round(r.width),
        display: cs.display,
        flex: cs.flex,
        minH: cs.minHeight,
        height: cs.height,
        width: cs.width,
      };
    }
    return {
      layout: dump(layout),
      wrapper: dump(wrapper),
      wrapperTag: wrapper?.tagName,
      mermaid: dump(mermaid),
      svg: dump(svg),
      svgAttrW: svg?.getAttribute('width'),
      svgAttrH: svg?.getAttribute('height'),
      svgViewBox: svg?.getAttribute('viewBox'),
    };
  });
  console.log('MERMAID SLIDE:', JSON.stringify(info, null, 2));
});

test('dump code-focus slide computed styles', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.slide-canvas');
  await page.waitForTimeout(800);
  await page.locator('.cursor-pointer').nth(3).click();
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const c = document.querySelector('.slide-canvas') as HTMLElement;
    if (!c) return null;
    const layout = c.querySelector('.layout-code-focus') as HTMLElement;
    const wrapper = layout?.firstElementChild as HTMLElement;
    const codeblock = c.querySelector('.codeblock') as HTMLElement;
    const pre = c.querySelector('.codeblock pre') as HTMLElement;
    function dump(el: HTMLElement | null) {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        h: Math.round(r.height),
        w: Math.round(r.width),
        display: cs.display,
        flex: cs.flex,
        minH: cs.minHeight,
        height: cs.height,
        overflow: cs.overflow,
      };
    }
    return {
      slide: dump(c),
      layout: dump(layout),
      wrapper: dump(wrapper),
      codeblock: dump(codeblock),
      pre: dump(pre),
      wrapperTag: wrapper?.tagName,
      wrapperClass: wrapper?.className,
    };
  });
  fs.writeFileSync(path.join(ART, 'code-slide.json'), JSON.stringify(info, null, 2));
  console.log('CODE SLIDE:', JSON.stringify(info, null, 2));
});
