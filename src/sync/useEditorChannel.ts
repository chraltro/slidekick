import { useEffect, useRef } from 'react';
import { getChannel } from './channel';
import type { SyncMessage } from './messages';
import { useDeckStore } from '@/state/useDeckStore';
import { useUiStore } from '@/state/useUiStore';

const HEARTBEAT_INTERVAL = 2000;
const AUDIENCE_TIMEOUT = 5000;

/**
 * Editor-side sync: publishes deck state on every change, sends heartbeats,
 * and listens for NAV / HELLO from the audience window.
 */
export function useEditorChannel() {
  const revRef = useRef(0);
  const lastSentHashesRef = useRef<string[]>([]);

  const setCurrentSlide = useUiStore((s) => s.setCurrentSlide);
  const setBlank = useUiStore((s) => s.setBlank);
  const markAudienceSeen = useUiStore((s) => s.markAudienceSeen);
  const setAudienceConnected = useUiStore((s) => s.setAudienceConnected);

  // Subscribe once
  useEffect(() => {
    const ch = getChannel();
    const unsub = ch.subscribe((msg: SyncMessage) => {
      if (msg.type === 'NAV' && msg.from === 'audience') {
        setCurrentSlide(msg.index);
      } else if (msg.type === 'BLANK' && msg.from === 'audience') {
        setBlank(msg.mode);
      } else if (msg.type === 'HEARTBEAT' && msg.from === 'audience') {
        markAudienceSeen();
      } else if (msg.type === 'HELLO' && msg.from === 'audience') {
        // Force a full state re-send next render
        revRef.current++;
        lastSentHashesRef.current = [];
        markAudienceSeen();
        publishStateNow();
      }
    });

    const heartbeat = window.setInterval(() => {
      ch.post({ type: 'HEARTBEAT', from: 'editor', t: Date.now() });
      const last = useUiStore.getState().audienceLastSeenAt;
      const connected = useUiStore.getState().audienceConnected;
      if (connected && last && Date.now() - last > AUDIENCE_TIMEOUT) {
        setAudienceConnected(false);
      }
    }, HEARTBEAT_INTERVAL);

    return () => {
      unsub();
      window.clearInterval(heartbeat);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Publish state whenever deck/parsed/current/blank changes
  const parsed = useDeckStore((s) => s.parsed);
  const deckId = useDeckStore((s) => s.deckId);
  const title = useDeckStore((s) => s.title);
  const currentSlide = useUiStore((s) => s.currentSlide);
  const blankMode = useUiStore((s) => s.blankMode);

  function publishStateNow() {
    const state = useDeckStore.getState();
    const ui = useUiStore.getState();
    const ch = getChannel();
    revRef.current++;
    const msg: SyncMessage = {
      type: 'STATE',
      deckId: state.deckId,
      title: state.title,
      slides: state.parsed.slides,
      config: state.parsed.config,
      currentIndex: ui.currentSlide,
      blankMode: ui.blankMode,
      rev: revRef.current,
    };
    ch.post(msg);
    lastSentHashesRef.current = state.parsed.slides.map((s) => s.hash);
  }

  useEffect(() => {
    const ch = getChannel();
    const slides = parsed.slides;
    const lastHashes = lastSentHashesRef.current;
    revRef.current++;

    // First publish or major change → full STATE
    if (lastHashes.length !== slides.length) {
      ch.post({
        type: 'STATE',
        deckId,
        title,
        slides,
        config: parsed.config,
        currentIndex: currentSlide,
        blankMode,
        rev: revRef.current,
      });
      lastSentHashesRef.current = slides.map((s) => s.hash);
      return;
    }

    // Otherwise: diff and send only changed slides
    const changed: number[] = [];
    for (let i = 0; i < slides.length; i++) {
      if (lastHashes[i] !== slides[i].hash) changed.push(i);
    }
    if (changed.length === 0) {
      // Still publish nav/blank in case those changed
      ch.post({ type: 'NAV', index: currentSlide, from: 'editor', rev: revRef.current });
      ch.post({ type: 'BLANK', mode: blankMode, from: 'editor', rev: revRef.current });
      return;
    }
    if (changed.length > slides.length / 2) {
      ch.post({
        type: 'STATE',
        deckId,
        title,
        slides,
        config: parsed.config,
        currentIndex: currentSlide,
        blankMode,
        rev: revRef.current,
      });
    } else {
      ch.post({
        type: 'STATE_DIFF',
        deckId,
        changedIndices: changed,
        slides: changed.map((i) => slides[i]),
        total: slides.length,
        config: parsed.config,
        rev: revRef.current,
      });
      ch.post({ type: 'NAV', index: currentSlide, from: 'editor', rev: revRef.current });
    }
    lastSentHashesRef.current = slides.map((s) => s.hash);
  }, [parsed, deckId, title, currentSlide, blankMode]);

  return {
    publishStateNow,
  };
}
