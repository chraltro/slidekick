import type { SlideAST } from '../types';
import { EnhancedHtml } from './EnhancedHtml';

export default function ContentLayout({ slide }: { slide: SlideAST }) {
  return (
    <div className="layout-content">
      <EnhancedHtml html={slide.html} />
    </div>
  );
}
