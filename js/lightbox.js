// Case study lightbox: media grows from its position into a focused view.
(function () {
  var figs = document.querySelectorAll('.case .cs-hero, .case .cs-media');
  if (!figs.length) return;
  var PA = window.PageAudio, FILL = 0.78, DUR = 560, FADE = 400;
  var EASE = 'cubic-bezier(.22,.61,.36,1)';
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function level(f) {
    var p = PA ? PA.prefs : { volume: 0.5, muted: false }, m = PA && PA.LEVEL ? PA.LEVEL.media : 0.8;
    var g = parseFloat(f && f.getAttribute('data-gain')); if (!(g > 0)) g = 1;
    return p.muted ? 0 : Math.min(1, p.volume * m * g);
  }
  function media(f) { return f.querySelector(':scope > img, :scope > video'); }
  function usable(f) { return !f.classList.contains('is-carousel') && !f.closest('a') && media(f); }

  var lb = document.createElement('div');
  lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.hidden = true;
  lb.innerHTML = '<div class="lb-back"></div><div class="lb-frame"></div><p class="lb-cap"></p>' +
    '<button type="button" class="lb-close" aria-label="Close"><span aria-hidden="true">×</span></button>';
  document.body.appendChild(lb);
  var back = lb.querySelector('.lb-back'), frame = lb.querySelector('.lb-frame'),
      cap = lb.querySelector('.lb-cap'), closeBtn = lb.querySelector('.lb-close');

  var open = null;   // { fig, el, home, next, video, sound, paused[] }

  function rectOf(f) { var r = f.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; }
  function target(el, f) {
    var w = el.videoWidth || el.naturalWidth, h = el.videoHeight || el.naturalHeight;
    if (!w || !h) { var r = f.getBoundingClientRect(); w = r.width; h = r.height; }
    var vw = innerWidth, vh = innerHeight, fw = vw < 700 ? 0.94 : FILL;   // phones: use nearly the full width
    var s = Math.min(vw * fw / w, vh * FILL / h);
    w *= s; h *= s;
    return { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h };
  }
  function place(r) { frame.style.left = r.left + 'px'; frame.style.top = r.top + 'px'; frame.style.width = r.width + 'px'; frame.style.height = r.height + 'px'; }
  function px(r) { return { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }; }
  function morph(from, to, done) {
    place(to);
    var fired = false, end = function () { if (!fired) { fired = true; if (done) done(); } };
    if (still || !frame.animate) { end(); return; }
    var a = frame.animate([px(from), px(to)], { duration: DUR, easing: EASE });
    a.onfinish = a.oncancel = end;
    setTimeout(end, DUR + 200);
  }

  function ramp(v, to, done) {
    cancelAnimationFrame(v.__raf);
    var from = v.volume, t0 = performance.now();
    (function step(now) {
      var k = Math.min(1, (now - t0) / FADE);
      v.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k < 1) v.__raf = requestAnimationFrame(step); else if (done) done();
    })(t0);
  }

  function show(f) {
    if (open) return;
    var el = media(f), isVid = el.tagName === 'VIDEO';
    if (window.HoverAudio) window.HoverAudio.stop();
    var o = open = { fig: f, el: el, video: isVid, sound: isVid && (f.hasAttribute('data-hover-audio') || f.hasAttribute('data-audio')), paused: [] };
    var node;
    if (isVid) { o.home = el.parentNode; o.next = el.nextSibling; node = el; }
    else { node = el.cloneNode(false); node.removeAttribute('loading'); node.removeAttribute('style'); f.classList.add('is-lb-source'); }
    o.node = node;
    frame.classList.toggle('is-whole', el.classList.contains('is-whole'));
    var figcap = f.querySelector('figcaption');
    cap.textContent = figcap ? figcap.textContent.replace(/\s+/g, ' ').trim() : (el.getAttribute('alt') || el.getAttribute('aria-label') || '');

    document.querySelectorAll('video').forEach(function (v) { if (v !== el && !v.paused) { v.pause(); o.paused.push(v); } });

    var from = rectOf(f);
    lb.hidden = false;
    place(from);
    frame.appendChild(node);
    if (isVid) { var p = el.play(); if (p && p.catch) p.catch(function () {}); }
    var sw = innerWidth - document.documentElement.clientWidth;
    document.documentElement.classList.add('lb-lock');
    if (window.SmoothScroll) window.SmoothScroll.stop();
    if (sw > 0) document.documentElement.style.paddingRight = sw + 'px';
    void lb.offsetWidth;
    lb.classList.add('is-open');
    morph(from, target(el, f));
    if (o.sound && level(f)) {
      if (PA && PA.connect) PA.connect(el);   // so the nav player's histogram shows it
      el.volume = 0; el.muted = false; ramp(el, level(f));
      if (PA) PA.duck(true);
    }
    closeBtn.focus({ preventScroll: true });
  }

  function hide() {
    var o = open; if (!o || o.closing) return;
    o.closing = true;
    lb.classList.remove('is-open');
    if (o.sound) { ramp(o.el, 0, function () { o.el.muted = true; }); if (PA) PA.duck(false); }
    var cur = frame.getBoundingClientRect();
    morph({ left: cur.left, top: cur.top, width: cur.width, height: cur.height }, rectOf(o.fig), function () {
      if (o.video) o.home.insertBefore(o.el, o.next && o.next.parentNode === o.home ? o.next : null);
      else { o.node.remove(); o.fig.classList.remove('is-lb-source'); }
      if (o.video) { o.el.muted = true; var p = o.el.play(); if (p && p.catch) p.catch(function () {}); }
      lb.hidden = true;
      document.documentElement.classList.remove('lb-lock');
      if (window.SmoothScroll) window.SmoothScroll.start();
      document.documentElement.style.paddingRight = '';
      o.paused.forEach(function (v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); });
      open = null;
      if (window.HoverAudio && window.HoverAudio.resume) window.HoverAudio.resume();
      o.fig.focus({ preventScroll: true });
    });
  }

  lb.addEventListener('click', hide);
  document.addEventListener('keydown', function (e) {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); hide(); }
    else if (e.key === 'Tab') { e.preventDefault(); closeBtn.focus(); }   // keep focus inside
  });
  addEventListener('resize', function () { if (open && !open.closing) place(target(open.el, open.fig)); });

  function bind(f) {
    if (f.classList.contains('lb-able') || !usable(f)) return;
    f.classList.add('lb-able');
    f.tabIndex = 0; f.setAttribute('role', 'button');
    var el = media(f);
    f.setAttribute('aria-label', 'View larger: ' + (el.getAttribute('alt') || el.getAttribute('aria-label') || 'media'));
    f.addEventListener('click', function () { if (usable(f)) show(f); });
    f.addEventListener('keydown', function (e) {
      if (e.target === f && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (usable(f)) show(f); }
    });
  }
  Array.prototype.forEach.call(figs, bind);

  window.Lightbox = { open: show, close: hide, isOpen: function () { return !!open; },
    bind: function (root) { Array.prototype.forEach.call(root.querySelectorAll('.cs-hero, .cs-media'), bind); } };
})();
