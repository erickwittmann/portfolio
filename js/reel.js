(function () {
  var btn = document.querySelector('.reel-frame');
  if (!btn) return;
  var loop = btn.querySelector('.reel-loop'), hint = btn.querySelector('.reel-hint');
  var PA = window.PageAudio, DUR = 620, EASE = 'cubic-bezier(.22,.61,.36,1)';
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      var on = es[0].isIntersecting;
      if (on) { var p = loop.play(); if (p && p.catch) p.catch(function () {}); }
      else loop.pause();
    }, { rootMargin: '200px 0px' }).observe(btn);
  }

  btn.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    var r = btn.getBoundingClientRect();
    hint.style.setProperty('--x', (e.clientX - r.left) + 'px');
    hint.style.setProperty('--y', (e.clientY - r.top) + 'px');
  });
  btn.addEventListener('pointerleave', function () { hint.style.removeProperty('--x'); hint.style.removeProperty('--y'); });

  var lb = document.createElement('div');
  lb.className = 'reel-lb'; lb.hidden = true;
  lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Motion reel 2025–26');
  lb.innerHTML =
    '<div class="reel-lb-back"></div>' +
    '<div class="reel-lb-frame"><video playsinline preload="none"></video></div>' +
    '<p class="reel-lb-bar">Soundtrack: <a href="https://open.spotify.com/track/5arjVgWfJHC7V5FFXPRf5g" target="_blank" rel="noopener">Feng — J*b ↗</a></p>' +
    '<button type="button" class="reel-lb-close" aria-label="Close the reel">×</button>';
  document.body.appendChild(lb);
  var frame = lb.querySelector('.reel-lb-frame'), video = frame.querySelector('video'), closeBtn = lb.querySelector('.reel-lb-close');
  var isOpen = false;

  function volume() {
    var p = PA ? PA.prefs : { volume: 0.6, muted: false }, k = PA && PA.LEVEL ? PA.LEVEL.stage : 0.5;
    return p.muted ? 0 : Math.min(1, p.volume * k * 1.6);
  }
  if (PA && PA.onVolume) PA.onVolume(function () { if (isOpen) video.volume = volume(); });

  function rect(el) { var r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; }
  function full() {
    var vw = innerWidth, vh = innerHeight, s = Math.min(vw * 0.94 / 16, vh * 0.86 / 9), w = 16 * s, h = 9 * s;
    return { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h };
  }
  function css(r) { return { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }; }
  function morph(from, to, done) {
    var end = css(to);
    for (var k in end) frame.style[k] = end[k];
    if (still || !frame.animate) { done(); return; }
    var a = frame.animate([css(from), end], { duration: DUR, easing: EASE }), fired = false;
    a.onfinish = a.oncancel = function () { if (!fired) { fired = true; done(); } };
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    if (!video.src) { video.poster = 'assets/reel/motion-reel-poster.webp'; video.src = btn.getAttribute('data-src'); }
    if (PA && PA.connect) PA.connect(video);
    if (PA && PA.fadeOut) PA.fadeOut();
    video.currentTime = 0; video.muted = false; video.volume = volume();
    var p = video.play(); if (p && p.catch) p.catch(function () {});
    lb.classList.remove('is-full');
    lb.hidden = false;
    document.documentElement.classList.add('reel-lock');
    if (window.SmoothScroll && window.SmoothScroll.stop) window.SmoothScroll.stop();
    void lb.offsetWidth;
    lb.classList.add('is-open');
    loop.pause();
    morph(rect(btn), full(), function () { lb.classList.add('is-full'); video.controls = true; closeBtn.focus(); });
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    video.controls = false;
    lb.classList.remove('is-open', 'is-full');
    morph(rect(frame), rect(btn), function () {
      lb.hidden = true;
      video.pause();
      document.documentElement.classList.remove('reel-lock');
      if (window.SmoothScroll && window.SmoothScroll.start) window.SmoothScroll.start();
      if (PA && PA.fadeIn) PA.fadeIn();
      var p = loop.play(); if (p && p.catch) p.catch(function () {});
      btn.focus({ preventScroll: true });
    });
  }

  btn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  lb.querySelector('.reel-lb-back').addEventListener('click', close);
  video.addEventListener('ended', close);
  addEventListener('resize', function () { if (isOpen) { var r = css(full()); for (var k in r) frame.style[k] = r[k]; } });
  document.addEventListener('keydown', function (e) {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') { e.preventDefault(); (document.activeElement === closeBtn ? video : closeBtn).focus(); }
    else if (e.key === ' ' && document.activeElement !== video) { e.preventDefault(); video.paused ? video.play() : video.pause(); }
  });
})();
