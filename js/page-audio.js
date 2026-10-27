// Music across pages.
// - Each page can have its own track, set in js/page-music.js (or, per page, <body data-music="...">
//   with a path relative to that page). The homepage's music is the stage playlist (js/hero.js).
// - Leaving for another page on this site (clicking a link) fades the music out first, then goes.
//   Coming back with the Back button fades it back in.
// - Volume and mute carry over from page to page (saved in this browser).
// - A page with its own track gets a small sound on/off button, so it can always be silenced.
// - Browsers only allow sound after the visitor has clicked/tapped/pressed a key; until then the
//   track waits and fades in on that first gesture.
// Load this before js/hero.js on the homepage, and on every page that has (or may get) music.
(function () {
  // ('ew-audio-2': the levels were rebalanced, so volumes saved under the old key start over at 50%.)
  var KEY = 'ew-audio-2', FADE_OUT = 700, FADE_IN = 1500;
  var prefs = { volume: 0.5, muted: false };   // the volume fader's position, 0..1; starts at 50%
  try { var saved = JSON.parse(localStorage.getItem(KEY)); if (saved && typeof saved.volume === 'number') prefs = { volume: saved.volume, muted: false }; } catch (e) {}
  // (muted is no longer used: there's no mute button, the nav player pauses instead.)

  // ---------- The site's sound balance: the one place to change it ----------
  // How loud each kind of sound plays = fader position x its level here. With the fader at 50%:
  //   stage playlist  about -22 LUFS  (the loudest thing on the site, by a little)
  //   videos          about -24 LUFS  (Boiler Room videos, the Beyond Fashion reel in focus)
  //   page music      about -24 LUFS  (the track behind a case study)
  // These assume songs mastered like normal releases (about -10 LUFS) and videos whose sound was
  // levelled to -16 LUFS (the Boiler Room web videos are). A song or video that's louder or quieter
  // than that can get its own trim: `gain` on a line in TRACKS (js/hero.js), data-gain="0.5" on a
  // video's <figure>. Raise or lower a number here to move that whole group.
  var LEVEL = { stage: 0.5, media: 0.8, music: 0.4 };

  var PageAudio = window.PageAudio = {
    prefs: prefs,
    LEVEL: LEVEL,
    save: function (volume, muted) {
      prefs.volume = volume; prefs.muted = muted;
      try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {}
    },
    // Set by whatever plays music on this page. fadeOut() starts the fade and returns how many
    // ms to wait before leaving (0 = nothing playing, leave straight away). fadeIn() undoes it.
    fadeOut: null,
    fadeIn: null,
    // duck(true) dips this page's music (e.g. while a video plays its own sound); duck(false) restores it.
    duck: function () {}
  };

  // ---------- Audio hub for the nav player (js/nav-audio.js) ----------
  // Everything that makes sound on a page goes through one analyser, so the nav's histogram (and
  // the stage visualizer) can show whatever is playing:
  // - the homepage stage registers its own analyser and transport (js/hero.js);
  // - elsewhere, the page's music and any video playing its sound are routed in with connect().
  // transport: { isPlaying(), toggle(), next?(), prev?(), title?() } for the play/skip buttons.
  var hub = { ctx: null, analyser: null, transport: null, volCbs: [], transportCbs: [] };
  function ensureCtx() {
    if (hub.analyser || hub.ctx === false) return hub.analyser;
    var AC = window.AudioContext || window.webkitAudioContext;
    try {
      hub.ctx = new AC();
      hub.analyser = hub.ctx.createAnalyser(); hub.analyser.fftSize = 1024; hub.analyser.smoothingTimeConstant = 0.72;
      hub.analyser.connect(hub.ctx.destination);
    } catch (e) { hub.ctx = false; hub.analyser = null; }
    return hub.analyser;
  }
  Object.defineProperty(PageAudio, 'analyser', { get: function () { return hub.analyser; } });
  Object.defineProperty(PageAudio, 'transport', { get: function () { return hub.transport; } });
  PageAudio.setAnalyser = function (an) { hub.analyser = an; };
  PageAudio.setTransport = function (t) { hub.transport = t; hub.transportCbs.forEach(function (cb) { cb(); }); };
  PageAudio.onTransport = function (cb) { hub.transportCbs.push(cb); };
  // Route a media element's sound through the analyser (once per element; after a click/tap).
  PageAudio.connect = function (el) {
    if (!el || el.__hubSrc || !ensureCtx() || !hub.ctx) return;
    try { el.__hubSrc = hub.ctx.createMediaElementSource(el); el.__hubSrc.connect(hub.analyser); } catch (e) {}
    if (hub.ctx.state === 'suspended') hub.ctx.resume();
  };
  // The nav's volume bar: saves the level and tells whoever is playing.
  PageAudio.setVolume = function (v) {
    PageAudio.save(Math.min(1, Math.max(0, v)), false);
    hub.volCbs.forEach(function (cb) { cb(prefs.volume); });
  };
  PageAudio.onVolume = function (cb) { hub.volCbs.push(cb); };
  // Browsers start an audio context paused until a click/tap/key; wake it on the first one.
  ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) {
    window.addEventListener(ev, function () { if (hub.ctx && hub.ctx.state === 'suspended') hub.ctx.resume(); }, { capture: true });
  });

  // ---------- Leaving: fade out, then navigate ----------
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search) return;   // same page (an anchor)
    var wait = PageAudio.fadeOut ? PageAudio.fadeOut() : 0;
    if (!wait) return;
    e.preventDefault();
    setTimeout(function () { location.href = url.href; }, wait);
  });
  // Back/Forward can restore this page exactly as it was left: faded out. Bring the music back.
  window.addEventListener('pageshow', function (e) { if (e.persisted && PageAudio.fadeIn) PageAudio.fadeIn(); });

  // ---------- This page's own track ----------
  // From js/page-music.js (paths from the site's main folder, found from where this script lives),
  // or a data-music="..." on <body> (paths from the page), which wins if both are set.
  var root = (document.currentScript && document.currentScript.src || location.href).replace(/js\/page-audio\.js.*$/, '');
  var page = (location.pathname.split('/').pop() || 'index').replace(/\.html?$/, '');
  var listed = window.PAGE_MUSIC && window.PAGE_MUSIC[page];
  var src = (document.body && document.body.getAttribute('data-music')) || (listed ? new URL(listed, root).href : '');
  if (!src) return;
  var el = new Audio(src);
  el.loop = true; el.preload = 'auto'; el.volume = 0;
  PageAudio.el = el;   // for inspecting in the console
  var target = 0, raf = 0, started = false, userPaused = false;
  // Fade by stepping the element's volume. (iPhones ignore volume changes, so there the music
  // simply starts and stops.)
  function rampTo(v, ms, done) {
    cancelAnimationFrame(raf);
    var from = el.volume, t0 = performance.now();
    (function step(now) {
      var k = Math.min(1, (now - t0) / ms);
      el.volume = Math.max(0, Math.min(1, from + (v - from) * k));
      if (k < 1) raf = requestAnimationFrame(step); else if (done) done();
    })(t0);
  }
  function level() { return prefs.muted ? 0 : Math.min(1, prefs.volume * LEVEL.music); }
  function start() {
    if (started || userPaused) return;
    PageAudio.connect(el);
    var p = el.play();
    if (p && p.then) p.then(function () { started = true; rampTo(level(), FADE_IN); }, function () {});
    else { started = true; rampTo(level(), FADE_IN); }
  }
  // Try right away (allowed if the browser trusts this site already); otherwise on the first gesture.
  start();
  ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) { window.addEventListener(ev, start, { capture: true }); });

  PageAudio.fadeOut = function () { if (!started || el.paused || el.volume < 0.01) return 0; rampTo(0, FADE_OUT); return FADE_OUT; };
  PageAudio.fadeIn = function () { if (started) rampTo(level(), FADE_IN); };
  var ducked = false;
  PageAudio.duck = function (on) { ducked = !!on; if (started) rampTo(ducked ? level() * 0.12 : level(), 450); };

  // ---------- Nav player controls for this page's music ----------
  PageAudio.setTransport({
    isPlaying: function () { return started && !el.paused; },
    toggle: function () {
      if (!started) { userPaused = false; start(); return; }
      if (el.paused) { userPaused = false; var p = el.play(); if (p && p.catch) p.catch(function () {}); rampTo(level(), 400); }
      else { userPaused = true; rampTo(0, 300, function () { el.pause(); }); }
    },
    title: function () { return decodeURIComponent(src.split('/').pop().replace(/\.[a-z0-9]+$/i, '')); }
  });
  PageAudio.onVolume(function () { if (started && !el.paused) rampTo(ducked ? level() * 0.12 : level(), 150); });
})();
