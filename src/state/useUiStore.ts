import { create } from 'zustand';

export type BlankMode = 'off' | 'black' | 'white';

interface UiState {
  currentSlide: number;
  /** Index of the currently-revealed fragment within the current slide. */
  fragmentStep: number;
  blankMode: BlankMode;
  isPresenting: boolean;
  audienceConnected: boolean;
  audienceLastSeenAt: number;
  timerStart: number | null; // ms epoch when started; null = stopped
  timerAccum: number; // accumulated paused time (ms)
  themeOverride: string | null;
  codeTheme: string;

  // Feature panels
  slideJumperOpen: boolean;
  overviewOpen: boolean;
  recentDecksOpen: boolean;
  themeTweakerOpen: boolean;
  drawingMode: boolean;
  /** Auto-advance enabled in present mode (driven by deck frontmatter). */
  autoAdvancePaused: boolean;

  setCurrentSlide(n: number): void;
  nextSlide(total: number): void;
  prevSlide(): void;
  setFragmentStep(n: number): void;
  setBlank(mode: BlankMode): void;
  setPresenting(p: boolean): void;
  setAudienceConnected(c: boolean): void;
  markAudienceSeen(): void;
  startTimer(): void;
  pauseTimer(): void;
  resetTimer(): void;
  getElapsed(): number;
  setThemeOverride(t: string | null): void;
  setCodeTheme(t: string): void;

  setSlideJumperOpen(b: boolean): void;
  setOverviewOpen(b: boolean): void;
  setRecentDecksOpen(b: boolean): void;
  setThemeTweakerOpen(b: boolean): void;
  setDrawingMode(b: boolean): void;
  setAutoAdvancePaused(b: boolean): void;
}

export const useUiStore = create<UiState>((set, get) => ({
  currentSlide: 0,
  fragmentStep: 0,
  blankMode: 'off',
  isPresenting: false,
  audienceConnected: false,
  audienceLastSeenAt: 0,
  timerStart: null,
  timerAccum: 0,
  themeOverride: null,
  codeTheme: 'catppuccin-mocha',
  slideJumperOpen: false,
  overviewOpen: false,
  recentDecksOpen: false,
  themeTweakerOpen: false,
  drawingMode: false,
  autoAdvancePaused: false,

  setCurrentSlide: (n) => set({ currentSlide: Math.max(0, n), fragmentStep: 0 }),
  nextSlide: (total) =>
    set((s) => ({ currentSlide: Math.min(total - 1, s.currentSlide + 1), fragmentStep: 0 })),
  prevSlide: () => set((s) => ({ currentSlide: Math.max(0, s.currentSlide - 1), fragmentStep: 0 })),
  setFragmentStep: (n) => set({ fragmentStep: Math.max(0, n) }),
  setBlank: (mode) => set({ blankMode: mode }),
  setPresenting: (p) => set({ isPresenting: p }),
  setAudienceConnected: (c) => set({ audienceConnected: c, audienceLastSeenAt: c ? Date.now() : 0 }),
  markAudienceSeen: () => set({ audienceConnected: true, audienceLastSeenAt: Date.now() }),
  startTimer: () => set((s) => (s.timerStart ? s : { timerStart: Date.now() })),
  pauseTimer: () =>
    set((s) => {
      if (!s.timerStart) return s;
      return { timerStart: null, timerAccum: s.timerAccum + (Date.now() - s.timerStart) };
    }),
  resetTimer: () => set({ timerStart: null, timerAccum: 0 }),
  getElapsed: () => {
    const { timerStart, timerAccum } = get();
    return timerAccum + (timerStart ? Date.now() - timerStart : 0);
  },
  setThemeOverride: (t) => set({ themeOverride: t }),
  setCodeTheme: (t) => set({ codeTheme: t }),

  setSlideJumperOpen: (b) => set({ slideJumperOpen: b }),
  setOverviewOpen: (b) => set({ overviewOpen: b }),
  setRecentDecksOpen: (b) => set({ recentDecksOpen: b }),
  setThemeTweakerOpen: (b) => set({ themeTweakerOpen: b }),
  setDrawingMode: (b) => set({ drawingMode: b }),
  setAutoAdvancePaused: (b) => set({ autoAdvancePaused: b }),
}));
