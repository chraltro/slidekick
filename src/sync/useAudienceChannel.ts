import { useEffect, useState } from 'react';
import { getChannel } from './channel';
import type { SyncMessage, BlankMode } from './messages';
import type { SlideAST, DeckConfig } from '@/slides/types';
import { useUiStore } from '@/state/useUiStore';

const HEARTBEAT_INTERVAL = 2000;

interface AudienceState {
  deckId: string | null;
  title: string;
  config: DeckConfig | null;
  slides: SlideAST[];
  currentIndex: number;
  blankMode: BlankMode;
  rev: number;
  editorConnected: boolean;
}

export function useAudienceChannel() {
  const [state, setState] = useState<AudienceState>({
    deckId: null,
    title: '',
    config: null,
    slides: [],
    currentIndex: 0,
    blankMode: 'off',
    rev: 0,
    editorConnected: false,
  });

  useEffect(() => {
    const ch = getChannel();
    let lastEditorHeartbeat = 0;

    const handler = (msg: SyncMessage) => {
      if (msg.type === 'STATE') {
        setState((prev) => ({
          ...prev,
          deckId: msg.deckId,
          title: msg.title,
          slides: msg.slides,
          config: msg.config,
          currentIndex: msg.currentIndex,
          blankMode: msg.blankMode,
          rev: msg.rev,
        }));
      } else if (msg.type === 'STATE_DIFF') {
        setState((prev) => {
          // A diff only makes sense against a baseline from the same deck.
          // Otherwise (missed STATE, deck switched) ask for a full resend
          // instead of splicing foreign slides into whatever we have.
          if (prev.deckId !== msg.deckId || prev.slides.length === 0) {
            ch.post({ type: 'HELLO', from: 'audience' });
            return prev;
          }
          const next = prev.slides.slice();
          for (let i = 0; i < msg.changedIndices.length; i++) {
            next[msg.changedIndices[i]] = msg.slides[i];
          }
          // Truncate or extend if total changed
          if (next.length !== msg.total) next.length = msg.total;
          return {
            ...prev,
            slides: next,
            config: msg.config,
            // Keep the visible slide in range when the deck shrinks.
            currentIndex: Math.min(prev.currentIndex, Math.max(0, msg.total - 1)),
            rev: msg.rev,
          };
        });
      } else if (msg.type === 'NAV') {
        setState((prev) => ({ ...prev, currentIndex: msg.index, rev: msg.rev }));
        // Mirror the sender's fragment reveal into this window's local step
        // (RenderSlide reads it from this window's UI store).
        if (msg.fragment !== undefined) useUiStore.getState().setFragmentStep(msg.fragment);
      } else if (msg.type === 'BLANK') {
        setState((prev) => ({ ...prev, blankMode: msg.mode, rev: msg.rev }));
      } else if (msg.type === 'HEARTBEAT' && msg.from === 'editor') {
        lastEditorHeartbeat = Date.now();
        setState((prev) => (prev.editorConnected ? prev : { ...prev, editorConnected: true }));
      }
    };

    const unsub = ch.subscribe(handler);

    // Say hello so the editor sends us a fresh STATE
    ch.post({ type: 'HELLO', from: 'audience' });

    const hb = window.setInterval(() => {
      ch.post({ type: 'HEARTBEAT', from: 'audience', t: Date.now() });
      if (lastEditorHeartbeat && Date.now() - lastEditorHeartbeat > 5000) {
        setState((prev) => (prev.editorConnected ? { ...prev, editorConnected: false } : prev));
      }
    }, HEARTBEAT_INTERVAL);

    return () => {
      unsub();
      window.clearInterval(hb);
    };
  }, []);

  // Outbound nav helper for the audience window's hotkeys
  function navigate(index: number, fragment = 0) {
    const ch = getChannel();
    useUiStore.getState().setFragmentStep(fragment);
    ch.post({ type: 'NAV', index, from: 'audience', rev: state.rev + 1, fragment });
    setState((prev) => ({ ...prev, currentIndex: index }));
  }

  function setBlank(mode: BlankMode) {
    const ch = getChannel();
    ch.post({ type: 'BLANK', mode, from: 'audience', rev: state.rev + 1 });
    setState((prev) => ({ ...prev, blankMode: mode }));
  }

  return { state, navigate, setBlank };
}
