// Generates a 160-slide stress-test deck covering every layout, content type,
// and a battery of pathological edge cases. Output: tests/fixtures/stress-deck.md
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';

const __dir = dirname(fileURLToPath(import.meta.url));

// --- Minimal PNG encoder ---------------------------------------------------
// markdown-it's validateLink allows data:image/(png|gif|jpeg|webp) but blocks
// data:image/svg+xml (SVG-in-data-URI is an XSS vector). So image fixtures use
// real PNG data URIs, built here as a two-tone solid so they render offline.
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}
function pngDataUri(label, w = 32, h = 32, c1 = '#6d5dfc', c2 = '#f5c2e7') {
  void label;
  const [r1, g1, b1] = hex(c1);
  const [r2, g2, b2] = hex(c2);
  // raw: each row prefixed with filter byte 0, RGB pixels.
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let p = 0;
  for (let y = 0; y < h; y++) {
    raw[p++] = 0;
    const top = y < h / 2;
    for (let x = 0; x < w; x++) {
      raw[p++] = top ? r1 : r2;
      raw[p++] = top ? g1 : g2;
      raw[p++] = top ? b1 : b2;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return 'data:image/png;base64,' + png.toString('base64');
}

const slides = [];
const add = (s) => slides.push(s.trim());

// A tiny always-available inline image (real PNG data URI) so image layouts
// render deterministically offline. Encoded small (CSS object-fit scales it up)
// to keep the deck lightweight.
const IMG = (label, w = 800, h = 600, c1 = '#6d5dfc', c2 = '#f5c2e7') => {
  const maxDim = 96;
  const s = Math.min(1, maxDim / Math.max(w, h));
  return pngDataUri(label, Math.max(2, Math.round(w * s)), Math.max(2, Math.round(h * s)), c1, c2);
};

const lorem =
  'The quick brown fox jumps over the lazy dog while the parser tokenizes each heading, list item, and fenced block into a slide the renderer can lay out without reflowing the fixed canvas.';
const loremShort = 'Markdown in, browser-native slides out.';
const words = lorem.split(' ');
const para = (n) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push(words[i % words.length]);
  return out.join(' ') + '.';
};

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------
const frontmatter = `---
title: 160-Slide Rendering Stress Test
theme: catppuccin-mocha
font: Inter
mono: JetBrains Mono
aspect: 16:9
pageNumber: true
transition: fade
---`;

// ===========================================================================
// 1-8  Titles / sections / ends
// ===========================================================================
add(`# Rendering Stress Test\n\n## 160 slides · every layout · every edge case`);
add(`# A Very Long Title That Runs On And On To See How The Title Layout Handles An H1 With Far Too Many Words To Fit Comfortably On A Single Line`);
add(`# Short`);
add(`# Title + Subtitle\n\n## A subtitle that is itself quite long and descriptive, testing wrapping behaviour under the title layout with a secondary line of muted text`);
add(`# Section One\n\n<!-- layout: section-divider -->`);
add(`# A Section Divider With A Much Longer Heading That Must Wrap\n\n<!-- layout: section-divider -->`);
add(`# Thank You\n\n<!-- layout: end -->\n\n## Questions?`);
add(`# Unicode Title · 你好世界 · مرحبا · Здравствуйте · 🎉`);

// ===========================================================================
// 9-24  Content: text lengths
// ===========================================================================
add(`# Empty-ish Content\n\nJust one short line.`);
add(`# One Word\n\nHi.`);
add(`# Medium Paragraph\n\n${para(40)}`);
add(`# Long Paragraph\n\n${para(120)}`);
add(`# Very Long Paragraph\n\n${para(260)}`);
add(`# Extreme Wall Of Text\n\n${para(600)}`);
add(`# Multiple Paragraphs\n\n${para(30)}\n\n${para(30)}\n\n${para(30)}\n\n${para(30)}`);
add(`# Many Paragraphs\n\n${Array.from({ length: 12 }, (_, i) => `Paragraph ${i + 1}. ${para(18)}`).join('\n\n')}`);
add(`# Heading Only, No Body`);
add(`# Heading + H2 + text\n\n## Subhead\n\n${para(25)}`);
add(`# Long Unbreakable Token\n\nHere is a URL with no spaces: https://example.com/${'a'.repeat(180)}/end`);
add(`# Long Word\n\n${'Supercalifragilistic'.repeat(12)}`);
add(`# Mixed Emphasis\n\n${para(20)} **bold run of several words here** and *italic emphasis across words* and ***bold italic*** plus \`inline code token\` and ~~strikethrough~~.`);
add(`# Inline Code Heavy\n\nUse \`useState\`, \`useEffect\`, \`useMemo\`, \`useCallback\`, \`useRef\`, \`useReducer\`, \`useContext\`, \`useLayoutEffect\`, \`useImperativeHandle\`, \`useTransition\`, \`useDeferredValue\`, and \`useId\` from React.`);
add(`# Links Heavy\n\n${Array.from({ length: 8 }, (_, i) => `[Link number ${i + 1}](https://example.com/${i})`).join(' · ')}\n\n${para(20)}`);
add(`# HTML Entities & Escapes\n\nAmpersand &amp; less-than &lt; greater-than &gt; quote &quot; copyright © trademark ™ arrows → ← ↑ ↓ and math ≤ ≥ ≠ ∞ ∑ ∏.`);

// ===========================================================================
// 25-40  Lists
// ===========================================================================
add(`# Short List\n\n- One\n- Two\n- Three`);
add(`# Medium List\n\n${Array.from({ length: 7 }, (_, i) => `- Item ${i + 1}: ${para(8)}`).join('\n')}`);
add(`# Long List (20)\n\n${Array.from({ length: 20 }, (_, i) => `- List item number ${i + 1}`).join('\n')}`);
add(`# Huge List (40)\n\n${Array.from({ length: 40 }, (_, i) => `- Point ${i + 1}`).join('\n')}`);
add(`# List With Long Items\n\n${Array.from({ length: 6 }, (_, i) => `- ${para(30)}`).join('\n')}`);
add(`# Ordered List\n\n${Array.from({ length: 8 }, (_, i) => `${i + 1}. Step ${i + 1}: ${para(6)}`).join('\n')}`);
add(`# Deeply Nested List\n\n- Level 1\n  - Level 2\n    - Level 3\n      - Level 4\n        - Level 5\n          - Level 6\n- Another 1\n  - Nested 2\n    - Nested 3`);
add(`# Mixed Nested Ordered/Unordered\n\n1. First\n   - sub a\n   - sub b\n2. Second\n   1. deep one\n   2. deep two\n      - deeper\n3. Third`);
add(`# Task-ish List\n\n- [x] Done item\n- [ ] Todo item\n- [x] Another done\n- [ ] Pending with ${para(12)}`);
add(`# List + Paragraph + List\n\n${para(15)}\n\n- alpha\n- beta\n- gamma\n\n${para(15)}\n\n1. one\n2. two`);
add(`# Single Item List\n\n- Just the one`);
add(`# List Of Links\n\n${Array.from({ length: 10 }, (_, i) => `- [Resource ${i + 1}](https://example.com/${i})`).join('\n')}`);
add(`# Emoji List\n\n- 🚀 Fast\n- 🔒 Secure\n- 🎨 Themeable\n- 📦 Zero backend\n- ⚡ Live sync\n- 🧪 Tested`);
add(`# List With Code Items\n\n- Run \`npm install\`\n- Then \`npm run dev\`\n- Open \`http://localhost:5173\`\n- Build with \`npm run build\``);
add(`# Very Long Nested Explosion\n\n${Array.from({ length: 10 }, (_, i) => `- Top ${i + 1}\n  - child of ${i + 1}\n  - child two of ${i + 1}`).join('\n')}`);
add(`# List Items With Inline Math\n\n- Energy $E = mc^2$\n- Euler $e^{i\\pi} + 1 = 0$\n- Gauss $\\sum_{k=1}^n k = \\frac{n(n+1)}{2}$\n- Pythagoras $a^2 + b^2 = c^2$`);

// ===========================================================================
// 41-52  Tables
// ===========================================================================
add(`# Small Table\n\n| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |`);
add(`# Wide Table (8 cols)\n\n| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |\n|----|----|----|----|----|----|----|----|\n| aa | bb | cc | dd | ee | ff | gg | hh |\n| ii | jj | kk | ll | mm | nn | oo | pp |`);
add(`# Tall Table (15 rows)\n\n| # | Name | Value |\n|---|------|-------|\n${Array.from({ length: 15 }, (_, i) => `| ${i + 1} | Row ${i + 1} | ${(i + 1) * 100} |`).join('\n')}`);
add(`# Table Long Cells\n\n| Feature | Description |\n|---------|-------------|\n| Live editing | ${para(20)} |\n| Export | ${para(20)} |\n| Themes | ${para(20)} |`);
add(`# Wide + Tall Table\n\n| ID | Alpha | Beta | Gamma | Delta | Epsilon |\n|----|-------|------|-------|-------|---------|\n${Array.from({ length: 12 }, (_, i) => `| ${i + 1} | ${para(3)} | ${para(3)} | ${para(3)} | ${para(3)} | ${para(3)} |`).join('\n')}`);
add(`# Table With Alignment\n\n| Left | Center | Right |\n|:-----|:------:|------:|\n| a | b | c |\n| longer text | mid | 12345 |`);
add(`# Table With Code & Math\n\n| Symbol | Meaning | Code |\n|--------|---------|------|\n| $\\pi$ | pi | \`Math.PI\` |\n| $\\infty$ | infinity | \`Infinity\` |\n| $\\Sigma$ | sum | \`reduce\` |`);
add(`# Numeric Table\n\n| Quarter | Revenue | Cost | Profit | Margin |\n|---------|---------|------|--------|--------|\n| Q1 | 1200 | 800 | 400 | 33% |\n| Q2 | 1900 | 1100 | 800 | 42% |\n| Q3 | 800 | 700 | 100 | 12% |\n| Q4 | 2700 | 1400 | 1300 | 48% |`);
add(`# Single Column Table\n\n| Items |\n|-------|\n| First |\n| Second |\n| Third |\n| Fourth |`);
add(`# Table Then Text\n\n| K | V |\n|---|---|\n| x | 1 |\n| y | 2 |\n\n${para(20)}`);
add(`# Giant Table (25 rows x 5)\n\n| # | A | B | C | D |\n|---|---|---|---|---|\n${Array.from({ length: 25 }, (_, i) => `| ${i + 1} | ${i * 2} | ${i * 3} | ${i * 5} | ${i * 7} |`).join('\n')}`);
add(`# Table With Empty Cells\n\n| Name | Q1 | Q2 | Q3 |\n|------|----|----|----|\n| Alice | 5 |  | 8 |\n| Bob |  | 3 |  |\n| Cara | 1 | 2 | 3 |`);

// ===========================================================================
// 53-70  Code
// ===========================================================================
add(`# Short Code\n\n\`\`\`js\nconsole.log('hi');\n\`\`\``);
add(`# Code Focus (ts, mac, highlight)\n\n\`\`\`ts {2-3} title="server.ts" mac\nimport { serve } from 'std/http';\nserve((req) => {\n  return new Response('Hello, presentation!');\n});\n\`\`\``);
add(`# Long Code (40 lines)\n\n\`\`\`ts nums\n${Array.from({ length: 40 }, (_, i) => `const value${i} = compute(${i}, ${i * 2}, 'label-${i}');`).join('\n')}\n\`\`\``);
add(`# Very Long Code (44 lines)\n\n\`\`\`python nums\n${Array.from({ length: 44 }, (_, i) => `def func_${i}(x): return x * ${i} + ${i * i}`).join('\n')}\n\`\`\``);
add(`# Wide Code (long lines)\n\n\`\`\`js\nconst reallyLongVariableName = someFunction(withArgumentOne, withArgumentTwo, withArgumentThree, withArgumentFour, withArgumentFive, withArgumentSix, withArgumentSeven);\nexport default reallyLongVariableName.map((x) => x.transformInSomeVeryDescriptiveAndVerboseManner()).filter(Boolean).join(', ');\n\`\`\``);
add(`# Diff Code\n\n\`\`\`diff\n- const old = true;\n+ const next = false;\n  const shared = 1;\n- removeThis();\n+ addThis();\n\`\`\``);
add(`# Rust\n\n\`\`\`rust\nfn main() {\n    let v = vec![1, 2, 3];\n    let sum: i32 = v.iter().sum();\n    println!("sum = {}", sum);\n}\n\`\`\``);
add(`# Go\n\n\`\`\`go\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("hello")\n}\n\`\`\``);
add(`# SQL\n\n\`\`\`sql\nSELECT id, name, COUNT(*) AS n\nFROM events\nWHERE created_at > NOW() - INTERVAL '7 days'\nGROUP BY id, name\nORDER BY n DESC\nLIMIT 10;\n\`\`\``);
add(`# Bash\n\n\`\`\`bash\n#!/usr/bin/env bash\nset -euo pipefail\nfor f in *.md; do\n  echo "processing $f"\ndone\n\`\`\``);
add(`# JSON\n\n\`\`\`json\n{\n  "name": "md-presentations",\n  "version": "0.1.0",\n  "themes": 17,\n  "layouts": 10\n}\n\`\`\``);
add(`# HTML\n\n\`\`\`html\n<div class="slide">\n  <h1>Title</h1>\n  <p>Body</p>\n</div>\n\`\`\``);
add(`# CSS\n\n\`\`\`css\n.slide-canvas {\n  width: 1920px;\n  height: 1080px;\n  overflow: hidden;\n}\n\`\`\``);
add(`# Code + Text Around\n\nBefore the code:\n\n\`\`\`js\nconst x = 1;\n\`\`\`\n\nAfter the code, ${para(15)}`);
add(`# Two Code Blocks\n\n\`\`\`js\nconst a = 1;\n\`\`\`\n\n\`\`\`js\nconst b = 2;\n\`\`\``);
add(`# Code No Language\n\n\`\`\`\nplain preformatted text\n  indented line\n    more indented\n\`\`\``);
add(`# Code With Highlights + Numbers\n\n\`\`\`ts {1,3,5} nums title="highlights.ts"\nconst a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\nconst e = 5;\n\`\`\``);
add(`# Extreme Code (48 lines)\n\n\`\`\`js nums\n${Array.from({ length: 48 }, (_, i) => `line${i}();`).join('\n')}\n\`\`\``);

// ===========================================================================
// 71-80  Math
// ===========================================================================
add(`# Inline Math\n\nEinstein: $E = mc^2$, Euler: $e^{i\\pi}+1=0$, and the quadratic formula $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$.`);
add(`# Block Math\n\n$$\\int_0^{\\infty} e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}$$`);
add(`# Multiple Block Math\n\n$$a^2 + b^2 = c^2$$\n\n$$\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}$$\n\n$$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$$`);
add(`# Long Equation\n\n$$f(x) = a_0 + \\sum_{n=1}^{\\infty}\\left(a_n \\cos\\frac{n\\pi x}{L} + b_n \\sin\\frac{n\\pi x}{L}\\right)$$`);
add(`# Matrix\n\n$$\\begin{bmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{bmatrix} \\begin{bmatrix} x \\\\ y \\\\ z \\end{bmatrix} = \\begin{bmatrix} p \\\\ q \\\\ r \\end{bmatrix}$$`);
add(`# Math + Text + List\n\nThe series converges:\n\n$$\\sum_{n=0}^{\\infty} \\frac{1}{2^n} = 2$$\n\n- Ratio test applies\n- Geometric with $r = 1/2$\n- Bounded above`);
add(`# Aligned Equations\n\n$$\\begin{aligned} (a+b)^2 &= a^2 + 2ab + b^2 \\\\ (a-b)^2 &= a^2 - 2ab + b^2 \\end{aligned}$$`);
add(`# Fraction Heavy\n\n$$\\frac{\\frac{1}{a} + \\frac{1}{b}}{\\frac{1}{c} - \\frac{1}{d}} = \\frac{cd(a+b)}{ab(d-c)}$$`);
add(`# Greek + Symbols\n\n$$\\alpha\\beta\\gamma\\delta\\epsilon\\zeta\\eta\\theta\\iota\\kappa\\lambda\\mu\\nu\\xi\\pi\\rho\\sigma\\tau\\phi\\chi\\psi\\omega \\quad \\nabla \\cdot \\vec{E} = \\frac{\\rho}{\\epsilon_0}$$`);
add(`# Broken Math (graceful)\n\n$$\\frac{\\unknowncommand{x}}{\\notreal}$$\n\nAn invalid TeX expression should degrade, not crash the slide.`);

// ===========================================================================
// 81-92  Mermaid
// ===========================================================================
add(`# Mermaid Flowchart LR\n\n\`\`\`mermaid\ngraph LR\n  A[Markdown] --> B[Parser]\n  B --> C[Slides]\n  C --> D[Preview]\n  C --> E[Audience]\n  E -.edits.-> A\n\`\`\``);
add(`# Mermaid Flowchart TD\n\n\`\`\`mermaid\ngraph TD\n  Start --> Decide{Fits?}\n  Decide -->|Yes| Render\n  Decide -->|No| PickLayout\n  PickLayout --> Render\n  Render --> Done\n\`\`\``);
add(`# Mermaid Sequence\n\n\`\`\`mermaid\nsequenceDiagram\n  participant Editor\n  participant Channel\n  participant Audience\n  Editor->>Channel: edit\n  Channel->>Audience: patch\n  Audience-->>Editor: ack\n\`\`\``);
add(`# Mermaid Class\n\n\`\`\`mermaid\nclassDiagram\n  class Deck {\n    +slides\n    +config\n    +parse()\n  }\n  class Slide {\n    +layout\n    +html\n  }\n  Deck --> Slide\n\`\`\``);
add(`# Mermaid State\n\n\`\`\`mermaid\nstateDiagram-v2\n  [*] --> Editing\n  Editing --> Presenting: Cmd+P\n  Presenting --> Editing: Esc\n  Presenting --> [*]\n\`\`\``);
add(`# Mermaid Pie\n\n\`\`\`mermaid\npie title Theme usage\n  "Mocha" : 38\n  "Tokyo" : 22\n  "Dracula" : 18\n  "Other" : 22\n\`\`\``);
add(`# Mermaid Gantt\n\n\`\`\`mermaid\ngantt\n  title Roadmap\n  dateFormat YYYY-MM-DD\n  section Core\n  Parser :a1, 2024-01-01, 30d\n  Layouts :a2, after a1, 20d\n  section Polish\n  Themes :2024-03-01, 25d\n\`\`\``);
add(`# Mermaid Large Graph\n\n\`\`\`mermaid\ngraph TD\n${Array.from({ length: 12 }, (_, i) => `  N${i} --> N${i + 1}`).join('\n')}\n  N6 --> N12\n  N3 --> N9\n\`\`\``);
add(`# Mermaid Wide Graph\n\n\`\`\`mermaid\ngraph LR\n  A --> B --> C --> D --> E --> F --> G --> H --> I --> J\n\`\`\``);
add(`# Mermaid ER\n\n\`\`\`mermaid\nerDiagram\n  DECK ||--o{ SLIDE : contains\n  SLIDE ||--o{ BLOCK : has\n  DECK { string title }\n  SLIDE { string layout }\n\`\`\``);
add(`# Mermaid + Text\n\nThe pipeline:\n\n\`\`\`mermaid\ngraph LR\n  In --> Out\n\`\`\``);
add(`# Broken Mermaid (graceful)\n\n\`\`\`mermaid\ngraph LR\n  A -->\n  this is not valid mermaid syntax @@@\n\`\`\``);

// ===========================================================================
// 93-104  Charts
// ===========================================================================
add(`# Bar Chart\n\n\`\`\`chart\ntype: bar\ntitle: Quarterly revenue\ndata:\n  Q1: 12\n  Q2: 19\n  Q3: 8\n  Q4: 27\n\`\`\``);
add(`# Line Chart Multi-series\n\n\`\`\`chart\ntype: line\ntitle: Growth\nlabels: [Jan, Feb, Mar, Apr, May, Jun]\nseries:\n  Revenue: [10, 15, 14, 22, 30, 38]\n  Profit: [2, 4, 5, 9, 14, 19]\n\`\`\``);
add(`# Pie Chart\n\n\`\`\`chart\ntype: pie\ntitle: Share\ndata:\n  A: 40\n  B: 30\n  C: 20\n  D: 10\n\`\`\``);
add(`# Donut Chart\n\n\`\`\`chart\ntype: donut\ntitle: Bundle\ndata:\n  App: 320\n  Grammars: 410\n  Mermaid: 180\n  KaTeX: 90\n\`\`\``);
add(`# Bar Many Categories\n\n\`\`\`chart\ntype: bar\ntitle: Monthly\ndata:\n${Array.from({ length: 12 }, (_, i) => `  M${i + 1}: ${Math.round(10 + 40 * Math.abs(Math.sin(i)))}`).join('\n')}\n\`\`\``);
add(`# Line Many Points\n\n\`\`\`chart\ntype: line\ntitle: Signal\nlabels: [${Array.from({ length: 20 }, (_, i) => `t${i}`).join(', ')}]\nseries:\n  Value: [${Array.from({ length: 20 }, (_, i) => Math.round(50 + 40 * Math.sin(i / 2))).join(', ')}]\n\`\`\``);
add(`# Chart + Text\n\nRevenue trend below:\n\n\`\`\`chart\ntype: bar\ndata:\n  A: 5\n  B: 12\n  C: 7\n\`\`\``);
add(`# Pie Many Slices\n\n\`\`\`chart\ntype: pie\ntitle: Languages\ndata:\n${['TS', 'JS', 'CSS', 'HTML', 'Rust', 'Go', 'Py', 'SQL'].map((k, i) => `  ${k}: ${5 + i * 3}`).join('\n')}\n\`\`\``);
add(`# Chart Long Labels\n\n\`\`\`chart\ntype: bar\ntitle: Departments\ndata:\n  Engineering and Platform: 45\n  Product and Design Systems: 30\n  Customer Success Operations: 25\n\`\`\``);
add(`# Chart Single Value\n\n\`\`\`chart\ntype: bar\ndata:\n  Only: 42\n\`\`\``);
add(`# Chart Big Numbers\n\n\`\`\`chart\ntype: bar\ntitle: Users\ndata:\n  2021: 1200000\n  2022: 3400000\n  2023: 8900000\n\`\`\``);
add(`# Broken Chart (graceful)\n\n\`\`\`chart\ntype: nonsense\nthis: is not: valid: yaml: at all: [\n\`\`\``);

// ===========================================================================
// 105-116  Callouts / infographics
// ===========================================================================
add(`# Tip Callout\n\n:::tip\nPrefer \`#\` over \`##\` for slide titles.\n:::`);
add(`# All Callout Types\n\n:::tip\nA tip.\n:::\n\n:::warning\nA warning.\n:::\n\n:::info\nSome info.\n:::\n\n:::danger\nDanger ahead.\n:::`);
add(`# Callout With Title\n\n:::warning Heads up\nDon't put metadata comments inside fenced code blocks.\n:::`);
add(`# Long Callout\n\n:::note\n${para(60)}\n:::`);
add(`# Stacked Callouts (6)\n\n:::tip\nTip\n:::\n\n:::info\nInfo\n:::\n\n:::note\nNote\n:::\n\n:::warning\nWarning\n:::\n\n:::danger\nDanger\n:::\n\n:::success\nSuccess\n:::`);
add(`# Stats 4\n\n:::stats\n- **17** Themes\n- **10** Layouts\n- **<500KB** Bundle\n- **0** Backends\n:::`);
add(`# Stats 8\n\n:::stats\n- **1** One\n- **2** Two\n- **3** Three\n- **4** Four\n- **5** Five\n- **6** Six\n- **7** Seven\n- **8** Eight\n:::`);
add(`# Stats Long Labels\n\n:::stats\n- **99.99%** Uptime across all monitored regions worldwide\n- **12ms** Median render latency for a full deck reflow\n- **3.2M** Monthly active presenters and counting\n:::`);
add(`# Compare\n\n:::compare\n## Before\n- single CRUD table\n- no audit trail\n- one writer wins\n\n## After\n- append-only events\n- complete audit trail\n- history is truth\n:::`);
add(`# Compare Long\n\n:::compare\n## Before\n${Array.from({ length: 8 }, (_, i) => `- old point ${i + 1}`).join('\n')}\n\n## After\n${Array.from({ length: 8 }, (_, i) => `- new point ${i + 1}`).join('\n')}\n:::`);
add(`# Timeline\n\n:::timeline\n- **2020** First sketch on a napkin\n- **2022** Internal demo\n- **2024** Open-sourced on GitHub\n- **2025** Hits 1k stars\n:::`);
add(`# Timeline Long\n\n:::timeline\n${Array.from({ length: 8 }, (_, i) => `- **20${20 + i}** ${para(14)}`).join('\n')}\n:::`);

// ===========================================================================
// 117-126  Quotes
// ===========================================================================
add(`# Short Quote\n\n> Simplicity is the ultimate sophistication.`);
add(`# Quote With Attribution\n\n> Edit the markdown in this window. The audience window updates in real time.\n>\n> -- The whole pitch`);
add(`# Long Quote\n\n> ${para(60)}\n>\n> -- Someone Verbose`);
add(`# Multi-paragraph Quote\n\n> First paragraph of the quote sets the scene.\n>\n> Second paragraph delivers the punchline.\n>\n> -- Author Name`);
add(`***\n\n> A quote slide with no header, started via three asterisks.\n>\n> -- Anonymous`);
add(`# Quote + Commentary\n\n> The best interface is no interface.\n>\n> -- Golden Krishna\n\n${para(20)}`);
add(`# Nested Blockquote\n\n> Outer quote begins here.\n>\n> > Nested inner quote.\n>\n> Back to outer.`);
add(`# Quote Heavy Punctuation\n\n> "Why?" she asked. "Because," he said, "it's — well — complicated; isn't it?"`);
add(`# Very Long Quote Overflow Test\n\n> ${para(150)}\n>\n> -- The Overflow Tester`);
add(`# Quote CJK\n\n> 千里之行，始于足下。\n>\n> -- 老子`);

// ===========================================================================
// 127-138  Images
// ===========================================================================
add(`# Full Image\n\n![Full bleed](${IMG('FULL', 1920, 1080)})`);
add(`# Full Image With Caption\n\n<!-- layout: full-image -->\n\n![A caption that describes the full-bleed background image in some detail](${IMG('CAPTION', 1920, 1080, '#f38ba8', '#fab387')})`);
add(`# Image Left\n\n<!-- layout: image-left -->\n\n![Left](${IMG('LEFT', 900, 1000, '#94e2d5', '#89b4fa')})\n\n## Image on the left\n\n${para(30)}`);
add(`# Image Right\n\n<!-- layout: image-right -->\n\n## Image on the right\n\n${para(30)}\n\n![Right](${IMG('RIGHT', 900, 1000, '#f9e2af', '#f38ba8')})`);
add(`# Image + Long Body\n\n<!-- layout: image-left -->\n\n![Pic](${IMG('PIC', 900, 1000)})\n\n## Details\n\n${para(80)}`);
add(`# Tall Image\n\n![Tall](${IMG('TALL', 600, 1400, '#cba6f7', '#f5c2e7')})`);
add(`# Wide Image\n\n![Wide](${IMG('WIDE', 2400, 500, '#a6e3a1', '#94e2d5')})`);
add(`# Small Image\n\n![Small](${IMG('SM', 200, 150)})\n\n${para(15)}`);
add(`# Broken Remote Image (graceful)\n\n![missing](https://invalid.invalid/nope-${Date.now ? 'x' : 'x'}.png)\n\nA broken image URL must not break the layout.`);
add(`# Two Images\n\n![One](${IMG('1', 600, 400)}) ![Two](${IMG('2', 600, 400, '#f38ba8', '#f9e2af')})`);
add(`# Image + Code\n\n![Diag](${IMG('DIAG', 800, 400)})\n\n\`\`\`js\nconst x = renderImage();\n\`\`\``);
add(`# Image Then List\n\n![Header](${IMG('HDR', 1600, 400)})\n\n- First takeaway\n- Second takeaway\n- Third takeaway`);

// ===========================================================================
// 139-150  Two-column
// ===========================================================================
add(`# Two Column Balanced\n\n<!-- layout: two-column -->\n\n## Left\n\n${para(20)}\n\n---\n\n## Right\n\n${para(20)}`);
add(`# Two Column Lists\n\n<!-- layout: two-column -->\n\n## Pros\n\n- fast\n- simple\n- offline\n\n---\n\n## Cons\n\n- new\n- niche\n- opinionated`);
add(`# Two Column Unbalanced\n\n<!-- layout: two-column -->\n\n## Tiny\n\nOne line.\n\n---\n\n## Huge\n\n${para(80)}`);
add(`# Two Column Code Left\n\n<!-- layout: two-column -->\n\n## Code\n\n\`\`\`js\nconst a = 1;\nconst b = 2;\n\`\`\`\n\n---\n\n## Explanation\n\n${para(25)}`);
add(`# Two Column Both Long\n\n<!-- layout: two-column -->\n\n## Left Side\n\n${para(50)}\n\n---\n\n## Right Side\n\n${para(50)}`);
add(`# Two Column Auto (no directive)\n\n## Left auto\n\n${para(15)}\n\n---\n\n## Right auto\n\n${para(15)}`);
add(`# Two Column With Math\n\n<!-- layout: two-column -->\n\n## Formula\n\n$$E = mc^2$$\n\n---\n\n## Meaning\n\nMass and energy are equivalent.`);
add(`# Two Column Nested Lists\n\n<!-- layout: two-column -->\n\n## Frontend\n\n- React\n  - hooks\n  - context\n- Vite\n\n---\n\n## Backend\n\n- None\n  - local-first\n  - IndexedDB`);
add(`# Two Column Long Lists\n\n<!-- layout: two-column -->\n\n## Column A\n\n${Array.from({ length: 12 }, (_, i) => `- a-item ${i + 1}`).join('\n')}\n\n---\n\n## Column B\n\n${Array.from({ length: 12 }, (_, i) => `- b-item ${i + 1}`).join('\n')}`);
add(`# Two Column Images\n\n<!-- layout: two-column -->\n\n## Before\n\n![b](${IMG('B', 700, 500, '#f38ba8', '#fab387')})\n\n---\n\n## After\n\n![a](${IMG('A', 700, 500, '#a6e3a1', '#94e2d5')})`);
add(`# Two Column Table\n\n<!-- layout: two-column -->\n\n## Data\n\n| X | Y |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n\n---\n\n## Notes\n\n${para(20)}`);
add(`# Two Column Callouts\n\n<!-- layout: two-column -->\n\n## Do\n\n:::success\nCommit often\n:::\n\n---\n\n## Don't\n\n:::danger\nForce push main\n:::`);

// ===========================================================================
// 151-160  Mixed / meta / stress
// ===========================================================================
add(`# Inline Icons\n\n:icon[zap]: Fast · :icon[shield]: Secure · :icon[github]: Open source · :icon[heart]: Loved`);
add(`# Fragments\n\n- Always visible\n- + Revealed on step one\n- + Revealed on step two\n- + Revealed on step three`);
add(`# Custom Background\n\n<!-- bg: #1a1a2e; color: #e0e0ff -->\n\nThis slide overrides its background and text colour via metadata.\n\n${para(15)}`);
add(`# Everything At Once\n\n## Kitchen sink\n\n${para(12)}\n\n- bullet with $x^2$\n- bullet with \`code\`\n\n:::tip\nA callout too.\n:::`);
add(`# Heading Hierarchy\n\n## H2 heading\n\n### H3 heading\n\n#### H4 heading\n\n${para(15)}`);
add(`# Horizontal Rules As Content\n\nAbove the rule.\n\n---\n\nBelow the rule.`);
add(`# RTL Text\n\nArabic: مرحبا بالعالم هذا نص تجريبي للتأكد من أن النص من اليمين إلى اليسار يظهر بشكل صحيح.\n\nHebrew: שלום עולם זהו טקסט לבדיקה.`);
add(`# CJK Dense\n\n日本語のテキスト。これはスライドが日本語の文字を正しくレンダリングできることを確認するためのテストです。中文文本用于测试。한국어 텍스트도 포함됩니다.`);
add(`# Special Characters\n\n\`\`\`\n\\ / | < > & " ' \` ~ ! @ # $ % ^ * ( ) _ + = { } [ ] : ; , . ?\n\`\`\`\n\nAnd inline: <not a tag> & \`\`backtick\`\` handling.`);
add(`# The End\n\n<!-- layout: end -->\n\n## 160 slides, all rendered`);

// ---------------------------------------------------------------------------
if (slides.length !== 160) {
  console.error(`Expected 160 slides, got ${slides.length}`);
}

const deck = frontmatter + '\n\n' + slides.join('\n\n');
mkdirSync(__dir, { recursive: true });
writeFileSync(join(__dir, 'stress-deck.md'), deck, 'utf8');
console.log(`Wrote stress-deck.md with ${slides.length} slides, ${deck.length} chars`);
