// The music player in the nav, on every page: back, a live histogram, skip. Hovering it drops a
// volume bar down; clicking the histogram pauses (it settles into a still white line) and plays.
// - It shows whatever is making sound on the page, through the audio hub in js/page-audio.js:
//   the stage playlist on the homepage (js/hero.js), the page's music and any video playing its
//   sound on a case study.
// - Back/skip only appear where there's a playlist (the homepage).
// - The lines are the music's spectrum (js/spectrum.js), the same lines the stage's visualizer
//   draws: nothing but the audio moves them. Silence = a flat line.
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
    // Mirrored: the bass sits in the middle, the highs toward both ends. Peaks rise from a baseline
    // that drops a little while music plays, so they have room; the lines spread apart slightly.
    var base = H / 2 + H * 0.22 * live, gap = 2.4 * live, amp = H * 0.62, N = Math.max(32, Math.round(W / 3)), bins = spec.bins;
    for (var l = 0; l < LINES; l++) {
      var c = COLORS[l], wh = 1 - live, row = spec.rows[l];   // colours fade to white as the line goes still
      ctx.strokeStyle = 'rgb(' + Math.round(c[0] + (255 - c[0]) * wh) + ',' + Math.round(c[1] + (255 - c[1]) * wh) + ',' + Math.round(c[2] + (255 - c[2]) * wh) + ')';
      ctx.beginPath();
      for (var i = 0; i <= N; i++) {
        var x = i / N, d = Math.abs(x - 0.5) * 2, f = d * (bins - 1), b0 = Math.floor(f), b1 = Math.min(bins - 1, b0 + 1);
        var v = row[b0] + (row[b1] - row[b0]) * (f - b0);
        v *= 1 - Math.pow(d, 6);   // ease the ends down to the baseline
        var y = Math.max(1, base + (l - (LINES - 1) / 2) * gap - v * amp);
        if (i) ctx.lineTo(x * W, y); else ctx.moveTo(0, y);
      }
      ctx.stroke();
    }
  })(last);
})();
