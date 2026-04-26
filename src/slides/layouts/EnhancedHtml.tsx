import { useEffect, useRef } from 'react';
import { enhanceCodeBlocks } from '@/code/CodeBlock';
import { renderMath } from '@/math/katex';
import { renderMermaid } from '@/diagrams/mermaid';
import { resolveAssetUrls } from '@/storage/assetStore';
import { useUiStore } from '@/state/useUiStore';
import { renderIcons } from '@/icons/renderIcons';
import { renderCharts } from '@/charts/renderCharts';

/**
 * Renders raw HTML and post-processes it: swaps codeblock placeholders for
 * Shiki-highlighted markup, renders KaTeX into .math-* spans/divs, renders
 * Mermaid into .codeblock-placeholder[data-lang=mermaid] elements, and
 * resolves asset:<hash> image URLs.
 */
export function EnhancedHtml({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const codeTheme = useUiStore((s) => s.codeTheme);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    (async () => {
      // Order matters: enhanceCodeBlocks converts mermaid placeholders into
      // .mermaid divs that renderMermaid then renders, so it must run first.
      await enhanceCodeBlocks(el, codeTheme);
      if (cancelled) return;
      // Synchronous enhancers — run immediately
      renderIcons(el);
      renderCharts(el);
      await Promise.all([
        renderMath(el),
        renderMermaid(el),
        resolveAssetUrls(el),
      ]);
    })();
    return () => {
      cancelled = true;
    };
  }, [html, codeTheme]);

  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}
