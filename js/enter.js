// Opening screen (homepage): the media grid shows straight away, slightly dimmed, with
// "[erick wittmann]" and "[click to enter]" over it. Clicking anywhere (or pressing Enter/Space, or
// trying to scroll) enters: the dim lifts, the sound starts (browsers only allow sound after a
// click/key, so this click is the one that unlocks it) and the camera pulls back from the LED
// screen to the whole stage on its own, over DURATION ms. After that the page scrolls as normal.
// - Arriving part-way down the page (a #about link, reloading lower down) skips the opening.
// - Reduced motion: no camera move; entering jumps straight to the stage.
// Load after js/intro.js (needs window.StageSeq).
(function () {
  var SEQ = window.StageSeq, section = document.getElementById('top');
  if (!SEQ || !section) return;
  var DURATION = 2800;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  var y0 = window.scrollY || window.pageYOffset;
  if (location.hash || y0 > 10) return;   // not starting at the top: no opening screen

  var gate = document.createElement('div');
  gate.className = 'enter';
  gate.innerHTML = '<span class="enter-name">[erick wittmann]</span>' +
    '<button type="button" class="enter-go">[click to enter]</button>';
  SEQ.pin.appendChild(gate);
  root.classList.add('is-gated');
  var state = 'gated';   // 'gated' -> 'entering' -> 'in'
  var lenis = window.SmoothScroll;   // js/smooth-scroll.js (null with reduced motion)
  if (lenis) lenis.stop();

  // Hold the page at the top until entered, and while the camera move plays.
  var KEYS = { ' ': 1, 'Enter': 1, 'ArrowDown': 1, 'PageDown': 1, 'End': 1, 'Spacebar': 1 };
  function hold(e) {
    if (state === 'in') return;
    if (e.cancelable) e.preventDefault();
    if (state === 'gated') enter();
  }
  window.addEventListener('wheel', hold, { passive: false });
  window.addEventListener('touchmove', hold, { passive: false });
  window.addEventListener('keydown', function (e) {
    if (state === 'in' || !KEYS[e.key]) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    hold(e);
  });
  // The first click anywhere on the grid enters (rather than following a link in a tile).
  SEQ.pin.addEventListener('click', function (e) {
    if (state !== 'gated') return;
    e.preventDefault(); e.stopPropagation();
    enter();
  }, true);

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }   // ease-in-out cubic
  function scrollToY(y) { window.scrollTo(0, y); }

  function enter() {
    if (state !== 'gated') return;
    state = 'entering';
    root.classList.remove('is-gated');
    gate.classList.add('is-out');
    setTimeout(function () { gate.remove(); }, 900);
    var end = SEQ.end();
    if (lenis) {   // let the smooth scroller play the move, so it hands over seamlessly to normal scrolling
      lenis.start();
      lenis.scrollTo(end, { duration: DURATION / 1000, easing: ease, lock: true, force: true, onComplete: done });
      setTimeout(done, DURATION + 400);   // in case onComplete doesn't come
      return;
    }
    root.style.scrollBehavior = 'auto';   // the page normally scrolls smoothly; steer it frame by frame instead
    if (reduced) { scrollToY(end); done(); return; }
    var from = window.scrollY || window.pageYOffset, t0 = performance.now();
    (function step(now) {
      var k = Math.min(1, (now - t0) / DURATION);
      scrollToY(from + (end - from) * ease(k));
      if (k < 1) requestAnimationFrame(step); else done();
    })(t0);
  }
  function done() {
    if (state === 'in') return;
    state = 'in';
    root.style.scrollBehavior = '';
  }
})();
