// Cursor tilt for the 2D sections under the stage. Each element leans slightly toward the cursor and
// drifts against it, scaled by its depth, so nearer things move more than farther ones. The motion
// follows the cursor the way the stage camera sways (js/hero.js), so the page and the stage read as
// one space. It's a CSS transform only (see .tilt in css/style.css): compositor work, no layout.
// - Only elements on screen are updated, and nothing runs once the cursor has stopped and settled.
// - Off on touch screens and with reduced motion.
// Add or tune elements in PARTS: [selector, depth]. Depth 1 = the strongest tilt and drift.
(function () {
  if (!window.matchMedia || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var MAX_TILT = 3.2;    // degrees at depth 1, cursor at the edge of the window
  var MAX_DRIFT = 14;    // px at depth 1
  var PARTS = [
    ['.about .portrait', 1],
    ['.about > div.reveal', 0.6],       // the text column (not the portrait, which is a .reveal too)
    ['.works-head', 0.35],
    ['.project', 0.55],                 // big cards: less, so the edges don't swing too far
    ['footer .col', 0.3],
    ['.case .cs-head, .case .cs-hero', 0.45],      // case study pages
    ['.case .cs-row .cs-media', 0.6], ['.case .cs-text', 0.35], ['.case .next-case', 0.4],
    ['.case .fmt-item', 0.45], ['.case .cs-spec-grid > div', 0.3]
  ];
  var items = [];
  PARTS.forEach(function (p) {
    Array.prototype.forEach.call(document.querySelectorAll(p[0]), function (el) {
      el.classList.add('tilt');
      items.push({ el: el, d: p[1], on: false, shown: '' });
    });
  });
  if (!items.length) return;
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) { e.target.__tilt.on = e.isIntersecting; });
      wake();
    }, { rootMargin: '100px 0px' });
    items.forEach(function (it) { it.el.__tilt = it; io.observe(it.el); });
  } else items.forEach(function (it) { it.on = true; });

  var mx = 0, my = 0, cx = 0, cy = 0, running = false;
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX / window.innerWidth * 2 - 1; my = e.clientY / window.innerHeight * 2 - 1;
    wake();
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', function () { mx = my = 0; wake(); });
  function wake() { if (!running) { running = true; requestAnimationFrame(tick); } }
  function tick() {
    cx += (mx - cx) * 0.07; cy += (my - cy) * 0.07;   // same easing feel as the stage camera
    items.forEach(function (it) {
      if (!it.on) return;
      var d = it.d;
      var v = (cx * MAX_TILT * d).toFixed(2) + '|' + (-cy * MAX_TILT * d).toFixed(2);
      if (v === it.shown) return;
      it.shown = v;
      var s = it.el.style;
      s.setProperty('--ry', (cx * MAX_TILT * d).toFixed(2));
      s.setProperty('--rx', (-cy * MAX_TILT * d * 0.7).toFixed(2));
      s.setProperty('--tx', (-cx * MAX_DRIFT * d).toFixed(1));
      s.setProperty('--ty', (-cy * MAX_DRIFT * d * 0.6).toFixed(1));
    });
    if (Math.abs(mx - cx) > 0.0005 || Math.abs(my - cy) > 0.0005) requestAnimationFrame(tick); else running = false;
  }
})();
