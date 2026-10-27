// The histogram's shape, shared by the nav player (js/nav-audio.js) and the stage visualizer
// (js/visualizer.js), so the two always match. It is the music's spectrum and nothing else: no clock
// moves it, so when the sound stops the lines lie flat.
//   var s = SpectrumLines();     // 48 bins x 6 lines
//   s.update(freqBytes | null)   // once per frame, from analyser.getByteFrequencyData (null = silence)
//   s.rows[line][bin]            // 0..1; bin 0 = bass ... last = highs
// The six lines are the same spectrum followed at different speeds: line 0 snaps to every hit, each
// line after trails a little more, which stacks them into the layered look.
(function () {
  var RATES = [0.75, 0.5, 0.36, 0.26, 0.19, 0.14];
  window.SpectrumLines = function (bins, lines) {
    bins = bins || 48; lines = lines || RATES.length;
    var rows = [], now = new Float32Array(bins), i;
    for (i = 0; i < lines; i++) rows.push(new Float32Array(bins));
    return {
      bins: bins, lines: lines, rows: rows, energy: 0,
      update: function (freq) {
        var e = 0, b, l;
        if (freq && freq.length) {
          var top = freq.length * 0.7;
          for (b = 0; b < bins; b++) {   // spaced like hearing: more bins for the lows
            var lo = 1 + Math.floor(Math.pow(b / bins, 2) * top), hi = Math.max(lo + 1, 1 + Math.floor(Math.pow((b + 1) / bins, 2) * top));
            var s = 0; for (var j = lo; j < hi; j++) s += freq[j];
            // Highs are naturally far quieter than the bass: tilt them up so the whole width moves.
            // Then a soft ceiling (no flat tops when it's loud): approaches 1 without clipping.
            var raw = Math.pow(s / ((hi - lo) * 255), 1.5) * (1 + 1.8 * b / bins);
            var v = 1 - Math.exp(-raw * 1.15);
            now[b] = v; e += v;
          }
        } else for (b = 0; b < bins; b++) now[b] = 0;
        this.energy = e / bins;
        for (l = 0; l < lines; l++) {
          var r = RATES[Math.min(l, RATES.length - 1)], row = rows[l];
          for (b = 0; b < bins; b++) row[b] += (now[b] - row[b]) * r;
        }
        return this.energy;
      }
    };
  };
})();
