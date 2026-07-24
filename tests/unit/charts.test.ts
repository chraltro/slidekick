import { describe, it, expect } from 'vitest';
import { renderCharts } from '@/charts/renderCharts';

/** Render one chart from YAML and return the resulting SVG/markup string. */
function chart(yaml: string): string {
  const root = document.createElement('div');
  const block = document.createElement('div');
  block.className = 'chart-block';
  block.dataset.chart = encodeURIComponent(yaml);
  root.appendChild(block);
  renderCharts(root);
  return block.innerHTML;
}

function rectHeights(svg: string): number[] {
  return [...svg.matchAll(/<rect[^>]*\bheight="([\d.]+)"/g)].map((m) => parseFloat(m[1]));
}

describe('bar chart', () => {
  it('renders every bar with visible height when data is negative', () => {
    const svg = chart('type: bar\ndata:\n  Gain: 50\n  Loss: -30\n  Net: 20\n  Deep: -60');
    const heights = rectHeights(svg);
    // 4 data bars (there may be extra <rect> only if legend used; bar chart has none).
    expect(heights.length).toBe(4);
    expect(heights.every((h) => h > 0)).toBe(true);
  });

  it('never emits NaN geometry for non-numeric cells', () => {
    const svg = chart('type: bar\ndata:\n  A: hello\n  B: 20\n  C: world');
    expect(svg).not.toMatch(/NaN/);
    expect(svg).toContain('<svg');
  });

  it('renders (no crash) when all values are zero', () => {
    const svg = chart('type: bar\ndata:\n  A: 0\n  B: 0');
    expect(svg).toContain('<svg');
    expect(svg).not.toMatch(/NaN/);
  });

  it('reports empty data instead of drawing nothing', () => {
    expect(chart('type: bar\ndata:')).toContain('chart-error');
  });
});

describe('pie chart', () => {
  it('does not emit NaN paths for non-numeric data', () => {
    const svg = chart('type: pie\ndata:\n  A: hello\n  B: 10');
    expect(svg).not.toMatch(/NaN/);
  });

  it('survives all-zero data via the total guard', () => {
    const svg = chart('type: pie\ndata:\n  A: 0\n  B: 0');
    expect(svg).toContain('<svg');
    expect(svg).not.toMatch(/NaN/);
  });
});

describe('line chart', () => {
  it('coerces non-finite series values without NaN geometry', () => {
    const svg = chart('type: line\nlabels: [a, b, c]\nseries:\n  S: [1, nope, 3]');
    expect(svg).not.toMatch(/NaN/);
    expect(svg).toContain('<svg');
  });
});
