// Anatomy of a Computer: embedded playable build on the case study.
(function () {
  var player = document.querySelector('.aoc-player');
  if (!player) return;
  var screen = player.querySelector('.aoc-screen'), start = player.querySelector('.aoc-start'),
      poster = player.querySelector('.aoc-poster'), label = player.querySelector('.aoc-start-label'),
      tabs = player.querySelectorAll('[data-build]'), full = player.querySelector('.aoc-full'),
      stop = player.querySelector('.aoc-stop'), open = player.querySelector('.aoc-open'), hint = player.querySelector('.aoc-hint');

  var BUILDS = {
    live:  { src: '../anatomy/live/index.html', poster: '../anatomy/shots/live.jpg', label: 'Play the live build',
             title: 'Anatomy of a Computer, live build',
             hint: 'Drag to turn a part · ← → change parts · 1–5 switch views · sound starts on your first click inside' },
    proto: { src: '../anatomy/prototype/index.html', poster: '../anatomy/shots/prototype.jpg', label: 'Play the prototype',
             title: 'Anatomy of a Computer, prototype',
             hint: '← → change parts · 1 goes down a view, 2 goes up · M turns the sound off' }
  };
  var build = 'live', frame = null;

  function duck(on) { if (window.PageAudio && PageAudio.duck) PageAudio.duck(on); }

  function play() {
    if (frame) frame.remove();
    frame = document.createElement('iframe');
    frame.src = BUILDS[build].src;
    frame.title = BUILDS[build].title;
    frame.allow = 'fullscreen; autoplay';
    frame.setAttribute('allowfullscreen', '');
    frame.addEventListener('load', function () { try { frame.contentWindow.focus(); } catch (e) {} });
    screen.appendChild(frame);
    player.classList.add('is-playing');
    duck(true);
  }

  function end() {
    if (document.fullscreenElement === screen && document.exitFullscreen) document.exitFullscreen();
    if (frame) { frame.remove(); frame = null; }
    player.classList.remove('is-playing');
    duck(false);
    start.focus({ preventScroll: true });
  }

  function choose(name) {
    if (name === build) return;
    build = name;
    tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.build === name)); });
    poster.src = BUILDS[name].poster;
    label.textContent = BUILDS[name].label;
    open.href = BUILDS[name].src;
    hint.textContent = BUILDS[name].hint;
    if (frame) play();   // already playing: switch builds in place
  }

  start.addEventListener('click', play);
  stop.addEventListener('click', end);
  tabs.forEach(function (t) { t.addEventListener('click', function () { choose(t.dataset.build); }); });
  full.addEventListener('click', function () {
    if (!frame) play();
    var go = screen.requestFullscreen || screen.webkitRequestFullscreen;
    if (go) { var p = go.call(screen); if (p && p.catch) p.catch(function () {}); }
  });
})();
