import type { SlideAST } from '../types';
import { splitTitle } from '../splitHtml';

export default function SectionDividerLayout({ slide }: { slide: SlideAST }) {
  const { titleHtml } = splitTitle(slide.html);
  return (
    <div className="layout-section-divider">
      <h1 dangerouslySetInnerHTML={{ __html: titleHtml }} />
    </div>
  );
}
