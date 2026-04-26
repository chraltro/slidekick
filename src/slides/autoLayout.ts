import type { Layout } from './types';

const TERMINAL_HINTS = /\b(thanks|thank you|questions|q\s*&\s*a|fin|the end)\b/i;

interface ContentSignals {
  hasH1: boolean;
  hasH2: boolean;
  imageCount: number;
  paragraphCount: number;
  listCount: number;
  blockquoteCount: number;
  codeLineCount: number;
  totalLineCount: number;
  hasInnerSeparator: boolean;
  imageAtEnd: boolean;
}

function analyze(source: string): ContentSignals {
  const lines = source.split('\n');
  const trimmed = lines.map((l) => l.trim()).filter((l) => l.length > 0);

  let hasH1 = false;
  let hasH2 = false;
  let imageCount = 0;
  let paragraphCount = 0;
  let listCount = 0;
  let blockquoteCount = 0;
  let codeLineCount = 0;
  let inFence = false;
  let lastImageLineIndex = -1;
  let lastContentLineIndex = -1;
  let hasInnerSeparator = false;

  trimmed.forEach((line, i) => {
    if (line.startsWith('```') || line.startsWith('~~~')) {
      inFence = !inFence;
      codeLineCount++;
      return;
    }
    if (inFence) {
      codeLineCount++;
      lastContentLineIndex = i;
      return;
    }

    if (/^#\s/.test(line)) hasH1 = true;
    else if (/^##\s/.test(line)) hasH2 = true;

    // Non-heading is "content"
    const isHeading = /^#{1,6}\s/.test(line);
    if (!isHeading) lastContentLineIndex = i;

    if (/!\[[^\]]*\]\([^)]+\)/.test(line) || /<img\s/.test(line)) {
      imageCount++;
      lastImageLineIndex = i;
    } else if (/^[-*+]\s/.test(line) || /^\d+\.\s/.test(line)) {
      listCount++;
    } else if (/^>\s?/.test(line)) {
      blockquoteCount++;
    } else if (line === '---') {
      // After frontmatter is stripped, an inner --- inside a slide chunk acts as column split.
      hasInnerSeparator = true;
    } else if (!isHeading) {
      paragraphCount++;
    }
  });

  const imageAtEnd = imageCount > 0 && lastImageLineIndex === lastContentLineIndex;

  return {
    hasH1,
    hasH2,
    imageCount,
    paragraphCount,
    listCount,
    blockquoteCount,
    codeLineCount,
    totalLineCount: trimmed.length,
    hasInnerSeparator,
    imageAtEnd,
  };
}

export function autoLayout(source: string, index: number, total: number): Layout {
  const s = analyze(source);

  // 1. Two-column wins if there's an inner --- separator (and the slide isn't
  //    just code, where --- inside might appear in YAML).
  if (s.hasInnerSeparator && s.codeLineCount / Math.max(s.totalLineCount, 1) < 0.5) {
    return 'two-column';
  }

  // 2. Headings only → title / section-divider / end
  const onlyHeadings = s.paragraphCount === 0 && s.listCount === 0 && s.imageCount === 0 && s.codeLineCount === 0 && s.blockquoteCount === 0;
  if (s.hasH1 && onlyHeadings) {
    if (index === total - 1 && TERMINAL_HINTS.test(source)) return 'end';
    if (s.hasH2) return 'title';
    if (index === 0) return 'title';
    if (index === total - 1) return TERMINAL_HINTS.test(source) ? 'end' : 'title';
    return 'section-divider';
  }

  // 3. Single image, nothing else
  if (s.imageCount === 1 && s.paragraphCount === 0 && s.listCount === 0 && s.codeLineCount === 0) {
    return 'full-image';
  }

  // 4. Image + small body
  if (s.imageCount === 1 && s.paragraphCount + s.listCount <= 4) {
    return s.imageAtEnd ? 'image-right' : 'image-left';
  }

  // 5. Code-dominant
  if (s.codeLineCount > 0 && s.codeLineCount / Math.max(s.totalLineCount, 1) > 0.5) {
    return 'code-focus';
  }

  // 6. Quote-dominant
  if (s.blockquoteCount > 0 && s.paragraphCount + s.listCount <= 1) {
    return 'quote';
  }

  return 'content';
}
