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

// While the user types, mermaid frequently sees half-typed source like
// `graph L` and produces an error. Don't flash that error in place of the
// previous valid render — wait until the source has been quiet for this
// long. Cached (already-rendered) sources render synchronously regardless.
const DEBOUNCE_MS = 350;
const pendingTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
// Each block carries the hash of whatever it currently displays so we can
// skip work when re-renders of the parent component produce the same source.
const renderedHash = new WeakMap<HTMLElement, string>();

export async function renderMermaid(root: HTMLElement): Promise<void> {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('.mermaid'));
  if (blocks.length === 0) return;
  for (const block of blocks) {
    const code = (block.textContent ?? '').trim();
    if (!code) {
      block.dataset.processed = '1';
      continue;
    }
    const key = hash(code);

    // Already rendered this exact source into this exact node — nothing
    // to do. This is the common case during keystroke storms when only
    // unrelated parts of the slide changed.
    if (renderedHash.get(block) === key) {
      block.dataset.processed = '1';
      continue;
    }

    const cached = cache.get(key);
    if (cached) {
      writeSvg(block, cached);
      renderedHash.set(block, key);
      block.dataset.processed = '1';
      continue;
    }

    // Cancel any prior debounce for this block before scheduling a new
    // attempt — otherwise stale renders would land after newer ones.
    const prev = pendingTimers.get(block);
    if (prev) clearTimeout(prev);

    // If nothing has ever been rendered into this node, render a placeholder
    // immediately so the layout doesn't collapse. Subsequent updates keep
    // whatever was there.
    if (!renderedHash.has(block) && !block.querySelector('svg')) {
      block.innerHTML = '<div style="opacity:0.4;font-style:italic;padding:1rem">Rendering diagram…</div>';
    }

    const timer = setTimeout(() => {
      pendingTimers.delete(block);
      void renderOne(block, code, key);
    }, DEBOUNCE_MS);
    pendingTimers.set(block, timer);
  }
}

async function renderOne(block: HTMLElement, code: string, key: string): Promise<void> {
  // The block may have been replaced by a parent re-render; bail in that case.
  if (!block.isConnected) return;
  // Source may have changed again during the debounce window; the new
  // call to renderMermaid will have queued a fresh timer for this block,
  // so this stale one should yield.
  const currentCode = (block.textContent ?? '').trim();
  if (hash(currentCode) !== key) return;

  let mermaid: MermaidApi;
  try {
    mermaid = await loadMermaid();
  } catch (e) {
    console.error('[mermaid] failed to load library', e);
    block.innerHTML = `<pre style="color:#f87171;font-size:1rem">mermaid library failed to load: ${(e as Error).message}</pre>`;
    block.dataset.processed = '1';
    return;
  }

  // Check again after the await — the user kept typing.
  if (!block.isConnected) return;
  if (hash((block.textContent ?? '').trim()) !== key) return;

  let svg: string;
  try {
    const result = await mermaid.render(`mmd-${key}-${Math.random().toString(36).slice(2, 7)}`, code);
    svg = result.svg;
    cache.set(key, svg);
  } catch (e) {
    // Don't replace a previously-good render with an error block — that's
    // exactly the "freak out" behavior. Keep the last valid SVG visible
    // and render the error only if the user has nothing else to look at.
    if (!renderedHash.has(block)) {
      block.innerHTML = `<pre style="color:#f87171;font-size:0.9rem;padding:1rem;background:rgba(248,113,113,0.1);border-radius:0.5rem;white-space:pre-wrap">Mermaid error: ${(e as Error).message}\n\nSource:\n${code.replace(/[<>]/g, (c) => (c === '<' ? '&lt;' : '&gt;'))}</pre>`;
      block.dataset.processed = '1';
    } else {
      console.warn('[mermaid] transient parse error, keeping last valid render', (e as Error).message);
    }
    return;
  }

  // One more freshness check before the DOM write.
  if (!block.isConnected) return;
  if (hash((block.textContent ?? '').trim()) !== key) return;

  writeSvg(block, svg);
  renderedHash.set(block, key);
  block.dataset.processed = '1';
}

function writeSvg(block: HTMLElement, svg: string): void {
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
}
