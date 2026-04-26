import type { SlideAST } from '../types';
import { splitImage } from '../splitHtml';

export default function FullImageLayout({ slide }: { slide: SlideAST }) {
  const { imageHtml, caption } = splitImage(slide.html);
  return (
    <div className="layout-full-image">
      <div className="image" dangerouslySetInnerHTML={{ __html: imageHtml ?? '' }} />
      {caption && <div className="caption">{caption}</div>}
    </div>
  );
}
