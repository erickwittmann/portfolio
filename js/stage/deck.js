// The lighting deck under the stage: now-playing waveform, transport, volume and four dials.
// Dials: drag up/down (or left/right), scroll, or use arrow keys. Double-click resets.
// Pyro also fires when pressed (click/tap without dragging, or Enter/Space).
(function () {
  var Stage = window.Stage, SFX = window.SFX;
  var deck = document.getElementById('deck');
  if (!Stage) { deck.hidden = true; return; }   // stage failed to start; nothing to control
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Transport + volume ----------
  var btnPlay = document.getElementById('btn-play'), btnMute = document.getElementById('btn-mute');
  var vol = document.getElementById('volume'), titleEl = document.getElementById('song-title');
  btnPlay.addEventListener('click', function () { Stage.togglePlay(); });
  document.getElementById('btn-prev').addEventListener('click', function () { Stage.prev(); });
  document.getElementById('btn-next').addEventListener('click', function () { Stage.next(); });
  btnMute.addEventListener('click', function () { Stage.toggleMute(); });
  vol.addEventListener('input', function () { Stage.setVolume(vol.value / 100); paintVol(); });
  function paintVol() { vol.style.setProperty('--v', vol.value + '%'); }
  function syncPlay() {
    btnPlay.classList.toggle('is-playing', Stage.playing);
    btnPlay.setAttribute('aria-label', Stage.playing ? 'Pause' : 'Play');
  }
  function syncMute() {
    btnMute.classList.toggle('is-muted', Stage.muted);
    btnMute.setAttribute('aria-label', Stage.muted ? 'Unmute' : 'Mute');
  }
  function syncTrack() {
    var t = Stage.track();
    titleEl.innerHTML = '';
    var a = document.createElement('b'); a.textContent = t.artist;
    titleEl.appendChild(a); titleEl.appendChild(document.createTextNode(' — ' + t.title));
  }
  Stage.on('play', syncPlay); Stage.on('mute', syncMute); Stage.on('track', syncTrack);
  syncPlay(); syncMute(); syncTrack(); paintVol();

  // ---------- Dials ----------
  var NS = 'http://www.w3.org/2000/svg', DOTS = 11, SWEEP = 270;
  var HUES = ['Red', 'Orange', 'Yellow', 'Lime', 'Green', 'Teal', 'Cyan', 'Blue', 'Indigo', 'Purple', 'Magenta', 'Pink', 'Red'];
  function describe(param, v) {
    if (param === 'hue') return HUES[Math.round(v * 12)];
    if (v < 0.04 && param !== 'haze') return 'Off';
    if (param === 'strobe') return (0.6 + v * 2.4).toFixed(1) + ' flashes per second';
    return Math.round(v * 100) + '%';
  }
  function svg(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  Array.prototype.forEach.call(deck.querySelectorAll('.knob'), function (el) {
    var param = el.getAttribute('data-param');
    var def = parseFloat(el.getAttribute('data-value')) || 0, value = def;
    var tapFires = el.getAttribute('data-tap') === 'fire';
    el.setAttribute('role', 'slider'); el.setAttribute('tabindex', '0');
    el.setAttribute('aria-valuemin', '0'); el.setAttribute('aria-valuemax', '100');

    var root = svg('svg', { viewBox: '-30 -30 60 60', 'aria-hidden': 'true' }, el);
    var dots = [];
    for (var i = 0; i < DOTS; i++) {
      var a = (-SWEEP / 2 + SWEEP * i / (DOTS - 1)) * Math.PI / 180;
      var d = svg('circle', { cx: (Math.sin(a) * 27).toFixed(2), cy: (-Math.cos(a) * 27).toFixed(2), r: 1.7, class: 'dot' }, root);
      if (param === 'hue') d.style.fill = 'hsl(' + Math.round(i / (DOTS - 1) * 360) + ',90%,60%)';
      dots.push(d);
    }
    svg('circle', { cx: 0, cy: 0, r: 17, class: 'cap' }, root);
    var needle = svg('line', { x1: 0, y1: -6, x2: 0, y2: -14, class: 'needle' }, root);

    var lastDetent = Math.round(value * 20);
    function render() {
      needle.setAttribute('transform', 'rotate(' + (-SWEEP / 2 + SWEEP * value).toFixed(1) + ')');
      var lit = value * (DOTS - 1);
      dots.forEach(function (d, i) {
        if (param === 'hue') { d.style.opacity = Math.abs(i - lit) < 0.5 ? 1 : 0.35; d.setAttribute('r', Math.abs(i - lit) < 0.5 ? 2.6 : 1.7); }
        else d.classList.toggle('on', i <= lit + 0.001 && value > 0.02);
      });
      el.setAttribute('aria-valuenow', Math.round(value * 100));
      el.setAttribute('aria-valuetext', describe(param, value));
    }
    function set(v, silent) {
      value = Math.min(1, Math.max(0, v));
      var detent = Math.round(value * 20);
      if (detent !== lastDetent && !silent) { SFX.tick(); lastDetent = detent; }
      Stage.set(param, value);
      render();
    }
    function tap() {
      if (!tapFires) return;
      Stage.fire();
      el.classList.add('is-fired');
      setTimeout(function () { el.classList.remove('is-fired'); }, 160);
    }

    var drag = null;
    el.addEventListener('pointerdown', function (e) {
      el.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, v: value, moved: false };
      e.preventDefault();
      el.focus({ preventScroll: true });
    });
    el.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = drag.y - e.clientY;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      if (drag.moved) set(drag.v + (dx + dy) / 170);
    });
    function end() { if (drag && !drag.moved) tap(); drag = null; }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', function () { drag = null; });
    el.addEventListener('wheel', function (e) { e.preventDefault(); set(value - e.deltaY * 0.0009); }, { passive: false });
    el.addEventListener('dblclick', function () { set(def); });
    el.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 0.01 : 0.05, k = e.key;
      if (k === 'ArrowUp' || k === 'ArrowRight') set(value + step);
      else if (k === 'ArrowDown' || k === 'ArrowLeft') set(value - step);
      else if (k === 'PageUp') set(value + 0.2);
      else if (k === 'PageDown') set(value - 0.2);
      else if (k === 'Home') set(0);
      else if (k === 'End') set(1);
      else if ((k === 'Enter' || k === ' ') && tapFires) tap();
      else return;
      e.preventDefault();
    });
    set(value, true);
  });

  // ---------- Waveform ----------
  // Live waveform once audio is on; until then a synthetic trace that breathes with the lights.
  var cv = document.getElementById('wave'), g = cv.getContext('2d');
  var buf = new Uint8Array(1024), visible = true, t0 = performance.now();
  function size() {
    var r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
  }
  size();
  window.addEventListener('resize', size);
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(cv);

  (function draw() {
    requestAnimationFrame(draw);
    if (!visible) return;
    var w = cv.width, h = cv.height, mid = h / 2, t = (performance.now() - t0) / 1000;
    var hue = Stage.state.hue * 360, lvl = Stage.state.level;
    g.clearRect(0, 0, w, h);
    var gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, 'hsla(' + (hue - 70) + ',95%,62%,0)');
    gr.addColorStop(0.18, 'hsl(' + (hue - 70) + ',95%,62%)');
    gr.addColorStop(0.5, 'hsl(' + hue + ',95%,60%)');
    gr.addColorStop(0.82, 'hsl(' + (hue + 70) + ',95%,62%)');
    gr.addColorStop(1, 'hsla(' + (hue + 70) + ',95%,62%,0)');
    g.strokeStyle = gr; g.lineWidth = Math.max(1.5, h / 22); g.lineJoin = 'round';

    var live = Stage.getWaveform(buf), pts = 96, i, x, y, env;
    g.beginPath();
    for (i = 0; i <= pts; i++) {
      x = i / pts * w; env = Math.sin(Math.PI * i / pts);
      if (live) y = mid + ((buf[Math.floor(i / pts * (buf.length - 1))] - 128) / 128) * h * 0.9 * env;
      else {
        var amp = Stage.playing && !reduced ? h * 0.26 * (0.35 + lvl) : h * 0.03;
        y = mid + env * amp * (Math.sin(i * 0.33 + t * 3.1) + 0.45 * Math.sin(i * 0.81 - t * 5.3));
      }
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.stroke();
  })();
})();
