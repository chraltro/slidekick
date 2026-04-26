import type { SlideAST, DeckConfig } from './types';
import Title from './layouts/Title';
import Content from './layouts/Content';
import TwoColumn from './layouts/TwoColumn';
import ImageLeft from './layouts/ImageLeft';
import ImageRight from './layouts/ImageRight';
import FullImage from './layouts/FullImage';
import CodeFocus from './layouts/CodeFocus';
import Quote from './layouts/Quote';
import SectionDivider from './layouts/SectionDivider';
import End from './layouts/End';
import clsx from 'clsx';
import { useUiStore } from '@/state/useUiStore';

const COMPONENTS = {
  title: Title,
  content: Content,
  'two-column': TwoColumn,
  'image-left': ImageLeft,
  'image-right': ImageRight,
  'full-image': FullImage,
  'code-focus': CodeFocus,
  quote: Quote,
  'section-divider': SectionDivider,
  end: End,
};

export interface RenderSlideProps {
  slide: SlideAST;
  config: DeckConfig;
  totalSlides: number;
  showPageNumber?: boolean;
}

export function RenderSlide({ slide, config, totalSlides, showPageNumber }: RenderSlideProps) {
  const Component = COMPONENTS[slide.layout] ?? Content;
  const aspect = config.aspect ?? '16:9';
  const aspectClass =
    aspect === '4:3' ? 'aspect-4-3' : aspect === '1:1' ? 'aspect-1-1' : 'aspect-16-9';
  const fragmentStep = useUiStore((s) => s.fragmentStep);
  const transition = config.transition ?? 'fade';

  const inlineStyle: React.CSSProperties = {};
  if (slide.meta.bg) inlineStyle.background = slide.meta.bg;
  if (slide.meta.color) inlineStyle.color = slide.meta.color;
  if (slide.meta.image) {
    inlineStyle.backgroundImage = `url(${slide.meta.image})`;
    inlineStyle.backgroundSize = 'cover';
    inlineStyle.backgroundPosition = 'center';
  }

  return (
    <div
      className={clsx(
        'slide-canvas slide',
        aspectClass,
        `theme-${config.theme}`,
        `transition-${transition}`,
        slide.meta.class,
      )}
      style={inlineStyle}
      data-slide-index={slide.index}
      data-slide-hash={slide.hash}
      data-slide-layout={slide.layout}
      data-fragment-step={fragmentStep}
      key={slide.hash}
    >
      <Component slide={slide} />
      {(showPageNumber ?? config.pageNumber) && (
        <div className="page-number">
          {slide.index + 1} / {totalSlides}
        </div>
      )}
      {config.footer && <div className="footer">{config.footer}</div>}
    </div>
  );
}
