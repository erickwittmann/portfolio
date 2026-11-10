// Smooth scrolling (Lenis).
(function () {
  var LERP = 0.1;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.SmoothScroll = null;
  if (reduced || !window.Lenis) return;
  var lenis;
  try { lenis = new Lenis({ lerp: LERP, smoothWheel: true, anchors: true }); } catch (e) { return; }
  window.SmoothScroll = lenis;
  (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
})();
