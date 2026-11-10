// Shared audio: saved volume, analyser hub, page music and fades between pages.
(function () {
  var KEY = 'ew-audio-2', FADE_OUT = 700, FADE_IN = 1500;
  var prefs = { volume: 0.5, muted: false };   // the volume fader's position, 0..1; starts at 50%
  try { var saved = JSON.parse(localStorage.getItem(KEY)); if (saved && typeof saved.volume === 'number') prefs = { volume: saved.volume, muted: false }; } catch (e) {}

  var LEVEL = { stage: 0.5, media: 0.8, music: 0.4 };

  var PageAudio = window.PageAudio = {
    prefs: prefs,
    LEVEL: LEVEL,
    save: function (volume, muted) {
      prefs.volume = volume; prefs.muted = muted;
      try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {}
    },
    fadeOut: null,
    fadeIn: null,
    duck: function () {}
  };

  // ---------- Audio hub for the nav player ----------
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
  PageAudio.connect = function (el) {
    if (!el || el.__hubSrc || !ensureCtx() || !hub.ctx) return;
    try { el.__hubSrc = hub.ctx.createMediaElementSource(el); el.__hubSrc.connect(hub.analyser); } catch (e) {}
    if (hub.ctx.state === 'suspended') hub.ctx.resume();
  };
  PageAudio.setVolume = function (v) {
    PageAudio.save(Math.min(1, Math.max(0, v)), false);
    hub.volCbs.forEach(function (cb) { cb(prefs.volume); });
  };
  PageAudio.onVolume = function (cb) { hub.volCbs.push(cb); };
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
  window.addEventListener('pageshow', function (e) { if (e.persisted && PageAudio.fadeIn) PageAudio.fadeIn(); });

  // ---------- This page's own track ----------
  var root = (document.currentScript && document.currentScript.src || location.href).replace(/js\/page-audio\.js.*$/, '');
  var page = (location.pathname.split('/').pop() || 'index').replace(/\.html?$/, '');
  var listed = window.PAGE_MUSIC && window.PAGE_MUSIC[page];
  var src = (document.body && document.body.getAttribute('data-music')) || (listed ? new URL(listed, root).href : '');
  if (!src) return;
  var el = new Audio(src);
  el.loop = true; el.preload = 'auto'; el.volume = 0;
  PageAudio.el = el;   // for inspecting in the console
  var target = 0, raf = 0, started = false, userPaused = false;
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
    title: function () { return decodeURIComponent(src.split('/').pop().replace(/\.[a-z0-9]+$/i, '')); },
    src: function () { return src; }   // for the now-playing card (js/now-playing.js)
  });
  PageAudio.onVolume(function () { if (started && !el.paused) rampTo(ducked ? level() * 0.12 : level(), 150); });
})();
