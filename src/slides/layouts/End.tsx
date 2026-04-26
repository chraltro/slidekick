import type { SlideAST } from '../types';
import { splitTitle } from '../splitHtml';

export default function EndLayout({ slide }: { slide: SlideAST }) {
  const { titleHtml, subtitleHtml } = splitTitle(slide.html);
  return (
    <div className="layout-end">
      <h1 dangerouslySetInnerHTML={{ __html: titleHtml || 'Thanks' }} />
      {subtitleHtml && <div className="subtitle" dangerouslySetInnerHTML={{ __html: subtitleHtml }} />}
      <div className="accent-bar" />
    </div>
  );
}
