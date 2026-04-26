import { icons } from 'lucide';

/**
 * Replace `<span class="lucide-icon" data-icon="name">` placeholders with the
 * SVG body from the lucide vanilla package. Idempotent.
 */
function pascal(name: string): string {
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

function buildSvg(iconNode: ReadonlyArray<readonly [string, Record<string, string | number>]>): string {
  const children = iconNode
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`)
        .join(' ');
      return `<${tag} ${a}/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-svg">${children}</svg>`;
}

export function renderIcons(root: HTMLElement): void {
  const placeholders = Array.from(root.querySelectorAll<HTMLElement>('.lucide-icon:not([data-processed])'));
  if (placeholders.length === 0) return;
  for (const el of placeholders) {
    const raw = (el.dataset.icon ?? '').trim();
    if (!raw) {
      el.dataset.processed = '1';
      continue;
    }
    const key = pascal(raw);
    const node = (icons as Record<string, ReadonlyArray<readonly [string, Record<string, string | number>]>>)[key];
    if (!node) {
      el.textContent = `❓${raw}`;
      el.dataset.processed = '1';
      continue;
    }
    el.innerHTML = buildSvg(node);
    el.dataset.processed = '1';
  }
}
