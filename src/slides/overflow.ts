import type { Layout, SlideAST } from './types';

/** Suggest layouts that would likely fit a slide that's currently overflowing. */
export function suggestLayouts(slide: SlideAST): Layout[] {
  const out: Layout[] = [];
  const src = slide.source;
  // If the slide has a code fence and is currently 'content', try code-focus.
  if (slide.layout !== 'code-focus' && /```/m.test(src)) out.push('code-focus');
  // If it has multiple paragraphs/lists, try two-column.
  if (slide.layout !== 'two-column') out.push('two-column');
  // If it has an image, try image-left/right or full-image.
  if (slide.layout !== 'full-image' && /!\[.*\]\(/.test(src)) out.push('full-image');
  if (slide.layout !== 'content') out.push('content');
  return out.slice(0, 3);
}
