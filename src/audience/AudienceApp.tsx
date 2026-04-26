import { useEffect } from 'react';
import { useAudienceChannel } from '@/sync/useAudienceChannel';
import { SlideStage } from '@/slides/SlideStage';
import { useThemeLoader } from '@/themes/useThemeLoader';

export default function AudienceApp() {
  const { state, navigate, setBlank } = useAudienceChannel();
  const config = state.config;

  useThemeLoader(config?.theme ?? 'catppuccin-mocha', config?.customCss);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;
      const total = state.slides.length;
      if (total === 0) return;
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
        case 'l':
          e.preventDefault();
          navigate(Math.min(total - 1, state.currentIndex + 1));
          break;
        case 'ArrowLeft':
        case 'PageUp':
        case 'h':
          e.preventDefault();
          navigate(Math.max(0, state.currentIndex - 1));
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
  }, [navigate, setBlank, state.blankMode, state.currentIndex, state.slides.length]);

  const currentSlide = state.slides[state.currentIndex] ?? null;

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
          <div className="text-2xl font-medium">Audience window ready</div>
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
    </div>
  );
}
