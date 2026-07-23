import { useDeckStore } from '@/state/useDeckStore';
import { useUiStore } from '@/state/useUiStore';
import clsx from 'clsx';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SlideAST, DeckConfig } from '@/slides/types';
import { RenderSlide } from '@/slides/renderSlide';
import { ErrorBoundary } from '@/ui/ErrorBoundary';

const THUMB_W = 192;
const THUMB_H = 108;

export function ThumbnailRail() {
  const parsed = useDeckStore((s) => s.parsed);
  const source = useDeckStore((s) => s.source);
  const setSource = useDeckStore((s) => s.setSource);
  const currentSlide = useUiStore((s) => s.currentSlide);
  const setCurrentSlide = useUiStore((s) => s.setCurrentSlide);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = parsed.slides.findIndex((s) => `slide-${s.index}` === active.id);
    const newIndex = parsed.slides.findIndex((s) => `slide-${s.index}` === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const slides = arrayMove(parsed.slides, oldIndex, newIndex);
    const fmEnd = parsed.slides[0]?.range.start ?? 0;
    const frontmatter = source.slice(0, fmEnd);
    // Slide ranges exclude the `***` separator lines and the final slide has
    // no trailing newline, so naive slice-concatenation merges slides. Rebuild
    // each piece with normalized spacing and re-emit `***` before any slide
    // that doesn't start with an H1 (it needs the explicit break to stay a
    // separate slide).
    const pieces = slides.map((s) => {
      const body = source.slice(s.range.start, s.range.end).replace(/\s+$/, '');
      return /^#\s/.test(body.trimStart()) ? body : `***\n\n${body}`;
    });
    const reassembled = frontmatter + pieces.join('\n\n') + '\n';
    setSource(reassembled);
    setCurrentSlide(newIndex);
  }

  return (
    <div className="h-full overflow-auto app-scroll p-2 bg-chrome-bg">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={parsed.slides.map((s) => `slide-${s.index}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {parsed.slides.map((slide) => (
              <Thumb
                key={`slide-${slide.index}`}
                id={`slide-${slide.index}`}
                slide={slide}
                config={parsed.config}
                total={parsed.slides.length}
                isActive={currentSlide === slide.index}
                onClick={() => setCurrentSlide(slide.index)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function Thumb({
  id,
  slide,
  config,
  total,
  isActive,
  onClick,
}: {
  id: string;
  slide: SlideAST;
  config: DeckConfig;
  total: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const aspect = config.aspect ?? '16:9';
  const baseW = aspect === '4:3' ? 1440 : aspect === '1:1' ? 1080 : 1920;
  const baseH = 1080;
  const thumbW = aspect === '1:1' ? THUMB_H : aspect === '4:3' ? Math.round((THUMB_H * 4) / 3) : THUMB_W;
  const scale = thumbW / baseW;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'rounded-md border overflow-hidden text-left transition relative cursor-pointer',
        isActive
          ? 'border-chrome-accent ring-1 ring-chrome-accent'
          : 'border-chrome-border hover:border-chrome-accent/60',
      )}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      {/* Mini slide rendering: scaled-down RenderSlide */}
      <div
        className="relative pointer-events-none select-none"
        style={{ width: thumbW, height: THUMB_H, overflow: 'hidden' }}
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
            <RenderSlide slide={slide} config={config} totalSlides={total} showPageNumber={false} />
          </ErrorBoundary>
        </div>
        {/* Click-blocker overlay so dnd-kit gets the events instead of slide internals */}
        <div className="absolute inset-0" />
      </div>
      <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-chrome-muted bg-chrome-surface flex items-center justify-between border-t border-chrome-border">
        <span className="truncate">
          <span className="text-chrome-fg">{slide.index + 1}</span>{' '}
          <span className="opacity-70">{slide.title ?? slide.layout}</span>
        </span>
        <span className="ml-2 shrink-0 opacity-50">{slide.layout}</span>
      </div>
    </div>
  );
}
