import type { SlideAST } from '../types';
import { splitTitle } from '../splitHtml';
import { FitScale } from './FitScale';

export default function SectionDividerLayout({ slide }: { slide: SlideAST }) {
  const { titleHtml } = splitTitle(slide.html);
  return (
    <div className="layout-section-divider">
      <FitScale align="center">
        <h1 dangerouslySetInnerHTML={{ __html: titleHtml }} />
      </FitScale>
    </div>
  );
}
