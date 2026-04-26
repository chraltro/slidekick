import type { SlideAST } from '../types';
import { splitQuote } from '../splitHtml';
import { EnhancedHtml } from './EnhancedHtml';

export default function QuoteLayout({ slide }: { slide: SlideAST }) {
  const { quoteHtml, attribution, rest } = splitQuote(slide.html);
  // Slide metadata can override / supply the attribution.
  const finalAttribution = slide.meta.attribution ?? attribution;
  // Strip empty whitespace-only "rest" so we don't show a tiny gap.
  const restHasContent = rest && rest.replace(/<[^>]+>/g, '').trim().length > 0;
  return (
    <div className="layout-quote">
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
