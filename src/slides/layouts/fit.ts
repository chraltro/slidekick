/**
 * Pure DOM fit helpers shared by the live layouts (via React effects) and the
 * static HTML exporter (called imperatively after enhancement). Keeping the
 * measurement in one place means the exported deck fits content exactly like
 * the live preview instead of drifting.
 */

export const FIT_STEPS = [
  1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.46, 0.42, 0.4, 0.37, 0.34, 0.31, 0.28,
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
  pre.style.removeProperty('font-size');
  const base = parseFloat(getComputedStyle(pre).fontSize) || 32;
  const fits = () =>
    pre.scrollHeight <= pre.clientHeight + 1 && pre.scrollWidth <= pre.clientWidth + 1;
  if (fits()) return;
  for (let i = 1; i < steps.length; i++) {
    pre.style.setProperty('font-size', `${base * steps[i]}px`, 'important');
    if (fits()) break;
  }
}
