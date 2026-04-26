import { LAYOUTS, type Layout } from '@/slides/types';
import { Button } from './Button';
import { LayoutGrid } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

interface Props {
  current?: Layout;
  onPick: (layout: Layout) => void;
}

const LABELS: Record<Layout, string> = {
  title: 'Title',
  content: 'Content',
  'two-column': 'Two Column',
  'image-left': 'Image Left',
  'image-right': 'Image Right',
  'full-image': 'Full Image',
  'code-focus': 'Code Focus',
  quote: 'Quote',
  'section-divider': 'Section Divider',
  end: 'End / Thanks',
};

export function LayoutPicker({ current, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => setAnchorRect(triggerRef.current?.getBoundingClientRect() ?? null);
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (popupRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const w = 224;
  const top = anchorRect ? anchorRect.bottom + 8 : 0;
  // LayoutPicker is in the bottom panel — open UPWARD instead of downward
  // when there's not enough room below.
  const spaceBelow = anchorRect ? window.innerHeight - anchorRect.bottom : 0;
  const popupHeight = LAYOUTS.length * 32 + 16;
  const openUp = spaceBelow < popupHeight + 16;
  const finalTop = anchorRect
    ? openUp
      ? anchorRect.top - popupHeight - 8
      : top
    : 0;
  const left = anchorRect
    ? Math.max(8, Math.min(window.innerWidth - w - 8, anchorRect.right - w))
    : 0;

  return (
    <>
      <Button ref={triggerRef} onClick={() => setOpen((v) => !v)} variant="default">
        <LayoutGrid size={14} />
        <span>{current ? LABELS[current] : 'Layout'}</span>
      </Button>
      {open && anchorRect &&
        createPortal(
          <div
            ref={popupRef}
            className="fixed p-1 bg-chrome-surface border border-chrome-border rounded-md shadow-2xl"
            style={{ top: finalTop, left, width: w, zIndex: 1000 }}
          >
            {LAYOUTS.map((l) => (
              <button
                key={l}
                onClick={() => {
                  onPick(l);
                  setOpen(false);
                }}
                className={clsx(
                  'w-full text-left px-2 py-1.5 text-sm rounded',
                  current === l ? 'bg-chrome-accent text-black' : 'text-chrome-fg hover:bg-[#1d1d24]',
                )}
              >
                {LABELS[l]}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
