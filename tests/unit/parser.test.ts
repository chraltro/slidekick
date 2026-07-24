import { describe, it, expect } from 'vitest';
import { parseDeck, splitSlides } from '@/slides/parser';

describe('splitSlides', () => {
  it('starts a new slide on each top-level H1', () => {
    const chunks = splitSlides('# One\n\nbody\n\n# Two\n\nbody');
    expect(chunks).toHaveLength(2);
  });

  it('does not split on H2 or on --- (column separator)', () => {
    const chunks = splitSlides('# One\n\n## sub\n\nleft\n\n---\n\nright');
    expect(chunks).toHaveLength(1);
  });

  it('splits on a lone *** without changing heading level', () => {
    const chunks = splitSlides('# One\n\nbody\n\n***\n\n> a quote');
    expect(chunks).toHaveLength(2);
  });

  it('ignores boundaries inside fenced code blocks', () => {
    const chunks = splitSlides('# One\n\n```md\n# not a slide\n***\n```\n\nafter');
    expect(chunks).toHaveLength(1);
  });
});

describe('parseDeck frontmatter', () => {
  it('applies defaults when frontmatter is absent', () => {
    const { config } = parseDeck('# Slide\n\nbody');
    expect(config.theme).toBe('catppuccin-mocha');
    expect(config.aspect).toBe('16:9');
  });

  it('reads theme/aspect/title from frontmatter', () => {
    const { config } = parseDeck('---\ntitle: My Talk\ntheme: nord\naspect: 4:3\n---\n\n# Slide');
    expect(config.title).toBe('My Talk');
    expect(config.theme).toBe('nord');
    expect(config.aspect).toBe('4:3');
  });

  it('treats malformed YAML frontmatter as empty instead of throwing', () => {
    expect(() => parseDeck('---\ntitle: [unclosed\n\tbad: : :\n---\n\n# Slide')).not.toThrow();
    const { config } = parseDeck('---\ntitle: [unclosed\n\tbad: : :\n---\n\n# Slide');
    expect(config.theme).toBe('catppuccin-mocha');
  });
});

describe('sanitizer (via rendered slide html)', () => {
  const html = (md: string) => parseDeck('# S\n\n' + md).slides[0].html;

  it('strips <script> elements', () => {
    expect(html('<script>window.x=1</script>text')).not.toContain('<script');
  });

  it('strips on* event-handler attributes', () => {
    const out = html('<img src="x" onerror="window.x=1">');
    expect(out).not.toMatch(/onerror/i);
  });

  it('strips javascript: URLs', () => {
    const out = html('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toMatch(/href="javascript:/i);
  });

  it('removes <iframe> and <style> elements', () => {
    expect(html('<iframe src="x"></iframe>')).not.toContain('<iframe');
    expect(html('<style>.slide{display:none}</style>')).not.toContain('<style');
  });

  it('keeps benign inline HTML', () => {
    const out = html('<sup>2</sup> and <br> and <div class="x">ok</div>');
    expect(out).toContain('<sup>');
    expect(out).toContain('<div');
  });
});

describe('math placeholders', () => {
  it('emits an inline math placeholder for $...$', () => {
    const out = parseDeck('# S\n\nEnergy $E=mc^2$ here').slides[0].html;
    expect(out).toContain('math-inline');
  });

  it('emits a block math placeholder for $$...$$', () => {
    const out = parseDeck('# S\n\n$$a^2+b^2=c^2$$').slides[0].html;
    expect(out).toContain('math-block');
  });

  it('does not treat plain currency as math', () => {
    const out = parseDeck('# S\n\nIt costs $5 and $10 today.').slides[0].html;
    expect(out).not.toContain('math-inline');
  });
});
