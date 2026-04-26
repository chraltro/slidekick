import { useEffect, useRef } from 'react';
import { useDeckStore } from '@/state/useDeckStore';
import { saveDeck, type DeckRecord, getDeck } from '@/storage/deckStore';

const ACTIVE_DECK_KEY = 'md-presentations:active-deck-id';

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
      if (rec) {
        useDeckStore.getState().loadDeck({ id: rec.id, title: rec.title, source: rec.source });
      }
    })();
  }, []);

  // Subscribe to source changes
  useEffect(() => {
    let timer: number | undefined;
    const unsub = useDeckStore.subscribe((state, prev) => {
      if (state.source === prev.source && state.title === prev.title) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const s = useDeckStore.getState();
        const rec: DeckRecord = {
          id: s.deckId,
          title: s.title,
          source: s.source,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        saveDeck(rec).then(() => {
          useDeckStore.getState().markSaved();
          localStorage.setItem(ACTIVE_DECK_KEY, s.deckId);
        });
      }, 400);
    });
    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, []);
}
