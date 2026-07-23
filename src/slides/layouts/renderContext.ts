import { createContext } from 'react';

/**
 * When true, slide layouts render their static markup but DO NOT kick off the
 * effect-driven enhancers (Shiki / KaTeX / Mermaid / icons / charts). The HTML
 * exporter renders slides with this flag set and runs the enhancers itself,
 * synchronously and awaited, so there is exactly one enhancement pass with no
 * race between React effects and the export pipeline.
 */
export const StaticRenderContext = createContext(false);

/**
 * Shiki theme for code blocks on the current slide, resolved from the deck
 * config by RenderSlide (frontmatter `codeTheme:` override → custom theme's
 * shikiTheme → the app theme's mapped default). EnhancedHtml consumes it so
 * the live preview highlights with the same theme the HTML export uses.
 */
export const CodeThemeContext = createContext('catppuccin-mocha');
