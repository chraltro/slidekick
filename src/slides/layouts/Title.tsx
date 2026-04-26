import type { SlideAST } from '../types';
import { splitTitle } from '../splitHtml';
import { EnhancedHtml } from './EnhancedHtml';

export default function TitleLayout({ slide }: { slide: SlideAST }) {
  const { titleHtml, subtitleHtml, rest } = splitTitle(slide.html);
  return (
    <div className={`layout-title layout-${slide.layout}`}>
      <h1 dangerouslySetInnerHTML={{ __html: titleHtml }} />
      {subtitleHtml && <div className="subtitle" dangerouslySetInnerHTML={{ __html: subtitleHtml }} />}
      <div className="accent-bar" />
      {rest && <EnhancedHtml html={rest} />}
    </div>
  );
}
