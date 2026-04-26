type MermaidApi = typeof import('mermaid').default;
let mermaidPromise: Promise<MermaidApi> | null = null;
const cache = new Map<string, string>();

async function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
        // Use a standard sans-serif so mermaid's text-width measurement
        // matches the rendered glyphs (mismatch causes label truncation).
        fontFamily: '"Inter", "Trebuchet MS", "Helvetica Neue", Arial, sans-serif',
        flowchart: { useMaxWidth: false, htmlLabels: true, padding: 30, nodeSpacing: 50, rankSpacing: 50 },
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
  const mermaid = await loadMermaid();
  for (const block of blocks) {
    const code = block.textContent ?? '';
    const key = hash(code);
    let svg = cache.get(key);
    if (!svg) {
      try {
        const result = await mermaid.render(`mmd-${key}`, code);
        svg = result.svg;
        cache.set(key, svg);
      } catch (e) {
        svg = `<pre style="color:#f87171">Mermaid error: ${(e as Error).message}</pre>`;
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
