// The homepage's music: the playlist in js/tracks.js, run from the nav player (js/nav-audio.js):
// play/pause, back, skip and volume. Songs crossfade into each other (on skip, and when one ends).
// - Browsers only allow sound after a click/tap/key; the music starts on the first one (on the
//   homepage that's usually "click to enter").
// - Everything goes through the site's audio hub (js/page-audio.js), so the nav histogram and the
//   now-playing panel (js/now-playing.js) follow it, and leaving for another page fades it out.
// - Volume = the nav fader x LEVEL.stage (js/page-audio.js) x the song's own `gain` (js/tracks.js).
// Load after js/page-audio.js and js/tracks.js. (The archived 3D stage, stage.html, has its own
// player in js/stage/hero.js.)
(function () {
  var PA = window.PageAudio, TRACKS = window.TRACKS || [];
  if (!PA || !TRACKS.length) return;
  var XFADE = 1.6, FADE_IN = 1.5, LEAVE = 0.7;   // seconds
  var LEVEL = PA.LEVEL ? PA.LEVEL.stage : 0.5;

  // Two players take turns: the next song loads into the idle one and fades up while the other fades down.
  function make() {
    var el = new Audio();
    el.preload = 'auto';
    return { el: el, mix: 0, to: 0 };
  }
  var P = [make(), make()], cur = 0, index = 0, started = false, userPaused = false;
  var master = 0, masterTo = 1, duck = 1, raf = 0, last = 0;
  function gain(i) { var g = TRACKS[i].gain; return typeof g === 'number' ? g : 1; }
  var gains = [gain(0), 1];
  function load(k, i) { P[k].el.src = TRACKS[i].src; gains[k] = gain(i); }
  load(0, 0);

  // Volumes ease toward their targets in one small loop that only runs while something is moving.
  function level() { return PA.prefs.muted ? 0 : PA.prefs.volume * LEVEL * duck; }
  function apply() {
    var L = level();
    for (var k = 0; k < 2; k++) P[k].el.volume = Math.max(0, Math.min(1, L * gains[k] * P[k].mix * master));
  }
  function step(now) {
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    var moving = false;
    function ease(v, to, secs) {
      if (v === to) return v;
      var d = dt / secs, n = to > v ? Math.min(to, v + d) : Math.max(to, v - d);
      if (n !== to) moving = true;
      return n;
    }
    P[0].mix = ease(P[0].mix, P[0].to, XFADE); P[1].mix = ease(P[1].mix, P[1].to, XFADE);
    master = ease(master, masterTo, masterTo > master ? FADE_IN : LEAVE);
    apply();
    raf = moving ? requestAnimationFrame(step) : 0;
  }
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); } }
  function play(el) { var p = el.play(); if (p && p.catch) p.catch(function () {}); return p; }

  function start() {
    if (started || userPaused) return;
    P.forEach(function (p) { PA.connect(p.el); });
    var p = play(P[cur].el);
    var go = function () { started = true; P[cur].mix = 1; P[cur].to = 1; master = 0; masterTo = 1; kick(); };
    if (p && p.then) p.then(go, function () {}); else go();
  }
  ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) { window.addEventListener(ev, start, { capture: true }); });

  function skip(dir) {
    if (TRACKS.length < 2) { P[cur].el.currentTime = 0; return; }
    userPaused = false;
    index = (index + dir + TRACKS.length) % TRACKS.length;
    var from = cur, to = 1 - cur;
    load(to, index);
    cur = to;
    P[to].mix = 0; P[to].to = 1; P[from].to = 0;
    if (!started) { start(); return; }
    masterTo = 1;
    play(P[to].el); kick();
    setTimeout(function () { if (cur !== from) P[from].el.pause(); }, XFADE * 1000 + 200);
  }
  // Near the end of a song, blend into the next one.
  P.forEach(function (p, k) {
    p.el.addEventListener('timeupdate', function () {
      var el = p.el;
      if (k === cur && !userPaused && el.duration > XFADE * 3 && el.duration - el.currentTime < XFADE) skip(1);
    });
    p.el.addEventListener('ended', function () { if (k === cur && !userPaused) skip(1); });
  });

  PA.setTransport({
    isPlaying: function () { return started && !userPaused && !P[cur].el.paused; },
    toggle: function () {
      if (!started) { userPaused = false; start(); return; }
      if (userPaused || P[cur].el.paused) { userPaused = false; play(P[cur].el); masterTo = 1; kick(); }
      else {
        userPaused = true; masterTo = 0; kick();
        setTimeout(function () { if (userPaused) P.forEach(function (p) { p.el.pause(); }); }, LEAVE * 1000 + 50);
      }
    },
    next: function () { skip(1); },
    prev: function () { skip(-1); },
    title: function () { return TRACKS[index].artist + ' — ' + TRACKS[index].title; },
    src: function () { return TRACKS[index].src; }
  });
  PA.onVolume(function () { apply(); });
  PA.fadeOut = function () { if (!started || userPaused) return 0; masterTo = 0; kick(); return LEAVE * 1000; };
  PA.fadeIn = function () { if (started && !userPaused) { masterTo = 1; kick(); } };
  PA.duck = function (on) { duck = on ? 0.12 : 1; apply(); };
})();
