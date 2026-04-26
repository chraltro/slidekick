import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDeckStore } from '@/state/useDeckStore';
import { useUiStore } from '@/state/useUiStore';

/**
 * Cmd/Ctrl+K modal: fuzzy-search the deck's slide titles and jump to a slide.
 * Up/down arrows navigate the result list, Enter jumps, Esc closes.
 */
export function SlideJumper() {
  const open = useUiStore((s) => s.slideJumperOpen);
  const setOpen = useUiStore((s) => s.setSlideJumperOpen);
  const setCurrent = useUiStore((s) => s.setCurrentSlide);
  const slides = useDeckStore((s) => s.parsed.slides);

  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return slides.map((s, i) => ({ slide: s, i, score: 0 }));
    return slides
      .map((s, i) => {
        const hay = `${s.title ?? ''} ${s.layout} ${i + 1}`.toLowerCase();
        let score = 0;
        if (hay.includes(q)) score = 1;
        // simple subseq fuzzy
        let pos = 0;
        for (const ch of q) {
          const idx = hay.indexOf(ch, pos);
          if (idx === -1) {
            score = 0;
            break;
          }
          pos = idx + 1;
          score += 0.05;
        }
        return { slide: s, i, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [slides, query]);

  if (!open) return null;

  function jump(idx: number) {
    setCurrent(idx);
    setOpen(false);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[640px] max-w-[90vw] bg-chrome-surface border border-chrome-border rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(filtered.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const r = filtered[active];
              if (r) jump(r.i);
            }
          }}
          placeholder="Jump to slide…"
          className="w-full px-4 py-3 bg-transparent border-b border-chrome-border text-base text-chrome-fg placeholder:text-chrome-muted outline-none"
        />
        <div className="max-h-[420px] overflow-auto app-scroll">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-sm text-chrome-muted">No slides match.</div>
          )}
          {filtered.map((r, idx) => (
            <button
              key={r.slide.hash + r.i}
              onClick={() => jump(r.i)}
              onMouseEnter={() => setActive(idx)}
              className={`w-full text-left px-4 py-2 flex items-center justify-between gap-3 ${
                idx === active ? 'bg-chrome-accent/15' : ''
              }`}
            >
              <span className="text-chrome-muted text-xs w-8 shrink-0">{r.i + 1}</span>
              <span className="flex-1 truncate text-chrome-fg text-sm">
                {r.slide.title ?? <span className="opacity-50 italic">untitled slide</span>}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-chrome-muted shrink-0">
                {r.slide.layout}
              </span>
            </button>
          ))}
        </div>
        <div className="px-4 py-2 text-xs text-chrome-muted border-t border-chrome-border flex items-center justify-between">
          <span>↑↓ navigate · ↵ jump · Esc close</span>
          <span>{filtered.length} slide{filtered.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
