import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { ParsedDeck, SlideAST } from '@/slides/types';
import { HTML_TEMPLATE } from './runtime/template';
import { NAVIGATION_RUNTIME } from './runtime/navigation';
import { RenderSlide } from '@/slides/renderSlide';
import { StaticRenderContext } from '@/slides/layouts/renderContext';
import { enhanceCodeBlocks } from '@/code/CodeBlock';
import { renderIcons } from '@/icons/renderIcons';
import { renderCharts } from '@/charts/renderCharts';
import { renderMath } from '@/math/katex';
import { renderMermaid } from '@/diagrams/mermaid';
import { fitScale, fitCode } from '@/slides/layouts/fit';
import { getAssetDataUri } from '@/storage/assetStore';
import { shikiThemeFor } from '@/code/themeMap';
import { ensureCustomThemesLoaded, getLoadedCustomThemes } from '@/themes/useCustomThemes';
import { themeToCss } from '@/themes/customThemes';

// The bundler turns these `?inline` imports into raw CSS strings at build time.
import tokensCssRaw from '@/themes/tokens.css?inline';
import slideCssRaw from '@/styles/slide-canvas.css?inline';
import infographicsCssRaw from '@/styles/infographics.css?inline';

/**
 * Renders the full deck to a single self-contained HTML string.
 *
 * Strategy: render each slide with the SAME React component the live app uses
 * (`RenderSlide`), into a detached off-screen container, then run the SAME
 * post-processors the app runs (Shiki code blocks, lucide icons, SVG charts,
 * KaTeX math, Mermaid diagrams) and inline every asset image as a data: URI.
 * The resulting DOM is serialized verbatim. This guarantees the export is
 * pixel-identical to the editor preview and audience window — there is no
 * second, divergent rendering path to drift out of sync.
 */
export async function exportDeckHtml(deck: ParsedDeck, title: string): Promise<string> {
  const themeId = deck.config.theme;
  // Make sure custom themes are loaded so we can resolve their code theme + CSS.
  await ensureCustomThemesLoaded();
  const customTheme = getLoadedCustomThemes().find((t) => t.id === themeId);
  const codeTheme = deck.config.codeTheme ?? customTheme?.shikiTheme ?? shikiThemeFor(themeId);

  // Off-screen host. Position far off-screen (rather than display:none) so that
  // layout-dependent rendering — Mermaid measuring text, KaTeX, etc. — sees a
  // real, laid-out canvas. Keep it the true 1920-wide canvas size so nothing
  // content-shrinks during measurement.
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:fixed;left:-100000px;top:0;width:1920px;height:1080px;overflow:hidden;pointer-events:none;opacity:0;z-index:-1;';
  document.body.appendChild(host);

  const slideHtmls: string[] = [];
  try {
    for (const slide of deck.slides) {
      try {
        const html = await renderSlideToString(slide, deck, host, codeTheme);
        if (html) slideHtmls.push(html);
      } catch (err) {
        // One bad slide must not abort the whole export. Emit a minimal,
        // theme-consistent fallback that still navigates correctly.
        console.error(`[export] slide ${slide.index} failed to render`, err);
        slideHtmls.push(fallbackSlide(slide, deck, themeId));
      }
    }
  } finally {
    host.remove();
  }

  const combined = slideHtmls.join('\n');

  // Theme CSS — built-in themes are bundled via import.meta.glob with `?inline`;
  // a custom theme generates its CSS from the stored variable bundle.
  let themeCss = '';
  if (customTheme) {
    themeCss = themeToCss(customTheme);
  } else {
    const themeCssMap = import.meta.glob('@/themes/*.css', {
      query: '?inline',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    const themeFile = Object.entries(themeCssMap).find(([k]) => k.endsWith(`/${themeId}.css`));
    themeCss = themeFile ? themeFile[1] : '';
  }

  // Best-effort KaTeX CSS — only inlined when the deck actually uses math.
  let katexCss = '';
  if (/class="(?:math-inline|math-block|katex)/.test(combined)) {
    try {
      katexCss = (await import('katex/dist/katex.min.css?inline')).default;
    } catch {
      /* skip */
    }
  }

  // Live, customCss is applied via style.textContent (no HTML parsing). In the
  // export it is concatenated into a <style> in the template, so a crafted
  // `</style><script>…` would break out and run when the file is opened.
  // Neutralize the only sequences that can close the element.
  const userCss = (deck.config.customCss ?? '').replace(/<\/(style|script)/gi, '<\\/$1');

  // IMPORTANT: use a function replacement for every token. A plain-string
  // replacement value would have its `$` sequences ($&, $1, $$, …) interpreted
  // by String.replace — CSS (e.g. `content:"$"`) and the JS runtime (regexes,
  // `?slide=`) legitimately contain `$`, which would otherwise be corrupted.
  const fill = (tpl: string, token: string, value: string) => tpl.replace(token, () => value);

  let out = HTML_TEMPLATE;
  out = fill(out, '__TITLE__', escapeHtml(title || deck.config.title || 'Presentation'));
  out = fill(out, '__TOKENS_CSS__', tokensCssRaw as unknown as string);
  out = fill(out, '__SLIDE_CSS__', slideCssRaw as unknown as string);
  out = fill(out, '__INFOGRAPHICS_CSS__', infographicsCssRaw as unknown as string);
  out = fill(out, '__THEME_CSS__', themeCss);
  out = fill(out, '__USER_CSS__', userCss);
  out = fill(out, '__KATEX_CSS__', katexCss);
  out = fill(out, '__SLIDES__', combined);
  out = fill(out, '__SCRIPT__', NAVIGATION_RUNTIME);
  return out;
}

/**
 * Render a single slide via the real React component, post-process it exactly
 * like the live app, then return its outerHTML.
 */
async function renderSlideToString(
  slide: SlideAST,
  deck: ParsedDeck,
  host: HTMLElement,
  codeTheme: string,
): Promise<string> {
  const mount = document.createElement('div');
  host.appendChild(mount);
  const root = createRoot(mount);

  try {
    // flushSync forces React to render synchronously so the DOM exists before
    // we post-process. Page-number / footer are driven by deck config exactly
    // as in the editor.
    flushSync(() => {
      root.render(
        <StaticRenderContext.Provider value={true}>
          <RenderSlide slide={slide} config={deck.config} totalSlides={deck.slides.length} />
        </StaticRenderContext.Provider>,
      );
    });

    const slideEl = mount.querySelector<HTMLElement>('.slide-canvas');
    if (!slideEl) return '';

    // Run the SAME enhancers the app runs, in the same order. enhanceCodeBlocks
    // must run before renderMermaid (it converts mermaid placeholders into
    // `.mermaid` divs that renderMermaid then renders).
    await enhanceCodeBlocks(slideEl, codeTheme);
    renderIcons(slideEl);
    renderCharts(slideEl);
    await Promise.all([renderMath(slideEl), renderMermaid(slideEl)]);

    // Strip transition animation classes — a static export shouldn't replay an
    // entrance animation on every navigation. The runtime just toggles display.
    slideEl.classList.remove('transition-fade', 'transition-slide', 'transition-none');
    // Remove the live fragment-step attribute and reveal every fragment, so an
    // exported deck shows all bullet points (no hidden, blurred items).
    slideEl.removeAttribute('data-fragment-step');
    slideEl.querySelectorAll('[data-fragment]').forEach((el) => el.removeAttribute('data-fragment'));

    // Inline assets (images) as data: URIs and drop interactive-only chrome.
    await inlineSlideAssets(slideEl);
    stripInteractiveChrome(slideEl);

    // Fit oversized content to the fixed canvas, matching the live preview.
    // Runs last, after enhancement + asset inlining, so measurements reflect
    // final content sizes (the host container is a real 1920×1080 box). In the
    // live app this is driven by React effects; here we invoke it imperatively.
    slideEl.querySelectorAll<HTMLElement>('.fit-outer').forEach((outer) => {
      const inner = outer.querySelector<HTMLElement>(':scope > .fit-inner');
      if (inner) fitScale(outer, inner);
    });
    fitCode(slideEl);

    return slideEl.outerHTML;
  } finally {
    root.unmount();
    mount.remove();
  }
}

// Remote/blob URLs are fetched at most once and reused across slides.
const remoteUriCache = new Map<string, string | null>();

/**
 * Resolve any image reference to a self-contained data: URI.
 * - `asset:HASH`  → IndexedDB asset, embedded as data: URI.
 * - `blob:...`    → fetched from the object URL, embedded.
 * - `http(s):...` → best-effort fetched (so the export works offline). If the
 *   fetch fails (CORS, offline, 404) the original URL is kept so the slide is
 *   no worse than before.
 * Returns the data: URI, or null to leave the source unchanged.
 */
async function resolveToDataUri(src: string): Promise<string | null> {
  const assetMatch = src.match(/^asset:([a-f0-9]+)$/);
  if (assetMatch) {
    return (await getAssetDataUri(assetMatch[1])) ?? null;
  }
  if (src.startsWith('data:')) return null; // already inline
  if (src.startsWith('blob:') || /^https?:\/\//.test(src)) {
    if (remoteUriCache.has(src)) return remoteUriCache.get(src) ?? null;
    let result: string | null = null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const resp = await fetch(src, { signal: controller.signal, mode: 'cors' });
      clearTimeout(timer);
      if (resp.ok) {
        const blob = await resp.blob();
        if (blob.type.startsWith('image/') || src.startsWith('blob:')) {
          result = await blobToDataUri(blob);
        }
      }
    } catch {
      result = null; // keep the original URL
    }
    remoteUriCache.set(src, result);
    return result;
  }
  return null;
}

/** Rewrite every image reference in `root` to a self-contained data: URI. */
async function inlineSlideAssets(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src') ?? '';
      if (!src) return;
      const dataUri = await resolveToDataUri(src);
      if (dataUri) {
        img.setAttribute('src', dataUri);
        // Drop responsive hints that point at the now-stale remote URL.
        img.removeAttribute('srcset');
      }
    }),
  );

  // Inline background-image: url(...) declared inline on any element.
  const bgEls = Array.from(root.querySelectorAll<HTMLElement>('[style*="url("]'));
  await Promise.all(
    bgEls.map(async (el) => {
      const style = el.getAttribute('style') ?? '';
      const m = style.match(/url\((['"]?)([^'")]+)\1\)/);
      if (!m) return;
      const dataUri = await resolveToDataUri(m[2]);
      if (dataUri) {
        el.setAttribute('style', style.replace(/url\((['"]?)[^'")]+\1\)/, `url('${dataUri}')`));
      }
    }),
  );
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Remove buttons / handlers that only make sense in the live, interactive app. */
function stripInteractiveChrome(root: HTMLElement): void {
  // Copy buttons carry click listeners that won't survive serialization anyway,
  // and "Copy" labels look broken in a static export. The export runtime wires
  // up its own copy buttons.
  root.querySelectorAll('.codeblock-copy').forEach((btn) => btn.remove());
  // Drop any data-processed bookkeeping attributes — purely internal.
  root.querySelectorAll('[data-processed]').forEach((el) => el.removeAttribute('data-processed'));
  // Drop now-redundant source-data attributes left on rendered elements; the
  // visible markup is already final, so these only bloat the file.
  root.querySelectorAll('.chart-block[data-chart]').forEach((el) => el.removeAttribute('data-chart'));
  root
    .querySelectorAll('[data-info], [data-content], [data-icon]')
    .forEach((el) => {
      el.removeAttribute('data-info');
      el.removeAttribute('data-content');
      // Keep data-icon only if the icon wasn't resolved (empty) — otherwise drop.
      if (el.classList.contains('lucide-icon') && el.childElementCount > 0) {
        el.removeAttribute('data-icon');
      }
    });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

/** Minimal, navigable slide used when a slide fails to render during export. */
function fallbackSlide(slide: SlideAST, deck: ParsedDeck, themeId: string): string {
  const aspect = deck.config.aspect ?? '16:9';
  const aspectClass = aspect === '4:3' ? 'aspect-4-3' : aspect === '1:1' ? 'aspect-1-1' : 'aspect-16-9';
  const title = escapeHtml(slide.title ?? `Slide ${slide.index + 1}`);
  return (
    `<div class="slide slide-canvas ${aspectClass} theme-${themeId} layout-content"` +
    ` data-slide-index="${slide.index}" data-slide-hash="${slide.hash}" data-slide-layout="${slide.layout}">` +
    `<div class="layout-content"><div><h1>${title}</h1></div></div></div>`
  );
}

export function downloadFile(filename: string, content: string, mime = 'application/octet-stream') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
