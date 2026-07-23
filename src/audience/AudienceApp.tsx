import { useEffect } from 'react';
import { useAudienceChannel } from '@/sync/useAudienceChannel';
import { SlideStage } from '@/slides/SlideStage';
import { RenderSlide } from '@/slides/renderSlide';
import { useThemeLoader } from '@/themes/useThemeLoader';
import { useUiStore } from '@/state/useUiStore';
import { DrawOverlay } from '@/editor/DrawOverlay';
import { ErrorBoundary } from '@/ui/ErrorBoundary';
import type { SlideAST, DeckConfig } from '@/slides/types';

/**
 * The presentation window. Opened from the editor ("Present"), screen-shared
 * in Teams/Zoom, and mirrors the editor live. It is also directly operable:
 * arrow/space navigation (fragment-aware), digit jumps, blanking, fullscreen,
 * drawing (D) and a slide overview (O).
 */
export default function AudienceApp() {
  const { state, navigate, setBlank } = useAudienceChannel();
  const config = state.config;
  const drawing = useUiStore((s) => s.drawingMode);
  const setDrawing = useUiStore((s) => s.setDrawingMode);
  const overviewOpen = useUiStore((s) => s.overviewOpen);
  const setOverviewOpen = useUiStore((s) => s.setOverviewOpen);

  useThemeLoader(config?.theme ?? 'catppuccin-mocha', config?.customCss);

  // Clamp: NAV can reference an index this window doesn't have yet (or no
  // longer has, if the deck shrank) — show the nearest valid slide instead of
  // dropping back to the placeholder mid-presentation.
  const clampedIndex = Math.min(state.currentIndex, state.slides.length - 1);
  const currentSlide = state.slides[clampedIndex] ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;
      const total = state.slides.length;
      if (total === 0) return;
      const index = Math.min(state.currentIndex, total - 1);

      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        setOverviewOpen(!useUiStore.getState().overviewOpen);
        return;
      }
      if (useUiStore.getState().overviewOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setOverviewOpen(false);
        }
        return; // overview owns the keyboard while open
      }
      if (e.key === 'd' || e.key === 'D') {
        // Exiting draw mode is handled by DrawOverlay itself (capture phase).
        e.preventDefault();
        setDrawing(true);
        return;
      }

      // Fragment-aware navigation: reveal fragments before changing slides.
      const fragments =
        document
          .querySelector(`[data-slide-index="${index}"]`)
          ?.querySelectorAll('[data-fragment]').length ?? 0;
      const step = useUiStore.getState().fragmentStep;

      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
        case 'l':
          e.preventDefault();
          if (fragments > 0 && step < fragments) navigate(index, step + 1);
          else navigate(Math.min(total - 1, index + 1));
          break;
        case 'ArrowLeft':
        case 'PageUp':
        case 'h':
          e.preventDefault();
          if (fragments > 0 && step > 0) navigate(index, step - 1);
          else navigate(Math.max(0, index - 1));
          break;
        case 'Home':
          e.preventDefault();
          navigate(0);
          break;
        case 'End':
          e.preventDefault();
          navigate(total - 1);
          break;
        case 'b':
        case 'B':
        case '.':
          e.preventDefault();
          setBlank(state.blankMode === 'black' ? 'off' : 'black');
          break;
        case 'w':
        case 'W':
          e.preventDefault();
          setBlank(state.blankMode === 'white' ? 'off' : 'white');
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen();
          break;
        case 'Escape':
          if (document.fullscreenElement) document.exitFullscreen();
          break;
        default:
          if (/^[0-9]$/.test(e.key)) {
            const idx = parseInt(e.key, 10) - 1;
            if (idx >= 0 && idx < total) navigate(idx);
          }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, setBlank, setDrawing, setOverviewOpen, state.blankMode, state.currentIndex, state.slides.length]);

  // Auto-advance / kiosk mode from frontmatter `autoAdvance: <seconds>`.
  // The interval restarts on every navigation, so manual navigation resets
  // the countdown.
  useEffect(() => {
    const seconds = config?.autoAdvance;
    const total = state.slides.length;
    if (!seconds || seconds <= 0 || total === 0) return;
    const id = window.setInterval(() => {
      navigate((Math.min(state.currentIndex, total - 1) + 1) % total);
    }, seconds * 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.autoAdvance, state.slides.length, state.currentIndex]);

  if (state.blankMode === 'black') {
    return <div className="fixed inset-0 bg-black" />;
  }
  if (state.blankMode === 'white') {
    return <div className="fixed inset-0 bg-white" />;
  }

  return (
    <div className="fixed inset-0 bg-black">
      {!currentSlide && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-chrome-fg gap-3">
          <div className="text-2xl font-medium">Presentation window ready</div>
          <div className="text-chrome-muted text-sm">
            {state.editorConnected ? 'Waiting for editor…' : 'Open the editor in another window.'}
          </div>
        </div>
      )}
      {currentSlide && config && (
        <SlideStage
          slide={currentSlide}
          config={config}
          totalSlides={state.slides.length}
          showPageNumber={config.pageNumber}
        />
      )}
      <DrawOverlay />
      {overviewOpen && config && (
        <AudienceOverview
          slides={state.slides}
          config={config}
          onPick={(idx) => {
            navigate(idx);
            setOverviewOpen(false);
          }}
        />
      )}
      {currentSlide && !drawing && !overviewOpen && (
        <div className="absolute bottom-2 right-2 text-xs text-white/40 select-none pointer-events-none">
          {clampedIndex + 1} / {state.slides.length} · D draw · O overview · F fullscreen
        </div>
      )}
    </div>
  );
}

/** Slide-grid overlay for the presentation window (toggled with O). */
function AudienceOverview({
  slides,
  config,
  onPick,
}: {
  slides: SlideAST[];
  config: DeckConfig;
  onPick: (index: number) => void;
}) {
  const aspect = config.aspect ?? '16:9';
  const baseW = aspect === '4:3' ? 1440 : aspect === '1:1' ? 1080 : 1920;
  const baseH = 1080;
  const targetW = 320;
  const scale = targetW / baseW;

  return (
    <div className="absolute inset-0 z-[1500] bg-chrome-bg overflow-auto app-scroll">
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-chrome-surface/90 backdrop-blur border-b border-chrome-border">
        <div className="text-sm text-chrome-fg">
          Overview · <span className="text-chrome-muted">{slides.length} slides</span>
        </div>
        <span className="text-xs text-chrome-muted">Click a slide · Esc or O to close</span>
      </div>
      <div
        className="grid gap-4 p-6"
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${targetW}px, 1fr))` }}
      >
        {slides.map((slide) => (
          <button
            key={slide.hash + slide.index}
            onClick={() => onPick(slide.index)}
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
                <ErrorBoundary resetKey={slide.hash}>
                  <RenderSlide slide={slide} config={config} totalSlides={slides.length} showPageNumber={false} />
                </ErrorBoundary>
              </div>
            </div>
            <div className="px-3 py-2 text-xs flex items-center justify-between bg-chrome-surface border-t border-chrome-border">
              <span>
                <span className="text-chrome-fg">{slide.index + 1}</span>{' '}
                <span className="text-chrome-muted truncate">{slide.title ?? slide.layout}</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-chrome-muted">{slide.layout}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
