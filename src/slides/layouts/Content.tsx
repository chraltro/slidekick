import type { SlideAST } from '../types';
import { EnhancedHtml } from './EnhancedHtml';
import { FitScale } from './FitScale';

export default function ContentLayout({ slide }: { slide: SlideAST }) {
  return (
    <div className="layout-content">
      <FitScale align="center">
        <EnhancedHtml html={slide.html} />
      </FitScale>
    </div>
  );
}
