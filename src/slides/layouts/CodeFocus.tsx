import { useRef } from 'react';
import type { SlideAST } from '../types';
import { EnhancedHtml } from './EnhancedHtml';
import { useCodeFit } from './useCodeFit';

export default function CodeFocusLayout({ slide }: { slide: SlideAST }) {
  const ref = useRef<HTMLDivElement>(null);
  // Diagrams/charts fill the slide via flex; only real code blocks are font-fit.
  useCodeFit(ref);
  return (
    <div className="layout-code-focus" ref={ref}>
      <EnhancedHtml html={slide.html} />
    </div>
  );
}
