import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { fitScale } from './fit';

/**
 * Bounded, quantized "shrink-to-fit" safety net.
 *
 * The deck's design philosophy is that content should be sized by layout, not
 * silently scaled to unreadable type. So this does nothing (scale = 1) for the
 * overwhelming majority of slides — it only kicks in when content would
 * genuinely overflow the fixed 1920×1080 canvas, and even then it snaps to a
 * small set of discrete scale steps (see fit.ts) so overflowing slides look
 * consistent with each other rather than each landing on an arbitrary size.
 */
export function FitScale({
  children,
  align = 'center',
}: {
  children: ReactNode;
  align?: 'center' | 'top';
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    let raf = 0;
    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      fitScale(outer, inner);
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };

    schedule();
    // Async enhancers (Shiki / KaTeX / Mermaid / charts / images) mutate the
    // content after first paint — re-fit a few times as they settle.
    const timers = [120, 380, 900].map((ms) => window.setTimeout(schedule, ms));

    const ro = new ResizeObserver(schedule);
    ro.observe(outer);
    ro.observe(inner);

    inner.querySelectorAll('img').forEach((img) => {
      if (!(img as HTMLImageElement).complete) {
        img.addEventListener('load', schedule, { once: true });
        img.addEventListener('error', schedule, { once: true });
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
      ro.disconnect();
    };
  });

  return (
    <div ref={outerRef} className={`fit-outer fit-${align}`}>
      <div ref={innerRef} className="fit-inner">
        {children}
      </div>
    </div>
  );
}
