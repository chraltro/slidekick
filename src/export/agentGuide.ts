// A comprehensive guide an LLM agent can paste into context to author decks
// for md-presentations. Lives as a string literal so it gets inlined without
// any extra fetch round-trip and ships in the offline PWA bundle.

export const AGENT_GUIDE = `# md-presentations — Agent Guide

This document is everything you need to write a complete, working
presentation for the md-presentations tool. Paste it into your context.
The output should be a single Markdown file. Nothing else is required.

---

## 1. File shape

A deck is one Markdown file. Optional YAML frontmatter at the top, then
slides separated by top-level \`#\` headings.

\`\`\`md
---
title: My Talk
theme: catppuccin-mocha
aspect: 16:9
pageNumber: true
---

# First slide title

## Optional subtitle (becomes the title-slide subtitle)

# Second slide

Body content goes here.
\`\`\`

### Slide-boundary rules (important — easy to get wrong)

- \`#\` (H1) at the start of a line **starts a new slide**. This is the
  ONLY default boundary.
- \`##\` (H2) does **NOT** start a new slide. It is in-slide content
  (subtitles, column headers, sub-sections).
- \`---\` on its own line does **NOT** start a new slide. It is reserved
  for the column separator inside two-column layouts.
- \`***\` on its own line **does** start a new slide. Use it only when you
  want a slide break without an H1 title.
- \`#\` lines inside fenced code blocks are ignored.

---

## 2. Frontmatter (deck-level config)

\`\`\`yaml
---
title: My Talk                        # browser tab title
theme: catppuccin-mocha               # see §10 for the full list
font: Inter                           # optional override (must be available)
mono: JetBrains Mono                  # optional mono override
aspect: 16:9                          # 16:9 | 4:3 | 1:1
transition: fade                      # fade | slide | none
pageNumber: true                      # show "N / Total" in slide footer
footer: My Conf 2025                  # optional running footer text
codeTheme: dracula                    # override Shiki theme; defaults to deck theme
autoAdvance: 8                        # auto-advance every N seconds (kiosk mode)
customCss: |
  .slide h1 { letter-spacing: -0.02em }
  .slide blockquote { border-left-width: 4px }
---
\`\`\`

All keys are optional except \`theme\` (which defaults to
\`catppuccin-mocha\` if omitted). \`customCss\` is injected into the slide
canvas — useful for one-off tweaks without authoring a full theme.

---

## 3. Per-slide metadata (HTML comments)

Place an HTML comment near the top of a slide to override behavior:

\`\`\`md
# How it works
<!-- layout: two-column; bg: #0a0a18; notes: remember to mention X -->

## Left column
...
\`\`\`

Semicolon-separated keys (case-insensitive):

| Key      | Values                                              | Effect                                     |
|----------|-----------------------------------------------------|--------------------------------------------|
| layout   | (see §4)                                            | Force a specific layout                    |
| bg       | any CSS color, gradient, or image url               | Slide background override                  |
| color    | any CSS color                                       | Text color override                        |
| class    | css class name                                      | Adds a custom class for use with customCss |
| align    | left / center / right                               | Text alignment                             |
| image    | url                                                 | Background image                           |
| notes    | speaker note text (any length, can span lines)      | Speaker notes (only visible to presenter)  |
| attribution | author name                                      | Attribution shown under a quote-layout slide |

You can also use a separate notes-only comment:

\`\`\`md
<!-- notes:
This is a multi-line speaker note.
Press tab in your editor to keep it tidy.
-->
\`\`\`

Comments inside fenced code blocks are treated as literal source, NOT as
metadata — so example syntax like \`\\\`\\\`\\\`md\` ... \`<!-- layout: ... -->\`
... \`\\\`\\\`\\\`\` will not be parsed as a directive.

---

## 4. Layouts (10 total)

The renderer auto-detects a layout from each slide's content shape. You
can always force one with \`<!-- layout: NAME -->\`.

| Name              | When auto-picked                                                 | Visual                                       |
|-------------------|------------------------------------------------------------------|----------------------------------------------|
| \`title\`         | First slide; H1+H2 only with no body                             | Big title + subtitle + accent bar            |
| \`content\`       | Default — anything not matching another rule                     | H1/H2 + body                                 |
| \`two-column\`    | Slide contains an inner \`---\` separator                        | Optional title spanning, content split L/R   |
| \`image-left\`    | One image + ≤4 text blocks, image FIRST                          | Image on left, text on right                 |
| \`image-right\`   | One image + ≤4 text blocks, image LAST                           | Text on left, image on right                 |
| \`full-image\`    | Exactly one image, no other content                              | Full-bleed image, alt becomes caption        |
| \`code-focus\`    | >50% of lines are inside fenced code                             | Heading + dominant code block                |
| \`quote\`         | Top-level blockquote + ≤1 other paragraph                        | Centered large italic quote + attribution    |
| \`section-divider\` | Lone H1 with no body, between content slides                   | Full-bleed accent-colored break              |
| \`end\`           | Last slide containing "thanks", "questions", "fin", or similar   | Big closing word + optional subtitle         |

### Layout-specific tips

**title** — use \`# Title\` then \`## Subtitle\` on the next non-blank line.
Don't add body content unless you want \`content\` instead.

**two-column** — write the slide as:

\`\`\`md
# Slide title (full-width header — optional)

## Left column
left content (markdown)

---

## Right column
right content (markdown)
\`\`\`

The first heading (H1 or H2) is hoisted to the full-width header row.
Everything before the inner \`---\` becomes the left column; everything
after becomes the right column.

**image-left / image-right** — write \`![alt](url)\` followed by some
text. Image first → image-left. Text first, image last → image-right.

**full-image** — put a single \`![alt](url)\` line as the only content.
The alt text becomes a caption pill in the bottom-left.

**code-focus** — \`# Heading\` then a fenced code block. The code block
fills the rest of the slide.

**quote** — \`# Heading\` (optional) then a blockquote. Each \`>\` line
renders as its own line on the slide (line breaks are preserved). For
attribution, start the last line with \`--\`, \`~\`, \`by \`, or use a
metadata comment.

\`\`\`md
# Optional title
> The actual quote.
> Multiple lines render as multiple lines.
> -- Author Name

# Or with metadata
<!-- attribution: Author Name -->
> The actual quote.
\`\`\`

**Quote without a header** — a slide doesn't have to start with \`#\`. Use
\`***\` on its own line as a slide separator and write the blockquote as
the entire slide:

\`\`\`md
# Some preceding slide

***

> A quote that stands alone, with no slide title.
> -- Author
\`\`\`

If there's prose after the blockquote on the same slide, it renders
underneath the attribution as supporting commentary.

**section-divider** — write \`# Section name\` with no body. If it sits
between two normal slides, it becomes a coloured break with large
centered text. If it sits AT the start, it's a title slide instead.

**end** — last slide. Use \`# Thanks\` or \`# Questions?\` or \`# Fin\`.

---

## 5. Code blocks

Backed by Shiki with VSCode TextMate grammars (high fidelity).

### Basic

\`\`\`md
\\\`\\\`\\\`ts
const x: number = 1
\\\`\\\`\\\`
\`\`\`

### Fence info string syntax

After the language, you can add flags and attributes in any order:

\`\`\`md
\\\`\\\`\\\`ts {2,4-7} title="server.ts" mac nums
import { serve } from 'std/http'
serve(req => new Response('hi'))
\\\`\\\`\\\`
\`\`\`

| Flag / attr      | Effect                                                           |
|------------------|------------------------------------------------------------------|
| \`{1,3-5}\`      | Highlights line 1, 3, 4, 5 (others are dimmed)                   |
| \`title="x.ts"\` | Adds a header bar with a title and macOS chrome                  |
| \`mac\`          | Adds the red/yellow/green window dots                            |
| \`nums\`         | Show line numbers                                                |
| \`diff-ts\`      | Use the \`diff-ts\` grammar (renders \`+\`/\`-\` line gutters)   |

### Supported languages

\`ts tsx js jsx python rust go java c cpp csharp html css json yaml toml
bash shell sql diff md\`

### Code-focus tip

Use \`<!-- layout: code-focus -->\` to make the code fill the slide. Or
let auto-detection handle it — a slide whose content is mostly a fenced
code block will pick code-focus automatically.

---

## 6. Math (KaTeX)

Inline: \`$E = mc^2$\`

Block (single line):

\`\`\`md
$$\\int_0^{\\infty} e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}$$
\`\`\`

Block (multi-line) is also supported:

\`\`\`md
$$
\\int_0^{\\infty} e^{-x^2}\\,dx
  = \\frac{\\sqrt{\\pi}}{2}
$$
\`\`\`

Backslashes are literal in the math source — no double-escaping needed.
KaTeX is pre-rendered on export, so the result is static HTML.

---

## 7. Diagrams (Mermaid)

Fence the diagram as \`mermaid\`:

\`\`\`md
\\\`\\\`\\\`mermaid
graph TD
  A[Markdown] --> B[Parser]
  B --> C[Slides]
  C --> D[Preview]
  C --> E[Audience]
  E -.edits.-> A
\\\`\\\`\\\`
\`\`\`

Mermaid renders to inline SVG. Use \`graph TD\` (top-down) for narrow
slides; \`graph LR\` is wider and works for short labels.

Supported types: flowchart (\`graph\`), sequence, class, state,
gantt, pie, ER, journey — anything Mermaid 11.x supports.

---

## 8. Lists, tables, fragments

### Standard lists

\`\`\`md
- bullet
- bullet
  - nested
1. ordered
2. ordered
\`\`\`

### Fragments (step-by-step reveal)

Prefix a list item with \`+ \` to make it a fragment that's hidden
until the presenter advances:

\`\`\`md
- always visible
+ revealed on first arrow press
+ revealed on second arrow press
+ revealed on third arrow press
\`\`\`

Arrow keys step through unrevealed fragments before advancing slides.

### Tables

Standard GFM tables work:

\`\`\`md
| Feature | Value |
|---------|-------|
| Layouts | 10    |
| Themes  | 17    |
\`\`\`

### Blockquotes

\`\`\`md
> The future is already here.
> It's just not evenly distributed.
\`\`\`

If a slide is mostly one blockquote, it auto-picks the \`quote\` layout.

### Links and images

\`\`\`md
[link text](https://example.com)
![alt text](https://example.com/photo.jpg)
\`\`\`

Images can be HTTP(S) URLs, data URIs, or local \`asset:HASH\` references
(produced when the user pastes an image into the editor).

---

## 8.5 Infographics (callouts, stats, compare, timeline, charts, icons)

### Callout boxes

\`\`\`md
:::tip
Always prefer \`#\` over \`##\` for slide titles.
:::

:::warning Look out
Don't put metadata comments inside code fences.
:::

:::info
KaTeX is pre-rendered on export.
:::
\`\`\`

Six callout types: \`tip\`, \`info\`, \`note\`, \`warning\`, \`danger\`, \`success\`. Optional title goes after the type name on the opening line.

### Stat / KPI grid

\`\`\`md
:::stats
- **1000+** Stars
- **17** Themes
- **10** Layouts
- **<500KB** Bundle
:::
\`\`\`

The first \`**bold**\` text on each line becomes the big number; the rest is the label. Auto-fits 1-4 columns based on count.

### Before / after comparison

\`\`\`md
:::compare
## Before
- single CRUD table
- no audit trail

## After
- append-only events
- full history
:::
\`\`\`

Two columns side-by-side. The first H2 turns red-tinted, the second green-tinted.

### Timeline

\`\`\`md
:::timeline
- **2020** Started building
- **2022** First public demo
- **2024** Open-sourced
:::
\`\`\`

Vertical timeline with dots and connector line. The first \`**bold**\` is highlighted as the date.

### Inline icons

\`:icon[name]:\` renders any [Lucide](https://lucide.dev) icon inline with the surrounding text:

\`\`\`md
:icon[zap]: Fast · :icon[shield]: Secure · :icon[github]: Open source
\`\`\`

Use \`kebab-case\` for multi-word names: \`:icon[git-branch]:\`, \`:icon[arrow-right]:\`.

### Charts

\`\`\`md
\\\`\\\`\\\`chart
type: bar
title: Q4 Revenue
data:
  Q1: 12
  Q2: 19
  Q3: 8
  Q4: 15
\\\`\\\`\\\`
\`\`\`

Supported types: \`bar\`, \`line\`, \`pie\`, \`donut\`. For multi-series line charts:

\`\`\`md
\\\`\\\`\\\`chart
type: line
title: Growth
labels: [Q1, Q2, Q3, Q4]
series:
  Revenue: [10, 15, 20, 28]
  Profit: [2, 4, 6, 11]
\\\`\\\`\\\`
\`\`\`

Charts render as inline SVG using theme colors automatically.

---

## 9. Speaker notes

Two equivalent ways:

\`\`\`md
<!-- notes: keep this short. Mention the customer story. -->
\`\`\`

Or as part of a structured comment:

\`\`\`md
<!-- layout: content; notes: keep this short -->
\`\`\`

Notes appear ONLY in the presenter panel under the editor. They are
never visible to the audience.

---

## 10. Themes (17 built-in)

Set with frontmatter \`theme: <id>\`. Each theme is a complete typography
+ palette + code-highlighting bundle.

**Developer dark / light**

\`catppuccin-mocha\` — purple-tinted dark, soft pastels (default)
\`catppuccin-latte\` — cream paper version
\`tokyo-night\` — deep navy, cyan/magenta accents
\`dracula\` — vivid pink/green on dark
\`gruvbox-dark\` — warm retro brown/orange
\`nord\` — cool desaturated frost
\`rose-pine\` — muted rose on warm dark wood
\`one-dark\` — Atom signature blue-grey
\`solarized-light\` — Schoonover beige scholarly
\`midnight-terminal\` — pure-black, mono everywhere, green accent

**Design-led**

\`editorial-serif\` — magazine style, generous leading
\`brutalist-mono\` — pure black/white, JetBrains Mono everywhere
\`minimal-sans\` — Inter, near-white, single accent under H1
\`pastel-notebook\` — graph-paper bg, Caveat headings
\`gradient-dawn\` — peach→lavender gradient, glassmorphic code
\`corporate-clean\` — navy + white, conservative
\`academic-paper\` — Computer Modern serif, two-column friendly

Pick a theme based on audience and content tone, not just personal
preference. Code-heavy talks → developer dark. Pitch decks →
\`gradient-dawn\` or \`corporate-clean\`. Academic → \`academic-paper\` or
\`editorial-serif\`.

---

## 11. Keyboard shortcuts (reference for your audience-facing slides)

| Shortcut             | Action                              |
|----------------------|-------------------------------------|
| \`Cmd/Ctrl + P\`     | Toggle present mode                 |
| \`Cmd/Ctrl + Shift+P\`| Open audience window               |
| \`Cmd/Ctrl + K\`     | Slide jumper (fuzzy search)         |
| \`Cmd/Ctrl + E\`     | Export self-contained HTML          |
| \`Cmd/Ctrl + S\`     | Save (autosave already on)          |
| Arrow keys, space    | Next / previous slide               |
| Home / End           | First / last slide                  |
| 1-9                  | Jump to slide N                     |
| \`O\`                | Overview grid                       |
| \`B\` / \`.\`        | Blank black                         |
| \`W\`                | Blank white                         |
| \`F\`                | Fullscreen                          |
| \`D\` (presenting)   | Drawing/laser overlay               |
| \`Esc\`              | Exit present / close panels         |

---

## 12. Worked example — full minimal deck

\`\`\`md
---
title: Migrating to event sourcing
theme: tokyo-night
aspect: 16:9
pageNumber: true
transition: fade
---

# Migrating to event sourcing

## What we learned shipping it to production

# The problem

<!-- notes: spend 30 seconds on the legacy CRUD pain -->

Every state change had to be reverse-engineered from the database.

- No audit trail
+ Auditors wanted one
+ Engineers wanted one even more

# The shape of the fix

<!-- layout: two-column -->

## Before

CRUD on a single table.

\\\`\\\`\\\`sql
UPDATE accounts SET balance = balance - 100 WHERE id = 1
\\\`\\\`\\\`

---

## After

Append-only events.

\\\`\\\`\\\`sql
INSERT INTO events (type, payload) VALUES ('Withdrew', '{"amount":100}')
\\\`\\\`\\\`

# How it flows

\\\`\\\`\\\`mermaid
graph TD
  A[Command] --> B[Aggregate]
  B --> C[Event store]
  C --> D[Projections]
  D --> E[Read models]
\\\`\\\`\\\`

# Math, briefly

Throughput is bounded by single-writer commits per aggregate:

$$T_{max} = \\frac{1}{\\Delta t_{commit}}$$

# Closing line

> Don't migrate to event sourcing because it's cool.
> Migrate because the audit trail is non-negotiable.

# Thanks

## Questions?
\`\`\`

---

## 13. Common author mistakes (avoid these)

- **Splitting on \`##\`** — H2 is in-slide content. Use \`#\` for new
  slides. If you find yourself with empty-feeling slides because every
  small section became its own slide, you're using \`##\` where \`#\`
  belongs.
- **Splitting on \`---\`** — \`---\` is for two-column layouts only. To
  force a slide break without a heading, use \`***\`.
- **Em-dashes inside quotes** — fine, but the \`quote\` layout treats a
  leading em-dash on the last line as the attribution and pulls it out.
  If you don't want attribution-extraction, don't start the last line
  with \`— \`, \`-- \`, \`–\`, or \`―\`.
- **Forgetting \`pageNumber: true\`** — most decks want page numbers.
- **Putting \`<!-- layout: ... -->\` inside an example code block** — the
  parser deliberately ignores comments inside fences, but if you're
  showing example syntax, escape backticks correctly so it parses.
- **Image overflow** — if an image is small but the slide forces
  full-image, it'll be stretched. Either provide a larger source or
  switch to \`image-left\`/\`image-right\`.
- **Fragments without lists** — the \`+ item\` fragment syntax only works
  on list items, not paragraphs.
- **Auto-advance with code-heavy slides** — readers need time to
  parse code. Either disable auto-advance for code-focused decks or
  set \`autoAdvance\` to a long interval (≥ 15 s).

---

## 14. Quick decision tree for layout choice

1. Is it the first slide and just a title (+ optional subtitle)? → \`title\`
2. Is it the last slide and says "thanks/questions/fin"? → \`end\`
3. Is it a single image with no text? → \`full-image\`
4. Is it a single image with a paragraph or two? → \`image-left\` (image
   first) or \`image-right\` (image last)
5. Is it dominated by code? → \`code-focus\`
6. Is it a famous quote with attribution? → \`quote\`
7. Does it open a major section with no body? → \`section-divider\`
8. Does it have two parallel ideas? → \`two-column\` (use inner \`---\`)
9. Otherwise → \`content\` (the default)

The auto-detector usually picks the right one. Override with
\`<!-- layout: NAME -->\` only when it doesn't.

---

## 15. Output checklist for an agent producing a deck

Before returning your final markdown:

- [ ] Frontmatter has \`theme\` and \`pageNumber\`.
- [ ] First slide is a clean title (\`# X\` then \`## Y\`, no body).
- [ ] Last slide is \`# Thanks\` or \`# Questions?\`.
- [ ] No \`##\` or \`---\` is used as an unintended slide break.
- [ ] Every code block has a language tag.
- [ ] Every image has a meaningful alt text.
- [ ] Speaker notes added where audience-only context would help.
- [ ] No slide is overstuffed — if a slide has more than ~6 bullets or
      ~80 words of body, split it.
- [ ] Mermaid diagrams use \`graph TD\` for narrow content.
- [ ] You've previewed roughly how each slide will lay out using §14.

Output the markdown only. No surrounding prose, no code fence around
the whole document — the user will paste it directly into the editor.
`;

export async function copyAgentGuide(): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(AGENT_GUIDE);
      return true;
    }
    // Fallback for older / restricted contexts
    const ta = document.createElement('textarea');
    ta.value = AGENT_GUIDE;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
