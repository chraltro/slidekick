export const HTML_TEMPLATE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__TITLE__</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { height: 100%; width: 100%; margin: 0; padding: 0; background: #000; overflow: hidden; }
  body { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
  body[data-blank="black"] #stage { visibility: hidden; }
  body[data-blank="black"]::before { content: ''; position: fixed; inset: 0; background: #000; z-index: 100; }
  body[data-blank="white"] #stage { visibility: hidden; }
  body[data-blank="white"]::before { content: ''; position: fixed; inset: 0; background: #fff; z-index: 100; }
  #stage { position: fixed; inset: 0; display: block; overflow: hidden; }
  #scaler { position: absolute; top: 50%; left: 50%; transform-origin: center center; transform: translate(-50%, -50%) scale(var(--fit-scale, 1)); }
  /* Only the active slide is shown; the runtime toggles .is-active. */
  #scaler > .slide { display: none; }
  #scaler > .slide.is-active { display: block; }
  /* List bullets/numbers — re-enable in case any reset stripped them. */
  .slide-canvas ul { list-style: disc outside; }
  .slide-canvas ol { list-style: decimal outside; }
  .slide-canvas li { display: list-item; }
  /* Exported decks reveal every fragment (no live step state). */
  .slide-canvas li[data-fragment] { opacity: 1 !important; pointer-events: auto !important; }
  .footer-controls { position: fixed; bottom: 12px; right: 14px; color: rgba(255,255,255,0.35); font-family: ui-monospace, monospace; font-size: 11px; pointer-events: none; user-select: none; transition: opacity .4s ease; z-index: 90; }
  .footer-controls.hidden { opacity: 0; }
  /* A subtle progress bar across the bottom edge. */
  #progress { position: fixed; left: 0; bottom: 0; height: 3px; background: var(--accent, #cba6f7); width: 0; transition: width .25s ease; z-index: 95; opacity: .85; }
  .codeblock-copy { cursor: pointer; }
__TOKENS_CSS__
__SLIDE_CSS__
__INFOGRAPHICS_CSS__
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
<div id="progress"></div>
<div class="footer-controls">&larr; &rarr; navigate &middot; F fullscreen &middot; B blank &middot; O overview</div>
<script>__SCRIPT__</script>
</body>
</html>`;
