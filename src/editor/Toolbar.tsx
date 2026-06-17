import { Button } from '@/ui/Button';
import { ThemePicker } from '@/ui/ThemePicker';
import { useDeckStore } from '@/state/useDeckStore';
import { useUiStore } from '@/state/useUiStore';
import {
  Play,
  Monitor,
  Download,
  Upload,
  FilePlus,
  Save,
  RefreshCw,
  LayoutGrid,
  Search,
  Folder,
  FileText,
  FileDown,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { exportDeckHtml, downloadFile } from '@/export/exportHtml';
import { exportDeckPdf } from '@/export/exportPdf';
import { exportDeckMd } from '@/export/exportMd';
import { copyAgentGuide } from '@/export/agentGuide';
import { BookOpen, Check } from 'lucide-react';
import { newDeckId } from '@/storage/deckStore';
import { DEFAULT_MARKDOWN } from '@/state/useDeckStore';

interface Props {
  onOpenAudience: () => void;
  audienceConnected: boolean;
}

export function Toolbar({ onOpenAudience, audienceConnected }: Props) {
  const source = useDeckStore((s) => s.source);
  const setSource = useDeckStore((s) => s.setSource);
  const parsed = useDeckStore((s) => s.parsed);
  const title = useDeckStore((s) => s.title);
  const setTitle = useDeckStore((s) => s.setTitle);
  const loadDeck = useDeckStore((s) => s.loadDeck);
  const setPresenting = useUiStore((s) => s.setPresenting);
  const isPresenting = useUiStore((s) => s.isPresenting);
  const dirty = useDeckStore((s) => s.dirty);
  const setSlideJumperOpen = useUiStore((s) => s.setSlideJumperOpen);
  const setOverviewOpen = useUiStore((s) => s.setOverviewOpen);
  const setRecentDecksOpen = useUiStore((s) => s.setRecentDecksOpen);

  const [busy, setBusy] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [guideCopied, setGuideCopied] = useState(false);
  const [exportAnchor, setExportAnchor] = useState<DOMRect | null>(null);
  const exportTriggerRef = useRef<HTMLButtonElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!exportMenuOpen) return;
    const update = () => setExportAnchor(exportTriggerRef.current?.getBoundingClientRect() ?? null);
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [exportMenuOpen]);

  useEffect(() => {
    if (!exportMenuOpen) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (exportMenuRef.current?.contains(t)) return;
      if (exportTriggerRef.current?.contains(t)) return;
      setExportMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setExportMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [exportMenuOpen]);

  function handleExportHtml() {
    setBusy(true);
    setExportMenuOpen(false);
    exportDeckHtml(parsed, title)
      .then((html) => {
        const filename = `${(title || 'deck').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}.html`;
        downloadFile(filename, html, 'text/html');
      })
      .finally(() => setBusy(false));
  }
  function handleExportPdf() {
    setBusy(true);
    setExportMenuOpen(false);
    exportDeckPdf(parsed, title).finally(() => setBusy(false));
  }
  function handleExportMd() {
    setExportMenuOpen(false);
    exportDeckMd(source, title);
  }

  function handleSetTheme(themeId: string) {
    // No-op if it's already the active theme (prevents duplicate-line bugs
    // when hover + click both fire onPick with the same id).
    if (parsed.config.theme === themeId && /^theme:\s*\S/m.test(source)) return;

    const fmMatch = source.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
    if (fmMatch) {
      const fmBlock = fmMatch[0];
      let updatedFm: string;
      if (/^theme:/m.test(fmBlock)) {
        updatedFm = fmBlock.replace(/^theme:.*$/m, `theme: ${themeId}`);
      } else {
        updatedFm = fmBlock.replace(/\r?\n---\r?\n$/, (m) =>
          m.startsWith('\r\n') ? `\r\ntheme: ${themeId}\r\n---\r\n` : `\ntheme: ${themeId}\n---\n`,
        );
      }
      setSource(updatedFm + source.slice(fmBlock.length));
    } else {
      setSource(`---\ntheme: ${themeId}\n---\n\n${source}`);
    }
  }

  function handleNew() {
    if (dirty && !confirm('Discard unsaved changes and start a new deck?')) return;
    loadDeck({ id: newDeckId(), title: 'Untitled', source: DEFAULT_MARKDOWN });
  }

  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,text/markdown,text/plain';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const text = await f.text();
      loadDeck({ id: newDeckId(), title: f.name.replace(/\.(md|markdown|txt)$/i, ''), source: text });
    };
    input.click();
  }

  function togglePresent() {
    setPresenting(!isPresenting);
    if (!isPresenting) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-chrome-border bg-chrome-surface/60 backdrop-blur">
      <div className="flex items-center gap-3 min-w-0">
        <div className="font-mono text-sm text-chrome-accent shrink-0 tracking-tight">md-pres</div>
        <div className="h-4 w-px bg-chrome-border shrink-0" aria-hidden />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-transparent text-sm text-chrome-fg placeholder:text-chrome-subtle outline-none border-none px-1.5 py-0.5 -mx-1.5 rounded truncate min-w-0 transition-colors hover:bg-chrome-surface focus:bg-chrome-surface focus-visible:ring-1 focus-visible:ring-chrome-accent/50"
          placeholder="Untitled"
        />
        {dirty ? (
          <span className="text-[10px] uppercase tracking-[0.08em] font-medium text-amber-400/90 shrink-0">Unsaved</span>
        ) : (
          <span className="text-[10px] uppercase tracking-[0.08em] font-medium text-chrome-subtle flex items-center gap-1 shrink-0">
            <Save size={10} /> Saved
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => setRecentDecksOpen(true)} variant="ghost" size="sm" title="My decks">
          <Folder size={14} />
        </Button>
        <Button onClick={handleNew} variant="ghost" size="sm" title="New deck">
          <FilePlus size={14} />
        </Button>
        <Button onClick={handleImport} variant="ghost" size="sm" title="Import .md">
          <Upload size={14} />
        </Button>
        <Button onClick={() => setSlideJumperOpen(true)} variant="ghost" size="sm" title="Jump to slide (Cmd/Ctrl+K)">
          <Search size={14} />
        </Button>
        <Button onClick={() => setOverviewOpen(true)} variant="ghost" size="sm" title="Overview (O)">
          <LayoutGrid size={14} />
        </Button>
        <ThemePicker current={parsed.config.theme} onPick={handleSetTheme} />
        <Button
          onClick={onOpenAudience}
          variant={audienceConnected ? 'default' : 'primary'}
          size="sm"
          title={audienceConnected ? 'Audience window connected' : 'Open audience window (share in Teams/Zoom)'}
        >
          {audienceConnected ? <RefreshCw size={14} /> : <Monitor size={14} />}
          <span>{audienceConnected ? 'Audience live' : 'Open Audience'}</span>
        </Button>
        <Button onClick={togglePresent} variant="primary" size="sm" title="Present (Cmd/Ctrl+P)">
          <Play size={14} />
          <span>{isPresenting ? 'Stop' : 'Present'}</span>
        </Button>
        <Button
          ref={exportTriggerRef}
          onClick={() => setExportMenuOpen((v) => !v)}
          variant="default"
          size="sm"
          disabled={busy}
          title="Export…"
        >
          <Download size={14} />
          <span>{busy ? 'Exporting…' : 'Export'}</span>
        </Button>
      </div>
      {exportMenuOpen && exportAnchor &&
        createPortal(
          <div
            ref={exportMenuRef}
            className="fixed bg-chrome-elevated border border-chrome-border rounded-lg shadow-xl shadow-black/40 p-1"
            style={{
              top: exportAnchor.bottom + 6,
              left: Math.max(8, Math.min(window.innerWidth - 232, exportAnchor.right - 224)),
              width: 224,
              zIndex: 1000,
            }}
          >
            <button
              onClick={handleExportHtml}
              className="w-full text-left px-2.5 py-1.5 text-xs text-chrome-fg hover:bg-chrome-surface-hover rounded-md inline-flex items-center gap-2.5 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-chrome-accent"
            >
              <FileText size={12} className="text-chrome-muted" /> HTML (self-contained)
            </button>
            <button
              onClick={handleExportPdf}
              className="w-full text-left px-2.5 py-1.5 text-xs text-chrome-fg hover:bg-chrome-surface-hover rounded-md inline-flex items-center gap-2.5 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-chrome-accent"
            >
              <FileDown size={12} className="text-chrome-muted" /> PDF (via print)
            </button>
            <button
              onClick={handleExportMd}
              className="w-full text-left px-2.5 py-1.5 text-xs text-chrome-fg hover:bg-chrome-surface-hover rounded-md inline-flex items-center gap-2.5 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-chrome-accent"
            >
              <Save size={12} className="text-chrome-muted" /> Markdown source (.md)
            </button>
            <div className="my-1 h-px bg-chrome-border" />
            <button
              onClick={async () => {
                const ok = await copyAgentGuide();
                if (ok) {
                  setGuideCopied(true);
                  setTimeout(() => setGuideCopied(false), 1800);
                }
                setExportMenuOpen(false);
              }}
              className="w-full text-left px-2.5 py-1.5 text-xs text-chrome-fg hover:bg-chrome-surface-hover rounded-md inline-flex items-center gap-2.5 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-chrome-accent"
              title="Copy the agent guide to clipboard. Paste it into Claude/GPT context to author decks for this tool."
            >
              {guideCopied ? <Check size={12} className="text-emerald-400" /> : <BookOpen size={12} className="text-chrome-muted" />}
              {guideCopied ? 'Copied!' : 'Copy agent guide'}
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
