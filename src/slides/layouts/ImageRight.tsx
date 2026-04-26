import type { SlideAST } from '../types';
import { splitImage } from '../splitHtml';
import { EnhancedHtml } from './EnhancedHtml';

export default function ImageRightLayout({ slide }: { slide: SlideAST }) {
  const { imageHtml, bodyHtml } = splitImage(slide.html);
  return (
    <div className="layout-image-right">
      <div className="body"><EnhancedHtml html={bodyHtml} /></div>
      <div className="image" dangerouslySetInnerHTML={{ __html: imageHtml ?? '' }} />
    </div>
  );
}
