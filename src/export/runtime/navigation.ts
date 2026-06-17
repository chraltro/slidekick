/**
 * Inlined into exported HTML. Pure DOM-driven; no framework. Handles slide
 * navigation, fit-scaling, blank modes, fullscreen, an overview grid, a
 * progress bar, working copy buttons, and click/touch advance.
 */
export const NAVIGATION_RUNTIME = `
(function () {
  var slides = Array.from(document.querySelectorAll('#scaler > .slide'));
  if (slides.length === 0) return;
  var stage = document.getElementById('stage');
  var scaler = document.getElementById('scaler');
  var progress = document.getElementById('progress');
  var footer = document.querySelector('.footer-controls');
  var current = 0;
  var blank = 'off';
  var overview = false;

  function clamp(i) { return Math.max(0, Math.min(slides.length - 1, i)); }

  function getStartIndex() {
    var params = new URLSearchParams(location.search);
    var s = parseInt(params.get('slide') || '1', 10);
    if (!isNaN(s)) return clamp(s - 1);
    return 0;
  }

  function baseSize(slide) {
    var cs = getComputedStyle(slide);
    return { w: parseFloat(cs.width) || 1920, h: parseFloat(cs.height) || 1080 };
  }

  function fit() {
    if (overview) return;
    var slide = slides[current];
    if (!slide || !stage || !scaler) return;
    var b = baseSize(slide);
    var scale = Math.min(window.innerWidth / b.w, window.innerHeight / b.h);
    scaler.style.setProperty('--fit-scale', scale);
  }

  function syncProgress() {
    if (!progress) return;
    var pct = slides.length <= 1 ? 100 : (current / (slides.length - 1)) * 100;
    progress.style.width = pct + '%';
    // Pull the accent colour from the active slide so the bar matches the theme.
    var slide = slides[current];
    if (slide) {
      var accent = getComputedStyle(slide).getPropertyValue('--accent');
      if (accent) progress.style.background = accent.trim();
    }
  }

  function show(i) {
    current = clamp(i);
    slides.forEach(function (el, idx) {
      el.classList.toggle('is-active', idx === current);
    });
    try { history.replaceState(null, '', '?slide=' + (current + 1)); } catch (e) {}
    fit();
    syncProgress();
    flashFooter();
  }

  var footerTimer;
  function flashFooter() {
    if (!footer) return;
    footer.classList.remove('hidden');
    clearTimeout(footerTimer);
    footerTimer = setTimeout(function () { footer.classList.add('hidden'); }, 2500);
  }

  function setBlank(mode) {
    blank = mode;
    if (mode === 'off') delete document.body.dataset.blank;
    else document.body.dataset.blank = mode;
  }

  function next() { if (current < slides.length - 1) show(current + 1); }
  function prev() { if (current > 0) show(current - 1); }

  // ---- Overview grid -------------------------------------------------------
  var overviewEl = null;
  function buildOverview() {
    overviewEl = document.createElement('div');
    overviewEl.id = 'overview';
    overviewEl.style.cssText = 'position:fixed;inset:0;background:#0b0b0f;z-index:200;overflow:auto;padding:3vh 3vw;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:2vh 2vw;align-content:start;';
    slides.forEach(function (slide, idx) {
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.style.cssText = 'all:unset;cursor:pointer;position:relative;border-radius:10px;overflow:hidden;outline:2px solid transparent;aspect-ratio:16/9;background:#000;box-shadow:0 4px 20px rgba(0,0,0,.5);';
      var b = baseSize(slide);
      var holder = document.createElement('div');
      holder.style.cssText = 'position:absolute;inset:0;overflow:hidden;';
      var clone = slide.cloneNode(true);
      clone.classList.add('is-active');
      clone.style.position = 'absolute';
      clone.style.top = '0';
      clone.style.left = '0';
      clone.style.transformOrigin = 'top left';
      holder.appendChild(clone);
      cell.appendChild(holder);
      var num = document.createElement('div');
      num.textContent = String(idx + 1);
      num.style.cssText = 'position:absolute;left:8px;bottom:6px;font:600 13px ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.55);padding:2px 8px;border-radius:6px;z-index:2;';
      cell.appendChild(num);
      cell.addEventListener('click', function () { toggleOverview(false); show(idx); });
      overviewEl.appendChild(cell);
      // Scale the clone to fit the cell once it has layout.
      requestAnimationFrame(function () {
        var cw = cell.clientWidth, ch = cell.clientHeight;
        if (!cw || !ch) return;
        var s = Math.min(cw / b.w, ch / b.h);
        clone.style.transform = 'scale(' + s + ')';
      });
    });
    document.body.appendChild(overviewEl);
  }

  function toggleOverview(force) {
    overview = typeof force === 'boolean' ? force : !overview;
    if (overview) {
      if (!overviewEl) buildOverview();
      overviewEl.style.display = 'grid';
      stage.style.visibility = 'hidden';
    } else if (overviewEl) {
      overviewEl.style.display = 'none';
      stage.style.visibility = '';
      fit();
    }
  }

  // ---- Copy buttons --------------------------------------------------------
  document.querySelectorAll('.codeblock').forEach(function (block) {
    var header = block.querySelector('.codeblock-header');
    if (!header || header.querySelector('.codeblock-copy')) return;
    var pre = block.querySelector('pre');
    var btn = document.createElement('button');
    btn.className = 'codeblock-copy';
    btn.type = 'button';
    btn.textContent = 'Copy';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var text = pre ? pre.textContent || '' : '';
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = 'Copied';
          setTimeout(function () { btn.textContent = 'Copy'; }, 1200);
        });
      }
    });
    header.appendChild(btn);
  });

  // ---- Keyboard ------------------------------------------------------------
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (overview) {
      if (e.key === 'Escape' || e.key === 'o' || e.key === 'O') { toggleOverview(false); return; }
    }
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': case ' ': case 'l': case 'j':
        e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'PageUp': case 'h': case 'k':
        e.preventDefault(); prev(); break;
      case 'Home': e.preventDefault(); show(0); break;
      case 'End': e.preventDefault(); show(slides.length - 1); break;
      case 'b': case 'B': case '.':
        setBlank(blank === 'black' ? 'off' : 'black'); break;
      case 'w': case 'W':
        setBlank(blank === 'white' ? 'off' : 'white'); break;
      case 'o': case 'O':
        toggleOverview(); break;
      case 'f': case 'F':
        if (document.fullscreenElement) document.exitFullscreen();
        else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
        break;
      case 'Escape':
        if (document.fullscreenElement) document.exitFullscreen();
        else if (blank !== 'off') setBlank('off');
        break;
    }
    if (/^[0-9]$/.test(e.key)) {
      var idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < slides.length) show(idx);
    }
  });

  // ---- Click / tap to advance ---------------------------------------------
  stage.addEventListener('click', function (e) {
    var tag = e.target && e.target.tagName;
    // Don't hijack clicks on links, buttons, or selected text.
    if (tag === 'A' || tag === 'BUTTON' || (e.target.closest && e.target.closest('a,button'))) return;
    if (window.getSelection && String(window.getSelection())) return;
    if (e.clientX < window.innerWidth * 0.25) prev();
    else next();
  });

  // ---- Touch swipe ---------------------------------------------------------
  var touchX = null;
  stage.addEventListener('touchstart', function (e) { touchX = e.changedTouches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) { if (dx < 0) next(); else prev(); }
    touchX = null;
  }, { passive: true });

  window.addEventListener('resize', fit);
  window.addEventListener('mousemove', flashFooter);
  show(getStartIndex());
})();
`;
