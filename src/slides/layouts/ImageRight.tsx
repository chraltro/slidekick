import type { SlideAST } from '../types';
import { splitImage } from '../splitHtml';
import { EnhancedHtml } from './EnhancedHtml';
import { FitScale } from './FitScale';

export default function ImageRightLayout({ slide }: { slide: SlideAST }) {
  const { imageHtml, bodyHtml } = splitImage(slide.html);
  return (
    <div className="layout-image-right">
      <div className="body">
        <FitScale align="center">
          <EnhancedHtml html={bodyHtml} />
        </FitScale>
      </div>
      <div className="image" dangerouslySetInnerHTML={{ __html: imageHtml ?? '' }} />
    </div>
  );
}
