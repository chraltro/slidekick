import type { SlideAST } from '../types';
import { splitColumns } from '../splitHtml';
import { EnhancedHtml } from './EnhancedHtml';

export default function TwoColumnLayout({ slide }: { slide: SlideAST }) {
  const { headerHtml, leftHtml, rightHtml } = splitColumns(slide.html);
  return (
    <div className="layout-two-column">
      {headerHtml && <div className="col-header" dangerouslySetInnerHTML={{ __html: headerHtml }} />}
      <div className="col"><EnhancedHtml html={leftHtml} /></div>
      <div className="col"><EnhancedHtml html={rightHtml} /></div>
    </div>
  );
}
