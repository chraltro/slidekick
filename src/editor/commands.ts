import { useEffect } from 'react';
import { useDeckStore } from '@/state/useDeckStore';
import { useUiStore } from '@/state/useUiStore';
import { exportDeckHtml, downloadFile } from '@/export/exportHtml';
export {};

export function useGlobalShortcuts(openAudience: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      const inEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        target?.isContentEditable ||
        target?.closest?.('.cm-editor');
      const meta = e.metaKey || e.ctrlKey;
      const ui = useUiStore.getState();
      const deck = useDeckStore.getState();

      if (meta && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (e.shiftKey) {
          openAudience();
        } else {
          ui.setPresenting(!ui.isPresenting);
        }
        return;
      }
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ui.setSlideJumperOpen(true);
        return;
      }
      if (meta && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        exportDeckHtml(deck.parsed, deck.title).then((html) => {
          const filename = `${(deck.title || 'deck').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}.html`;
          downloadFile(filename, html, 'text/html');
        });
        return;
      }
      if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault();
        deck && useDeckStore.setState({ lastSavedAt: Date.now(), dirty: false });
        return;
      }

      if (inEditable) return;

      // Single-key shortcuts (only outside text inputs)
      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        ui.setOverviewOpen(!useUiStore.getState().overviewOpen);
        return;
      }
      if ((e.key === 'd' || e.key === 'D') && ui.isPresenting) {
        e.preventDefault();
        ui.setDrawingMode(!useUiStore.getState().drawingMode);
        return;
      }

      const total = deck.parsed.slides.length;
      // Fragment-aware navigation: if the current slide has unrevealed
      // fragments, advance through them before moving to the next slide.
      const currentSlideEl = document.querySelector(
        `[data-slide-index="${ui.currentSlide}"]`,
      ) as HTMLElement | null;
      const fragments = currentSlideEl
        ? currentSlideEl.querySelectorAll('[data-fragment]').length
        : 0;
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          if (fragments > 0 && useUiStore.getState().fragmentStep < fragments) {
            ui.setFragmentStep(useUiStore.getState().fragmentStep + 1);
          } else {
            ui.setCurrentSlide(Math.min(total - 1, ui.currentSlide + 1));
          }
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          if (fragments > 0 && useUiStore.getState().fragmentStep > 0) {
            ui.setFragmentStep(useUiStore.getState().fragmentStep - 1);
          } else {
            ui.setCurrentSlide(Math.max(0, ui.currentSlide - 1));
          }
          break;
        case 'Home':
          ui.setCurrentSlide(0);
          break;
        case 'End':
          ui.setCurrentSlide(total - 1);
          break;
        case 'Escape':
          if (ui.isPresenting) {
            ui.setPresenting(false);
            document.exitFullscreen?.();
          }
          break;
        case 'b':
        case 'B':
        case '.':
          ui.setBlank(ui.blankMode === 'black' ? 'off' : 'black');
          break;
        case 'w':
        case 'W':
          ui.setBlank(ui.blankMode === 'white' ? 'off' : 'white');
          break;
        case 'f':
        case 'F':
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openAudience]);
}
