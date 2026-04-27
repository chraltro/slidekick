import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_PREFIX = 'mdp-split:';

function loadSize(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function saveSize(key: string, value: number) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_PREFIX + key, String(Math.round(value)));
}

/**
 * Hook: a numeric size that persists to localStorage. Use for split-pane
 * widths/heights so the user's layout survives reloads.
 */
export function usePersistedSize(key: string, fallback: number): [number, (n: number) => void] {
  const [size, setSize] = useState<number>(() => loadSize(key, fallback));
  const set = useCallback(
    (n: number) => {
      setSize(n);
      saveSize(key, n);
    },
    [key],
  );
  return [size, set];
}

interface DragHandleProps {
  /** 'col' = vertical line, drag horizontally. 'row' = horizontal line, drag vertically. */
  orientation: 'col' | 'row';
  /** Called once at pointerdown to snapshot the size that drag deltas apply to. */
  getStart: () => number;
  /** Sign convention: +1 if dragging the handle right/down increases the tracked size; -1 otherwise. */
  direction?: 1 | -1;
  /** Called on every pointer move with the resolved size: getStart() + direction*deltaPx. */
  onDrag: (nextSize: number) => void;
  className?: string;
}

/**
 * Thin draggable handle. Captures pointer events on the handle itself, so
 * the drag survives the cursor leaving the handle (which it always does
 * on the very first pixel of motion).
 */
export function DragHandle({ orientation, getStart, direction = 1, onDrag, className = '' }: DragHandleProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    const startCoord = orientation === 'col' ? e.clientX : e.clientY;
    const startSize = getStart();
    ref.current?.setPointerCapture(e.pointerId);
    setActive(true);
    document.body.style.cursor = orientation === 'col' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    const move = (ev: PointerEvent) => {
      const cur = orientation === 'col' ? ev.clientX : ev.clientY;
      onDrag(startSize + direction * (cur - startCoord));
    };
    const up = (ev: PointerEvent) => {
      ref.current?.releasePointerCapture(ev.pointerId);
      setActive(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  const base =
    orientation === 'col'
      ? 'relative w-px shrink-0 bg-chrome-border hover:bg-chrome-accent/60 transition-colors'
      : 'relative h-px shrink-0 bg-chrome-border hover:bg-chrome-accent/60 transition-colors';
  // Wider invisible hit-target overlaying the 1px visible line.
  const hit =
    orientation === 'col'
      ? 'before:absolute before:inset-y-0 before:-left-1 before:-right-1 before:content-[""] cursor-col-resize'
      : 'before:absolute before:inset-x-0 before:-top-1 before:-bottom-1 before:content-[""] cursor-row-resize';
  const activeCls = active ? 'bg-chrome-accent' : '';

  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation={orientation === 'col' ? 'vertical' : 'horizontal'}
      onPointerDown={onPointerDown}
      className={`${base} ${hit} ${activeCls} ${className}`}
    />
  );
}

/**
 * Reset all persisted split sizes (used by a "reset layout" action — not
 * wired up yet but kept here so callers don't have to know the key prefix).
 */
export function resetAllSplits() {
  if (typeof window === 'undefined') return;
  for (let i = window.localStorage.length - 1; i >= 0; i--) {
    const k = window.localStorage.key(i);
    if (k?.startsWith(STORAGE_PREFIX)) window.localStorage.removeItem(k);
  }
}

/**
 * Hook: track a container's clientWidth/Height in px so split logic can
 * convert pixel deltas into the right column-template values, and clamp
 * sizes to the available space when the window resizes.
 */
export function useContainerSize(ref: React.RefObject<HTMLElement>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      setSize({ width: e.contentRect.width, height: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}
