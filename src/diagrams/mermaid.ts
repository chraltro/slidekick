type MermaidApi = typeof import('mermaid').default;
let mermaidPromise: Promise<MermaidApi> | null = null;
// Rendered-SVG cache. Capped: while an author edits a diagram, every
// intermediate source that renders successfully would otherwise accumulate a
// full SVG string for the rest of the session. Cleared when the theme palette
// changes (cached SVGs bake in the palette's colors).
const cache = new Map<string, string>();
const CACHE_MAX = 50;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

async function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => m.default);
  }
  return mermaidPromise;
}

interface Palette {
  bg: string;
  bgAlt: string;
  fg: string;
  fgMuted: string;
  accent: string;
  rule: string;
  codeBg: string;
  dark: boolean;
}

/** Relative luminance of a hex or rgb()/rgba() color; NaN if unparseable. */
function luminance(color: string): number {
  let r: number, g: number, b: number;
  const hex = color.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    r = parseInt(hex[0] + hex[0], 16); g = parseInt(hex[1] + hex[1], 16); b = parseInt(hex[2] + hex[2], 16);
  } else if (/^[0-9a-f]{6}$/i.test(hex)) {
    r = parseInt(hex.slice(0, 2), 16); g = parseInt(hex.slice(2, 4), 16); b = parseInt(hex.slice(4, 6), 16);
  } else {
    const m = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (!m) return NaN;
    r = +m[1]; g = +m[2]; b = +m[3];
  }
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Read the active theme's palette from the slide's cascaded CSS variables. */
function readPalette(el: HTMLElement): Palette {
  const scope = (el.closest('.slide-canvas') as HTMLElement | null) ?? el;
  const cs = getComputedStyle(scope);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  const bg = v('--bg', '#1e1e2e');
  const lum = luminance(bg);
  return {
    bg,
    bgAlt: v('--bg-alt', '#181825'),
    fg: v('--fg', '#cdd6f4'),
    fgMuted: v('--fg-muted', '#a6adc8'),
    accent: v('--accent', '#cba6f7'),
    rule: v('--rule', '#45475a'),
    codeBg: v('--code-bg', '#181825'),
    dark: Number.isNaN(lum) ? true : lum < 0.5,
  };
}

// Distinct categorical hues for pie slices (matches the SVG chart palette).
const PIE_PALETTE = ['#cba6f7', '#94e2d5', '#f9e2af', '#f5c2e7', '#a6e3a1', '#fab387', '#89b4fa', '#eba0ac', '#74c7ec', '#f38ba8', '#b4befe', '#f2cdcd'];
const PIE_VARS: Record<string, string> = Object.fromEntries(PIE_PALETTE.map((c, i) => [`pie${i + 1}`, c]));

// Re-initialize mermaid only when the palette actually changes (theme switch).
let currentPaletteKey = '';
function applyPalette(mermaid: MermaidApi, p: Palette): void {
  const key = JSON.stringify(p);
  if (key === currentPaletteKey) return;
  currentPaletteKey = key;
  cache.clear();
  mermaid.initialize({
    startOnLoad: false,
    // 'strict' lets mermaid sanitize label text itself. Diagram source is
    // user/LLM-authored and this SVG lands in innerHTML after the parser's
    // sanitize pass has already run, so nothing else guards this surface.
    securityLevel: 'strict',
    // Use a standard sans-serif so mermaid's text-width measurement matches the
    // rendered glyphs (mismatch causes label truncation).
    fontFamily: '"Inter", "Trebuchet MS", "Helvetica Neue", Arial, sans-serif',
    // wrappingWidth: mermaid's default (200px) wraps mid-length labels onto a
    // second line, making those nodes taller than their siblings and breaking
    // rank alignment. Widen it so labels stay on one line.
    flowchart: { useMaxWidth: false, htmlLabels: true, padding: 30, nodeSpacing: 50, rankSpacing: 50, wrappingWidth: 500 },
    // Drive mermaid from the deck's own theme variables so diagrams match the
    // slide on both light and dark themes (previously hard-coded to 'dark',
    // which rendered dark boxes with unreadable labels on light themes).
    theme: 'base',
    themeVariables: {
      darkMode: p.dark,
      fontSize: '20px',
      background: p.bg,
      mainBkg: p.bgAlt,
      primaryColor: p.bgAlt,
      primaryTextColor: p.fg,
      primaryBorderColor: p.accent,
      secondaryColor: p.bgAlt,
      tertiaryColor: p.bg,
      secondaryTextColor: p.fg,
      tertiaryTextColor: p.fg,
      lineColor: p.fgMuted,
      textColor: p.fg,
      nodeBorder: p.accent,
      clusterBkg: p.bg,
      clusterBorder: p.rule,
      titleColor: p.fg,
      edgeLabelBackground: p.codeBg,
      labelBackground: p.codeBg,
      nodeTextColor: p.fg,
      // Pie/flowchart categorical slices need distinct hues — without these,
      // every pie slice inherits primaryColor and the chart goes monochrome.
      ...PIE_VARS,
      pieStrokeColor: p.bg,
      pieOuterStrokeColor: p.rule,
      pieTitleTextColor: p.fg,
      pieSectionTextColor: '#11111b',
      pieLegendTextColor: p.fg,
    },
  });
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
  // Match mermaid's palette to the active deck theme before rendering.
  applyPalette(mermaid, readPalette(blocks[0]));
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
