export const HTML_TEMPLATE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__TITLE__</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { height: 100%; width: 100%; margin: 0; padding: 0; background: #000; overflow: hidden; }
  body[data-blank="black"] #stage { display: none; }
  body[data-blank="black"]::before { content: ''; position: fixed; inset: 0; background: #000; z-index: 100; }
  body[data-blank="white"] #stage { display: none; }
  body[data-blank="white"]::before { content: ''; position: fixed; inset: 0; background: #fff; z-index: 100; }
  #stage { position: fixed; inset: 0; display: block; }
  #scaler { position: absolute; top: 50%; left: 50%; transform-origin: center center; transform: translate(-50%, -50%) scale(var(--fit-scale, 1)); }
  /* List bullets/numbers — re-enable in case any reset stripped them. */
  .slide-canvas ul { list-style: disc outside; }
  .slide-canvas ol { list-style: decimal outside; }
  .slide-canvas li { display: list-item; }
  .footer-controls { position: fixed; bottom: 12px; right: 12px; color: rgba(255,255,255,0.4); font-family: ui-monospace, monospace; font-size: 11px; pointer-events: none; user-select: none; }
__TOKENS_CSS__
__SLIDE_CSS__
__THEME_CSS__
__USER_CSS__
__KATEX_CSS__
</style>
</head>
<body>
<div id="stage">
  <div id="scaler">
    __SLIDES__
  </div>
</div>
<div class="footer-controls">→ next · ← prev · F fullscreen · B blank</div>
<script>__SCRIPT__</script>
</body>
</html>`;
