import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { THEMES, type ThemeInfo } from '@/themes/index';
import { useCustomThemes } from '@/themes/useCustomThemes';
import { themeToThemeInfo, isCustomThemeId } from '@/themes/customThemes';
import { ThemeEditor } from '@/editor/ThemeEditor';
import clsx from 'clsx';
import { Button } from './Button';
import { Palette, Plus, Pencil } from 'lucide-react';

interface Props {
  current: string;
  onPick: (id: string) => void;
}

export function ThemePicker({ current, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [editor, setEditor] = useState<{ editingId?: string } | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const customThemes = useCustomThemes();
  const customInfos = useMemo(() => customThemes.map(themeToThemeInfo), [customThemes]);
  const allThemes = useMemo(() => [...THEMES, ...customInfos], [customInfos]);

  const active = allThemes.find((t) => t.id === current) ?? THEMES[0];

  function commit(t: ThemeInfo) {
    onPick(t.id);
    setHover(null);
    setOpen(false);
  }

  // Recompute popup anchor on open + on resize/scroll while open.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect() ?? null;
      setAnchorRect(r);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  // Click-outside to close (more robust than onMouseLeave which Playwright/test
  // automation can accidentally trigger). Suspended while the editor modal is up.
  useEffect(() => {
    if (!open || editor) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (popupRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      if (hover && hover !== current) onPick(current);
      setHover(null);
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (hover && hover !== current) onPick(current);
        setHover(null);
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, editor, hover, current, onPick]);

  const popupWidth = 680;
  const popupTop = anchorRect ? anchorRect.bottom + 8 : 0;
  // Right-align under the trigger, but keep within viewport.
  const popupLeft = anchorRect
    ? Math.max(8, Math.min(window.innerWidth - popupWidth - 8, anchorRect.right - popupWidth))
    : 0;

  return (
    <>
      <Button ref={triggerRef} data-testid="theme-picker-trigger" onClick={() => setOpen((v) => !v)} variant="default">
        <Palette size={14} />
        <span>{active.name}</span>
      </Button>
      {open && anchorRect &&
        createPortal(
          <div
            ref={popupRef}
            className="fixed p-3 bg-chrome-surface border border-chrome-border rounded-lg shadow-2xl"
            style={{ top: popupTop, left: popupLeft, width: popupWidth, zIndex: 1000 }}
          >
            <div className="grid grid-cols-3 gap-2 max-h-[460px] overflow-auto app-scroll">
              {allThemes.map((t) => {
                const custom = isCustomThemeId(t.id);
                return (
                  <button
                    key={t.id}
                    data-theme-id={t.id}
                    aria-label={`Theme: ${t.name}`}
                    onMouseEnter={() => {
                      setHover(t.id);
                      onPick(t.id);
                    }}
                    onClick={() => commit(t)}
                    className={clsx(
                      'group relative h-[124px] rounded-md overflow-hidden border text-left transition',
                      current === t.id ? 'border-chrome-accent' : 'border-chrome-border hover:border-chrome-accent/60',
                    )}
                    style={{ background: t.swatch.bg, color: t.swatch.fg }}
                  >
                    <div className="absolute inset-0 px-3 py-2 flex flex-col justify-between">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold tracking-tight" style={{ color: t.swatch.fg }}>
                          {t.name}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider opacity-50">
                          {custom ? 'custom' : t.category}
                        </span>
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex gap-1">
                          <div className="h-3 w-3 rounded-sm border border-black/10" style={{ background: t.swatch.bg }} />
                          <div className="h-3 w-3 rounded-sm" style={{ background: t.swatch.accent }} />
                          <div className="h-3 w-3 rounded-sm border border-black/10" style={{ background: t.swatch.fg }} />
                        </div>
                        <div className="text-[10px] opacity-50 truncate">{t.id}</div>
                      </div>
                    </div>
                    {custom && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Edit theme: ${t.name}`}
                        title="Edit theme"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditor({ editingId: t.id });
                        }}
                        onMouseEnter={(e) => e.stopPropagation()}
                        className="absolute top-1.5 right-1.5 p-1 rounded bg-black/30 text-white/80 opacity-0 group-hover:opacity-100 hover:bg-black/50 transition"
                      >
                        <Pencil size={12} />
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Create-new card */}
              <button
                aria-label="Create new theme"
                onMouseEnter={() => setHover(null)}
                onClick={() => setEditor({})}
                className="h-[124px] rounded-md border border-dashed border-chrome-border hover:border-chrome-accent text-chrome-muted hover:text-chrome-fg flex flex-col items-center justify-center gap-1.5 transition"
              >
                <Plus size={22} />
                <span className="text-xs font-medium">Create theme</span>
              </button>
            </div>
            <div className="mt-2 text-xs text-chrome-muted px-1 flex items-center justify-between">
              <span>{hover ? `Previewing: ${hover}` : 'Hover to preview · click to apply · + to create'}</span>
              <span className="opacity-60">Esc to cancel</span>
            </div>
          </div>,
          document.body,
        )}
      {editor &&
        createPortal(
          <ThemeEditor
            editingId={editor.editingId}
            onClose={() => setEditor(null)}
            onSaved={(id) => onPick(id)}
          />,
          document.body,
        )}
    </>
  );
}
