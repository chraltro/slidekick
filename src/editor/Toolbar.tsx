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
  Sliders,
  FileDown,
} from 'lucide-react';
import { useState } from 'react';
import { exportDeckHtml, downloadFile } from '@/export/exportHtml';
import { exportDeckPdf } from '@/export/exportPdf';
import { exportDeckMd } from '@/export/exportMd';
import { downloadAgentGuide } from '@/export/agentGuide';
import { BookOpen } from 'lucide-react';
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
  const setThemeTweakerOpen = useUiStore((s) => s.setThemeTweakerOpen);
  const themeTweakerOpen = useUiStore((s) => s.themeTweakerOpen);

  const [busy, setBusy] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

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
    <div className="flex items-center justify-between px-3 py-2 border-b border-chrome-border bg-chrome-surface/60 backdrop-blur">
      <div className="flex items-center gap-2 min-w-0">
        <div className="font-mono text-sm text-chrome-accent shrink-0">md-pres</div>
        <span className="text-chrome-border">|</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-transparent text-sm text-chrome-fg outline-none border-none px-1 truncate min-w-0"
          placeholder="Untitled"
        />
        {dirty ? (
          <span className="text-[10px] uppercase tracking-wider text-amber-400">Unsaved</span>
        ) : (
          <span className="text-[10px] uppercase tracking-wider text-chrome-muted flex items-center gap-1">
            <Save size={10} /> saved
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
        <Button
          onClick={() => setThemeTweakerOpen(!themeTweakerOpen)}
          variant="ghost"
          size="sm"
          title="Theme tweaker"
        >
          <Sliders size={14} />
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
        <div className="relative">
          <Button
            onClick={() => setExportMenuOpen((v) => !v)}
            variant="default"
            size="sm"
            disabled={busy}
            title="Export…"
          >
            <Download size={14} />
            <span>{busy ? 'Exporting…' : 'Export'}</span>
          </Button>
          {exportMenuOpen && (
            <div
              className="absolute right-0 mt-2 w-44 bg-chrome-surface border border-chrome-border rounded-md shadow-2xl z-50 p-1"
              onMouseLeave={() => setExportMenuOpen(false)}
            >
              <button
                onClick={handleExportHtml}
                className="w-full text-left px-2 py-1.5 text-xs text-chrome-fg hover:bg-[#1d1d24] rounded inline-flex items-center gap-2"
              >
                <FileText size={12} /> HTML (self-contained)
              </button>
              <button
                onClick={handleExportPdf}
                className="w-full text-left px-2 py-1.5 text-xs text-chrome-fg hover:bg-[#1d1d24] rounded inline-flex items-center gap-2"
              >
                <FileDown size={12} /> PDF (via print)
              </button>
              <button
                onClick={handleExportMd}
                className="w-full text-left px-2 py-1.5 text-xs text-chrome-fg hover:bg-[#1d1d24] rounded inline-flex items-center gap-2"
              >
                <Save size={12} /> Markdown source (.md)
              </button>
              <div className="my-1 h-px bg-chrome-border" />
              <button
                onClick={() => {
                  downloadAgentGuide();
                  setExportMenuOpen(false);
                }}
                className="w-full text-left px-2 py-1.5 text-xs text-chrome-fg hover:bg-[#1d1d24] rounded inline-flex items-center gap-2"
                title="Download a complete reference an LLM agent can paste into context to author decks for this tool"
              >
                <BookOpen size={12} /> Guide for agent (.md)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
