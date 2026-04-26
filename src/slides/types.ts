export type Layout =
  | 'title'
  | 'content'
  | 'two-column'
  | 'image-left'
  | 'image-right'
  | 'full-image'
  | 'code-focus'
  | 'quote'
  | 'section-divider'
  | 'end';

export const LAYOUTS: Layout[] = [
  'title',
  'content',
  'two-column',
  'image-left',
  'image-right',
  'full-image',
  'code-focus',
  'quote',
  'section-divider',
  'end',
];

export type Aspect = '16:9' | '4:3' | '1:1';

export interface DeckConfig {
  title?: string;
  theme: string;
  font?: string;
  mono?: string;
  transition?: 'fade' | 'slide' | 'none';
  aspect?: Aspect;
  codeTheme?: string;
  customCss?: string;
  pageNumber?: boolean;
  footer?: string;
  /** Seconds per slide for auto-advance / kiosk mode. Omit to disable. */
  autoAdvance?: number;
}

export interface SlideMeta {
  layout?: Layout;
  bg?: string;
  color?: string;
  class?: string;
  notes?: string;
  align?: 'left' | 'center' | 'right';
  image?: string;
  /** Attribution shown under a quote-layout slide (overrides leading-dash detection). */
  attribution?: string;
}

export interface SlideAST {
  /** 0-based index in the deck. */
  index: number;
  /** Stable hash of the slide's source text — used for diffing. */
  hash: string;
  /** Source character ranges in the original markdown buffer (excluding frontmatter). */
  range: { start: number; end: number };
  /** Raw markdown of just this slide (without frontmatter). */
  source: string;
  /** Resolved layout — either explicit from meta or auto-detected. */
  layout: Layout;
  /** Per-slide metadata after merging defaults. */
  meta: SlideMeta;
  /** Rendered HTML (sanitized markdown-it output) for the body. */
  html: string;
  /** Speaker notes (markdown). */
  notes?: string;
  /** Convenience: extracted title (H1 or H2 text) for thumbnails. */
  title?: string;
}

export interface ParsedDeck {
  config: DeckConfig;
  slides: SlideAST[];
  /** Original markdown source. */
  source: string;
}
