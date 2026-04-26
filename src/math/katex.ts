let katexPromise: Promise<typeof import('katex')> | null = null;
let cssInjected = false;

async function loadKatex() {
  if (!katexPromise) {
    katexPromise = import('katex');
    if (!cssInjected) {
      // Inject KaTeX CSS once via dynamic import (Vite resolves the URL).
      import('katex/dist/katex.min.css').catch(() => undefined);
      cssInjected = true;
    }
  }
  return katexPromise;
}

export async function renderMath(root: HTMLElement): Promise<void> {
  const inline = Array.from(root.querySelectorAll<HTMLElement>('.math-inline:not([data-processed])'));
  const block = Array.from(root.querySelectorAll<HTMLElement>('.math-block:not([data-processed])'));
  if (inline.length === 0 && block.length === 0) return;

  const katex = (await loadKatex()).default;

  for (const el of inline) {
    const tex = decodeURIComponent(el.dataset.tex ?? '');
    try {
      el.innerHTML = katex.renderToString(tex, { displayMode: false, throwOnError: false });
    } catch {
      /* leave fallback text */
    }
    el.dataset.processed = '1';
  }
  for (const el of block) {
    const tex = decodeURIComponent(el.dataset.tex ?? '');
    try {
      el.innerHTML = katex.renderToString(tex, { displayMode: true, throwOnError: false });
    } catch {
      /* leave fallback text */
    }
    el.dataset.processed = '1';
  }
}
