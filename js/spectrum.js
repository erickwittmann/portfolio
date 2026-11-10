// Shared spectrum smoothing for the visualizers.
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
