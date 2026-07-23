import { useCallback, useEffect, useRef } from 'react';
import { Toolbar } from './Toolbar';
import { ThumbnailRail } from './ThumbnailRail';
import { PresenterPanel } from './PresenterPanel';
import CodeMirrorEditor from './CodeMirrorEditor';
import { DragHandle, useContainerSize, usePersistedSize } from './SplitPane';
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
import { DrawOverlay } from './DrawOverlay';
import { isInsideFence } from '@/slides/parser';
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
  const themeOverride = useUiStore((s) => s.themeOverride);

  // Theme-picker hover preview: swap the theme locally without touching the
  // markdown source (writing on hover would pollute undo history and trigger
  // an autosave per swatch). Only the local preview uses this — thumbnails
  // and the audience window keep the real config.
  const previewConfig = themeOverride ? { ...parsed.config, theme: themeOverride } : parsed.config;

  // Lets index.html chrome (the demant.app link) hide itself during a show.
  useEffect(() => {
    document.body.classList.toggle('presenting', isPresenting);
    return () => document.body.classList.remove('presenting');
  }, [isPresenting]);

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
    // Find the real layout directive, skipping comments inside code fences —
    // those are literal syntax examples, and rewriting one would corrupt the
    // author's code sample instead of setting the layout.
    const re = /<!--([\s\S]*?)-->/g;
    let m: RegExpExecArray | null;
    let target: RegExpExecArray | null = null;
    while ((m = re.exec(slideSrc)) !== null) {
      if (isInsideFence(slideSrc, m.index)) continue;
      if (/\blayout\s*:/i.test(m[1])) {
        target = m;
        break;
      }
    }
    let updated: string;
    if (target) {
      const inner = target[1].replace(/layout\s*:\s*[^;]+/i, `layout: ${layout}`);
      updated =
        slideSrc.slice(0, target.index) +
        `<!--${inner}-->` +
        slideSrc.slice(target.index + target[0].length);
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

  // Resizable panes. Sizes persist to localStorage via usePersistedSize.
  // Editor + thumbnail rail are pixel-sized; the preview pane absorbs the
  // remainder via `1fr`. Presenter panel height is also pixel-sized.
  const mainRef = useRef<HTMLDivElement | null>(null);
  const { width: mainWidth, height: mainHeight } = useContainerSize(mainRef);
  const [editorW, setEditorW] = usePersistedSize('editor', 520);
  const [thumbsW, setThumbsW] = usePersistedSize('thumbs', 220);
  const [presenterH, setPresenterH] = usePersistedSize('presenter', 120);

  // Clamp sizes to keep the preview from collapsing below 280px.
  function clampEditor(next: number): number {
    const minEditor = 240;
    const minPreview = 280;
    const maxEditor = Math.max(minEditor, mainWidth - thumbsW - minPreview);
    return Math.max(minEditor, Math.min(maxEditor, next));
  }
  function clampThumbs(next: number): number {
    const minThumbs = 0;
    const maxThumbs = Math.max(minThumbs, mainWidth - editorW - 280);
    return Math.max(minThumbs, Math.min(maxThumbs, next));
  }
  function clampPresenter(next: number): number {
    const minH = 0;
    const maxH = Math.max(minH, mainHeight - 240);
    return Math.max(minH, Math.min(maxH, next));
  }

  if (isPresenting) {
    return (
      <div className="fixed inset-0 bg-black">
        {blankMode === 'black' ? (
          <div className="absolute inset-0 bg-black" />
        ) : blankMode === 'white' ? (
          <div className="absolute inset-0 bg-white" />
        ) : (
          slide && <SlideStage slide={slide} config={previewConfig} totalSlides={parsed.slides.length} showPageNumber={parsed.config.pageNumber} />
        )}
        <DrawOverlay />
        <div className="absolute bottom-2 right-2 text-xs text-white/40 select-none pointer-events-none">
          {currentSlide + 1} / {parsed.slides.length} · Esc to exit · D draw · O overview
        </div>
      </div>
    );
  }

  return (
    <div ref={editorRootRef} className="grid h-full grid-rows-[auto_1fr_1px_auto] bg-chrome-bg overflow-hidden">
      <Toolbar onOpenAudience={openAudience} audienceConnected={audienceConnected} />
      <div
        ref={mainRef}
        className="grid min-h-0 overflow-hidden"
        style={{
          gridTemplateColumns: `${clampEditor(editorW)}px 1px minmax(280px, 1fr) 1px ${clampThumbs(thumbsW)}px`,
        }}
      >
        <div className="min-h-0 min-w-0 flex flex-col">
          <CodeMirrorEditor
            value={source}
            onChange={setSource}
            slideRanges={parsed.slides.map((s) => s.range)}
            onCursorSlide={(idx) => setCurrentSlide(idx)}
          />
        </div>
        <DragHandle
          orientation="col"
          getStart={() => editorW}
          onDrag={(next) => setEditorW(clampEditor(next))}
        />
        <div className="min-h-0 min-w-0 bg-chrome-bg flex items-center justify-center p-6">
          <div className="w-full h-full max-w-full max-h-full flex items-center justify-center">
            <div
              className="relative shadow-2xl rounded-md overflow-hidden ring-1 ring-chrome-border"
              style={{
                aspectRatio:
                  parsed.config.aspect === '4:3' ? '4 / 3' : parsed.config.aspect === '1:1' ? '1 / 1' : '16 / 9',
                // Width clamp must use the same ratio as aspectRatio above, or
                // 4:3 and 1:1 decks overflow the pane vertically.
                width: `min(100%, calc((100vh - 200px) * ${
                  parsed.config.aspect === '4:3' ? '4 / 3' : parsed.config.aspect === '1:1' ? '1' : '16 / 9'
                }))`,
              }}
            >
              <SlideStage
                slide={slide}
                config={previewConfig}
                totalSlides={parsed.slides.length}
                showPageNumber={parsed.config.pageNumber}
              />
            </div>
          </div>
        </div>
        <DragHandle
          orientation="col"
          direction={-1}
          getStart={() => thumbsW}
          onDrag={(next) => setThumbsW(clampThumbs(next))}
        />
        <div className="min-h-0 overflow-hidden">
          <ThumbnailRail />
        </div>
      </div>
      <DragHandle
        orientation="row"
        direction={-1}
        getStart={() => presenterH}
        onDrag={(next) => setPresenterH(clampPresenter(next))}
      />
      <div style={{ height: clampPresenter(presenterH) }} className="min-h-0 overflow-hidden">
        <PresenterPanel onSetSlideLayout={setSlideLayout} />
      </div>
      <SlideJumper />
      <Overview />
      <RecentDecks />
    </div>
  );
}
