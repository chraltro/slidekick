import { describe, it, expect } from 'vitest';
import { autoLayout } from '@/slides/autoLayout';

describe('autoLayout', () => {
  it('classifies the first heading-only slide as a title', () => {
    expect(autoLayout('# Welcome', 0, 5)).toBe('title');
  });

  it('classifies an H1 + H2 heading-only slide as a title', () => {
    expect(autoLayout('# Title\n\n## Subtitle', 0, 5)).toBe('title');
  });

  it('classifies a mid-deck lone heading as a section divider', () => {
    expect(autoLayout('# Part Two', 2, 5)).toBe('section-divider');
  });

  it('classifies a terminal "Thanks" heading slide as end', () => {
    expect(autoLayout('# Thanks\n\n## Questions?', 4, 5)).toBe('end');
  });

  it('classifies prose + list as content', () => {
    expect(autoLayout('# S\n\nSome text.\n\n- a\n- b', 1, 5)).toBe('content');
  });

  it('classifies a code-dominant slide as code-focus', () => {
    const src = '# S\n\n```ts\n' + Array.from({ length: 8 }, (_, i) => `const x${i} = ${i};`).join('\n') + '\n```';
    expect(autoLayout(src, 1, 5)).toBe('code-focus');
  });

  it('classifies a lone blockquote as a quote', () => {
    expect(autoLayout('# S\n\n> A pithy remark.', 1, 5)).toBe('quote');
  });

  it('classifies an inner --- separator as two-column', () => {
    expect(autoLayout('## Left\n\ntext\n\n---\n\n## Right\n\ntext', 1, 5)).toBe('two-column');
  });

  it('classifies a single lone image as full-image', () => {
    expect(autoLayout('# S\n\n![alt](img.png)', 1, 5)).toBe('full-image');
  });
});
