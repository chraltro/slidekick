type MermaidApi = typeof import('mermaid').default;
let mermaidPromise: Promise<MermaidApi> | null = null;
// Rendered-SVG cache. Capped: while an author edits a diagram, every
// intermediate source that renders successfully would otherwise accumulate a
// full SVG string for the rest of the session.
const cache = new Map<string, string>();
const CACHE_MAX = 50;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

async function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: 'dark',
        // 'strict' lets mermaid sanitize label text itself. Diagram source is
        // user/LLM-authored and this SVG lands in innerHTML after the parser's
        // sanitize pass has already run, so nothing else guards this surface.
        securityLevel: 'strict',
        // Use a standard sans-serif so mermaid's text-width measurement
        // matches the rendered glyphs (mismatch causes label truncation).
        fontFamily: '"Inter", "Trebuchet MS", "Helvetica Neue", Arial, sans-serif',
        // wrappingWidth: mermaid's default (200px) wraps mid-length labels onto a
        // second line, which makes those nodes taller than their siblings and
        // breaks the visual alignment of a rank. Widen it so labels stay on one line.
        flowchart: { useMaxWidth: false, htmlLabels: true, padding: 30, nodeSpacing: 50, rankSpacing: 50, wrappingWidth: 500 },
        themeVariables: { fontSize: '20px' },
      });
      return m.default;
    });
  }
  return mermaidPromise;
}

function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export async function renderMermaid(root: HTMLElement): Promise<void> {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('.mermaid:not([data-processed])'));
  if (blocks.length === 0) return;
  let mermaid: MermaidApi;
  try {
    mermaid = await loadMermaid();
  } catch (e) {
    console.error('[mermaid] failed to load library', e);
    for (const b of blocks) {
      b.innerHTML = `<pre style="color:#f87171;font-size:1rem">mermaid library failed to load: ${escapeHtml((e as Error).message)}</pre>`;
      b.dataset.processed = '1';
    }
    return;
  }
  for (const block of blocks) {
    const code = (block.textContent ?? '').trim();
    if (!code) {
      block.dataset.processed = '1';
      continue;
    }
    const key = hash(code);
    let svg = cache.get(key);
    if (!svg) {
      try {
        // Mermaid uses this id as a prefix for every internal SVG element id
        // (markers, gradients, css selectors inside the SVG's <style>). If two
        // renders ever share the same id — e.g. you edit then revert, or two
        // identical diagrams exist on the page — the second SVG's styles get
        // clobbered by the first's leftover <style> tags in the DOM and the
        // diagram renders with default sizing ("zoomed all the way out, lots
        // of boxes"). Make every render id globally unique.
        const renderId = `mmd-${key}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        const result = await mermaid.render(renderId, code);
        svg = result.svg;
        if (cache.size >= CACHE_MAX) {
          const oldest = cache.keys().next().value;
          if (oldest !== undefined) cache.delete(oldest);
        }
        cache.set(key, svg);
      } catch (e) {
        console.error('[mermaid] render failed for code:', code, e);
        svg = `<pre style="color:#f87171;font-size:1rem;padding:1rem;background:rgba(248,113,113,0.1);border-radius:0.5rem">Mermaid error: ${escapeHtml((e as Error).message)}\n\nSource:\n${escapeHtml(code)}</pre>`;
      }
    }
    block.innerHTML = svg;
    // Mermaid sets `style="max-width:NNNpx"` on the SVG which prevents it
    // from scaling up. Strip it and let CSS scale the diagram to its
    // container while preserving aspect ratio.
    const svgEl = block.querySelector('svg');
    if (svgEl) {
      svgEl.removeAttribute('style');
      svgEl.removeAttribute('width');
      svgEl.removeAttribute('height');
      svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }
    block.dataset.processed = '1';
  }
}
