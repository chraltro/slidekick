import type { SlideAST } from '../types';
import { splitTitle } from '../splitHtml';
import { FitScale } from './FitScale';

export default function EndLayout({ slide }: { slide: SlideAST }) {
  const { titleHtml, subtitleHtml } = splitTitle(slide.html);
  return (
    <div className="layout-end">
      <FitScale align="center">
        <h1 dangerouslySetInnerHTML={{ __html: titleHtml || 'Thanks' }} />
        {subtitleHtml && <div className="subtitle" dangerouslySetInnerHTML={{ __html: subtitleHtml }} />}
        <div className="accent-bar" />
      </FitScale>
    </div>
  );
}
