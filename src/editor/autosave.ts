import { useEffect, useRef } from 'react';
import { useDeckStore, DEFAULT_MARKDOWN } from '@/state/useDeckStore';
import { saveDeck, type DeckRecord, getDeck } from '@/storage/deckStore';

const ACTIVE_DECK_KEY = 'md-presentations:active-deck-id';

let debounceTimer: number | undefined;

interface SaveSnapshot {
  id: string;
  title: string;
  source: string;
}

async function writeRecord(snap: SaveSnapshot): Promise<void> {
  // Preserve the original creation timestamp — a save must not reset it.
  const existing = await getDeck(snap.id);
  const rec: DeckRecord = {
    id: snap.id,
    title: snap.title,
    source: snap.source,
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };
  await saveDeck(rec);
  const s = useDeckStore.getState();
  if (s.deckId === snap.id) {
    localStorage.setItem(ACTIVE_DECK_KEY, snap.id);
    // Only clear the dirty flag if nothing changed while the write was
    // in flight — otherwise the newest edits would show as "Saved".
    if (s.source === snap.source && s.title === snap.title) {
      s.markSaved();
    }
  }
}

function reportSaveError(e: unknown): void {
  // Keep `dirty` set so the toolbar honestly shows "Unsaved".
  console.error('[autosave] failed to write deck to IndexedDB', e);
}

/**
 * Write the current deck to IndexedDB immediately, cancelling any pending
 * debounced save. Used by Ctrl+S and the tab-close flush.
 */
export function flushSaveNow(): Promise<void> {
  window.clearTimeout(debounceTimer);
  const s = useDeckStore.getState();
  return writeRecord({ id: s.deckId, title: s.title, source: s.source }).catch(reportSaveError);
}

/**
 * Autosaves on every source change with a 400ms debounce. Also restores the
 * last-active deck from IndexedDB on first mount.
 */
export function useAutosave() {
  const restored = useRef(false);

  // Restore on mount
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    (async () => {
      const id = localStorage.getItem(ACTIVE_DECK_KEY);
      if (!id) return;
      const rec = await getDeck(id);
      if (!rec) return;
      // Don't clobber anything the user typed or imported while the async
      // restore was still loading.
      const s = useDeckStore.getState();
      if (s.dirty || s.source !== DEFAULT_MARKDOWN) return;
      s.loadDeck({ id: rec.id, title: rec.title, source: rec.source });
    })();
  }, []);

  // Subscribe to source changes
  useEffect(() => {
    const unsub = useDeckStore.subscribe((state, prev) => {
      if (state.deckId !== prev.deckId) {
        // Deck switched. Persist the outgoing deck's un-debounced edits before
        // they are lost, and cancel any timer that would now save the wrong deck.
        window.clearTimeout(debounceTimer);
        if (prev.dirty) {
          writeRecord({ id: prev.deckId, title: prev.title, source: prev.source }).catch(
            reportSaveError,
          );
        }
        localStorage.setItem(ACTIVE_DECK_KEY, state.deckId);
        return;
      }
      if (state.source === prev.source && state.title === prev.title) return;
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        const s = useDeckStore.getState();
        writeRecord({ id: s.deckId, title: s.title, source: s.source }).catch(reportSaveError);
      }, 400);
    });
    return () => {
      unsub();
      window.clearTimeout(debounceTimer);
    };
  }, []);

  // Best-effort flush when the tab goes away inside the debounce window.
  useEffect(() => {
    const flush = () => {
      if (useDeckStore.getState().dirty) void flushSaveNow();
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, []);
}
