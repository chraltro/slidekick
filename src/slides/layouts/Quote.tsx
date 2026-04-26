import type { SlideAST } from '../types';
import { splitQuote } from '../splitHtml';
import { EnhancedHtml } from './EnhancedHtml';

export default function QuoteLayout({ slide }: { slide: SlideAST }) {
  const { headerHtml, quoteHtml, attribution, rest } = splitQuote(slide.html);
  const finalAttribution = slide.meta.attribution ?? attribution;
  const restHasContent = rest && rest.replace(/<[^>]+>/g, '').trim().length > 0;
  return (
    <div className="layout-quote">
      {headerHtml && (
        <div className="quote-header" dangerouslySetInnerHTML={{ __html: headerHtml }} />
      )}
      <blockquote dangerouslySetInnerHTML={{ __html: quoteHtml ?? '' }} />
      {finalAttribution && <div className="attribution">{finalAttribution}</div>}
      {restHasContent && (
        <div className="quote-rest">
          <EnhancedHtml html={rest} />
        </div>
      )}
    </div>
  );
}
