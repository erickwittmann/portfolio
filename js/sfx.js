// Synthesized sound effects (no audio files): relay clicks for the splash letters, a heavy
// "lights on" clunk and knob detent ticks.
// Browsers keep audio locked until the visitor clicks, taps or presses a key. Sounds requested
// before that are silently skipped; SFX.onUnlock lets the stage unmute the reel at that moment.
(function () {
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, master = null, noise = null, unlocked = false, waiting = [];
  try { ctx = AC ? new AC() : null; } catch (e) { ctx = null; }
  if (ctx) {
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var d = noise.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function live() { return ctx && ctx.state === 'running'; }

  function env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  function burst(t, dur, type, freq, q, peak, decay) {
    var s = ctx.createBufferSource(); s.buffer = noise;
    var f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    var g = ctx.createGain(); env(g, t, peak, 0.002, decay);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 0.5, dur);
    return f;
  }
  function thump(t, f0, f1, peak, decay) {
    var o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + decay);
    var g = ctx.createGain(); env(g, t, peak, 0.004, decay);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + decay + 0.05);
  }

  var SFX = {
    get ctx() { return ctx; },
    get unlocked() { return unlocked; },
    // A stage-light relay engaging: a bright click over a small body thump. `i` varies the pitch.
    relay: function (i) {
      if (!live()) return;
      var t = ctx.currentTime, k = 1 + ((i || 0) % 5) * 0.06;
      burst(t, 0.03, 'bandpass', 2600 * k, 1.4, 0.32, 0.03);
      thump(t, 150 * k, 70, 0.16, 0.09);
    },
    // A soft chime, played as each stage light strikes during the zoom-out (in place of the relay
    // click). Successive lights climb a warm A major 9 chord, so the reveal plays as a gentle
    // arpeggio: a sine with a quiet octave above, eased in, ringing out through a low-pass, panned
    // a little left and right.
    chime: function (i) {
      if (!live()) return;
      var NOTES = [220, 277.18, 329.63, 415.3, 493.88, 554.37, 659.25, 830.61];
      var n = (i || 0) % NOTES.length, f = NOTES[n], t = ctx.currentTime + 0.01;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.3;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      var out = g;
      if (ctx.createStereoPanner) { var pan = ctx.createStereoPanner(); pan.pan.value = (n % 2 ? 0.35 : -0.35) * (0.5 + (n / NOTES.length) * 0.5); g.connect(pan); out = pan; }
      lp.connect(g); out.connect(master);
      [[f, 'sine', 1], [f * 2, 'sine', 0.22], [f * 3.01, 'triangle', 0.05]].forEach(function (p) {
        var o = ctx.createOscillator(), og = ctx.createGain();
        o.type = p[1]; o.frequency.value = p[0]; og.gain.value = p[2];
        o.connect(og); og.connect(lp); o.start(t); o.stop(t + 2.5);
      });
    },
    // Big breaker "lights on": low thud, a hum swell, a bright click on top.
    clunk: function () {
      if (!live()) return;
      var t = ctx.currentTime;
      burst(t, 0.05, 'highpass', 3000, 0.7, 0.35, 0.05);
      thump(t, 95, 38, 0.6, 0.55);
      var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 60;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
      var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + 1.5);
    },
    // Knob detent.
    tick: function () {
      if (!live()) return;
      burst(ctx.currentTime, 0.012, 'highpass', 5000, 0.8, 0.09, 0.012);
    },
    onUnlock: function (cb) { if (unlocked) cb(); else waiting.push(cb); }
  };

  // The first click, tap or key press anywhere unlocks audio for the whole page.
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    ['pointerdown', 'touchend', 'keydown'].forEach(function (ev) { window.removeEventListener(ev, unlock, true); });
    var done = function () { waiting.splice(0).forEach(function (cb) { cb(); }); };
    if (ctx && ctx.state !== 'running') ctx.resume().then(done, done); else done();
  }
  ['pointerdown', 'touchend', 'keydown'].forEach(function (ev) { window.addEventListener(ev, unlock, true); });

  window.SFX = SFX;
})();
