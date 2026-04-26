import { useEffect, useRef, useState } from 'react';
import { useUiStore } from '@/state/useUiStore';

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ffffff'];

/**
 * Drawing overlay for present mode. Press `D` to toggle. Mouse draws strokes,
 * `C` clears, number keys 1-6 pick colors, `Esc` exits.
 */
export function DrawOverlay() {
  const drawing = useUiStore((s) => s.drawingMode);
  const setDrawing = useUiStore((s) => s.setDrawingMode);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(3);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      cv.width = window.innerWidth * dpr;
      cv.height = window.innerHeight * dpr;
      cv.style.width = window.innerWidth + 'px';
      cv.style.height = window.innerHeight + 'px';
      const ctx = cv.getContext('2d');
      ctx?.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [drawing]);

  useEffect(() => {
    if (!drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setDrawing(false);
        clear();
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        clear();
      } else if (/^[1-6]$/.test(e.key)) {
        e.preventDefault();
        setColor(COLORS[parseInt(e.key, 10) - 1]);
      } else if (e.key === '+' || e.key === '=') {
        setWidth((w) => Math.min(12, w + 1));
      } else if (e.key === '-') {
        setWidth((w) => Math.max(1, w - 1));
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [drawing, setDrawing]);

  function clear() {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !canvasRef.current) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }

  function start(e: React.PointerEvent) {
    drawingRef.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(e.clientX, e.clientY);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(e.clientX, e.clientY);
    ctx.stroke();
  }
  function end() {
    drawingRef.current = false;
  }

  if (!drawing) return null;

  return (
    <div className="fixed inset-0 z-[1200] cursor-crosshair">
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className="absolute inset-0"
      />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur px-3 py-2 rounded-full flex items-center gap-2 text-white">
        {COLORS.map((c, i) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-6 h-6 rounded-full ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''}`}
            style={{ background: c }}
            title={`${i + 1}`}
          />
        ))}
        <div className="w-px h-4 bg-white/30 mx-1" />
        <button
          onClick={() => setWidth((w) => Math.max(1, w - 1))}
          className="px-2 text-xs"
          title="−"
        >
          −
        </button>
        <span className="text-xs w-5 text-center tabular-nums">{width}</span>
        <button
          onClick={() => setWidth((w) => Math.min(12, w + 1))}
          className="px-2 text-xs"
          title="+"
        >
          +
        </button>
        <div className="w-px h-4 bg-white/30 mx-1" />
        <button onClick={clear} className="px-2 text-xs hover:text-amber-300">Clear (C)</button>
        <button
          onClick={() => {
            setDrawing(false);
            clear();
          }}
          className="px-2 text-xs hover:text-amber-300"
        >
          Exit (D)
        </button>
      </div>
    </div>
  );
}
