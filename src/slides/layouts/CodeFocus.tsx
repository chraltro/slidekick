import type { SlideAST } from '../types';
import { EnhancedHtml } from './EnhancedHtml';

export default function CodeFocusLayout({ slide }: { slide: SlideAST }) {
  return (
    <div className="layout-code-focus">
      <EnhancedHtml html={slide.html} />
    </div>
  );
}
