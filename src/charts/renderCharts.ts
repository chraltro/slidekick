import yaml from 'js-yaml';

interface ChartConfig {
  type?: 'bar' | 'line' | 'pie' | 'donut';
  title?: string;
  data?: Record<string, number> | number[];
  labels?: string[];
  series?: Record<string, number[]>;
  colors?: string[];
  yMax?: number;
  yLabel?: string;
}

const DEFAULT_PALETTE = [
  '#cba6f7', // accent
  '#94e2d5',
  '#f9e2af',
  '#f5c2e7',
  '#a6e3a1',
  '#fab387',
  '#89b4fa',
  '#eba0ac',
];

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

/**
 * User-supplied colors are interpolated into SVG attribute values, so they
 * must be escaped — `colors: ['red"><img onerror=…>']` would otherwise break
 * out of the attribute and execute.
 */
function paletteFor(cfg: ChartConfig): string[] {
  const colors = cfg.colors;
  if (!colors || colors.length === 0) return DEFAULT_PALETTE;
  return colors.map((c) => escapeHtml(String(c)));
}

function parseConfig(src: string): ChartConfig {
  try {
    const parsed = yaml.load(src);
    if (parsed && typeof parsed === 'object') return parsed as ChartConfig;
  } catch {
    /* fall through */
  }
  return {};
}

function renderBar(cfg: ChartConfig): string {
  const W = 800;
  const H = 400;
  const PAD_TOP = 40;
  const PAD_BOTTOM = 60;
  const PAD_LEFT = 50;
  const PAD_RIGHT = 20;
  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  // Normalize data — accept either {label: value} or labels[] + series
  let labels: string[] = [];
  let values: number[] = [];
  if (cfg.data && !Array.isArray(cfg.data)) {
    labels = Object.keys(cfg.data);
    values = Object.values(cfg.data).map(Number);
  } else if (Array.isArray(cfg.data) && cfg.labels) {
    labels = cfg.labels;
    values = cfg.data.map(Number);
  } else if (cfg.labels && cfg.series) {
    const firstSeries = Object.values(cfg.series)[0] ?? [];
    labels = cfg.labels;
    values = firstSeries.map(Number);
  }
  if (labels.length === 0) return `<div class="chart-error">Empty chart data</div>`;

  const palette = paletteFor(cfg);
  const yMax = cfg.yMax ?? (Math.max(...values, 0) * 1.1 || 1);
  const barW = (innerW / labels.length) * 0.7;
  const gap = (innerW / labels.length) * 0.3;
  const yTicks = 4;

  const yGrid = Array.from({ length: yTicks + 1 }, (_, i) => {
    const t = i / yTicks;
    const y = PAD_TOP + innerH * (1 - t);
    const v = (yMax * t).toFixed(yMax >= 100 ? 0 : 1);
    return `
      <line x1="${PAD_LEFT}" y1="${y}" x2="${W - PAD_RIGHT}" y2="${y}" stroke="var(--rule, #444)" stroke-opacity="0.3" stroke-dasharray="2,2"/>
      <text x="${PAD_LEFT - 8}" y="${y + 4}" text-anchor="end" font-size="12" fill="var(--fg-muted, #999)">${v}</text>
    `;
  }).join('');

  const bars = labels
    .map((label, i) => {
      const v = values[i] ?? 0;
      // Clamp: a negative value would produce a negative rect height, which
      // SVG rejects (the bar silently disappears).
      const h = Math.max(0, (v / yMax) * innerH);
      const x = PAD_LEFT + (innerW / labels.length) * i + gap / 2;
      const y = PAD_TOP + innerH - h;
      const color = palette[i % palette.length];
      return `
        <rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${color}" rx="4">
          <title>${escapeHtml(label)}: ${v}</title>
        </rect>
        <text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="13" font-weight="600" fill="var(--fg, #ddd)">${v}</text>
        <text x="${x + barW / 2}" y="${PAD_TOP + innerH + 22}" text-anchor="middle" font-size="13" fill="var(--fg-muted, #999)">${escapeHtml(label)}</text>
      `;
    })
    .join('');

  const title = cfg.title
    ? `<text x="${W / 2}" y="22" text-anchor="middle" font-size="16" font-weight="600" fill="var(--fg, #ddd)">${escapeHtml(cfg.title)}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;max-height:100%;">
    ${title}
    ${yGrid}
    ${bars}
  </svg>`;
}

function renderLine(cfg: ChartConfig): string {
  const W = 800;
  const H = 400;
  const PAD_TOP = 40;
  const PAD_BOTTOM = 60;
  const PAD_LEFT = 50;
  const PAD_RIGHT = 20;
  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  let labels: string[] = cfg.labels ?? [];
  let series: Record<string, number[]> = cfg.series ?? {};
  if (Object.keys(series).length === 0) {
    if (cfg.data && !Array.isArray(cfg.data)) {
      labels = Object.keys(cfg.data);
      series = { Series: Object.values(cfg.data).map(Number) };
    } else if (Array.isArray(cfg.data)) {
      labels = labels.length ? labels : cfg.data.map((_, i) => String(i + 1));
      series = { Series: cfg.data.map(Number) };
    }
  }
  if (labels.length === 0) return `<div class="chart-error">Empty chart data</div>`;

  const palette = paletteFor(cfg);
  const allValues = Object.values(series).flat();
  const yMax = cfg.yMax ?? (Math.max(...allValues, 0) * 1.1 || 1);
  const yMin = Math.min(0, ...allValues);
  const yRange = yMax - yMin || 1;
  const yTicks = 4;

  function xForIndex(i: number): number {
    if (labels.length === 1) return PAD_LEFT + innerW / 2;
    return PAD_LEFT + (innerW / (labels.length - 1)) * i;
  }
  function yForValue(v: number): number {
    return PAD_TOP + innerH * (1 - (v - yMin) / yRange);
  }

  const yGrid = Array.from({ length: yTicks + 1 }, (_, i) => {
    const t = i / yTicks;
    const v = yMin + yRange * t;
    const y = yForValue(v);
    return `
      <line x1="${PAD_LEFT}" y1="${y}" x2="${W - PAD_RIGHT}" y2="${y}" stroke="var(--rule, #444)" stroke-opacity="0.3" stroke-dasharray="2,2"/>
      <text x="${PAD_LEFT - 8}" y="${y + 4}" text-anchor="end" font-size="12" fill="var(--fg-muted, #999)">${v.toFixed(yRange >= 10 ? 0 : 1)}</text>
    `;
  }).join('');

  const xLabels = labels
    .map(
      (l, i) =>
        `<text x="${xForIndex(i)}" y="${PAD_TOP + innerH + 22}" text-anchor="middle" font-size="13" fill="var(--fg-muted, #999)">${escapeHtml(l)}</text>`,
    )
    .join('');

  const seriesEntries = Object.entries(series);
  const lines = seriesEntries
    .map(([name, vals], idx) => {
      const color = palette[idx % palette.length];
      const path = vals
        .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xForIndex(i)} ${yForValue(v)}`)
        .join(' ');
      const dots = vals
        .map(
          (v, i) =>
            `<circle cx="${xForIndex(i)}" cy="${yForValue(v)}" r="4" fill="${color}"><title>${escapeHtml(name)} - ${escapeHtml(labels[i] ?? '')}: ${v}</title></circle>`,
        )
        .join('');
      return `
        <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        ${dots}
      `;
    })
    .join('');

  const legend =
    seriesEntries.length > 1
      ? `<g transform="translate(${PAD_LEFT}, ${H - 12})">
          ${seriesEntries
            .map(([name], i) => {
              const color = palette[i % palette.length];
              return `<g transform="translate(${i * 130}, 0)">
                <circle cx="6" cy="-4" r="5" fill="${color}"/>
                <text x="18" y="0" font-size="12" fill="var(--fg, #ddd)">${escapeHtml(name)}</text>
              </g>`;
            })
            .join('')}
        </g>`
      : '';

  const title = cfg.title
    ? `<text x="${W / 2}" y="22" text-anchor="middle" font-size="16" font-weight="600" fill="var(--fg, #ddd)">${escapeHtml(cfg.title)}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;max-height:100%;">
    ${title}
    ${yGrid}
    ${xLabels}
    ${lines}
    ${legend}
  </svg>`;
}

function renderPie(cfg: ChartConfig, donut = false): string {
  const W = 800;
  const H = 400;

  let entries: [string, number][] = [];
  if (cfg.data && !Array.isArray(cfg.data)) {
    entries = Object.entries(cfg.data).map(([k, v]) => [k, Number(v)]);
  } else if (Array.isArray(cfg.data) && cfg.labels) {
    const arr = cfg.data;
    entries = cfg.labels.map((l, i) => [l, Number(arr[i] ?? 0)]);
  }
  if (entries.length === 0) return `<div class="chart-error">Empty chart data</div>`;

  const total = entries.reduce((s, [, v]) => s + Math.max(0, v), 0) || 1;
  const palette = paletteFor(cfg);
  const cx = 200;
  const cy = H / 2 + 10;
  const r = 140;
  const inner = donut ? r * 0.55 : 0;

  let cumulative = 0;
  const slices = entries
    .map(([label, val], i) => {
      const value = Math.max(0, val);
      const start = (cumulative / total) * Math.PI * 2 - Math.PI / 2;
      cumulative += value;
      const end = (cumulative / total) * Math.PI * 2 - Math.PI / 2;
      const large = end - start > Math.PI ? 1 : 0;
      const x1 = cx + Math.cos(start) * r;
      const y1 = cy + Math.sin(start) * r;
      const x2 = cx + Math.cos(end) * r;
      const y2 = cy + Math.sin(end) * r;
      const color = palette[i % palette.length];
      const labelAngle = (start + end) / 2;
      const labelR = r + 24;
      const lx = cx + Math.cos(labelAngle) * labelR;
      const ly = cy + Math.sin(labelAngle) * labelR;
      const pct = ((value / total) * 100).toFixed(1);
      let path: string;
      if (donut) {
        const ix1 = cx + Math.cos(start) * inner;
        const iy1 = cy + Math.sin(start) * inner;
        const ix2 = cx + Math.cos(end) * inner;
        const iy2 = cy + Math.sin(end) * inner;
        path = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${inner} ${inner} 0 ${large} 0 ${ix1} ${iy1} Z`;
      } else {
        path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
      }
      // Inline % label only if slice is wide enough
      const showLabel = value / total > 0.05;
      const inlineLabel = showLabel
        ? `<text x="${cx + Math.cos(labelAngle) * (donut ? (r + inner) / 2 : r * 0.6)}" y="${cy + Math.sin(labelAngle) * (donut ? (r + inner) / 2 : r * 0.6) + 4}" text-anchor="middle" font-size="13" font-weight="600" fill="#000">${pct}%</text>`
        : '';
      void lx;
      void ly;
      return `
        <path d="${path}" fill="${color}">
          <title>${escapeHtml(label)}: ${value} (${pct}%)</title>
        </path>
        ${inlineLabel}
      `;
    })
    .join('');

  const legend = `
    <g transform="translate(420, ${H / 2 - entries.length * 14})">
      ${entries
        .map(([label, val], i) => {
          const color = palette[i % palette.length];
          const pct = ((val / total) * 100).toFixed(1);
          return `<g transform="translate(0, ${i * 28})">
            <rect x="0" y="0" width="14" height="14" rx="3" fill="${color}"/>
            <text x="22" y="11" font-size="14" fill="var(--fg, #ddd)">${escapeHtml(label)}</text>
            <text x="22" y="26" font-size="11" fill="var(--fg-muted, #999)">${val} · ${pct}%</text>
          </g>`;
        })
        .join('')}
    </g>
  `;

  const title = cfg.title
    ? `<text x="${W / 2}" y="22" text-anchor="middle" font-size="16" font-weight="600" fill="var(--fg, #ddd)">${escapeHtml(cfg.title)}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;max-height:100%;">
    ${title}
    ${slices}
    ${legend}
  </svg>`;
}

export function renderCharts(root: HTMLElement): void {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('.chart-block:not([data-processed])'));
  if (blocks.length === 0) return;
  for (const block of blocks) {
    const src = decodeURIComponent(block.dataset.chart ?? '');
    const cfg = parseConfig(src);
    let svg = '';
    try {
      switch (cfg.type) {
        case 'line':
          svg = renderLine(cfg);
          break;
        case 'pie':
          svg = renderPie(cfg, false);
          break;
        case 'donut':
          svg = renderPie(cfg, true);
          break;
        case 'bar':
        default:
          svg = renderBar(cfg);
      }
    } catch (e) {
      svg = `<pre class="chart-error">Chart error: ${escapeHtml((e as Error).message)}</pre>`;
    }
    block.innerHTML = svg;
    block.dataset.processed = '1';
  }
}
