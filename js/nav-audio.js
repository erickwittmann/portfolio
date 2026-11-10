(function () {
  var PA = window.PageAudio, nav = document.getElementById('nav');
  if (!PA || !nav) return;
  var ul = nav.querySelector('ul');

  var li = document.createElement('li');
  li.className = 'nav-audio';
  li.innerHTML =
    '<button type="button" class="na-skip na-prev" aria-label="Previous song"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h2v10H3zM13 3v10L6 8z"/></svg></button>' +
    '<button type="button" class="na-wave" aria-label="Pause music" aria-pressed="false"><canvas></canvas></button>' +
    '<button type="button" class="na-skip na-next" aria-label="Next song"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 3h2v10h-2zM3 3v10l7-5z"/></svg></button>' +
    '<div class="na-vol"><label class="na-vol-in"><span class="sr-only">Volume</span><input type="range" min="0" max="1" step="0.01"></label></div>';
  ul.appendChild(li);
  var waveBtn = li.querySelector('.na-wave'), canvas = li.querySelector('canvas'), ctx = canvas.getContext('2d');
  var prev = li.querySelector('.na-prev'), next = li.querySelector('.na-next'), range = li.querySelector('input');

  // ---------- Controls ----------
  function tr() { return PA.transport; }
  function syncButtons() {
    var t = tr(), list = !!(t && t.next);
    prev.hidden = next.hidden = !list;
    li.classList.toggle('has-player', !!t);
  }
  PA.onTransport(syncButtons); syncButtons();
  waveBtn.addEventListener('click', function () { var t = tr(); if (t && t.toggle) t.toggle(); });
  prev.addEventListener('click', function () { var t = tr(); if (t && t.prev) t.prev(); });
  next.addEventListener('click', function () { var t = tr(); if (t && t.next) t.next(); });
  range.value = PA.prefs.volume;
  range.addEventListener('input', function () { PA.setVolume(parseFloat(range.value)); paintRange(); });
  function paintRange() { range.style.setProperty('--v', (range.value * 100).toFixed(1) + '%'); }
  paintRange();

  // ---------- Visualizer ----------
  var W = 0, H = 0, dpr = 1, drawnStill = '';
  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
    drawnStill = '';
  }
  size(); addEventListener('resize', size);

  var BINS = 48, SPAN = 0.72;
  var OUTER = [[0, [88, 201, 166]], [0.42, [228, 132, 230]], [0.72, [156, 92, 255]], [1, [128, 40, 245]]];
  var INNER = [[0, [104, 214, 180]], [0.35, [255, 120, 90]], [0.75, [255, 100, 150]], [1, [170, 70, 255]]];
  function mix(stops, t) {
    for (var i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
      var a = stops[i - 1], b = stops[i], k = (t - a[0]) / (b[0] - a[0]);
      return [a[1][0] + (b[1][0] - a[1][0]) * k, a[1][1] + (b[1][1] - a[1][1]) * k, a[1][2] + (b[1][2] - a[1][2]) * k];
    }
    return stops[stops.length - 1][1];
  }
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')'; }

  var bars = 0, outerH, innerH, palette = [];
  function layout() {
    bars = Math.max(12, Math.round(W / 7));
    outerH = new Float32Array(bars); innerH = new Float32Array(bars); palette = [];
    for (var i = 0; i < bars; i++) {
      var t = i / (bars - 1);
      palette.push({ o: mix(OUTER, t), c: mix(INNER, t), env: Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.9), core: Math.max(0, Math.sin(Math.PI * (t - 0.18) / 0.78)) });
    }
  }

  var freq = null, spec = window.SpectrumLines ? SpectrumLines(BINS, 3) : null;
  var PEAK = new Float32Array(BINS);
  var live = 0, last = performance.now(), wasPlaying = null;
  function analyse(playing) {
    var an = PA.analyser;
    if (an && playing) {
      if (!freq || freq.length !== an.frequencyBinCount) freq = new Uint8Array(an.frequencyBinCount);
      an.getByteFrequencyData(freq);
      return spec.update(freq) > 0.004;
    }
    spec.update(null);
    return false;
  }
  function soundOn() {
    var tp = tr();
    if (tp && tp.isPlaying()) return true;
    var vids = document.querySelectorAll('video');
    for (var i = 0; i < vids.length; i++) if (!vids[i].paused && !vids[i].muted && vids[i].volume > 0.01) return true;
    return false;
  }
  function band(row, t) {
    var f = t * (BINS * SPAN - 1), b0 = Math.floor(f), b1 = Math.min(BINS - 1, b0 + 1);
    var v = row[b0] + (row[b1] - row[b0]) * (f - b0);
    return Math.min(1, v / Math.max(PEAK[b0], 0.08));
  }
  function capsule(x, mid, w, h, c, alpha) {
    var g = ctx.createLinearGradient(0, mid - h / 2, 0, mid + h / 2);
    g.addColorStop(0, rgba(c, alpha * 0.3)); g.addColorStop(0.5, rgba(c, alpha)); g.addColorStop(1, rgba(c, alpha * 0.3));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, mid, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
  }

  (function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var playing = soundOn(), heard = spec ? analyse(playing) : false;
    live += ((heard ? 1 : 0) - live) * Math.min(1, dt * 4);
    if (playing !== wasPlaying) {
      wasPlaying = playing;
      waveBtn.setAttribute('aria-pressed', playing ? 'false' : 'true');
      waveBtn.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
      li.classList.toggle('is-paused', !playing);
    }
    if (!W || !spec) return;
    if (!bars || palette.length !== Math.max(12, Math.round(W / 7))) layout();
    var still = live < 0.002 && !heard;
    if (still && drawnStill === W + 'x' + H) return;
    drawnStill = still ? W + 'x' + H : '';

    var top = spec.rows[0], slow = spec.rows[2];
    for (var b = 0; b < BINS; b++) PEAK[b] = Math.max(top[b], PEAK[b] - dt * 0.15);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var mid = H / 2, step = W / bars, bw = Math.max(2, step * 0.62), dot = Math.min(bw, 3.5);
    var ease = Math.min(1, dt * 14);
    for (var i = 0; i < bars; i++) {
      var p = palette[i], t = i / (bars - 1);
      var o = (0.18 + 0.82 * band(top, t)) * p.env * live, n = band(slow, t) * p.core * live;
      outerH[i] += (o - outerH[i]) * ease; innerH[i] += (n - innerH[i]) * ease;
      var x = step * (i + 0.5), oh = Math.max(dot, outerH[i] * H), ih = innerH[i] * H * 0.62;
      var dim = 1 - live;
      capsule(x, mid, bw, oh, [p.o[0] + (255 - p.o[0]) * dim, p.o[1] + (255 - p.o[1]) * dim, p.o[2] + (255 - p.o[2]) * dim], 0.9);
      if (ih > 2) capsule(x, mid, bw * 0.8, ih, p.c, 0.95);
    }
  })(last);
})();
