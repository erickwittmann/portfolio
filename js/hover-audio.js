// Sound on hover for videos in a figure marked data-hover-audio (e.g. the Boiler Room videos).
// - The videos loop silently. Hovering one fades its own sound in; moving off fades it out. Only
//   one plays at a time, and the page's background music dips meanwhile (PageAudio.duck).
// - Browsers block sound until the visitor has clicked/tapped the page once. Until then the badge
//   says "Click for sound".
// - Clicking a video opens it in the focus view (js/lightbox.js), where it plays with sound whether or
//   not the pointer is on it. Touch screens (no hover): tap a video to open it with sound.
// - Uses the visitor's volume and mute from the rest of the site (js/page-audio.js).
// - Ambient videos (data-ambient-audio="0.3"): after the first click they keep playing their sound
//   quietly all the time (at that fraction of full), come up to full on hover, and go quiet while
//   another video or the focus view has the sound.
(function () {
  var figs = document.querySelectorAll('[data-hover-audio]');
  if (!figs.length) return;
  var PA = window.PageAudio, FADE = 350;
  var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  var activated = false;   // has the visitor clicked/tapped/pressed a key yet?
  function isActive() { return activated || (navigator.userActivation && navigator.userActivation.hasBeenActive); }
  ['pointerdown', 'keydown'].forEach(function (ev) { window.addEventListener(ev, function () { activated = true; setTimeout(syncAmbient, 0); }, { capture: true }); });
  // Loudness = the site's volume x the level for videos (js/page-audio.js) x the figure's own trim (data-gain).
  function level(f) {
    var p = PA ? PA.prefs : { volume: 0.5, muted: false }, m = PA && PA.LEVEL ? PA.LEVEL.media : 0.8;
    var g = parseFloat(f && f.getAttribute('data-gain')); if (!(g > 0)) g = 1;
    return p.muted ? 0 : Math.min(1, p.volume * m * g);
  }

  var current = null, held = false;   // held: the focus view has the sound
  function ambientK(f) { var a = parseFloat(f.getAttribute('data-ambient-audio')); return a > 0 ? Math.min(1, a) : 0; }
  // Bring every ambient video to where it should be: a quiet bed, or silent while something else plays.
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
    if (!ambientK(f)) v.volume = 0;   // an ambient video rises from its bed instead of from silence
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
    // Without the focus view (lightbox.js not on the page), clicking/tapping toggles the sound here.
    var lb = function () { return !!window.Lightbox; };
    if (fine) {
      f.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') soundOn(f); });
      // (When the focus view opens it covers the video, which counts as the pointer leaving: the
      // focus view runs the sound from then on, so leave it alone.)
      f.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !(window.Lightbox && window.Lightbox.isOpen())) soundOff(f); });
      f.addEventListener('click', function () { activated = true; if (!lb() && !f.classList.contains('has-sound')) soundOn(f); });
    } else {
      f.addEventListener('click', function () { activated = true; if (lb()) return; if (current === f) soundOff(f); else soundOn(f); });
    }
  });
  // Leaving the page or switching tabs: stop any video sound.
  document.addEventListener('visibilitychange', function () { if (document.hidden && current) soundOff(current); syncAmbient(); });
  // For the focus view: stop whatever is playing on hover.
  window.HoverAudio = {
    stop: function () { held = true; if (current) soundOff(current); syncAmbient(); Array.prototype.forEach.call(figs, function (f) { f.classList.remove('needs-click'); }); },
    resume: function () { held = false; syncAmbient(); }   // the focus view closed
  };
})();
