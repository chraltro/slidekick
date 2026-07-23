let katexPromise: Promise<typeof import('katex')> | null = null;
let cssPromise: Promise<unknown> | null = null;

async function loadKatex() {
  if (!katexPromise) {
    katexPromise = import('katex');
    // Inject KaTeX CSS once via dynamic import (Vite resolves the URL). We must
    // AWAIT it before rendering — otherwise the first math slide renders while
    // the stylesheet is missing and stretchy glyphs (\sqrt radicals, big
    // delimiters) blow far past the canvas until the CSS lands.
    cssPromise = import('katex/dist/katex.min.css').catch(() => undefined);
  }
  await cssPromise;
  return katexPromise;
}

// Rendered-TeX cache: the editor re-runs this pass on the edited slide every
// keystroke (across preview + thumbnail + overview), and KaTeX rendering is
// pure in (tex, displayMode).
const texCache = new Map<string, string>();
const TEX_CACHE_MAX = 500;

function renderTex(katex: typeof import('katex').default, tex: string, displayMode: boolean): string | null {
  const key = `${displayMode ? 'b' : 'i'}\u0000${tex}`;
  const cached = texCache.get(key);
  if (cached !== undefined) return cached;
  try {
    const html = katex.renderToString(tex, { displayMode, throwOnError: false });
    if (texCache.size >= TEX_CACHE_MAX) {
      const oldest = texCache.keys().next().value;
      if (oldest !== undefined) texCache.delete(oldest);
    }
    texCache.set(key, html);
    return html;
  } catch {
    return null; // leave fallback text
  }
}

export async function renderMath(root: HTMLElement): Promise<void> {
  const inline = Array.from(root.querySelectorAll<HTMLElement>('.math-inline:not([data-processed])'));
  const block = Array.from(root.querySelectorAll<HTMLElement>('.math-block:not([data-processed])'));
  if (inline.length === 0 && block.length === 0) return;

  const katex = (await loadKatex()).default;

  for (const el of inline) {
    const tex = decodeURIComponent(el.dataset.tex ?? '');
    const html = renderTex(katex, tex, false);
    if (html !== null) el.innerHTML = html;
    el.dataset.processed = '1';
  }
  for (const el of block) {
    const tex = decodeURIComponent(el.dataset.tex ?? '');
    const html = renderTex(katex, tex, true);
    if (html !== null) el.innerHTML = html;
    el.dataset.processed = '1';
  }
}
