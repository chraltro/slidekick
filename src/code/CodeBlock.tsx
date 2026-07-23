import { getHighlighter, isLangSupported } from './shikiHighlighter';
import { shikiThemeFor } from './themeMap';

interface FenceMeta {
  lang: string;
  highlights: Set<number>;
  title?: string;
  mac: boolean;
  numbers: boolean;
  rawInfo: string;
}

function parseFenceInfo(info: string): FenceMeta {
  const meta: FenceMeta = {
    lang: '',
    highlights: new Set(),
    mac: false,
    numbers: false,
    rawInfo: info,
  };
  const trimmed = info.trim();
  if (!trimmed) return meta;
  // First token: language
  const langMatch = trimmed.match(/^([\w-]+)/);
  if (langMatch) meta.lang = langMatch[1];

  // Highlights: {1,3-5}
  const highlightMatch = trimmed.match(/\{([\d,\-\s]+)\}/);
  if (highlightMatch) {
    const segs = highlightMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
    for (const seg of segs) {
      if (seg.includes('-')) {
        const [a, b] = seg.split('-').map((n) => parseInt(n, 10));
        if (!isNaN(a) && !isNaN(b)) {
          for (let i = a; i <= b; i++) meta.highlights.add(i);
        }
      } else {
        const n = parseInt(seg, 10);
        if (!isNaN(n)) meta.highlights.add(n);
      }
    }
  }

  // title="..."
  const titleMatch = trimmed.match(/title="([^"]+)"/);
  if (titleMatch) meta.title = titleMatch[1];

  // flags
  if (/\bmac\b/.test(trimmed)) meta.mac = true;
  if (/\b(nums|numbers|line-numbers)\b/.test(trimmed)) meta.numbers = true;

  return meta;
}

// Shiki output cache. The editor re-enhances the edited slide on every
// keystroke (and the same slide renders in the preview, thumbnail rail, and
// overview at once) — without this, each of those re-runs full TextMate
// highlighting per code block. Keyed by everything that affects the output.
const highlightCache = new Map<string, string>();
const HIGHLIGHT_CACHE_MAX = 300;

function cacheHighlight(key: string, html: string): void {
  if (highlightCache.size >= HIGHLIGHT_CACHE_MAX) {
    const oldest = highlightCache.keys().next().value;
    if (oldest !== undefined) highlightCache.delete(oldest);
  }
  highlightCache.set(key, html);
}

/**
 * Replace `.codeblock-placeholder` divs in `root` with rendered Shiki HTML.
 * Idempotent: marks processed elements with data-processed.
 */
export async function enhanceCodeBlocks(root: HTMLElement, codeTheme: string): Promise<void> {
  const placeholders = Array.from(
    root.querySelectorAll<HTMLElement>('.codeblock-placeholder:not([data-processed])'),
  );
  if (placeholders.length === 0) return;

  const shiki = await getHighlighter();
  const theme = shikiThemeFor(codeTheme);

  for (const placeholder of placeholders) {
    const info = decodeURIComponent(placeholder.dataset.info ?? '');
    const content = decodeURIComponent(placeholder.dataset.content ?? '');
    const langRaw = (placeholder.dataset.lang ?? '').trim();
    const fence = parseFenceInfo(info);

    // Mermaid is handled by renderMermaid; convert the placeholder into a
    // bare `.mermaid` div with the source as text content, but DO NOT mark it
    // as processed so renderMermaid will pick it up.
    if (langRaw === 'mermaid') {
      const mermaidEl = document.createElement('div');
      mermaidEl.className = 'mermaid';
      mermaidEl.textContent = content;
      placeholder.replaceWith(mermaidEl);
      continue;
    }

    const lang = isLangSupported(fence.lang) ? fence.lang : isLangSupported(langRaw) ? langRaw : 'text';

    // NUL-joined so adjacent fields can't collide.
    const cacheKey = [theme, lang, info, content].join('\u0000');
    let highlighted = highlightCache.get(cacheKey) ?? '';
    if (!highlighted) {
      try {
        highlighted = shiki.codeToHtml(content, {
          lang,
          theme,
          transformers: [
            {
              line(node, line) {
                if (fence.highlights.size > 0) {
                  if (fence.highlights.has(line)) {
                    this.addClassToHast(node, 'line highlighted');
                  } else {
                    this.addClassToHast(node, 'line dimmed');
                  }
                } else {
                  this.addClassToHast(node, 'line');
                }
              },
            },
          ],
        });
        cacheHighlight(cacheKey, highlighted);
      } catch {
        // Fallback: plain pre/code with HTML-escaped content
        const escaped = content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        highlighted = `<pre><code>${escaped}</code></pre>`;
      }
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'codeblock' + (fence.numbers ? ' with-line-numbers' : '');
    if (fence.mac || fence.title) {
      const header = document.createElement('div');
      header.className = 'codeblock-header';
      if (fence.mac) {
        const dots = document.createElement('span');
        dots.className = 'codeblock-mac-dots';
        dots.innerHTML = '<span></span><span></span><span></span>';
        header.appendChild(dots);
      }
      const title = document.createElement('span');
      title.className = 'codeblock-title';
      title.textContent = fence.title ?? '';
      header.appendChild(title);
      const langPill = document.createElement('span');
      langPill.className = 'codeblock-lang';
      langPill.textContent = fence.lang || '';
      header.appendChild(langPill);
      const copy = document.createElement('button');
      copy.className = 'codeblock-copy';
      copy.type = 'button';
      copy.textContent = 'Copy';
      copy.addEventListener('click', () => {
        navigator.clipboard?.writeText(content).then(() => {
          copy.textContent = 'Copied';
          setTimeout(() => (copy.textContent = 'Copy'), 1200);
        });
      });
      header.appendChild(copy);
      wrapper.appendChild(header);
    }
    const codeContainer = document.createElement('div');
    codeContainer.innerHTML = highlighted;
    // Append inner pre directly so wrapper structure stays clean
    while (codeContainer.firstChild) wrapper.appendChild(codeContainer.firstChild);

    wrapper.dataset.processed = '1';
    placeholder.replaceWith(wrapper);
  }
}
