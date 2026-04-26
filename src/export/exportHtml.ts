import type { ParsedDeck } from '@/slides/types';
import { HTML_TEMPLATE } from './runtime/template';
import { NAVIGATION_RUNTIME } from './runtime/navigation';
import { inlineAssetUrls } from './inlineAssets';
import { getHighlighter } from '@/code/shikiHighlighter';
import { shikiThemeFor } from '@/code/themeMap';

// The bundler turns these `?inline` imports into raw CSS strings at build time.
// Vite handles `?inline` automatically; in dev these will resolve at runtime.
import tokensCssRaw from '@/themes/tokens.css?inline';
import slideCssRaw from '@/styles/slide-canvas.css?inline';

/**
 * Renders the full deck to a single self-contained HTML string.
 * Pre-renders Shiki, KaTeX (best-effort), and Mermaid into static markup;
 * inlines all required CSS; embeds asset images as data: URIs.
 */
export async function exportDeckHtml(deck: ParsedDeck, title: string): Promise<string> {
  const themeId = deck.config.theme;
  const codeTheme = deck.config.codeTheme ?? shikiThemeFor(themeId);
  const aspect = deck.config.aspect ?? '16:9';

  const slideHtmls: string[] = [];
  for (const slide of deck.slides) {
    let html = await renderSlideHtmlString(slide.html, codeTheme);
    if (slide.meta.bg) {
      html = wrapBg(html, slide.meta.bg);
    }
    const aspectClass =
      aspect === '4:3' ? 'aspect-4-3' : aspect === '1:1' ? 'aspect-1-1' : 'aspect-16-9';
    const slideAttrs = [
      `class="slide slide-canvas ${aspectClass} layout-${slide.layout} theme-${themeId}${slide.meta.class ? ' ' + slide.meta.class : ''}"`,
      `data-slide-index="${slide.index}"`,
      `data-slide-hash="${slide.hash}"`,
      `data-slide-layout="${slide.layout}"`,
    ].join(' ');
    let style = '';
    if (slide.meta.bg) style += `background:${slide.meta.bg};`;
    if (slide.meta.color) style += `color:${slide.meta.color};`;
    if (slide.meta.image) style += `background-image:url('${slide.meta.image}');background-size:cover;background-position:center;`;
    const styleAttr = style ? ` style="${style}"` : '';
    const layoutHtml = wrapLayout(slide.layout, html);
    const pageNum = deck.config.pageNumber
      ? `<div class="page-number">${slide.index + 1} / ${deck.slides.length}</div>`
      : '';
    slideHtmls.push(`<div ${slideAttrs}${styleAttr}>${layoutHtml}${pageNum}</div>`);
  }

  let combined = slideHtmls.join('\n');
  combined = await inlineAssetUrls(combined);

  // Render KaTeX server-side (browser-side, since we're in-browser).
  combined = await prerenderMath(combined);
  // Render Mermaid (best-effort)
  combined = await prerenderMermaid(combined);

  // Theme CSS — bundled all themes are available via import.meta.glob('?inline').
  const themeCssMap = (import.meta.glob('@/themes/*.css', { query: '?inline', import: 'default', eager: true }) as Record<string, string>);
  const themeFile = Object.entries(themeCssMap).find(([k]) => k.endsWith(`/${themeId}.css`));
  const themeCss = themeFile ? themeFile[1] : '';

  // Best-effort KaTeX CSS — load if available
  let katexCss = '';
  try {
    katexCss = (await import('katex/dist/katex.min.css?inline')).default;
  } catch {
    /* skip */
  }

  const userCss = deck.config.customCss ?? '';

  const out = HTML_TEMPLATE
    .replace('__TITLE__', escapeHtml(title || deck.config.title || 'Presentation'))
    .replace('__TOKENS_CSS__', tokensCssRaw as unknown as string)
    .replace('__SLIDE_CSS__', slideCssRaw as unknown as string)
    .replace('__THEME_CSS__', themeCss)
    .replace('__USER_CSS__', userCss)
    .replace('__KATEX_CSS__', katexCss)
    .replace('__SLIDES__', combined)
    .replace('__SCRIPT__', NAVIGATION_RUNTIME);

  return out;
}

async function renderSlideHtmlString(html: string, codeTheme: string): Promise<string> {
  // Pre-highlight any codeblock-placeholder via Shiki
  const placeholderRe = /<div class="codeblock-placeholder" data-info="([^"]*)" data-lang="([^"]*)" data-content="([^"]*)"><\/div>/g;
  const matches = Array.from(html.matchAll(placeholderRe));
  if (matches.length === 0) return html;
  const shiki = await getHighlighter();
  let out = html;
  for (const m of matches) {
    const info = decodeURIComponent(m[1]);
    const lang = (m[2] || '').trim();
    const content = decodeURIComponent(m[3]);
    if (lang === 'mermaid') {
      const replacement = `<div class="mermaid">${escapeHtml(content)}</div>`;
      out = out.replace(m[0], replacement);
      continue;
    }
    let highlighted = '';
    try {
      const validLang = isValidShikiLang(lang) ? lang : 'text';
      highlighted = shiki.codeToHtml(content, { lang: validLang, theme: codeTheme });
    } catch {
      highlighted = `<pre><code>${escapeHtml(content)}</code></pre>`;
    }
    const fence = parseFence(info);
    const headerHtml = (fence.mac || fence.title)
      ? `<div class="codeblock-header">${
          fence.mac ? '<span class="codeblock-mac-dots"><span></span><span></span><span></span></span>' : ''
        }<span class="codeblock-title">${escapeHtml(fence.title ?? '')}</span><span class="codeblock-lang">${escapeHtml(fence.lang ?? '')}</span></div>`
      : '';
    const wrapper = `<div class="codeblock${fence.numbers ? ' with-line-numbers' : ''}">${headerHtml}${highlighted}</div>`;
    out = out.replace(m[0], wrapper);
  }
  return out;
}

function parseFence(info: string) {
  const lang = info.match(/^([\w-]+)/)?.[1];
  const title = info.match(/title="([^"]+)"/)?.[1];
  const mac = /\bmac\b/.test(info);
  const numbers = /\b(nums|numbers|line-numbers)\b/.test(info);
  return { lang, title, mac, numbers };
}

function isValidShikiLang(lang: string): boolean {
  return /^(ts|tsx|js|jsx|python|rust|go|java|c|cpp|csharp|html|css|json|yaml|toml|bash|shell|sh|sql|diff|md|markdown)$/.test(lang);
}

async function prerenderMath(html: string): Promise<string> {
  if (!/class="math-(inline|block)"/.test(html)) return html;
  let katex: typeof import('katex').default;
  try {
    katex = (await import('katex')).default;
  } catch {
    return html;
  }
  return html
    .replace(/<span class="math-inline" data-tex="([^"]*)">[^<]*<\/span>/g, (_full, encoded) => {
      const tex = decodeURIComponent(encoded);
      try {
        return `<span class="math-inline">${katex.renderToString(tex, { displayMode: false, throwOnError: false })}</span>`;
      } catch {
        return `<span class="math-inline">${escapeHtml(tex)}</span>`;
      }
    })
    .replace(/<div class="math-block" data-tex="([^"]*)">[^<]*<\/div>/g, (_full, encoded) => {
      const tex = decodeURIComponent(encoded);
      try {
        return `<div class="math-block">${katex.renderToString(tex, { displayMode: true, throwOnError: false })}</div>`;
      } catch {
        return `<div class="math-block">${escapeHtml(tex)}</div>`;
      }
    });
}

async function prerenderMermaid(html: string): Promise<string> {
  if (!/class="mermaid"/.test(html)) return html;
  try {
    const mermaid = (await import('mermaid')).default;
    mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
    const blockRe = /<div class="mermaid">([\s\S]*?)<\/div>/g;
    let out = '';
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let counter = 0;
    while ((match = blockRe.exec(html)) !== null) {
      out += html.slice(lastIndex, match.index);
      const code = decodeHtml(match[1].trim());
      try {
        const r = await mermaid.render(`mmd-export-${counter++}`, code);
        out += `<div class="mermaid">${r.svg}</div>`;
      } catch {
        out += `<div class="mermaid"><pre>${escapeHtml(code)}</pre></div>`;
      }
      lastIndex = match.index + match[0].length;
    }
    out += html.slice(lastIndex);
    return out;
  } catch {
    return html;
  }
}

function wrapLayout(layout: string, contentHtml: string): string {
  // Apply the same per-layout wrapping that React layouts produce for a sane export
  return `<div class="layout-${layout}">${contentHtml}</div>`;
}

function wrapBg(html: string, _bg: string) {
  return html;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

function decodeHtml(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
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
