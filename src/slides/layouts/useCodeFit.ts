import { useEffect, type RefObject } from 'react';
import { fitCode } from './fit';

/**
 * Shrink a code block's font size just enough to fit the fixed canvas, in
 * discrete steps. Code-focus deliberately fills the slide (see slide-canvas.css)
 * and long/wide code would otherwise scroll or clip; reducing the font is the
 * one place the deck accepts smaller type, and only when there is genuinely a
 * lot of code. Steps are shared (see fit.ts) so heavy code slides look
 * consistent, and match the static export path.
 *
 * Runs after Shiki replaces the placeholder (observed via MutationObserver) and
 * on resize. Idempotent: always resets to the CSS default before measuring.
 */
export function useCodeFit(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => fitCode(root));
    };

    schedule();
    const timers = [120, 380, 900].map((ms) => window.setTimeout(schedule, ms));
    const mo = new MutationObserver(schedule);
    mo.observe(root, { childList: true, subtree: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(root);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
      mo.disconnect();
      ro.disconnect();
    };
  });
}
