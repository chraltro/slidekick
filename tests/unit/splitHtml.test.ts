import { describe, it, expect } from 'vitest';
import { splitTitle, splitColumns, splitQuote, splitImage } from '@/slides/splitHtml';

describe('splitTitle', () => {
  it('separates the H1 title from an H2 subtitle', () => {
    const { titleHtml, subtitleHtml } = splitTitle('<h1>Big</h1><h2>Small</h2>');
    expect(titleHtml).toBe('Big');
    expect(subtitleHtml).toBe('Small');
  });
  it('leaves later content in rest', () => {
    const { rest } = splitTitle('<h1>T</h1><p>body</p>');
    expect(rest).toContain('<p>body</p>');
  });
});

describe('splitColumns', () => {
  it('splits on an <hr> into left/right', () => {
    const { leftHtml, rightHtml } = splitColumns('<p>left</p><hr><p>right</p>');
    expect(leftHtml).toContain('left');
    expect(rightHtml).toContain('right');
  });
  it('lifts a leading heading into the full-width header', () => {
    const { headerHtml, leftHtml, rightHtml } = splitColumns('<h2>Head</h2><p>l</p><hr><p>r</p>');
    expect(headerHtml).toContain('Head');
    expect(leftHtml).toContain('l');
    expect(rightHtml).toContain('r');
  });
  it('puts everything in the left column when there is no separator', () => {
    const { leftHtml, rightHtml } = splitColumns('<p>only</p>');
    expect(leftHtml).toContain('only');
    expect(rightHtml).toBe('');
  });
});

describe('splitQuote', () => {
  it('extracts an em-dash attribution from the last line', () => {
    const { quoteHtml, attribution } = splitQuote('<blockquote><p>Wisdom.<br>-- Someone</p></blockquote>');
    expect(quoteHtml).toContain('Wisdom.');
    expect(attribution).toBe('Someone');
    expect(quoteHtml).not.toContain('Someone');
  });
  it('lifts a leading heading above the quote', () => {
    const { headerHtml, quoteHtml } = splitQuote('<h1>Title</h1><blockquote><p>Q</p></blockquote>');
    expect(headerHtml).toContain('Title');
    expect(quoteHtml).toContain('Q');
  });
  it('keeps commentary after the quote in rest', () => {
    const { rest } = splitQuote('<blockquote><p>Q</p></blockquote><p>note</p>');
    expect(rest).toContain('note');
  });
});

describe('splitImage', () => {
  it('extracts the image and uses its alt as the caption', () => {
    const { imageHtml, caption } = splitImage('<p><img src="a.png" alt="A scene"></p>');
    expect(imageHtml).toContain('a.png');
    expect(caption).toBe('A scene');
  });
  it('keeps non-image body separate from the image', () => {
    const { imageHtml, bodyHtml } = splitImage('<p><img src="a.png" alt=""></p><p>text</p>');
    expect(imageHtml).toContain('a.png');
    expect(bodyHtml).toContain('text');
    expect(bodyHtml).not.toContain('img');
  });
});
