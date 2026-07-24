import type { HighlighterCore } from 'shiki/core';
import { createHighlighterCore } from 'shiki/core';
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';
import { SHIKI_LANGS } from './themeMap';

let highlighterPromise: Promise<HighlighterCore> | null = null;

/**
 * Fine-grained Shiki highlighter: only the themes and language grammars the app
 * actually offers are imported. `import('shiki')` (the full bundle) pulls in
 * ~200 grammars as separate chunks — dead weight the PWA would precache (tens of
 * MB). Each grammar file below is self-contained (no transitive imports), so
 * this loads exactly what we ship. Aliases (ts→typescript, js→javascript,
 * bash/shell→shellscript, md→markdown, etc.) are registered by their canonical
 * grammar, so SHIKI_LANGS keeps working.
 */
export async function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [
        import('shiki/themes/catppuccin-mocha.mjs'),
        import('shiki/themes/catppuccin-latte.mjs'),
        import('shiki/themes/tokyo-night.mjs'),
        import('shiki/themes/dracula.mjs'),
        import('shiki/themes/github-light.mjs'),
        import('shiki/themes/github-dark.mjs'),
        import('shiki/themes/nord.mjs'),
        import('shiki/themes/rose-pine.mjs'),
        import('shiki/themes/one-dark-pro.mjs'),
        import('shiki/themes/solarized-light.mjs'),
        import('shiki/themes/min-light.mjs'),
        import('shiki/themes/min-dark.mjs'),
      ],
      langs: [
        import('shiki/langs/typescript.mjs'), // ts
        import('shiki/langs/tsx.mjs'),
        import('shiki/langs/javascript.mjs'), // js
        import('shiki/langs/jsx.mjs'),
        import('shiki/langs/python.mjs'),
        import('shiki/langs/rust.mjs'),
        import('shiki/langs/go.mjs'),
        import('shiki/langs/java.mjs'),
        import('shiki/langs/c.mjs'),
        import('shiki/langs/cpp.mjs'),
        import('shiki/langs/csharp.mjs'),
        import('shiki/langs/html.mjs'),
        import('shiki/langs/css.mjs'),
        import('shiki/langs/json.mjs'),
        import('shiki/langs/yaml.mjs'),
        import('shiki/langs/toml.mjs'),
        import('shiki/langs/shellscript.mjs'), // bash, sh, shell, zsh
        import('shiki/langs/sql.mjs'),
        import('shiki/langs/diff.mjs'),
        import('shiki/langs/markdown.mjs'), // md
      ],
      engine: createOnigurumaEngine(import('shiki/wasm')),
    });
  }
  return highlighterPromise;
}

export function isLangSupported(lang: string): boolean {
  return (SHIKI_LANGS as readonly string[]).includes(lang);
}
