import type { SlideAST, DeckConfig } from '@/slides/types';

export type BlankMode = 'off' | 'black' | 'white';

export type Role = 'editor' | 'audience';

export type SyncMessage =
  | {
      type: 'STATE';
      deckId: string;
      title: string;
      slides: SlideAST[];
      config: DeckConfig;
      currentIndex: number;
      blankMode: BlankMode;
      rev: number;
    }
  | {
      type: 'STATE_DIFF';
      deckId: string;
      changedIndices: number[];
      slides: SlideAST[]; // only the changed ones, but in their full form
      total: number;
      config: DeckConfig;
      rev: number;
    }
  | { type: 'NAV'; index: number; from: Role; rev: number }
  | { type: 'BLANK'; mode: BlankMode; from: Role; rev: number }
  | { type: 'HEARTBEAT'; from: Role; t: number }
  | { type: 'HELLO'; from: Role };

export const CHANNEL_NAME = 'md-presentations:sync';
export const STORAGE_KEY = 'md-presentations:sync:msg';
