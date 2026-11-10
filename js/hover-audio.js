// Plays a video's sound while it is hovered (figures marked data-hover-audio).
(function () {
  var figs = document.querySelectorAll('[data-hover-audio]');
  if (!figs.length) return;
  var PA = window.PageAudio, FADE = 350;
  var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  var activated = false;
  function isActive() { return activated || (navigator.userActivation && navigator.userActivation.hasBeenActive); }
  ['pointerdown', 'keydown'].forEach(function (ev) { window.addEventListener(ev, function () { activated = true; setTimeout(syncAmbient, 0); }, { capture: true }); });
  function level(f) {
    var p = PA ? PA.prefs : { volume: 0.5, muted: false }, m = PA && PA.LEVEL ? PA.LEVEL.media : 0.8;
    var g = parseFloat(f && f.getAttribute('data-gain')); if (!(g > 0)) g = 1;
    return p.muted ? 0 : Math.min(1, p.volume * m * g);
  }

  // A cursor already resting on a video when the page opens doesn't count as hovering it:
  // that video waits until the cursor leaves and comes back.
  var moved = false;
  window.addEventListener('pointermove', function () { moved = true; }, { capture: true, once: true });

  var current = null, held = false;   // held: the focus view has the sound
  function ambientK(f) { var a = parseFloat(f.getAttribute('data-ambient-audio')); return a > 0 ? Math.min(1, a) : 0; }
  function syncAmbient() {
    Array.prototype.forEach.call(figs, function (f) {
      var k = ambientK(f), v = f.__video;
      if (!k || !v || f === current) return;
      var want = (!isActive() || held || document.hidden || current) ? 0 : level(f) * k;
      if (want > 0) {
        if (PA && PA.connect) PA.connect(v);
        if (v.muted) { v.volume = 0; v.muted = false; }
        ramp(v, want);
      } else if (!v.muted) ramp(v, 0, function () { if (f !== current && !(level(f) * k > 0 && isActive() && !held && !current && !document.hidden)) v.muted = true; });
    });
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
  function soundOn(f) {
    if (window.Lightbox && window.Lightbox.isOpen()) return;
    if (current && current !== f) soundOff(current);
    var v = f.__video;
    if (!isActive()) { f.classList.add('needs-click'); return; }
    if (!level(f)) { f.classList.add('is-muted-pref'); return; }
    current = f;
    f.classList.add('has-sound'); f.classList.remove('needs-click');
    if (PA && PA.connect) PA.connect(v);   // so the nav player's histogram shows it
    v.muted = false;
    if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    if (!ambientK(f)) v.volume = 0;
    ramp(v, level(f));
    if (PA) PA.duck(true);
    syncAmbient();   // other ambient videos go quiet
  }
  function soundOff(f) {
    var v = f.__video;
    f.classList.remove('has-sound', 'needs-click', 'is-muted-pref');
    if (current === f) { current = null; if (PA) PA.duck(false); }
    if (ambientK(f)) { syncAmbient(); return; }   // back down to its bed (and the others come back)
    ramp(v, 0, function () { if (current !== f) v.muted = true; });
    syncAmbient();
  }

  Array.prototype.forEach.call(figs, function (f) {
    var v = f.querySelector('video'); if (!v) return;
    f.__video = v; v.muted = true;
    if (!fine) f.classList.add('is-touch');
    var badge = document.createElement('span');
    badge.className = 'hover-sound'; badge.setAttribute('aria-hidden', 'true');
    badge.innerHTML = '<span class="sound-bars"><i></i><i></i><i></i></span><span class="hs-label"></span>';
    f.appendChild(badge);
    var lb = function () { return !!window.Lightbox; };
    if (fine) {
      f.addEventListener('pointerenter', function (e) {
        if (e.pointerType !== 'mouse') return;
        if (!moved) { f.classList.add('hover-wait'); return; }
        soundOn(f);
      });
      f.addEventListener('pointerleave', function (e) {
        if (e.pointerType !== 'mouse') return;
        if (f.classList.contains('hover-wait')) { f.classList.remove('hover-wait'); return; }
        if (!(window.Lightbox && window.Lightbox.isOpen())) soundOff(f);
      });
      f.addEventListener('click', function () { activated = true; if (!lb() && !f.classList.contains('has-sound')) soundOn(f); });
    } else {
      f.addEventListener('click', function () { activated = true; if (lb()) return; if (current === f) soundOff(f); else soundOn(f); });
    }
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden && current) soundOff(current); syncAmbient(); });
  window.HoverAudio = {
    stop: function () { held = true; if (current) soundOff(current); syncAmbient(); Array.prototype.forEach.call(figs, function (f) { f.classList.remove('needs-click'); }); },
    resume: function () { held = false; syncAmbient(); }   // the focus view closed
  };
})();
