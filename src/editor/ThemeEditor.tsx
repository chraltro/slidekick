import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, Download, Trash2, Check, X } from 'lucide-react';
import {
  type CustomTheme,
  type ThemeVars,
  THEME_VARS,
  DEFAULT_THEME_VARS,
  slugify,
  themeToCss,
  serializeTheme,
  parseThemeFile,
  getCustomTheme,
} from '@/themes/customThemes';
import { upsertCustomTheme, removeCustomTheme } from '@/themes/useCustomThemes';
import { SHIKI_THEMES } from '@/code/themeMap';

interface Props {
  /** When editing an existing custom theme, its id; otherwise undefined to create new. */
  editingId?: string;
  onClose: () => void;
  /** Called with the saved theme id so the caller can apply it. */
  onSaved: (id: string) => void;
}

const PREVIEW_STYLE_ID = 'theme-editor-preview';
const CATEGORIES: CustomTheme['category'][] = ['dev-dark', 'dev-light', 'design'];

function rgbToHex(input: string): string {
  const v = input.trim();
  if (/^#([0-9a-f]{6})$/i.test(v)) return v;
  if (/^#([0-9a-f]{3})$/i.test(v)) return '#' + [...v.slice(1)].map((c) => c + c).join('');
  const m = v.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (m) return '#' + [m[1], m[2], m[3]].map((n) => parseInt(n, 10).toString(16).padStart(2, '0')).join('');
  return '#000000';
}

export function ThemeEditor({ editingId, onClose, onSaved }: Props) {
  const [name, setName] = useState('My theme');
  const [category, setCategory] = useState<CustomTheme['category']>('dev-dark');
  const [shikiTheme, setShikiTheme] = useState('github-dark');
  const [vars, setVars] = useState<ThemeVars>({ ...DEFAULT_THEME_VARS });
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Load existing theme when editing.
  useEffect(() => {
    let cancelled = false;
    if (!editingId) return;
    getCustomTheme(editingId).then((t) => {
      if (cancelled || !t) return;
      setName(t.name);
      setCategory(t.category);
      setShikiTheme(t.shikiTheme);
      setVars({ ...DEFAULT_THEME_VARS, ...t.vars });
      setCreatedAt(t.createdAt);
    });
    return () => {
      cancelled = true;
    };
  }, [editingId]);

  const id = useMemo(() => (editingId ? editingId : slugify(name)), [editingId, name]);

  const previewTheme: CustomTheme = useMemo(
    () => ({
      id: 'theme-editor-preview',
      name,
      category,
      shikiTheme,
      vars,
      createdAt: createdAt ?? 0,
      updatedAt: 0,
    }),
    [name, category, shikiTheme, vars, createdAt],
  );

  // Inject a scoped preview stylesheet so the live preview reflects edits
  // instantly without persisting.
  useEffect(() => {
    let style = document.getElementById(PREVIEW_STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = PREVIEW_STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = themeToCss(previewTheme);
    return () => {
      document.getElementById(PREVIEW_STYLE_ID)?.remove();
    };
  }, [previewTheme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function setVar(key: string, value: string) {
    setVars((prev) => ({ ...prev, [key]: value }));
  }

  function buildTheme(): CustomTheme {
    const now = Date.now();
    return {
      id,
      name: name.trim() || 'Untitled theme',
      category,
      shikiTheme,
      vars,
      createdAt: createdAt ?? now,
      updatedAt: now,
    };
  }

  async function handleSave() {
    setError(null);
    try {
      const theme = buildTheme();
      await upsertCustomTheme(theme);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1400);
      onSaved(theme.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function handleExport() {
    const theme = buildTheme();
    const blob = new Blob([serializeTheme(theme)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${theme.id}.mdtheme.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleUploadClick() {
    fileRef.current?.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setError(null);
    try {
      const text = await f.text();
      const fallback = f.name.replace(/\.(mdtheme\.)?(json|css)$/i, '');
      const parsed = parseThemeFile(text, fallback);
      setName(parsed.name);
      setCategory(parsed.category);
      setShikiTheme(parsed.shikiTheme);
      setVars({ ...DEFAULT_THEME_VARS, ...parsed.vars });
      // Imported themes always become a new theme in this browser.
      setCreatedAt(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDelete() {
    if (!editingId) return;
    if (!confirm(`Delete theme "${name}"? This cannot be undone.`)) return;
    await removeCustomTheme(editingId);
    onClose();
  }

  const grouped = useMemo(() => {
    const groups: Record<string, typeof THEME_VARS> = {};
    for (const v of THEME_VARS) (groups[v.group] ??= []).push(v);
    return Object.entries(groups);
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[1800] flex items-center justify-center bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        data-testid="theme-editor"
        className="w-[min(1100px,95vw)] h-[min(720px,92vh)] bg-chrome-surface border border-chrome-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-chrome-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-semibold text-chrome-fg shrink-0">
              {editingId ? 'Edit theme' : 'Create theme'}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Theme name"
              className="bg-chrome-bg/60 text-sm text-chrome-fg px-2 py-1 rounded border border-chrome-border outline-none focus:border-chrome-accent min-w-0 w-48"
            />
            <code className="text-[10px] text-chrome-muted truncate hidden sm:block">{id}</code>
          </div>
          <button onClick={onClose} className="text-chrome-muted hover:text-chrome-fg" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-[340px_1fr]">
          {/* Controls */}
          <div className="border-r border-chrome-border overflow-auto app-scroll p-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-chrome-muted flex flex-col gap-1">
                Category
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CustomTheme['category'])}
                  className="bg-chrome-bg/60 text-chrome-fg px-2 py-1 rounded border border-chrome-border outline-none focus:border-chrome-accent"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-chrome-muted flex flex-col gap-1">
                Code theme (Shiki)
                <select
                  value={shikiTheme}
                  onChange={(e) => setShikiTheme(e.target.value)}
                  className="bg-chrome-bg/60 text-chrome-fg px-2 py-1 rounded border border-chrome-border outline-none focus:border-chrome-accent"
                >
                  {SHIKI_THEMES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>

            {grouped.map(([group, items]) => (
              <div key={group}>
                <div className="text-[10px] uppercase tracking-wider text-chrome-muted mb-1.5">{group}</div>
                <div className="space-y-1.5">
                  {items.map((v) => (
                    <div key={v.key} className="flex items-center justify-between gap-2 text-xs text-chrome-fg">
                      <span className="truncate" title={v.key}>{v.label}</span>
                      {v.type === 'color' ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="color"
                            value={rgbToHex(vars[v.key] ?? '#000000')}
                            onChange={(e) => setVar(v.key, e.target.value)}
                            className="w-7 h-6 rounded border border-chrome-border bg-transparent cursor-pointer p-0"
                          />
                          <input
                            value={vars[v.key] ?? ''}
                            onChange={(e) => setVar(v.key, e.target.value)}
                            className="w-20 bg-chrome-bg/60 text-chrome-fg px-1.5 py-0.5 rounded border border-chrome-border outline-none focus:border-chrome-accent font-mono text-[10px]"
                          />
                        </div>
                      ) : (
                        <input
                          value={vars[v.key] ?? ''}
                          onChange={(e) => setVar(v.key, e.target.value)}
                          className="w-40 bg-chrome-bg/60 text-chrome-fg px-1.5 py-0.5 rounded border border-chrome-border outline-none focus:border-chrome-accent font-mono text-[10px] shrink-0"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Live preview */}
          <div className="min-h-0 overflow-hidden bg-chrome-bg flex flex-col">
            <div className="text-[10px] uppercase tracking-wider text-chrome-muted px-4 pt-3">Live preview</div>
            <div className="flex-1 min-h-0 p-4 flex items-center justify-center">
              <ThemePreview themeClass={`theme-${previewTheme.id}`} aspectKey={previewTheme.id} />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-4 py-3 border-t border-chrome-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleUploadClick}
              className="inline-flex items-center gap-1.5 text-xs text-chrome-fg bg-chrome-bg/60 border border-chrome-border rounded px-2.5 py-1.5 hover:border-chrome-accent"
            >
              <Upload size={12} /> Upload
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 text-xs text-chrome-fg bg-chrome-bg/60 border border-chrome-border rounded px-2.5 py-1.5 hover:border-chrome-accent"
            >
              <Download size={12} /> Export
            </button>
            {editingId && (
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded px-2.5 py-1.5 hover:bg-red-500/20"
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
            <input ref={fileRef} type="file" accept=".json,.css,application/json,text/css" className="hidden" onChange={handleFile} />
          </div>
          <div className="flex items-center gap-3">
            {error && <span className="text-xs text-red-400 max-w-[280px] truncate" title={error}>{error}</span>}
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-chrome-accent text-chrome-bg rounded px-3 py-1.5 hover:opacity-90"
            >
              {savedFlash ? <Check size={13} /> : null}
              {savedFlash ? 'Saved' : editingId ? 'Save changes' : 'Save theme'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Static sample slide rendered with the in-progress theme class for preview. */
function ThemePreview({ themeClass, aspectKey }: { themeClass: string; aspectKey: string }) {
  return (
    <div
      key={aspectKey}
      className="relative w-full max-w-full max-h-full rounded-md overflow-hidden ring-1 ring-chrome-border shadow-xl"
      style={{ aspectRatio: '16 / 9' }}
    >
      <div className="absolute inset-0 origin-top-left" style={{ width: 1920, height: 1080, transform: 'scale(var(--preview-scale, 0.3))' }} ref={scaleToFit}>
        <div className={`slide-canvas slide aspect-16-9 ${themeClass}`} style={{ width: 1920, height: 1080 }}>
          <div className="layout-content">
            <div>
              <h1>Aa Theme preview</h1>
              <h2>Headings, body, accents</h2>
              <p>
                The quick brown fox jumps. Here is an <a href="#">accent link</a> and{' '}
                <code>inline code</code>.
              </p>
              <ul>
                <li>First bullet point</li>
                <li>Second bullet point</li>
              </ul>
              <blockquote>
                <p>A short blockquote to show the rule and muted text.</p>
              </blockquote>
              <div className="codeblock">
                <div className="codeblock-header">
                  <span className="codeblock-title">sample.ts</span>
                  <span className="codeblock-lang">ts</span>
                </div>
                <pre style={{ background: 'var(--code-bg)', color: 'var(--code-fg)' }}>
                  <code>{'const greet = (x: string) => `Hi ${x}`;'}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Ref callback: scale the 1920×1080 canvas to fit its container width. */
function scaleToFit(el: HTMLDivElement | null) {
  if (!el) return;
  const parent = el.parentElement;
  if (!parent) return;
  const apply = () => {
    const scale = parent.clientWidth / 1920;
    el.style.setProperty('--preview-scale', String(scale));
    parent.style.height = `${1080 * scale}px`;
  };
  apply();
  // Re-fit on resize while mounted.
  const ro = new ResizeObserver(apply);
  ro.observe(parent);
}
