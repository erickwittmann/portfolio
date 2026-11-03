// Opening screen (homepage): the media grid shows straight away, slightly dimmed (it still flexes
// around the cursor), with a black bar across the middle: "erickwittmann.com", "headphones
// recommended", Instagram and LinkedIn, and "click to enter". Clicking anywhere (or pressing
// Enter/Space, or trying to scroll) enters: the bar collapses to a line and closes, the dim lifts, the
// sound starts (browsers only allow sound after a click/key, so this click is the one that unlocks it)
// and the camera pulls back from the LED screen to the whole stage on its own, over DURATION ms.
// After that the page scrolls as normal. The two social links open in a new tab without entering.
// - Arriving part-way down the page (a #about link, reloading lower down) skips the opening.
// - Reduced motion: no camera move; entering jumps straight to the stage.
// Load after js/intro.js (needs window.StageSeq).
(function () {
  var SEQ = window.StageSeq, section = document.getElementById('top');
  if (!SEQ || !section) return;
  var DURATION = 2800, CLOSE = 1100;   // CLOSE: how long the bar and dim take to go (css/style.css)
  // Same icons as the About bar (index.html): Instagram as an outline, LinkedIn as a solid tile.
  var SOCIAL =
    '<li><a href="https://www.instagram.com/erickwittmann" target="_blank" rel="noopener" aria-label="Instagram">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="si-line" x="3" y="3" width="18" height="18" rx="5"/>' +
      '<circle class="si-line" cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.2"/></svg></a></li>' +
    '<li><a href="https://www.linkedin.com/in/erick-wittmann-b228b2305/" target="_blank" rel="noopener" aria-label="LinkedIn">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="2.5"/>' +
      '<path class="si-cut" d="M7.6 10.2V17M11.4 17v-6.8M11.4 13.4c0-2 1.2-3.3 2.8-3.3s2.6 1.1 2.6 3.3V17"/>' +
      '<circle class="si-dot" cx="7.6" cy="7.3" r="1.3"/></svg></a></li>';
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  var y0 = window.scrollY || window.pageYOffset;
  if (location.hash || y0 > 10) return;   // not starting at the top: no opening screen

  var gate = document.createElement('div');
  gate.className = 'enter';
  gate.innerHTML =
    '<div class="enter-bar"><canvas class="pixel-trail" aria-hidden="true"></canvas><div class="enter-box">' +
      '<p class="enter-id"><span class="enter-name">erickwittmann.com</span>' +
        '<span class="enter-tag">headphones recommended <svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/></svg></span></p>' +
      '<ul class="soc-icons" aria-label="Social">' + SOCIAL + '</ul>' +
    '</div><button type="button" class="enter-go">click to enter</button></div>';
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
    if (e.target.closest && e.target.closest('input, textarea, select, .soc-icons a')) return;
    hold(e);
  });
  // The first click anywhere on the grid enters (rather than following a link in a tile).
  // The social links are the exception: they open in a new tab and leave the opening screen up.
  SEQ.pin.addEventListener('click', function (e) {
    if (state !== 'gated') return;
    if (e.target.closest && e.target.closest('.soc-icons a')) return;
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
    setTimeout(function () { gate.remove(); }, CLOSE + 100);
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
