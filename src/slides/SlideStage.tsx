import { useEffect, useRef, useState } from 'react';
import type { SlideAST, DeckConfig } from './types';
import { RenderSlide } from './renderSlide';

/**
 * Wraps a slide in the fit-scaling stage. Uses ResizeObserver to compute
 * --fit-scale on the stage element, so the 1920x1080 canvas inside is scaled
 * (never reflowed) to fit the viewport.
 */
export function SlideStage({
  slide,
  config,
  totalSlides,
  showPageNumber,
  className,
}: {
  slide: SlideAST | null;
  config: DeckConfig;
  totalSlides: number;
  showPageNumber?: boolean;
  className?: string;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const scalerRef = useRef<HTMLDivElement | null>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    const scaler = scalerRef.current;
    if (!stage || !scaler) return;

    const aspect = config.aspect ?? '16:9';
    const baseW = aspect === '4:3' ? 1440 : aspect === '1:1' ? 1080 : 1920;
    const baseH = 1080;

    const update = () => {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      if (!w || !h) return;
      const scale = Math.min(w / baseW, h / baseH);
      scaler.style.setProperty('--fit-scale', String(scale));
      // Overflow check: compare canvas scrollHeight vs canvas clientHeight.
      const canvas = scaler.querySelector('.slide-canvas') as HTMLElement | null;
      if (canvas) {
        const isOverflowing = canvas.scrollHeight > canvas.clientHeight + 4 || canvas.scrollWidth > canvas.clientWidth + 4;
        setOverflow(isOverflowing);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [slide?.hash, config.aspect]);

  return (
    <div ref={stageRef} className={`slide-stage ${className ?? ''}`}>
      <div ref={scalerRef} className="slide-scaler">
        {slide && (
          <RenderSlide
            slide={slide}
            config={config}
            totalSlides={totalSlides}
            showPageNumber={showPageNumber}
          />
        )}
      </div>
      {overflow && (
        <div className="absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 pointer-events-none z-10">
          Overflow — try another layout
        </div>
      )}
    </div>
  );
}
