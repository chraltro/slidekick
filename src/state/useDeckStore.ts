import { create } from 'zustand';
import type { ParsedDeck } from '@/slides/types';
import { parseDeck } from '@/slides/parser';

interface DeckState {
  deckId: string;
  title: string;
  source: string;
  parsed: ParsedDeck;
  dirty: boolean;
  lastSavedAt: number | null;

  setSource(src: string): void;
  setTitle(title: string): void;
  setDeckId(id: string): void;
  loadDeck(payload: { id: string; title: string; source: string }): void;
  markSaved(): void;
}

const DEFAULT_MARKDOWN = `---
title: Welcome to md-presentations
theme: catppuccin-mocha
font: Inter
mono: JetBrains Mono
aspect: 16:9
pageNumber: true
---

# md-presentations

## A PowerPoint alternative for the LLM era

# Why this exists

You can paste an outline from Claude or GPT, hit present, and stop fiddling with PPTX layouts.

- Live edit while presenting, audience sees changes in real time
- 17 polished themes, none of the auto-shrunk-text ugliness
- Self-contained HTML export, share offline, render anywhere

# Part 1

## Layouts

# Title layout

## Used for the first slide and section openers

# Content layout

The default. Renders headings, paragraphs, lists, links, and tables.

- A bullet
- Another bullet
- A [link](https://example.com)

# Two columns

<!-- layout: two-column -->

## Left

Use a single \`---\` inside the slide to split into two columns.

Each side renders its own Markdown independently.

---

## Right

Auto-detected when the renderer sees an inner separator.

You can also force it:

\`\`\`md
<!-- layout: two-column -->
\`\`\`

# Code focus

\`\`\`ts {2-3} title="server.ts" mac
import { serve } from 'std/http';
serve((req) => {
  return new Response('Hello, presentation!');
});
\`\`\`

# Quote layout

> Edit the markdown in this window.
> The audience window updates in real time.
>
> That is the whole pitch.

# Section break

## Auto-classified as section-divider when an H1 sits between content slides

# Part 2

## Features

# Math

Inline: $E = mc^2$. Block:

$$\\int_0^{\\infty} e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}$$

# Diagrams

\`\`\`mermaid
graph TD
  A[Markdown] --> B[Parser]
  B --> C[Slides]
  C --> D[Preview]
  C --> E[Audience]
  E -.edits.-> A
\`\`\`

# Bar chart

\`\`\`chart
type: bar
title: Quarterly revenue
data:
  Q1: 12
  Q2: 19
  Q3: 8
  Q4: 27
\`\`\`

# Line chart

\`\`\`chart
type: line
title: Growth
labels: [Jan, Feb, Mar, Apr, May, Jun]
series:
  Revenue: [10, 15, 14, 22, 30, 38]
  Profit: [2, 4, 5, 9, 14, 19]
\`\`\`

# Pie chart

\`\`\`chart
type: pie
title: Theme usage
data:
  Catppuccin Mocha: 38
  Tokyo Night: 22
  Dracula: 18
  Other: 22
\`\`\`

# Donut chart

\`\`\`chart
type: donut
title: Bundle composition
data:
  Application: 320
  Shiki grammars: 410
  Mermaid: 180
  KaTeX: 90
\`\`\`

# Stat tiles

:::stats
- **17** Themes
- **10** Layouts
- **<500KB** Bundle (no images)
- **0** Backend services
:::

# Callouts

:::tip
Prefer \`#\` over \`##\` for slide titles.
:::

:::warning Heads up
Don't put metadata comments inside fenced code blocks.
:::

:::info
KaTeX, Mermaid, and charts are pre-rendered on export.
:::

:::success
Autosave is on by default. Your work is in IndexedDB.
:::

# Compare layout

:::compare
## Before
- single CRUD table
- no audit trail
- one writer wins
- migrations rewrite history

## After
- append-only events
- complete audit trail
- projections decoupled from writes
- history is the source of truth
:::

# Timeline

:::timeline
- **2020** First sketch on a napkin
- **2022** Internal demo
- **2024** Open-sourced on GitHub
- **2025** Hits 1k stars
:::

# Inline icons

:icon[zap]: Fast · :icon[shield]: Secure · :icon[github]: Open source

:icon[git-branch]: Branchable · :icon[zap]: Hot reload · :icon[lock]: Local-first · :icon[heart]: Made with care

# Quote with attribution

> Edit the markdown in this window.
> The audience window updates in real time.
> -- That is the whole pitch.

This is the wedge. Everything else is supporting infrastructure for this single moment of feedback.

***

> A quote slide without a header. Use \`***\` on its own line to start a new slide without an H1.
>
> -- Anonymous

# Images

![A scenic mountain photo](https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&q=80)

# Image with caption

<!-- layout: image-left -->

![Sunlight through trees](https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&q=80)

## Image-left layout

When a slide contains one image plus some text, the renderer auto-detects \`image-left\` (or \`image-right\` if the image is last).

You can also force it with \`<!-- layout: image-left -->\`.

# Themes

<!-- layout: two-column -->

## 17 built in

- Catppuccin Mocha and Latte
- Tokyo Night
- Dracula
- Gruvbox Dark
- Nord
- Rose Pine
- One Dark
- Solarized Light

---

## Plus design-led

- Editorial Serif
- Brutalist Mono
- Minimal Sans
- Pastel Notebook
- Gradient Dawn
- Corporate Clean
- Academic Paper
- Midnight Terminal

# Speaker notes

<!-- notes: This text only appears in the presenter panel below the editor. Use it for cues that nobody else should see. -->

Add per-slide notes with an HTML comment:

\`\`\`md
<!-- notes: this stays private -->
\`\`\`

# Keyboard shortcuts

<!-- layout: two-column -->

## Editor

- \`Cmd/Ctrl + P\` present
- \`Cmd/Ctrl + Shift + P\` open audience
- \`Cmd/Ctrl + E\` export HTML
- \`Cmd/Ctrl + S\` save

---

## When presenting

- Arrow keys, space, PgUp/PgDn navigate
- \`B\` blank black, \`W\` blank white
- \`F\` fullscreen, \`Esc\` exit
- Number keys jump to slide N

# Live edit, while presenting

Click "Open Audience" in the toolbar. Drag the popup onto your second monitor. Share that window in Teams or Zoom.

Then keep editing. Every change syncs in real time.

# Export

\`Cmd/Ctrl + E\` produces a single self-contained HTML file:

- Code, math, and Mermaid pre-rendered
- Theme CSS inlined
- Images embedded as data URIs
- ~3KB navigation runtime

Open it offline. Anywhere.

# Thanks

## Questions?
`;

const initialDeck = parseDeck(DEFAULT_MARKDOWN);

export const useDeckStore = create<DeckState>((set) => ({
  deckId: 'default',
  title: 'Welcome to md-presentations',
  source: DEFAULT_MARKDOWN,
  parsed: initialDeck,
  dirty: false,
  lastSavedAt: null,

  setSource: (src) =>
    set(() => {
      const parsed = parseDeck(src);
      return {
        source: src,
        parsed,
        title: parsed.config.title ?? 'Untitled',
        dirty: true,
      };
    }),
  setTitle: (title) => set({ title, dirty: true }),
  setDeckId: (id) => set({ deckId: id }),
  loadDeck: ({ id, title, source }) =>
    set(() => {
      const parsed = parseDeck(source);
      return {
        deckId: id,
        title,
        source,
        parsed,
        dirty: false,
        lastSavedAt: Date.now(),
      };
    }),
  markSaved: () => set({ dirty: false, lastSavedAt: Date.now() }),
}));

export { DEFAULT_MARKDOWN };
