// The music player in the nav, on every page: back, a live histogram, skip. Hovering it drops a
// volume bar down; clicking the histogram pauses (it settles into a still white line) and plays.
// - It shows whatever is making sound on the page, through the audio hub in js/page-audio.js:
//   the stage playlist on the homepage (js/hero.js), the page's music and any video playing its
//   sound on a case study.
// - Back/skip only appear where there's a playlist (the homepage).
// - The lines are the music's spectrum (js/spectrum.js), the same lines the stage's visualizer
//   draws: nothing but the audio moves them. Silence = a flat line. They're drawn OP-1 style:
//   bass to highs from left to right, all the lines pinched together at both ends.
// Load after js/page-audio.js and js/spectrum.js.
(function () {
  var PA = window.PageAudio, nav = document.getElementById('nav');
  if (!PA || !nav) return;
  var ul = nav.querySelector('ul');
  var LINES = 6;
  // Top to bottom, as in the design: red, cyan, blue, yellow, white, magenta.
  var COLORS = [[255, 20, 20], [25, 215, 255], [40, 90, 255], [255, 230, 0], [255, 255, 255], [255, 25, 215]];

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

  // ---------- Histogram ----------
  var W = 0, H = 0, dpr = 1;
  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
  }
  size(); addEventListener('resize', size);
  // Points along each line, and how far each may leave the centre: 0 at both ends (where all the
  // lines meet), rising quickly to 1. Fixed, so it's worked out once.
  var PTS = 30, ENV = new Float32Array(PTS + 1);
  // Each band's recent peak and usual level (see the drawing below). SPAN: the share of the spectrum
  // drawn, bass upward; the very top is near-silent in most songs, so it's left off.
  var PEAK = new Float32Array(48), AVG = new Float32Array(48), SPAN = 0.72;
  for (var ei = 0; ei <= PTS; ei++) { var ex = ei / PTS, ea = Math.min(1, ex / 0.16, (1 - ex) / 0.16); ENV[ei] = ea * ea * (3 - 2 * ea); }

  var freq = null, spec = window.SpectrumLines ? SpectrumLines(48, LINES) : null;
  var live = 0, last = performance.now(), wasPlaying = null, drawnStill = '';
  // Reads the music into the shared spectrum lines (js/spectrum.js). Returns whether anything is heard.
  function analyse(playing) {
    var an = PA.analyser;
    if (an && playing) {
      if (!freq || freq.length !== an.frequencyBinCount) freq = new Uint8Array(an.frequencyBinCount);
      an.getByteFrequencyData(freq);
      return spec.update(freq) > 0.004;   // silence (e.g. sound not allowed yet) counts as not playing
    }
    spec.update(null);
    return false;
  }
  // Is anything audible? The transport (music) or, on case pages, a video playing its sound.
  function soundOn() {
    var tp = tr();
    if (tp && tp.isPlaying()) return true;
    var vids = document.querySelectorAll('video');
    for (var i = 0; i < vids.length; i++) if (!vids[i].paused && !vids[i].muted && vids[i].volume > 0.01) return true;
    return false;
  }
  (function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var playing = soundOn(), heard = spec ? analyse(playing) : false;
    live += ((heard ? 1 : 0) - live) * Math.min(1, dt * 5);   // 1 = colourful wave, 0 = still white line
    if (playing !== wasPlaying) {
      wasPlaying = playing;
      waveBtn.setAttribute('aria-pressed', playing ? 'false' : 'true');
      waveBtn.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
      li.classList.toggle('is-paused', !playing);
    }
    if (!W) return;
    // Settled into the still white line: it's already drawn, so skip until something plays.
    var still = live < 0.002 && !heard;
    if (still && drawnStill === W + 'x' + H) return;
    drawnStill = still ? W + 'x' + H : '';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1.4; ctx.lineJoin = ctx.lineCap = 'round';
    // OP-1 style: bass on the left, highs on the right (not mirrored). Every line leaves from one
    // point at the left end and comes back to one point at the right; in between they fan apart and
    // swing above and below the centre on smooth curves. Each line reads the spectrum a little
    // further along than the one above it, so they move like separate strands, not copies.
    var mid = H / 2, gap = H * 0.085 * live, amp = H * 0.75 * live, bins = spec.bins, x0 = 2, xw = W - 4;
    // Each band swings around its own usual level (a slow average), scaled by its recent peak, so
    // the quieter highs on the right move as much as the bass on the left. Silent bands stay level.
    var top = spec.rows[0], ka = Math.min(1, dt * 0.8);
    for (var pb = 0; pb < bins; pb++) { AVG[pb] += (top[pb] - AVG[pb]) * ka; PEAK[pb] = Math.max(top[pb], PEAK[pb] - dt * 0.12); }
    for (var l = 0; l < LINES; l++) {
      var c = COLORS[l], wh = 1 - live, row = spec.rows[l], off = (l - (LINES - 1) / 2) * gap, shift = l * 0.018;
      ctx.strokeStyle = 'rgb(' + Math.round(c[0] + (255 - c[0]) * wh) + ',' + Math.round(c[1] + (255 - c[1]) * wh) + ',' + Math.round(c[2] + (255 - c[2]) * wh) + ')';
      ctx.beginPath(); ctx.moveTo(x0, mid);
      var px = x0, py = mid;
      for (var i = 1; i <= PTS; i++) {
        var x = i / PTS, e = ENV[i], f = Math.min(1, x * 0.94 + shift) * (bins * SPAN - 1), b0 = Math.floor(f), b1 = Math.min(bins - 1, b0 + 1);
        var v = row[b0] + (row[b1] - row[b0]) * (f - b0);
        v = (v - AVG[b0]) / Math.max(PEAK[b0], 0.05);   // above / below its band's usual level
        var nx = x0 + x * xw, ny = Math.min(H - 1.5, Math.max(1.5, mid + (off - v * amp) * e));
        ctx.quadraticCurveTo(px, py, (px + nx) / 2, (py + ny) / 2);   // through the midpoints: rounded, no corners
        px = nx; py = ny;
      }
      ctx.lineTo(x0 + xw, mid);
      ctx.stroke();
    }
  })(last);
})();
