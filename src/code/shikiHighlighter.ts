import type { Highlighter } from 'shiki';
import { SHIKI_LANGS, SHIKI_THEMES } from './themeMap';

let highlighterPromise: Promise<Highlighter> | null = null;

export async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then(({ createHighlighter }) =>
      createHighlighter({
        themes: [...SHIKI_THEMES],
        langs: [...SHIKI_LANGS],
      }),
    );
  }
  return highlighterPromise;
}

export function isLangSupported(lang: string): boolean {
  return (SHIKI_LANGS as readonly string[]).includes(lang);
}
