import { useSyncExternalStore } from 'react';
import {
  type CustomTheme,
  loadCustomThemes,
  saveCustomTheme as persist,
  deleteCustomTheme as removePersisted,
  themeToCss,
} from './customThemes';

/**
 * App-wide registry of custom themes. Holds the loaded list, keeps a single
 * `<style>` tag in the document head in sync, and notifies React subscribers.
 * Shared across the editor and audience windows (each runs its own registry
 * instance, both reading from the same IndexedDB store).
 */

const STYLE_ID = 'custom-themes-css';

let themes: CustomTheme[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function syncStyleTag() {
  if (typeof document === 'undefined') return;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (themes.length === 0) {
    style?.remove();
    return;
  }
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = themes.map(themeToCss).join('\n');
}

function setThemes(next: CustomTheme[]) {
  // New array reference so useSyncExternalStore sees a change.
  themes = next.slice().sort((a, b) => a.createdAt - b.createdAt);
  syncStyleTag();
  emit();
}

let initPromise: Promise<void> | null = null;
export function ensureCustomThemesLoaded(): Promise<void> {
  if (!initPromise) {
    initPromise = loadCustomThemes()
      .then((list) => {
        themes = list;
        loaded = true;
        syncStyleTag();
        emit();
      })
      .catch(() => {
        loaded = true;
      });
  }
  return initPromise;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  ensureCustomThemesLoaded();
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): CustomTheme[] {
  return themes;
}

const EMPTY: CustomTheme[] = [];
function getServerSnapshot(): CustomTheme[] {
  return EMPTY;
}

/** React hook: the current list of custom themes (re-renders on change). */
export function useCustomThemes(): CustomTheme[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function isCustomThemesLoaded(): boolean {
  return loaded;
}

/** Add or update a theme (persists, re-injects CSS, notifies). */
export async function upsertCustomTheme(theme: CustomTheme): Promise<void> {
  await persist(theme);
  const rest = themes.filter((t) => t.id !== theme.id);
  setThemes([...rest, theme]);
}

/** Remove a theme by id. */
export async function removeCustomTheme(id: string): Promise<void> {
  await removePersisted(id);
  setThemes(themes.filter((t) => t.id !== id));
}

/** Synchronous accessor for non-React code paths (e.g. export). */
export function getLoadedCustomThemes(): CustomTheme[] {
  return themes;
}
