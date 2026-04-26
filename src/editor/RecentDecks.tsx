import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUiStore } from '@/state/useUiStore';
import { useDeckStore } from '@/state/useDeckStore';
import { listDecks, type DeckRecord, deleteDeck, newDeckId } from '@/storage/deckStore';
import { DEFAULT_MARKDOWN } from '@/state/useDeckStore';
import { Trash2, Plus } from 'lucide-react';

export function RecentDecks() {
  const open = useUiStore((s) => s.recentDecksOpen);
  const setOpen = useUiStore((s) => s.setRecentDecksOpen);
  const loadDeck = useDeckStore((s) => s.loadDeck);
  const currentDeckId = useDeckStore((s) => s.deckId);

  const [decks, setDecks] = useState<DeckRecord[]>([]);

  async function refresh() {
    setDecks(await listDecks());
  }

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;

  function fmt(ts: number) {
    const d = new Date(ts);
    return d.toLocaleString();
  }

  function handleNew() {
    loadDeck({ id: newDeckId(), title: 'Untitled', source: DEFAULT_MARKDOWN });
    setOpen(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this deck? This cannot be undone.')) return;
    await deleteDeck(id);
    refresh();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[1800] bg-black/60 flex items-start justify-center pt-20"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[560px] max-w-[90vw] bg-chrome-surface border border-chrome-border rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-chrome-border flex items-center justify-between">
          <div className="text-sm font-medium text-chrome-fg">Your decks</div>
          <button
            onClick={handleNew}
            className="text-xs px-2 py-1 bg-chrome-accent text-black rounded-md inline-flex items-center gap-1"
          >
            <Plus size={12} /> New deck
          </button>
        </div>
        <div className="max-h-[480px] overflow-auto app-scroll">
          {decks.length === 0 && (
            <div className="px-4 py-8 text-sm text-chrome-muted text-center">
              No saved decks yet. Start typing — autosave will keep your work.
            </div>
          )}
          {decks.map((d) => (
            <div
              key={d.id}
              className={`group px-4 py-3 flex items-center gap-3 border-b border-chrome-border last:border-b-0 ${
                d.id === currentDeckId ? 'bg-chrome-accent/10' : 'hover:bg-chrome-bg/40'
              }`}
            >
              <button
                onClick={() => {
                  loadDeck({ id: d.id, title: d.title, source: d.source });
                  setOpen(false);
                }}
                className="flex-1 text-left min-w-0"
              >
                <div className="text-sm text-chrome-fg truncate">{d.title || 'Untitled'}</div>
                <div className="text-[11px] text-chrome-muted">
                  {fmt(d.updatedAt)} · {d.source.length.toLocaleString()} chars
                  {d.id === currentDeckId ? ' · open' : ''}
                </div>
              </button>
              <button
                onClick={() => handleDelete(d.id)}
                title="Delete deck"
                className="p-1 text-chrome-muted hover:text-red-400 opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="px-4 py-2 text-xs text-chrome-muted border-t border-chrome-border">
          Esc close · Decks live in your browser's IndexedDB · Local only
        </div>
      </div>
    </div>,
    document.body,
  );
}
