import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUiStore } from '@/state/useUiStore';

/** Live tweaker for the active theme's CSS variables. Persists per-session. */
const VARS: { key: string; label: string; type: 'color' | 'length' }[] = [
  { key: '--bg', label: 'Background', type: 'color' },
  { key: '--fg', label: 'Text', type: 'color' },
  { key: '--fg-muted', label: 'Muted text', type: 'color' },
  { key: '--accent', label: 'Accent', type: 'color' },
  { key: '--accent-2', label: 'Accent 2', type: 'color' },
  { key: '--code-bg', label: 'Code background', type: 'color' },
  { key: '--rule', label: 'Rule', type: 'color' },
];

const STYLE_ID = 'theme-tweaker-overrides';

function readVar(key: string): string {
  // Read from any rendered .slide-canvas element so we get the resolved value
  const el = document.querySelector('.slide-canvas') as HTMLElement | null;
  if (!el) return '';
  const v = getComputedStyle(el).getPropertyValue(key).trim();
  return v;
}

function rgbToHex(rgb: string): string {
  const m = rgb.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) return rgb.length === 4 ? '#' + [...rgb.slice(1)].map((c) => c + c).join('') : rgb;
  const m2 = rgb.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (m2) {
    return (
      '#' +
      [m2[1], m2[2], m2[3]]
        .map((n) => parseInt(n, 10).toString(16).padStart(2, '0'))
        .join('')
    );
  }
  return rgb;
}

export function ThemeTweaker() {
  const open = useUiStore((s) => s.themeTweakerOpen);
  const setOpen = useUiStore((s) => s.setThemeTweakerOpen);

  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  useEffect(() => {
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (Object.keys(overrides).length === 0) {
      if (style) style.remove();
      return;
    }
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    const decls = Object.entries(overrides)
      .map(([k, v]) => `${k}: ${v} !important;`)
      .join(' ');
    style.textContent = `.slide-canvas { ${decls} }`;
  }, [overrides]);

  if (!open) return null;

  function set(key: string, value: string) {
    setOverrides((prev) => ({ ...prev, [key]: value }));
  }
  function reset() {
    setOverrides({});
  }

  return createPortal(
    <div
      className="fixed top-16 right-4 z-[1700] w-72 bg-chrome-surface border border-chrome-border rounded-lg shadow-2xl"
    >
      <div className="px-3 py-2 border-b border-chrome-border flex items-center justify-between">
        <div className="text-sm font-medium text-chrome-fg">Theme tweaker</div>
        <button onClick={() => setOpen(false)} className="text-chrome-muted text-xs hover:text-chrome-fg">
          ✕
        </button>
      </div>
      <div className="p-3 space-y-2 max-h-[60vh] overflow-auto app-scroll">
        {VARS.map((v) => {
          const current = overrides[v.key] ?? rgbToHex(readVar(v.key));
          return (
            <label key={v.key} className="flex items-center justify-between gap-2 text-xs text-chrome-fg">
              <span>{v.label}</span>
              <input
                type="color"
                value={current.startsWith('#') ? current : '#000000'}
                onChange={(e) => set(v.key, e.target.value)}
                className="w-8 h-6 rounded border border-chrome-border bg-transparent cursor-pointer"
              />
            </label>
          );
        })}
      </div>
      <div className="px-3 py-2 border-t border-chrome-border flex items-center justify-between">
        <button onClick={reset} className="text-xs text-chrome-muted hover:text-chrome-fg">
          Reset
        </button>
        <span className="text-[10px] text-chrome-muted">
          Session-only · copy CSS to keep
        </span>
      </div>
    </div>,
    document.body,
  );
}
