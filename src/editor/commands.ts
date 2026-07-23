import { useEffect } from 'react';
import { useDeckStore } from '@/state/useDeckStore';
import { useUiStore } from '@/state/useUiStore';
import { exportDeckHtml, downloadFile } from '@/export/exportHtml';
import { flushSaveNow } from './autosave';

export function useGlobalShortcuts(openAudience: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      // Also stand down when a control is focused: stealing Space/arrows from
      // a focused button or select breaks keyboard operation of the toolbar.
      const inEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        target?.isContentEditable ||
        target?.closest?.('.cm-editor, button, [role="button"], select, [role="dialog"]');
      const meta = e.metaKey || e.ctrlKey;
      const ui = useUiStore.getState();
      const deck = useDeckStore.getState();

      if (meta && e.key.toLowerCase() === 'p') {
        // Presenting IS the audience window — one flow, one shortcut.
        e.preventDefault();
        openAudience();
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
        // Actually write to IndexedDB now — flushSaveNow clears the dirty
        // flag only once the write has landed.
        void flushSaveNow();
        return;
      }

      if (inEditable) return;

      // Single-key shortcuts (only outside text inputs)
      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        ui.setOverviewOpen(!useUiStore.getState().overviewOpen);
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
        default:
          // Number keys jump straight to slide N, matching the audience
          // window and the exported deck.
          if (/^[1-9]$/.test(e.key)) {
            const idx = parseInt(e.key, 10) - 1;
            if (idx < total) ui.setCurrentSlide(idx);
          }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openAudience]);
}
