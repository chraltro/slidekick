import yaml from 'js-yaml';
import MarkdownIt from 'markdown-it';
// markdown-it-attrs has no types — declared in src/types/shims.d.ts
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import mdAttrs from 'markdown-it-attrs';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import mdContainer from 'markdown-it-container';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';
import type { DeckConfig, ParsedDeck, SlideAST, SlideMeta, Layout } from './types';
import { LAYOUTS } from './types';
import { autoLayout } from './autoLayout';

const md: MarkdownIt = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  // Single newlines in source become <br> in output. Authors typically write
  // each thought on its own line in a presentation deck and expect that
  // structure to be preserved on the slide. This is especially important
  // inside blockquotes where multi-line quotes are common.
  breaks: true,
}).use(mdAttrs);

// Container directives — ::: name ... :::
// `stats` (KPI grid), `compare` (before/after), `timeline` (vertical),
// callout boxes (`tip`, `warning`, `info`, `note`, `danger`, `success`).
const CALLOUT_TYPES = ['tip', 'warning', 'info', 'note', 'danger', 'success'] as const;
const STRUCTURAL_TYPES = ['stats', 'compare', 'timeline', 'columns'] as const;
for (const type of [...CALLOUT_TYPES, ...STRUCTURAL_TYPES]) {
  md.use(mdContainer, type, {
    render(tokens: Array<{ nesting: number; info: string }>, idx: number) {
      const t = tokens[idx];
      if (t.nesting === 1) {
        const info = t.info.trim().slice(type.length).trim();
        const isCallout = (CALLOUT_TYPES as readonly string[]).includes(type);
        const cls = isCallout ? `callout callout-${type}` : `infographic infographic-${type}`;
        const titleAttr = info
          ? ` data-title="${info.replace(/"/g, '&quot;')}"`
          : '';
        return `<div class="${cls}"${titleAttr}>\n`;
      }
      return '</div>\n';
    },
  });
}

// Inline icon rule — `:icon[name]:` → placeholder span enhanced post-render.
md.inline.ruler.after('emphasis', 'lucide_icon', (state, silent) => {
  const start = state.pos;
  const src = state.src;
  if (src[start] !== ':') return false;
  const m = src.slice(start).match(/^:icon\[([\w-]+)\]:/);
  if (!m) return false;
  if (silent) return true;
  const token = state.push('lucide_icon', 'span', 0);
  token.content = m[1];
  state.pos = start + m[0].length;
  return true;
});
md.renderer.rules.lucide_icon = (tokens, idx) =>
  `<span class="lucide-icon" data-icon="${tokens[idx].content.replace(/"/g, '&quot;')}"></span>`;

// Single fence handler covering: ```chart (custom SVG charts), ```mermaid
// (handled later by renderMermaid), and all real code blocks (Shiki).
md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  const info = (token.info || '').trim();
  if (/^chart\b/.test(info)) {
    const encoded = encodeURIComponent(token.content);
    return `<div class="chart-block" data-chart="${encoded}"></div>`;
  }
  // Everything else (including mermaid) goes through the codeblock-placeholder
  // pipeline — CodeBlock.tsx then either Shiki-highlights it or, for mermaid,
  // converts it into a `.mermaid` div for renderMermaid to render.
  const langMatch = info.match(/^([\w-]+)/);
  const lang = langMatch ? langMatch[1] : '';
  const dataInfo = encodeURIComponent(info);
  const dataContent = encodeURIComponent(token.content);
  return `<div class="codeblock-placeholder" data-info="${dataInfo}" data-lang="${lang}" data-content="${dataContent}"></div>`;
};

// Math rendering: $...$ inline, $$...$$ block. We tokenize as inline 'math_inline'
// and block 'math_block' placeholders that the runtime fills with KaTeX.
function mathRule(state: StateInline) {
  const start = state.pos;
  const src = state.src;
  if (src[start] !== '$') return false;
  // Block math handled separately — only inline here.
  // Find closing $.
  let end = start + 1;
  while (end < src.length) {
    if (src[end] === '\\') {
      end += 2;
      continue;
    }
    if (src[end] === '$' && src[end - 1] !== ' ') break;
    if (src[end] === '\n') return false;
    end++;
  }
  if (end >= src.length || src[end] !== '$') return false;
  if (end - start < 2) return false;
  const content = src.slice(start + 1, end);
  if (!content.trim()) return false;
  const token = state.push('math_inline', 'span', 0);
  token.content = content;
  state.pos = end + 1;
  return true;
}
md.inline.ruler.after('escape', 'math_inline', mathRule as any);
md.renderer.rules.math_inline = (tokens, idx) =>
  `<span class="math-inline" data-tex="${encodeURIComponent(tokens[idx].content)}">${escapeHtml(tokens[idx].content)}</span>`;

// Block math: $$ ... $$ — supports both same-line ($$x$$) and multi-line forms.
md.block.ruler.before('fence', 'math_block', (state, startLine, endLine, silent) => {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  if (start + 2 > max) return false;
  if (state.src.slice(start, start + 2) !== '$$') return false;
  if (silent) return true;

  // Same-line form: $$...$$ on a single line.
  const firstLine = state.src.slice(start, max);
  const sameLineMatch = firstLine.match(/^\$\$([\s\S]*?)\$\$\s*$/);
  if (sameLineMatch) {
    const content = sameLineMatch[1].trim();
    const token = state.push('math_block', 'div', 0);
    token.content = content;
    token.map = [startLine, startLine + 1];
    state.line = startLine + 1;
    return true;
  }

  // Multi-line form: $$ on opener line, $$ on a later line.
  let nextLine = startLine + 1;
  let closed = false;
  for (; nextLine < endLine; nextLine++) {
    const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
    const lineEnd = state.eMarks[nextLine];
    const line = state.src.slice(lineStart, lineEnd);
    if (line.trim() === '$$' || line.trimEnd().endsWith('$$')) {
      closed = true;
      break;
    }
  }
  if (!closed) return false;

  const innerStart = state.bMarks[startLine + 1] ?? state.eMarks[startLine] + 1;
  const innerEnd = state.bMarks[nextLine] + state.tShift[nextLine];
  let content = state.src.slice(innerStart, innerEnd);
  // If closer line has trailing content before $$, include it.
  const closerLine = state.src.slice(state.bMarks[nextLine] + state.tShift[nextLine], state.eMarks[nextLine]);
  const closerTrim = closerLine.trim();
  if (closerTrim !== '$$' && closerTrim.endsWith('$$')) {
    content += closerTrim.slice(0, -2);
  }
  content = content.replace(/^\$\$\s*/, '').trim();
  const token = state.push('math_block', 'div', 0);
  token.content = content;
  token.map = [startLine, nextLine + 1];
  state.line = nextLine + 1;
  return true;
});
md.renderer.rules.math_block = (tokens, idx) =>
  `<div class="math-block" data-tex="${encodeURIComponent(tokens[idx].content)}">${escapeHtml(tokens[idx].content)}</div>`;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

/**
 * Normalize: convert CRLF to LF and strip leading/trailing blank lines.
 * Returns the normalized text and the number of characters trimmed from the
 * start so callers can re-derive source-relative offsets.
 */
function normalize(src: string): { text: string; leadOffset: number } {
  const lf = src.replace(/\r\n/g, '\n');
  const leadMatch = lf.match(/^\n+/);
  const leadOffset = leadMatch ? leadMatch[0].length : 0;
  const trimmed = lf.replace(/^\n+|\n+$/g, '');
  return { text: trimmed, leadOffset };
}

/** Fast 32-bit FNV-1a hash; sufficient for slide identity. */
function hash32(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

interface RawSlideChunk {
  source: string;
  range: { start: number; end: number };
}

/**
 * Split markdown into slides. Boundary rules:
 *   - Top-level `#` (H1) starts a new slide. This is the only default boundary.
 *   - `##` (H2) is an in-slide subheading — used as a subtitle on title slides
 *     and as column headers in two-column layouts.
 *   - `---` is an in-slide separator — used as the column divider in
 *     two-column layouts. It does NOT split slides.
 *   - A `\n***\n` (asterisks) is a hard slide break for users who want one
 *     without changing heading levels.
 *
 * Boundaries inside fenced code blocks are ignored.
 */
export function splitSlides(markdown: string): RawSlideChunk[] {
  const src = markdown;
  const lines = src.split('\n');

  const lineStarts: number[] = [0];
  for (let i = 0; i < lines.length - 1; i++) {
    lineStarts.push(lineStarts[i] + lines[i].length + 1);
  }

  const breaks: number[] = [];
  let inFence = false;
  let fenceMarker = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fenceMatch[1];
      } else if (trimmed.startsWith(fenceMarker)) {
        inFence = false;
        fenceMarker = '';
      }
      continue;
    }
    if (inFence) continue;

    // Only H1 splits by default.
    if (/^#\s+\S/.test(trimmed) && !/^##/.test(trimmed)) {
      breaks.push(i);
    } else if (/^\*{3,}\s*$/.test(trimmed) && i > 0) {
      // `***` is the explicit slide-break marker for users who want one
      // without inserting an H1. Distinct from `---` which is the column
      // separator inside two-column layouts.
      breaks.push(i);
    }
  }

  if (breaks.length === 0) {
    return [{ source: src, range: { start: 0, end: src.length } }];
  }

  if (breaks[0] !== 0) breaks.unshift(0);

  const chunks: RawSlideChunk[] = [];
  for (let bi = 0; bi < breaks.length; bi++) {
    const startLine = breaks[bi];
    const endLine = bi + 1 < breaks.length ? breaks[bi + 1] : lines.length;
    const startOffset = lineStarts[startLine];
    const endOffset = endLine < lines.length ? lineStarts[endLine] : src.length;
    const chunkSrc = src.slice(startOffset, endOffset);
    // Skip a chunk that is just an explicit-break marker line (***)
    if (chunkSrc.trim().length === 0) continue;
    if (/^\*{3,}\s*$/.test(chunkSrc.trim()) && bi > 0) continue;
    // For *** breaks: the chunk starts with the *** line, advance past it.
    let adjustedStart = startOffset;
    let adjustedSrc = chunkSrc;
    const firstLine = lines[startLine] ?? '';
    if (/^\*{3,}\s*$/.test(firstLine.trim())) {
      adjustedStart = lineStarts[startLine + 1] ?? endOffset;
      adjustedSrc = src.slice(adjustedStart, endOffset);
      if (adjustedSrc.trim().length === 0) continue;
    }
    chunks.push({ source: adjustedSrc, range: { start: adjustedStart, end: endOffset } });
  }

  return chunks;
}

const META_COMMENT_RE = /<!--\s*([\s\S]*?)\s*-->/;

/** Returns true if `offset` falls inside a fenced code block in `src`. */
function isInsideFence(src: string, offset: number): boolean {
  let pos = 0;
  let inFence = false;
  let fenceMarker = '';
  const lines = src.split('\n');
  for (const line of lines) {
    const lineEnd = pos + line.length;
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!inFence) {
        if (offset >= pos && offset <= lineEnd) return false; // inside the fence opener line itself
        inFence = true;
        fenceMarker = fenceMatch[1];
      } else if (trimmed.startsWith(fenceMarker)) {
        if (offset >= pos && offset <= lineEnd) return true;
        inFence = false;
        fenceMarker = '';
      }
    }
    if (offset >= pos && offset <= lineEnd) return inFence;
    pos = lineEnd + 1; // +1 for the newline
  }
  return inFence;
}

/** Extract per-slide metadata from `<!-- key: value; key: value -->` comments. */
export function parseSlideMeta(source: string): { meta: SlideMeta; cleaned: string; notes?: string } {
  const meta: SlideMeta = {};
  let notes: string | undefined;
  let cleaned = source;

  // Iterate; first comment with structured keys wins, but we collect notes from any.
  let match: RegExpExecArray | null;
  const re = /<!--([\s\S]*?)-->/g;
  while ((match = re.exec(source)) !== null) {
    // Skip comments that appear inside fenced code blocks — they're literal
    // syntax examples, not real directives.
    if (isInsideFence(source, match.index)) continue;
    const inner = match[1].trim();
    // Notes can be a multi-line block: "notes: ..." or just plain note text.
    if (/^notes\s*:/i.test(inner)) {
      const noteText = inner.replace(/^notes\s*:\s*/i, '').trim();
      notes = (notes ? notes + '\n' : '') + noteText;
      cleaned = cleaned.replace(match[0], '');
      continue;
    }
    // Structured key:value;key:value
    if (inner.includes(':') && !/^#/.test(inner)) {
      const parts = inner.split(';');
      let consumed = false;
      for (const part of parts) {
        const idx = part.indexOf(':');
        if (idx === -1) continue;
        const key = part.slice(0, idx).trim().toLowerCase();
        const val = part.slice(idx + 1).trim();
        if (key === 'layout') {
          if ((LAYOUTS as readonly string[]).includes(val)) {
            meta.layout = val as Layout;
            consumed = true;
          }
        } else if (key === 'bg' || key === 'background') {
          meta.bg = val;
          consumed = true;
        } else if (key === 'color' || key === 'fg') {
          meta.color = val;
          consumed = true;
        } else if (key === 'class') {
          meta.class = val;
          consumed = true;
        } else if (key === 'align') {
          if (val === 'left' || val === 'center' || val === 'right') {
            meta.align = val;
            consumed = true;
          }
        } else if (key === 'image') {
          meta.image = val;
          consumed = true;
        } else if (key === 'attribution' || key === 'by') {
          meta.attribution = val;
          consumed = true;
        } else if (key === 'notes') {
          notes = (notes ? notes + '\n' : '') + val;
          consumed = true;
        }
      }
      if (consumed) {
        cleaned = cleaned.replace(match[0], '');
      }
    }
  }

  if (notes) meta.notes = notes;
  // Use the matcher above just to silence unused-var lint for META_COMMENT_RE
  void META_COMMENT_RE;
  return { meta, cleaned, notes };
}

/** Extract a title from the slide source (first H1 or H2 text). */
function extractTitle(src: string): string | undefined {
  const lines = src.split('\n');
  for (const line of lines) {
    const m = line.match(/^#{1,2}\s+(.+?)\s*$/);
    if (m) return m[1].trim();
  }
  return undefined;
}

/**
 * Convert "+ item" lines (or "- + item") to standard list items but tag them
 * as fragments so the renderer can hide them until the user advances.
 * Each fragment gets `data-fragment="N"` (1-based step within the slide).
 */
function applyFragments(html: string): string {
  // Match list items whose content starts with "+ " (a literal plus + space).
  // Increment a step counter per occurrence.
  let step = 0;
  return html.replace(/<li>(\s*)\+\s+([\s\S]*?)<\/li>/g, (_full, ws, inner) => {
    step += 1;
    return `<li data-fragment="${step}">${ws}${inner}</li>`;
  });
}

// Raw HTML is allowed in slides (html: true) so authors can drop in the odd
// <div>/<sup>/<br>. But rendered markdown is fed to dangerouslySetInnerHTML, so
// untrusted decks (e.g. pasted from an LLM) could smuggle in active content.
// Strip the dangerous surface — script-like elements, event-handler attributes,
// and javascript:/data:text/html URLs — while leaving benign markup intact.
const DANGEROUS_TAGS = 'script,iframe,object,embed,style,link,meta,base,form,frame,frameset,noscript';
const DANGEROUS_URL = /^\s*(?:javascript|vbscript|data:text\/html)/i;

function sanitizeHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return html; // non-DOM environments
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  doc.querySelectorAll(DANGEROUS_TAGS).forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
      } else if (
        (name === 'href' || name === 'src' || name === 'xlink:href' || name === 'formaction' || name === 'action') &&
        DANGEROUS_URL.test(attr.value)
      ) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return doc.body.innerHTML;
}

function renderSlideHtml(cleaned: string): string {
  return applyFragments(sanitizeHtml(md.render(cleaned)));
}

/**
 * Browser-safe frontmatter splitter. Returns parsed data + remaining body and
 * the offset in the original `markdown` where the body begins. The offset is
 * needed so slide ranges can be expressed in source-relative coordinates
 * (i.e. usable directly with editor cursor positions).
 */
function splitFrontmatter(markdown: string): { data: Record<string, unknown>; content: string; bodyOffset: number } {
  const src = markdown.replace(/^﻿/, '');
  const bomDelta = markdown.length - src.length;
  if (!src.startsWith('---')) return { data: {}, content: src, bodyOffset: bomDelta };
  const opener = src.match(/^---\r?\n/);
  if (!opener) return { data: {}, content: src, bodyOffset: bomDelta };
  const rest = src.slice(opener[0].length);
  const closeMatch = rest.match(/\r?\n---\r?\n/);
  if (!closeMatch || closeMatch.index === undefined) {
    return { data: {}, content: src, bodyOffset: bomDelta };
  }
  const yamlSrc = rest.slice(0, closeMatch.index);
  const content = rest.slice(closeMatch.index + closeMatch[0].length);
  const bodyOffset = bomDelta + opener[0].length + closeMatch.index + closeMatch[0].length;
  let data: Record<string, unknown> = {};
  try {
    const parsed = yaml.load(yamlSrc);
    if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>;
  } catch {
    /* ignore malformed frontmatter — treat as if empty */
  }
  return { data, content, bodyOffset };
}

export function parseDeck(markdown: string): ParsedDeck {
  const fm = splitFrontmatter(markdown);
  const config: DeckConfig = {
    theme: 'catppuccin-mocha',
    aspect: '16:9',
    transition: 'fade',
    ...(fm.data as Partial<DeckConfig>),
  };
  const norm = normalize(fm.content);
  // Offset between body coordinates (where splitSlides operates) and the
  // original markdown source. Adding this to a body-relative offset gives
  // the source-relative offset used by the CodeMirror editor.
  const bodyToSource = fm.bodyOffset + norm.leadOffset;
  const chunks = splitSlides(norm.text);

  const slides: SlideAST[] = chunks.map((chunk, i) => {
    const { meta, cleaned, notes } = parseSlideMeta(chunk.source);
    const layout: Layout = meta.layout ?? autoLayout(cleaned, i, chunks.length);
    const html = renderSlideHtml(cleaned);
    const title = extractTitle(cleaned);
    return {
      index: i,
      hash: hash32(chunk.source),
      range: {
        start: chunk.range.start + bodyToSource,
        end: chunk.range.end + bodyToSource,
      },
      source: chunk.source,
      layout,
      meta,
      html,
      notes,
      title,
    };
  });

  return { config, slides, source: markdown };
}

/** Diff two parsed decks; returns indices of slides that changed. */
export function diffSlides(prev: SlideAST[], next: SlideAST[]): number[] {
  const changed: number[] = [];
  const len = Math.max(prev.length, next.length);
  for (let i = 0; i < len; i++) {
    if (!prev[i] || !next[i] || prev[i].hash !== next[i].hash) {
      changed.push(i);
    }
  }
  return changed;
}

export const markdownIt = md;
