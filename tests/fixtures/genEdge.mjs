// Adversarial edge-case deck: content designed to break parsers/renderers,
// not just "a lot of content". Output: tests/fixtures/edge-deck.md
// Deck-corrupting cases (bad frontmatter, unclosed fences, BOM/CRLF, empty
// decks) are tested separately in the harness as isolated mini-decks.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const slides = [];
const add = (title, body) => slides.push(`# ${title}\n\n${body}`.trim());
const addRaw = (raw) => slides.push(raw.trim());

// ---- Unicode / text torture ------------------------------------------------
const zalgo = 'Z̸̧̢̛̬͓̮̩̙̳͈̗̠̜̬̀͊̈́͛̐̏̽͛̍̕a̵̢̧̛̬͖̙̯̰̳̻̜͖ĺ̶̢̛̤̬͇̮g̷̢̛̬͓̮o̶̡̧̬͖̙ ' .repeat(3);
add('Zalgo Combining Marks', `Combining diacritics that stack far above/below the line:\n\n${zalgo}\n\nDoes it clip or overflow the line box?`);
add('Bidi Override', `Left-to-right then an RLO override: ‮gnirts desrever a si sihT‬ back to normal. And a spoof: file‮gpj.exe`);
add('Zero-Width & Control', `Zero-width​space‌and‍joiners, word⁠joiner, and soft­hyphens all in one line to see if they wreck spacing.`);
add('Emoji ZWJ & Modifiers', `Family: 👨‍👩‍👧‍👦 · Skin tones: 👍🏻👍🏽👍🏿 · Flags: 🇺🇳🇯🇵🏴󠁧󠁢󠁳󠁣󠁴󠁿 · Keycaps: 1️⃣2️⃣3️⃣ · Profession: 🧑‍💻👩‍🚀`);
add('Full-Width & Vertical', `Ｆｕｌｌｗｉｄｔｈ　ＡＳＣＩＩ．　ﾊﾝｶｸ katakana. 縦書きテスト。​`);
add('RTL Mixed Numbers', `Arabic with numbers: قيمة 12345 و 67890 مع نص إنجليزي English inline ثم عربي مرة أخرى.`);
add('Long Unbreakable', `${'x'.repeat(2000)}`);
add('Long Emoji Run', `${'🎉'.repeat(400)}`);
add('Combining Explosion', `${'á̂̃̄̅'.repeat(300)}`);
add('NBSP And Spaces', `a    b  c  d normal e   f (regular collapsed).`);

// ---- Markdown escape / emphasis torture ------------------------------------
add('Escape Soup', String.raw`Literal backslash \\ then \*not italic\* and \_not emphasis\_ and \# not heading and \[not link\] and \`not code\` and \~\~not strike\~\~.`);
add('Nested Emphasis', `***bold italic*** and **bold *nested italic* back** and *italic **nested bold** back* and ***a**b*c and _under **mixed** score_.`);
add('Intraword Underscores', `snake_case_variable_name and my_long_python_function_name_here and a__b__c and file_v1_final_FINAL.txt`);
add('Special Char Soup', String.raw`Every special: \ / | < > & " ' ${'`'} ~ ! @ # $ % ^ & * ( ) _ + = { } [ ] : ; , . ? and <not-a-tag> &notanentity; &amp; &#x1F600;`);
add('Asterisk Storm', `*a* **b** ***c*** * d * ** e ** *** f *** *** *** * * * ***`);
add('Pipe Characters', `Inline pipes a|b|c and \\| escaped and code \`a|b\` outside a table.`);

// ---- Headings edge ---------------------------------------------------------
addRaw(`#\n\nA slide whose H1 is empty (just a hash).`);
addRaw(`# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6\n\nAll six heading levels on one slide.`);
addRaw(`# Trailing Hashes ###\n\nATX heading with closing hashes.`);
addRaw(`Setext H1\n=========\n\nSetext H2\n---------\n\nUnderlined headings (may or may not be supported).`);
addRaw(`#NoSpace\n\n#alsonospace — these are NOT headings without a space; should render as text.`);

// ---- Lists edge ------------------------------------------------------------
add('Empty List Items', `- \n- item\n- \n- another\n-`);
add('Deep Nest 10', Array.from({length:10},(_,i)=>`${'  '.repeat(i)}- level ${i+1}`).join('\n'));
add('Ordered Huge Start', `997. nine ninety seven\n998. nine ninety eight\n999. nine ninety nine`);
add('Loose vs Tight', `- tight one\n- tight two\n\n- loose one\n\n- loose two`);
addRaw(`# Mixed Markers\n\n- dash\n* star\n+ plus\n1. one\n2) two-paren`);

// ---- Blockquotes edge ------------------------------------------------------
add('Deep Blockquote', Array.from({length:8},(_,i)=>'>'.repeat(i+1)+' level '+(i+1)).join('\n'));
add('Blockquote Kitchen Sink', `> A quote with a list:\n> - one\n> - two\n>\n> \`\`\`js\n> const inQuote = true;\n> \`\`\`\n>\n> | a | b |\n> |---|---|\n> | 1 | 2 |`);

// ---- Tables edge -----------------------------------------------------------
add('Ragged Table', `| a | b | c |\n|---|---|---|\n| 1 |\n| 1 | 2 | 3 | 4 | 5 |\n| only one |`);
add('Table No Body', `| head1 | head2 |\n|-------|-------|`);
addRaw(`# Table Missing Separator\n\n| a | b |\n| 1 | 2 |\n\nWithout a header separator row this is not a table.`);
add('Table Pipes & Code', `| expr | note |\n|------|------|\n| \`a\\|\\|b\` | logical or |\n| \\| | literal pipe |\n| a\\|b | escaped |`);
add('Table Empty Cells', `| x | y | z |\n|---|---|---|\n|   |   |   |\n| a |   | c |`);
add('Table 40 Columns', `${Array.from({length:40},(_,i)=>'c'+i).join(' | ')}\n${Array.from({length:40},()=>'---').join('|')}\n${Array.from({length:40},(_,i)=>i).join(' | ')}`);

// ---- Code fences edge (contained — closed within the slide) ----------------
add('Empty Code Block', '```\n```');
add('Code Backticks Inside', '````md\n```js\nnested fence\n```\n````');
add('Tilde Fence', '~~~python\nprint("tilde fence")\n~~~');
add('Fence Weird Lang', '```this-is-not-a-real-language-name-12345\nsome content\n```');
add('Code Only Whitespace', '```\n    \n\t\n   \n```');
add('Code With Long Line', '```js\nconst x = "'+'y'.repeat(1000)+'";\n```');
add('Code HTML & Special', '```html\n<script>alert(1)</script>\n<div class="x">&amp; &lt; &gt;</div>\n```');

// ---- Raw HTML + XSS (must NOT execute; must NOT wreck layout) ---------------
add('Raw HTML Block', `<div style="padding:2rem;border:2px solid red">Raw HTML div with inline style.</div>\n\n<table><tr><td>raw</td><td>table</td></tr></table>`);
add('XSS Script Tag', `Before.\n\n<script>window.__xss_script=1;document.title='pwned'</script>\n\nAfter — the script must not run.`);
add('XSS Img Onerror', `<img src="x-does-not-exist.png" onerror="window.__xss_img=1" alt="broken with handler">\n\nThe onerror handler must not fire arbitrary code.`);
add('XSS SVG Onload', `<svg onload="window.__xss_svg=1"><rect width="10" height="10"/></svg>\n\nSVG onload must not run.`);
add('XSS Javascript Link', `[click me](javascript:window.__xss_link=1) and <a href="javascript:window.__xss_a=1">raw anchor</a>.`);
add('XSS Iframe', `<iframe src="javascript:window.__xss_iframe=1" width="200" height="100"></iframe>\n\nIframe injection.`);
add('HTML Style Injection', `<style>.slide-canvas{display:none!important}</style>\n\nA style tag trying to hide the whole slide must not nuke rendering.`);

// ---- Math edge -------------------------------------------------------------
add('Currency Not Math', `The plan costs $5 today and $10 tomorrow, a $5 to $10 range, so $$ is money not math here.`);
add('Empty Math', `Inline empty $$ and block:\n\n$$\n$$\n\nShould degrade, not crash.`);
add('Unclosed Inline Math', `Here is an unclosed $x = y + z and then normal text continues on the line.`);
add('Dangerous TeX Macro', `$$\\def\\x{\\x}\\x$$\n\n$$\\includegraphics{/etc/passwd}$$\n\nKaTeX must reject unsafe macros gracefully.`);
add('Math Special Chars', `$\\text{100\\% \\& <tag> \\#hash}$ and $a \\backslash b$ and $\\{ \\}$.`);
add('Huge Math Expression', `$$${Array.from({length:40},(_,i)=>`x_{${i}}`).join(' + ')} = \\sum_{i=0}^{40} x_i$$`);

// ---- Mermaid edge ----------------------------------------------------------
add('Mermaid Empty', '```mermaid\n```');
add('Mermaid Only Comment', '```mermaid\n%% just a comment\n```');
add('Mermaid Unicode Labels', '```mermaid\ngraph LR\n  A[开始] --> B[プロセス]\n  B --> C[نهاية]\n  C --> D[🎉 done]\n```');
add('Mermaid Very Wide', '```mermaid\ngraph LR\n  '+Array.from({length:24},(_,i)=>'N'+i).join(' --> ')+'\n```');
add('Mermaid Long Labels', '```mermaid\ngraph TD\n  A[This is an extremely long node label that goes on and on and should test wrapping and overflow] --> B[Another very long label here too]\n```');

// ---- Charts edge -----------------------------------------------------------
add('Chart Empty Data', '```chart\ntype: bar\ndata:\n```');
add('Chart All Zero', '```chart\ntype: bar\ndata:\n  A: 0\n  B: 0\n  C: 0\n```');
add('Chart Negatives', '```chart\ntype: bar\ntitle: Net\ndata:\n  Gain: 50\n  Loss: -30\n  Net: 20\n  Deep: -60\n```');
add('Chart Non-Numeric', '```chart\ntype: bar\ndata:\n  A: hello\n  B: world\n```');
add('Chart Tiny Diffs', '```chart\ntype: bar\ndata:\n  A: 1000000\n  B: 1000001\n  C: 1000002\n```');
add('Chart Single Point Line', '```chart\ntype: line\nlabels: [only]\nseries:\n  S: [42]\n```');
add('Chart Duplicate Keys', '```chart\ntype: pie\ndata:\n  A: 10\n  A: 20\n  A: 30\n```');

// ---- Images edge -----------------------------------------------------------
const px = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
add('Image No Alt', `![](${px})`);
add('Image Empty Src', `![alt text](.)\n\nAn image with an essentially empty source.`);
add('Image With Title', `![alt](${px} "a title attribute")`);
add('Many Tiny Images', Array.from({length:60},()=>`![](${px})`).join(' '));
add('Image Broken + Text', `![missing](https://invalid.invalid/x.png)\n\nBody text beside a broken image.`);

// ---- Links edge ------------------------------------------------------------
add('Empty & Weird Links', `[empty]() and [space]( ) and [nested [brackets]](https://example.com) and [](https://notext.com).`);
add('Reference Links', `A [reference][ref] link and another [ref] and [num][1].\n\n[ref]: https://example.com\n[1]: https://example.org`);
add('Autolinks', `<https://example.com> and <mailto:a@b.com> and bare https://linkify.me/auto and www.example.com.`);
add('Link Special Chars', `[weird](https://example.com/path?a=1&b=2#frag) and [paren](https://en.wikipedia.org/wiki/Example_(disambiguation)).`);

// ---- Containers / callouts edge --------------------------------------------
add('Callout Unknown Type', `:::wat\nUnknown container type.\n:::`);
add('Callout Empty', `:::tip\n:::`);
addRaw(`# Callout Nested\n\n:::info\nOuter\n\n:::warning\nInner nested container\n:::\n\nBack to outer\n:::`);
add('Callout Unclosed', `:::danger\nThis callout is never closed on this slide`);
add('Icon Unknown', `:icon[definitely-not-an-icon-xyz]: fallback and :icon[]: empty and :icon[zap]: real.`);

// ---- Fragments / meta edge -------------------------------------------------
add('Many Fragments', Array.from({length:14},(_,i)=>`- + fragment ${i+1}`).join('\n'));
addRaw(`# Bad Meta Values\n\n<!-- layout: not-a-real-layout; bg: notacolor; color: alsobad; align: sideways -->\n\nInvalid metadata should be ignored, not crash.`);
addRaw(`# Comment Only Body\n\n<!-- just a comment and nothing else -->`);
addRaw(`# Weird Meta Combo\n\n<!-- bg: linear-gradient(45deg, #f00, #00f); color: #fff -->\n\nGradient background via meta.`);

// ---- Structural / whitespace edge ------------------------------------------
add('Only Invisible', `​​​`);
add('HR Variants', `Above.\n\n---\n\n***\n\n___\n\n- - -\n\nBelow (various thematic breaks).`);
add('Tabs And Indent', `\tTab-indented line.\n    Four-space line.\n\t  Mixed tab+space.\n\nNormal.`);
add('Trailing Whitespace', `Line with trailing spaces.     \nNext line.      \nHard break?`);
add('Many Inline Elements', Array.from({length:200},(_,i)=>`[l${i}](https://e.com/${i})`).join(' '));
add('Many Code Spans', Array.from({length:200},(_,i)=>`\`c${i}\``).join(' '));
add('HTML Entities Everywhere', `&lt;&gt;&amp;&quot;&apos;&copy;&reg;&trade;&mdash;&hellip;&rarr;&larr;&spades;&hearts;&diams;&clubs;&#128512;&#x1F680;`);

// ---------------------------------------------------------------------------
const frontmatter = `---
title: Adversarial Edge Cases
theme: catppuccin-mocha
aspect: 16:9
pageNumber: true
---`;

const deck = frontmatter + '\n\n' + slides.join('\n\n');
mkdirSync(__dir, { recursive: true });
writeFileSync(join(__dir, 'edge-deck.md'), deck, 'utf8');
console.log(`Wrote edge-deck.md with ${slides.length} adversarial slides, ${deck.length} chars`);
