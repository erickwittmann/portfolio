const SAMPLES = {
  slide: ["whoosh-xkeril.ogg"],
  scan: ["whoosh-airy.ogg"],
  breath: ["whoosh-breath.ogg"],
  whisper: ["whoosh-whisper.ogg"],  // take apart, line-up, badge (Virtual_Vibes)
  start: ["air-rush.ogg"],
  tap: ["tap-1.ogg", "tap-2.ogg"],  // fingertip taps on card (Squirrel_404, CC0)
};
const AUDIO = new URL("../../assets/audio/", import.meta.url);

let ctx = null, out = null, verb = null, musicBus = null, noiseBuf = null;
let muted = false, scoreOn = false, scoreTimer = 0, chordIdx = 0, mood = "overview";
const buffers = {}, reversed = {};
try { muted = localStorage.getItem("aoc-sound") === "off"; } catch { }

function ac() {
  if (muted) return null;
  try {
    if (!ctx) setup();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch { return null; }
}

function setup() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -6; comp.knee.value = 6; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25;
  out = ctx.createGain(); out.gain.value = 0.9;
  out.connect(comp).connect(ctx.destination);
  verb = ctx.createConvolver();
  verb.buffer = impulse(3.6);
  const wet = ctx.createGain(); wet.gain.value = 0.55;
  verb.connect(wet).connect(out);
  musicBus = ctx.createGain(); musicBus.gain.value = 0;
  const musicTone = ctx.createBiquadFilter(); musicTone.type = "lowpass"; musicTone.frequency.value = 1400; musicTone.Q.value = 0.4;
  musicBus.connect(musicTone);
  musicTone.connect(out); musicTone.connect(send(0.7));
  musicBus.tone = musicTone;
  noiseBuf = pinkNoise(4);
  for (const [role, list] of Object.entries(SAMPLES)) for (const f of list) load(f).then((b) => {
    if (!b) return;
    (buffers[role] ||= []).push(b);
    (reversed[role] ||= []).push(reverse(b));
  });
  document.addEventListener("visibilitychange", () => {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    if (document.hidden) { out.gain.setTargetAtTime(0, t, 0.12); setTimeout(() => document.hidden && ctx.suspend(), 450); }
    else ctx.resume().then(() => out.gain.setTargetAtTime(0.9, ctx.currentTime, 0.5));
  });
}

async function load(name) {
  try { return await ctx.decodeAudioData(await (await fetch(new URL(name, AUDIO))).arrayBuffer()); } catch { return null; }
}
function send(amount) { const g = ctx.createGain(); g.gain.value = amount; g.connect(verb); return g; }
function reverse(b) {
  const r = ctx.createBuffer(b.numberOfChannels, b.length, b.sampleRate);
  for (let ch = 0; ch < b.numberOfChannels; ch++) r.getChannelData(ch).set(b.getChannelData(ch).slice().reverse());
  return r;
}
function play(role, { gain = 0.5, rate = 1, pan = 0, back = false, verbAmt = 0.4 } = {}) {
  const list = (back ? reversed : buffers)[role];
  if (!list?.length) return 0;
  const c = ctx, t = c.currentTime + 0.01;
  const src = c.createBufferSource(); src.buffer = list[Math.floor(Math.random() * list.length)];
  src.playbackRate.value = rate;
  const dur = src.buffer.duration / rate;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.02);
  g.gain.setValueAtTime(gain, t + Math.max(0.03, dur - 0.3)); g.gain.linearRampToValueAtTime(0, t + dur);
  const p = c.createStereoPanner();
  p.pan.setValueAtTime(-pan, t); p.pan.linearRampToValueAtTime(pan, t + dur);
  src.connect(g).connect(p); p.connect(out); p.connect(send(verbAmt));
  src.start(t); src.stop(t + dur + 0.05);
  return dur;
}

function impulse(sec) {
  const len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      lp += (Math.random() * 2 - 1 - lp) * (0.5 - 0.42 * t);   // the tail darkens as it decays
      d[i] = lp * Math.pow(1 - t, 2.6) * (i < 90 ? i / 90 : 1);
    }
  }
  return buf;
}
function pinkNoise(sec) {
  const len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16;
    }
  }
  return buf;
}
function bell(n, peak = 0.42) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i / (n - 1), u = x < peak ? x / peak * 0.5 : 0.5 + (x - peak) / (1 - peak) * 0.5; c[i] = Math.sin(Math.PI * u) ** 2; }
  return c;
}

// ---------- transitions ----------
let lastShoosh = 0;
function shoosh({ dur = 1.2, from = 260, peak = 1600, to = 500, gain = 0.32, pan = 0, verbAmt = 0.45, q = 0.8, sample = null } = {}) {
  const c = ac(); if (!c) return;
  if (c.currentTime - lastShoosh < 0.3) return;   // rapid clicking never stacks whooshes
  lastShoosh = c.currentTime;
  const t = c.currentTime + 0.01;
  if (scoreOn && !ducked) { musicBus.gain.setTargetAtTime(level() * 0.7, t, 0.03); musicBus.gain.setTargetAtTime(level(), t + dur * 0.6, 0.25); }
  if (sample && play(sample.role, { verbAmt, ...sample })) return;
  const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = q;
  const sweep = new Float32Array(64);
  for (let i = 0; i < 64; i++) { const x = i / 63; sweep[i] = x < 0.45 ? from * Math.pow(peak / from, x / 0.45) : peak * Math.pow(to / peak, (x - 0.45) / 0.55); }
  bp.frequency.setValueCurveAtTime(sweep, t, dur);
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 5200;
  const g = c.createGain(); g.gain.value = 0;
  g.gain.setValueCurveAtTime(bell(64).map((v) => v * gain), t, dur);
  const p = c.createStereoPanner();
  p.pan.setValueAtTime(-pan * 0.7, t); p.pan.linearRampToValueAtTime(pan * 0.7, t + dur);
  src.connect(bp).connect(lp).connect(g).connect(p);
  p.connect(out); p.connect(send(verbAmt));
  src.start(t, Math.random() * 3); src.stop(t + dur + 0.05);
}

function tap(gain = 0.05, freq = 2400) {
  const c = ac(); if (!c) return;
  if (play("tap", { gain: gain * 7, rate: 0.94 + Math.random() * 0.12, verbAmt: 0.25 })) return;
  const t = c.currentTime + 0.005;
  const src = c.createBufferSource(); src.buffer = buffers.tap[0] || noiseBuf;
  const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = 1.1;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  src.connect(bp).connect(g); g.connect(out); g.connect(send(0.25));
  src.start(t, buffers.tap[0] ? 0 : Math.random() * 3); src.stop(t + 0.08);
}

function bloom(midis, { gain = 0.05, attack = 0.04, release = 1.6, gap = 0.08, verbAmt = 0.8 } = {}) {
  const c = ac(); if (!c) return;
  midis.forEach((m, i) => {
    const t = c.currentTime + 0.01 + i * gap, f = 440 * Math.pow(2, (m - 69) / 12);
    const o = c.createOscillator(); o.type = "sine"; o.frequency.value = f;
    const o2 = c.createOscillator(); o2.type = "sine"; o2.frequency.value = f * 2.001;
    const g2 = c.createGain(); g2.gain.value = 0.18;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.setTargetAtTime(0, t + attack, release / 4);
    o.connect(g); o2.connect(g2).connect(g); g.connect(out); g.connect(send(verbAmt));
    o.start(t); o2.start(t); o.stop(t + attack + release * 1.5); o2.stop(t + attack + release * 1.5);
  });
}

// ---------- the score ----------
const CHORDS = [[45, 52, 55, 59, 60], [48, 55, 59, 64, 67], [40, 47, 55, 62, 69], [43, 50, 59, 64, 69]];   // Am9, Cmaj7, Em11, G6/9
const GLINT = [76, 79, 81, 83, 86, 88];   // E minor pentatonic, high
const BEAT = 60 / 72, BAR = BEAT * 10, STEP = BEAT;
const MOOD = {
  overview:  { tone: 1300, glint: 0.2, pulse: 0, arp: 0, air: 0 },
  framework: { tone: 650, glint: 0.12, pulse: 0, arp: 0, air: 0 },
  power:     { tone: 1050, glint: 0.1, pulse: 0.09, arp: 0, air: 0 },
  data:      { tone: 2000, glint: 0.3, pulse: 0, arp: 0.5, air: 0 },
  airflow:   { tone: 1500, glint: 0.15, pulse: 0, arp: 0, air: 0.12 },
};
const layers = {};
let ducked = false, menuOpen = false;
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function chord(notes, t, hold) {
  for (const m of notes) {
    const g = ctx.createGain(); g.gain.value = 0;
    const lvl = (m < 50 ? 0.05 : 0.034) * (0.85 + Math.random() * 0.3);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + 3.5); g.gain.setValueAtTime(lvl, t + hold); g.gain.linearRampToValueAtTime(0, t + hold + 5.5);
    for (const [type, cents] of [["sine", -5], ["triangle", 4]]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = hz(m); o.detune.value = cents + (Math.random() - 0.5) * 4;
      const og = ctx.createGain(); og.gain.value = type === "sine" ? 1 : 0.35;
      o.connect(og).connect(g); o.start(t); o.stop(t + hold + 6);
    }
    g.connect(musicBus);
  }
}
function arpeggio(notes, t) {
  const tones = [...notes.slice(1), notes[1] + 12, notes[3] + 12].map((m) => m + 12);
  for (let i = 0; i < Math.round(BAR / STEP); i++) {
    const at = t + i * STEP, m = tones[(i * 3) % tones.length];
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = hz(m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.045, at + 0.02); g.gain.setTargetAtTime(0, at + 0.02, 0.45);
    o.connect(g).connect(layers.arp); o.start(at); o.stop(at + 2.6);
  }
}
function buildLayers() {
  const sub = ctx.createOscillator(); sub.type = "sine"; sub.frequency.value = hz(CHORDS[0][0] - 12);
  const subAmp = ctx.createGain(); subAmp.gain.value = 0.5;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.75;
  const lfoDepth = ctx.createGain(); lfoDepth.gain.value = 0.5;
  lfo.connect(lfoDepth).connect(subAmp.gain);
  layers.pulse = ctx.createGain(); layers.pulse.gain.value = 0;
  sub.connect(subAmp).connect(layers.pulse).connect(musicBus);
  sub.start(); lfo.start();
  layers.sub = sub;
  layers.arp = ctx.createGain(); layers.arp.gain.value = 0;
  layers.arp.connect(musicBus); layers.arp.connect(send(0.6));
  const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 600; bp.Q.value = 0.6;
  const drift = ctx.createOscillator(); drift.frequency.value = 0.07;
  const driftAmt = ctx.createGain(); driftAmt.gain.value = 380;
  drift.connect(driftAmt).connect(bp.frequency);
  layers.air = ctx.createGain(); layers.air.gain.value = 0;
  n.connect(bp).connect(layers.air).connect(musicBus);
  n.start(); drift.start();
}
function scoreStep() {
  if (!scoreOn || !ctx) return;
  const t = ctx.currentTime + 0.05, notes = CHORDS[chordIdx % CHORDS.length];
  chord(notes, t, BAR - 0.5);
  arpeggio(notes, t);
  layers.sub.frequency.setTargetAtTime(hz(notes[0] - 12), t, 0.8);
  chordIdx++;
  const m = MOOD[mood] || MOOD.overview;
  for (let k = 0; k < 3; k++) if (Math.random() < m.glint) {
    const at = 1.5 + Math.random() * 6, n = GLINT[Math.floor(Math.random() * GLINT.length)];
    setTimeout(() => scoreOn && !muted && bloom([n], { gain: 0.012, attack: 0.6, release: 4, verbAmt: 1.2 }), at * 1000);
  }
  scoreTimer = setTimeout(scoreStep, BAR * 1000);
}
function level() { return ducked ? 0.22 : 0.5; }
function startScore() {
  const c = ac(); if (!c || scoreOn) return;
  scoreOn = true;
  buildLayers();
  musicBus.gain.cancelScheduledValues(c.currentTime);
  musicBus.gain.setValueAtTime(musicBus.gain.value, c.currentTime);
  musicBus.gain.linearRampToValueAtTime(level(), c.currentTime + 6);
  scoreStep();
  setMood(mood);
}
function setMood(name) {
  mood = MOOD[name] ? name : "overview";
  if (!ctx || !scoreOn) return;
  const m = MOOD[mood], beat = Math.ceil(ctx.currentTime / STEP) * STEP;
  musicBus.tone.frequency.setTargetAtTime(menuOpen ? 1200 : m.tone, beat, 1.4);
  layers.pulse.gain.setTargetAtTime(m.pulse, beat, 1.2);
  layers.arp.gain.setTargetAtTime(m.arp, beat, 0.6);
  layers.air.gain.setTargetAtTime(m.air, beat, 1.8);
}
function duck(on) {
  ducked = on;
  if (!ctx || !scoreOn) return;
  musicBus.gain.setTargetAtTime(level(), ctx.currentTime, on ? 0.35 : 1.2);
}

export const sfx = {
  tick() { tap(0.035, 2600); },
  slide(dir = 1) { shoosh({ dur: 1.15, from: 220, peak: 1500, to: 380, gain: 0.3, pan: dir, verbAmt: 0.4, sample: { role: "slide", gain: 0.55, rate: 0.92, pan: 0.6 * dir } }); },
  scan(down = true) {
    const sample = { role: "scan", gain: 0.42, back: !down, rate: 1.05 };
    shoosh(down ? { dur: 1.5, from: 180, peak: 2600, to: 900, gain: 0.26, q: 1.4, verbAmt: 0.6, sample } : { dur: 1.4, from: 1800, peak: 900, to: 160, gain: 0.24, q: 1.2, verbAmt: 0.55, sample });
  },
  pop() { shoosh({ dur: 0.7, from: 700, peak: 1900, to: 1100, gain: 0.07, q: 1.4, verbAmt: 0.5, sample: { role: "breath", gain: 0.28 } }); bloom([76, 83], { gain: 0.016, gap: 0.07, release: 1.8 }); },
  spread(open = true) { shoosh({ dur: 1.0, from: 400, peak: 2200, to: 700, gain: 0.18, verbAmt: 0.5, sample: { role: "whisper", gain: 0.4, back: !open } }); },
  wide() { shoosh({ dur: 1.4, from: 200, peak: 1800, to: 400, gain: 0.26, pan: 1, verbAmt: 0.6, sample: { role: "whisper", gain: 0.42, rate: 0.85, pan: 0.8 } }); },
  found() { tap(0.04, 2200); setTimeout(() => tap(0.032, 2900), 70); },
  boot() { shoosh({ dur: 2.8, from: 110, peak: 1700, to: 280, gain: 0.3, verbAmt: 0.7, sample: { role: "start", gain: 0.5 } }); startScore(); },
  badge() {
    shoosh({ dur: 1.9, from: 260, peak: 2800, to: 900, gain: 0.2, verbAmt: 0.8, sample: { role: "whisper", gain: 0.36 } });
    if (ctx && scoreOn) { const t = ctx.currentTime; musicBus.gain.setTargetAtTime(level() * 1.4, t, 0.6); musicBus.gain.setTargetAtTime(level(), t + 4, 1.2); }
  },
  menu(open) { menuOpen = open; setMood(mood); },
  stop() {
    if (!ctx || !scoreOn) return;
    const t = ctx.currentTime;
    musicBus.tone.frequency.cancelScheduledValues(t); musicBus.tone.frequency.setValueAtTime(musicBus.tone.frequency.value, t);
    musicBus.tone.frequency.exponentialRampToValueAtTime(90, t + 0.6);
    musicBus.gain.setTargetAtTime(0, t + 0.3, 0.12);
  },
  resume() { if (!ctx || !scoreOn) return; musicBus.gain.setTargetAtTime(level(), ctx.currentTime, 2); setMood(mood); },
  music() { startScore(); },
  mood(name) { setMood(name); },
  duck(on) { duck(on); },
  get muted() { return muted; },
  set muted(v) {
    muted = v;
    try { localStorage.setItem("aoc-sound", v ? "off" : "on"); } catch { }
    if (!ctx) return;
    if (v) ctx.suspend(); else { ctx.resume(); if (!scoreOn) startScore(); }
  },
};
