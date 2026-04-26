import { useCallback, useEffect, useRef } from 'react';
import { Toolbar } from './Toolbar';
import { ThumbnailRail } from './ThumbnailRail';
import { PresenterPanel } from './PresenterPanel';
import CodeMirrorEditor from './CodeMirrorEditor';
import { SlideStage } from '@/slides/SlideStage';
import { useDeckStore } from '@/state/useDeckStore';
import { useUiStore } from '@/state/useUiStore';
import { useEditorChannel } from '@/sync/useEditorChannel';
import { useThemeLoader } from '@/themes/useThemeLoader';
import { useAutosave } from './autosave';
import { useGlobalShortcuts } from './commands';
import { useImagePaste } from './useImagePaste';
import { SlideJumper } from './SlideJumper';
import { Overview } from './Overview';
import { RecentDecks } from './RecentDecks';
import { ThemeTweaker } from './ThemeTweaker';
import { DrawOverlay } from './DrawOverlay';
import type { Layout } from '@/slides/types';

export default function EditorApp() {
  const source = useDeckStore((s) => s.source);
  const setSource = useDeckStore((s) => s.setSource);
  const parsed = useDeckStore((s) => s.parsed);
  const currentSlide = useUiStore((s) => s.currentSlide);
  const setCurrentSlide = useUiStore((s) => s.setCurrentSlide);
  const isPresenting = useUiStore((s) => s.isPresenting);
  const audienceConnected = useUiStore((s) => s.audienceConnected);
  const blankMode = useUiStore((s) => s.blankMode);

  const editorRootRef = useRef<HTMLDivElement | null>(null);

  useThemeLoader(parsed.config.theme, parsed.config.customCss);
  useAutosave();
  useEditorChannel();
  useImagePaste(editorRootRef);

  // Auto-advance / kiosk mode: when frontmatter has `autoAdvance: <seconds>`
  // and we're presenting (and not paused), step forward every N seconds.
  const autoAdvancePaused = useUiStore((s) => s.autoAdvancePaused);
  useEffect(() => {
    const seconds = parsed.config.autoAdvance;
    if (!isPresenting || !seconds || seconds <= 0 || autoAdvancePaused) return;
    const total = parsed.slides.length;
    const id = window.setInterval(() => {
      const cur = useUiStore.getState().currentSlide;
      const next = (cur + 1) % total;
      useUiStore.getState().setCurrentSlide(next);
    }, seconds * 1000);
    return () => window.clearInterval(id);
  }, [isPresenting, parsed.config.autoAdvance, parsed.slides.length, autoAdvancePaused]);

  const openAudience = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('role', 'audience');
    window.open(
      url.toString(),
      'md-presentations-audience',
      'popup=yes,width=1280,height=720,menubar=no,toolbar=no,status=no',
    );
  }, []);

  useGlobalShortcuts(openAudience);

  function setSlideLayout(slideIndex: number, layout: Layout | string) {
    const slide = parsed.slides[slideIndex];
    if (!slide) return;
    const slideSrc = source.slice(slide.range.start, slide.range.end);
    let updated;
    if (/<!--\s*[^>]*\blayout\s*:/i.test(slideSrc)) {
      updated = slideSrc.replace(
        /<!--([\s\S]*?)-->/,
        (_full, inner) => {
          if (/\blayout\s*:/i.test(inner)) {
            return `<!--${inner.replace(/layout\s*:\s*[^;]+/i, `layout: ${layout}`)}-->`;
          }
          return `<!--${inner}; layout: ${layout}-->`;
        },
      );
    } else {
      const lines = slideSrc.split('\n');
      const headingIdx = lines.findIndex((l) => /^#{1,2}\s/.test(l));
      const insertAt = headingIdx >= 0 ? headingIdx + 1 : 0;
      lines.splice(insertAt, 0, `<!-- layout: ${layout} -->`);
      updated = lines.join('\n');
    }
    const newSource = source.slice(0, slide.range.start) + updated + source.slice(slide.range.end);
    setSource(newSource);
  }

  const slide = parsed.slides[currentSlide] ?? null;

  if (isPresenting) {
    return (
      <div className="fixed inset-0 bg-black">
        {blankMode === 'black' ? (
          <div className="absolute inset-0 bg-black" />
        ) : blankMode === 'white' ? (
          <div className="absolute inset-0 bg-white" />
        ) : (
          slide && <SlideStage slide={slide} config={parsed.config} totalSlides={parsed.slides.length} showPageNumber={parsed.config.pageNumber} />
        )}
        <DrawOverlay />
        <div className="absolute bottom-2 right-2 text-xs text-white/40 select-none pointer-events-none">
          {currentSlide + 1} / {parsed.slides.length} · Esc to exit · D draw · O overview
        </div>
      </div>
    );
  }

  return (
    <div ref={editorRootRef} className="grid h-full grid-rows-[auto_1fr_auto] bg-chrome-bg overflow-hidden">
      <Toolbar onOpenAudience={openAudience} audienceConnected={audienceConnected} />
      <div className="grid grid-cols-[minmax(320px,1fr)_minmax(0,1.6fr)_220px] min-h-0 overflow-hidden">
        <div className="border-r border-chrome-border min-h-0 min-w-0 flex flex-col">
          <CodeMirrorEditor
            value={source}
            onChange={setSource}
            slideRanges={parsed.slides.map((s) => s.range)}
            onCursorSlide={(idx) => setCurrentSlide(idx)}
          />
        </div>
        <div className="min-h-0 min-w-0 bg-chrome-bg flex items-center justify-center p-6">
          <div className="w-full h-full max-w-full max-h-full flex items-center justify-center">
            <div
              className="relative shadow-2xl rounded-md overflow-hidden ring-1 ring-chrome-border"
              style={{
                aspectRatio:
                  parsed.config.aspect === '4:3' ? '4 / 3' : parsed.config.aspect === '1:1' ? '1 / 1' : '16 / 9',
                width: 'min(100%, calc((100vh - 200px) * 16 / 9))',
              }}
            >
              <SlideStage
                slide={slide}
                config={parsed.config}
                totalSlides={parsed.slides.length}
                showPageNumber={parsed.config.pageNumber}
              />
            </div>
          </div>
        </div>
        <div className="border-l border-chrome-border min-h-0">
          <ThumbnailRail />
        </div>
      </div>
      <PresenterPanel onSetSlideLayout={setSlideLayout} />
      <SlideJumper />
      <Overview />
      <RecentDecks />
      <ThemeTweaker />
    </div>
  );
}
