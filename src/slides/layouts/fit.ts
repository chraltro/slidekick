/**
 * Pure DOM fit helpers shared by the live layouts (via React effects) and the
 * static HTML exporter (called imperatively after enhancement). Keeping the
 * measurement in one place means the exported deck fits content exactly like
 * the live preview instead of drifting.
 */

export const FIT_STEPS = [
  1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.46, 0.42, 0.4, 0.37, 0.34, 0.31, 0.28,
  0.25, 0.22,
];

export const CODE_STEPS = [
  1, 0.9, 0.8, 0.72, 0.64, 0.56, 0.5, 0.45, 0.4, 0.36, 0.32, 0.3, 0.28, 0.26,
];

/** Worst px any descendant is painted outside `outer` at the current transform. */
function worstOverflow(outer: HTMLElement, inner: HTMLElement): number {
  const o = outer.getBoundingClientRect();
  let worst = 0;
  const consider = (r: DOMRect) => {
    if (r.width < 1 && r.height < 1) return;
    worst = Math.max(worst, o.top - r.top, r.bottom - o.bottom, o.left - r.left, r.right - o.right);
  };
  consider(inner.getBoundingClientRect());
  inner.querySelectorAll('*').forEach((el) => {
    // SVG internals (KaTeX radical paths, mermaid glyphs) can report a geometric
    // bbox far larger than their clipping <svg> viewport — measure the <svg>.
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return;
    consider((el as HTMLElement).getBoundingClientRect());
  });
  return worst;
}

/**
 * Scale `inner` down (via transform) to the largest discrete step at which its
 * content fits within `outer`. No-op when it already fits (scale 1).
 */
export function fitScale(outer: HTMLElement, inner: HTMLElement, steps: number[] = FIT_STEPS): void {
  inner.style.transform = 'none';
  const availH = outer.clientHeight;
  const availW = outer.clientWidth;
  const contentH = inner.scrollHeight;
  const contentW = inner.scrollWidth;
  if (!availH || !availW || !contentH || !contentW) return;
  const needed = Math.min(availH / contentH, availW / contentW);
  let start = 0;
  if (needed < 0.999) {
    for (let i = 0; i < steps.length; i++) {
      if (steps[i] <= needed + 1e-4) {
        start = i;
        break;
      }
      start = i;
    }
  }
  for (let i = start; i < steps.length; i++) {
    const k = steps[i];
    inner.style.transform = k < 1 ? `scale(${k})` : 'none';
    if (worstOverflow(outer, inner) <= 2) break;
  }
}

/**
 * Reduce a code block's font size to the largest discrete step at which it fits
 * (height and width). Operates on the `.codeblock pre` inside `root`.
 */
export function fitCode(root: HTMLElement, steps: number[] = CODE_STEPS): void {
  const pre = root.querySelector<HTMLElement>('.codeblock pre');
  if (!pre) return;
  // The <code> child carries `white-space: pre`, so wrapping must be set there
  // too (not just on <pre>).
  const code = pre.querySelector<HTMLElement>('code') ?? pre;
  const setWrap = (on: boolean) => {
    for (const el of [pre, code]) {
      if (on) {
        el.style.setProperty('white-space', 'pre-wrap', 'important');
        el.style.setProperty('overflow-wrap', 'anywhere', 'important');
      } else {
        el.style.removeProperty('white-space');
        el.style.removeProperty('overflow-wrap');
      }
    }
  };
  // Reset any prior fit so measurement starts from the stylesheet default.
  pre.style.removeProperty('font-size');
  setWrap(false);
  const base = parseFloat(getComputedStyle(pre).fontSize) || 32;
  const fitsBoth = () =>
    pre.scrollHeight <= pre.clientHeight + 1 && pre.scrollWidth <= pre.clientWidth + 1;
  const fitsHeight = () => pre.scrollHeight <= pre.clientHeight + 1;
  if (fitsBoth()) return;

  // First, shrink the font to fit both axes without wrapping (crisp code).
  for (let i = 1; i < steps.length; i++) {
    pre.style.setProperty('font-size', `${base * steps[i]}px`, 'important');
    if (fitsBoth()) return;
  }

  // Still too wide even at the smallest font (a single enormous line): wrap as
  // a last resort so all the code is visible, then fit height.
  if (pre.scrollWidth > pre.clientWidth + 1) {
    setWrap(true);
    pre.style.removeProperty('font-size');
    if (fitsHeight()) return;
    for (let i = 1; i < steps.length; i++) {
      pre.style.setProperty('font-size', `${base * steps[i]}px`, 'important');
      if (fitsHeight()) return;
    }
  }
}
