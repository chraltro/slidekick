import { useUiStore } from '@/state/useUiStore';
import { useDeckStore } from '@/state/useDeckStore';
import { RenderSlide } from '@/slides/renderSlide';

/** Press `O` (or click the overview button) to see all slides on one page. */
export function Overview() {
  const open = useUiStore((s) => s.overviewOpen);
  const setOpen = useUiStore((s) => s.setOverviewOpen);
  const setCurrent = useUiStore((s) => s.setCurrentSlide);
  const parsed = useDeckStore((s) => s.parsed);

  if (!open) return null;

  const aspect = parsed.config.aspect ?? '16:9';
  const baseW = aspect === '4:3' ? 1440 : aspect === '1:1' ? 1080 : 1920;
  const baseH = 1080;
  const targetW = 320;
  const scale = targetW / baseW;

  return (
    <div
      className="fixed inset-0 z-[1500] bg-chrome-bg overflow-auto app-scroll"
      onKeyDown={(e) => {
        if (e.key === 'Escape' || e.key === 'o' || e.key === 'O') setOpen(false);
      }}
      tabIndex={-1}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-chrome-surface/90 backdrop-blur border-b border-chrome-border">
        <div className="text-sm text-chrome-fg">
          Overview · <span className="text-chrome-muted">{parsed.slides.length} slides</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="px-3 py-1 text-xs text-chrome-muted hover:text-chrome-fg border border-chrome-border rounded-md"
        >
          Close (Esc)
        </button>
      </div>
      <div
        className="grid gap-4 p-6"
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${targetW}px, 1fr))` }}
      >
        {parsed.slides.map((slide) => (
          <button
            key={slide.hash + slide.index}
            onClick={() => {
              setCurrent(slide.index);
              setOpen(false);
            }}
            className="group relative rounded-md overflow-hidden border border-chrome-border hover:border-chrome-accent transition text-left"
            style={{ width: targetW }}
          >
            <div
              className="relative pointer-events-none select-none"
              style={{ width: targetW, height: targetW * (baseH / baseW) }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: baseW,
                  height: baseH,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }}
              >
                <RenderSlide slide={slide} config={parsed.config} totalSlides={parsed.slides.length} showPageNumber={false} />
              </div>
            </div>
            <div className="px-3 py-2 text-xs flex items-center justify-between bg-chrome-surface border-t border-chrome-border">
              <span>
                <span className="text-chrome-fg">{slide.index + 1}</span>{' '}
                <span className="text-chrome-muted truncate">{slide.title ?? slide.layout}</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-chrome-muted">
                {slide.layout}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
