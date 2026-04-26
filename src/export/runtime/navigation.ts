/**
 * Inlined into exported HTML. ~3KB. Pure DOM-driven; no framework.
 */
export const NAVIGATION_RUNTIME = `
(function() {
  const slides = Array.from(document.querySelectorAll('.slide'));
  if (slides.length === 0) return;
  const stage = document.getElementById('stage');
  const scaler = document.getElementById('scaler');
  let current = 0;
  let blank = 'off';

  function getStartIndex() {
    const params = new URLSearchParams(location.search);
    const s = parseInt(params.get('slide') || '1', 10);
    if (!isNaN(s)) return Math.max(0, Math.min(slides.length - 1, s - 1));
    return 0;
  }

  function show(i) {
    current = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((el, idx) => {
      el.style.display = idx === current ? '' : 'none';
    });
    history.replaceState(null, '', '?slide=' + (current + 1));
    fit();
  }

  function fit() {
    if (!stage || !scaler) return;
    const slide = slides[current];
    if (!slide) return;
    // Read the canvas's intrinsic CSS dimensions, not offsetWidth (which can
    // be 0 if the slide is hidden during measurement, or content-shrinks if
    // the inline width didn't apply).
    const cs = getComputedStyle(slide);
    const baseW = parseFloat(cs.width) || 1920;
    const baseH = parseFloat(cs.height) || 1080;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const scale = Math.min(w / baseW, h / baseH);
    scaler.style.setProperty('--fit-scale', scale);
  }

  function setBlank(mode) {
    blank = mode;
    document.body.dataset.blank = mode;
  }

  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': case ' ': case 'l':
        e.preventDefault(); show(current + 1); break;
      case 'ArrowLeft': case 'PageUp': case 'h':
        e.preventDefault(); show(current - 1); break;
      case 'Home': show(0); break;
      case 'End': show(slides.length - 1); break;
      case 'b': case 'B': case '.':
        setBlank(blank === 'black' ? 'off' : 'black'); break;
      case 'w': case 'W':
        setBlank(blank === 'white' ? 'off' : 'white'); break;
      case 'f': case 'F':
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
        break;
      case 'Escape':
        if (document.fullscreenElement) document.exitFullscreen();
        break;
    }
    if (/^[0-9]$/.test(e.key)) {
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < slides.length) show(idx);
    }
  });

  window.addEventListener('resize', fit);
  show(getStartIndex());
})();
`;
