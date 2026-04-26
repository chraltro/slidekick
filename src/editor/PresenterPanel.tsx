import { useEffect, useState } from 'react';
import { useDeckStore } from '@/state/useDeckStore';
import { useUiStore } from '@/state/useUiStore';
import { Button } from '@/ui/Button';
import { LayoutPicker } from '@/ui/LayoutPicker';
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

interface Props {
  onSetSlideLayout: (slideIndex: number, layout: string) => void;
}

export function PresenterPanel({ onSetSlideLayout }: Props) {
  const parsed = useDeckStore((s) => s.parsed);
  const currentSlide = useUiStore((s) => s.currentSlide);
  const setCurrentSlide = useUiStore((s) => s.setCurrentSlide);
  const startTimer = useUiStore((s) => s.startTimer);
  const pauseTimer = useUiStore((s) => s.pauseTimer);
  const resetTimer = useUiStore((s) => s.resetTimer);
  const timerStart = useUiStore((s) => s.timerStart);
  const getElapsed = useUiStore((s) => s.getElapsed);

  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);

  const slide = parsed.slides[currentSlide];
  const total = parsed.slides.length;

  return (
    <div className="border-t border-chrome-border bg-chrome-surface/40 px-3 py-2 flex items-stretch gap-3">
      <div className="flex flex-col w-72">
        <div className="text-[10px] uppercase tracking-wider text-chrome-muted">
          Slide {currentSlide + 1} / {total} — {slide?.layout ?? '—'}
        </div>
        <div className="flex items-center gap-1 mt-1">
          <Button size="sm" variant="ghost" onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}>
            <ChevronLeft size={14} />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCurrentSlide(Math.min(total - 1, currentSlide + 1))}>
            <ChevronRight size={14} />
          </Button>
          {slide && (
            <LayoutPicker
              current={slide.layout}
              onPick={(l) => onSetSlideLayout(currentSlide, l)}
            />
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-chrome-muted">Speaker notes</div>
        <div className="text-sm text-chrome-fg mt-1 whitespace-pre-wrap line-clamp-4 max-h-20 overflow-auto">
          {slide?.notes ?? <span className="text-chrome-muted italic">No notes — add `&lt;!-- notes: ... --&gt;` in the slide.</span>}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 w-44 shrink-0">
        <div className="text-[10px] uppercase tracking-wider text-chrome-muted">Timer</div>
        <div className="text-2xl font-mono text-chrome-fg tabular-nums">{fmt(getElapsed())}</div>
        <div className="flex items-center gap-1">
          {timerStart ? (
            <Button size="sm" variant="ghost" onClick={pauseTimer} title="Pause">
              <Pause size={12} />
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={startTimer} title="Start">
              <Play size={12} />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={resetTimer} title="Reset">
            <RotateCcw size={12} />
          </Button>
        </div>
      </div>
    </div>
  );
}
