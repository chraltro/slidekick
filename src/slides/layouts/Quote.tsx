import type { SlideAST } from '../types';
import { splitQuote } from '../splitHtml';

export default function QuoteLayout({ slide }: { slide: SlideAST }) {
  const { quoteHtml, attribution } = splitQuote(slide.html);
  return (
    <div className="layout-quote">
      <blockquote dangerouslySetInnerHTML={{ __html: quoteHtml ?? '' }} />
      {attribution && <div className="attribution">{attribution}</div>}
    </div>
  );
}
