import { useContext, useEffect, useRef } from 'react';
import { enhanceCodeBlocks } from '@/code/CodeBlock';
import { renderMath } from '@/math/katex';
import { renderMermaid } from '@/diagrams/mermaid';
import { resolveAssetUrls } from '@/storage/assetStore';
import { renderIcons } from '@/icons/renderIcons';
import { renderCharts } from '@/charts/renderCharts';
import { StaticRenderContext, CodeThemeContext } from './renderContext';

/**
 * Renders raw HTML and post-processes it: swaps codeblock placeholders for
 * Shiki-highlighted markup, renders KaTeX into .math-* spans/divs, renders
 * Mermaid into .codeblock-placeholder[data-lang=mermaid] elements, and
 * resolves asset:<hash> image URLs.
 */
export function EnhancedHtml({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const codeTheme = useContext(CodeThemeContext);
  const staticRender = useContext(StaticRenderContext);

  useEffect(() => {
    // In static export mode the exporter owns the enhancement pass — skip the
    // effect-driven one so the two don't race over the same placeholders.
    if (staticRender) return;
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    (async () => {
      // Order matters: enhanceCodeBlocks converts mermaid placeholders into
      // .mermaid divs that renderMermaid then renders, so it must run first.
      await enhanceCodeBlocks(el, codeTheme);
      if (cancelled) return;
      renderCharts(el);
      await Promise.all([
        renderIcons(el),
        renderMath(el),
        renderMermaid(el),
        resolveAssetUrls(el),
      ]);
    })();
    return () => {
      cancelled = true;
    };
  }, [html, codeTheme, staticRender]);

  // Keyed on the code theme: switching themes must restore the raw
  // placeholders (fresh innerHTML) so the effect can re-highlight — enhanced
  // blocks are otherwise already consumed and would keep the old colors.
  return <div key={codeTheme} ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}
