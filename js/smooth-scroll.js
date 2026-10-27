// Smooth scrolling (Lenis, js/vendor/lenis.min.js): the mouse wheel's steps become one gliding
// motion, so the stage's camera, the content and the parallax all move smoothly instead of jumping
// a notch at a time. Touch screens keep their own native scrolling (already smooth).
// - window.SmoothScroll is the Lenis instance (or null with reduced motion / no Lenis):
//   .stop() / .start() freeze and release the page (the focus view uses them), .scrollTo(y, opts).
// - Links to #sections on the same page glide there too.
// - LERP sets the feel: lower = floatier, higher = snappier (0.1 is Lenis's default).
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
