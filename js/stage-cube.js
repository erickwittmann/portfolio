// Lightweight stand-in for the 3D stage (js/hero.js) until the final model is ready: one cube with
// the reel on every face, unlit (MeshBasicMaterial, so no lights, shadows or reflections to pay for).
// It exposes the same window.Stage API, so the deck, dials and waveform work unchanged:
//   colour -> edge + backdrop tint   strobe -> backdrop flash (max 3/s)
//   pyro   -> spin kick on the beat  haze   -> backdrop glow
// To go back to the full stage, swap this script for hero.js (+ GLTFLoader) in index.html.
(function () {
  var statusEl = document.getElementById('status');
  var SFX = window.SFX;
  function fail(msg) { statusEl.textContent = msg; }
  if (typeof THREE === 'undefined') { fail('3D library failed to load.'); return; }
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DEVICE_DPR = window.devicePixelRatio || 1;

  // Playlist for the deck. Add { artist, title, src } entries and prev/next step through them.
  var TRACKS = [
    { artist: 'Feng', title: 'J*b', src: 'assets/hero.mp4' }
  ];

  // Everything the deck controls. Values are 0..1.
  var show = { hue: 0.36, strobe: 0, pyro: 0.35, haze: 0.45, level: 0, kick: 0 };

  // ---------- Renderer / scene / camera ----------
  var wrap = document.getElementById('wrap');
  var renderer;
  // One unlit mesh is cheap even at full resolution; MSAA only on standard-density screens.
  try { renderer = new THREE.WebGLRenderer({ antialias: DEVICE_DPR < 2, powerPreference: 'low-power' }); }
  catch (e) { fail('WebGL is not available in this browser.'); return; }
  renderer.setPixelRatio(Math.min(DEVICE_DPR, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  wrap.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  var camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  var CUBE = 2, baseDist = 8;
  function resize() {
    var w = wrap.clientWidth || window.innerWidth || 800, h = wrap.clientHeight || window.innerHeight || 600;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    // Keep the cube (its corner-to-corner span) at about 70% of the shorter side of the canvas.
    var t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    baseDist = (CUBE * 1.75) / (2 * t * Math.min(1, camera.aspect)) / 0.72;
  }
  resize();
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);

  var mouse = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  window.addEventListener('pointermove', function (e) {
    mouse.x = (e.clientX / (window.innerWidth || 1)) * 2 - 1;
    mouse.y = (e.clientY / (window.innerHeight || 1)) * 2 - 1;
  });
  document.documentElement.addEventListener('mouseleave', function () { mouse.x = 0; mouse.y = 0; });

  // ---------- Events for the deck ----------
  var handlers = {};
  function on(ev, cb) { (handlers[ev] = handlers[ev] || []).push(cb); }
  function emit(ev) { (handlers[ev] || []).forEach(function (cb) { cb(); }); }

  // ---------- Video + audio (same behaviour as hero.js) ----------
  var video = document.createElement('video');
  video.loop = true; video.muted = true; video.playsInline = true; video.setAttribute('playsinline', '');
  video.preload = 'auto';
  var trackIndex = 0;
  video.addEventListener('error', function () { statusEl.textContent = 'Video could not be loaded.'; });
  video.addEventListener('playing', function () { statusEl.textContent = ''; emit('play'); });
  video.addEventListener('pause', function () { emit('play'); });
  video.addEventListener('volumechange', function () { emit('mute'); });
  video.addEventListener('loadedmetadata', cropToSquare);

  function playSafe() {
    var p = video.play();
    if (p && p.catch) p.catch(function () { statusEl.textContent = 'Press play to start the reel.'; emit('play'); });
  }
  function loadTrack(i, autoplay) {
    trackIndex = (i + TRACKS.length) % TRACKS.length;
    video.src = TRACKS[trackIndex].src;
    video.load();
    emit('track');
    if (autoplay) playSafe();
  }

  // Audio graph: video -> analyser -> gain -> speakers. Built on the first click/tap/key press
  // (browsers block audio until then); that same gesture unmutes the reel with a fade-in,
  // unless the visitor has muted it themselves.
  var audio = { analyser: null, gain: null, freq: null, volume: 0.7, userMuted: false, unlockedAt: -1e9 };
  SFX.onUnlock(function () {
    var ctx = SFX.ctx;
    audio.unlockedAt = performance.now();
    if (ctx) {
      try {
        var src = ctx.createMediaElementSource(video);
        audio.analyser = ctx.createAnalyser(); audio.analyser.fftSize = 1024; audio.analyser.smoothingTimeConstant = 0.72;
        audio.freq = new Uint8Array(audio.analyser.frequencyBinCount);
        audio.gain = ctx.createGain(); audio.gain.gain.value = 0;
        src.connect(audio.analyser); audio.analyser.connect(audio.gain); audio.gain.connect(ctx.destination);
      } catch (e) { audio.analyser = audio.gain = null; }
    }
    if (!audio.userMuted) unmute(1.6);
  });
  function unmute(fade) {
    audio.userMuted = false;
    video.muted = false;
    if (audio.gain) {
      var t = SFX.ctx.currentTime, g = audio.gain.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(audio.volume, t + (fade || 0.15));
    } else video.volume = audio.volume;
    if (video.paused) playSafe();
  }
  function mute() { audio.userMuted = true; video.muted = true; }

  // ---------- The cube ----------
  // One VideoTexture shared by all six faces, so the reel uploads once per new video frame.
  var vtex = new THREE.VideoTexture(video);
  vtex.minFilter = THREE.LinearFilter; vtex.magFilter = THREE.LinearFilter; vtex.generateMipmaps = false; vtex.encoding = THREE.sRGBEncoding;
  // Faces are square: centre-crop the reel instead of squashing it.
  function cropToSquare() {
    var a = video.videoWidth / (video.videoHeight || 1);
    if (a >= 1) { vtex.repeat.set(1 / a, 1); vtex.offset.set((1 - 1 / a) / 2, 0); }
    else { vtex.repeat.set(1, a); vtex.offset.set(0, (1 - a) / 2); }
  }
  var cubeMat = new THREE.MeshBasicMaterial({ map: vtex, color: 0x000000 });
  var cube = new THREE.Mesh(new THREE.BoxGeometry(CUBE, CUBE, CUBE), cubeMat);
  var edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
  cube.add(new THREE.LineSegments(new THREE.EdgesGeometry(cube.geometry), edgeMat));
  cube.rotation.set(-0.42, 0.65, 0);
  scene.add(cube);
  loadTrack(0, false);

  // ---------- Strobe (capped at 3 flashes/second, the WCAG limit for flashing content) ----------
  var strobePhase = 0, strobeFlash = 0;
  function updateStrobe(dt) {
    if (show.strobe > 0.03) {
      var rate = 0.6 + show.strobe * 2.4;            // 0.6 .. 3 Hz
      if (reduced) rate = Math.min(rate, 1);
      strobePhase += dt * rate;
      if (strobePhase >= 1) { strobePhase -= 1; strobeFlash = 0.06; }
    } else strobePhase = 0.98;                       // first flash lands right away when turned up
    strobeFlash -= dt;
    return strobeFlash > 0;
  }

  // ---------- Audio analysis (or an idle 120 BPM pulse while muted/locked) ----------
  var avgBass = 0.2, lastKick = -1, lastBeatIdx = -1;
  function updateAudio(dt, t) {
    var lvl = 0, kick = false;
    if (audio.analyser && !video.muted && !video.paused) {
      audio.analyser.getByteFrequencyData(audio.freq);
      var bass = 0, mid = 0, i;
      for (i = 1; i < 7; i++) bass += audio.freq[i];
      for (i = 7; i < 80; i++) mid += audio.freq[i];
      bass /= 6 * 255; mid /= 73 * 255;
      lvl = Math.min(1, bass * 0.7 + mid * 0.6);
      avgBass += (bass - avgBass) * 0.04;
      if (bass > avgBass * 1.2 && bass > 0.32 && t - lastKick > 0.28) { kick = true; lastKick = t; }
    } else if (!video.paused) {
      var beat = (t * 2) % 1;
      lvl = 0.32 + 0.38 * Math.pow(1 - beat, 5);
      var idx = Math.floor(t * 2);
      if (idx !== lastBeatIdx) { lastBeatIdx = idx; kick = true; }
    }
    show.level += (lvl - show.level) * 0.35;
    show.kick = kick ? 1 : Math.max(0, show.kick - dt * 3.5);
    return kick;
  }

  // ---------- Per-frame update ----------
  // Pyro has no sparks here: it throws the cube into a quick extra spin.
  var spin = 0, lastPyro = -10, edgeColor = new THREE.Color(), white = new THREE.Color(1, 1, 1);
  function firePyro(power) {
    spin += (reduced ? 1.2 : 4.5) * (power || 1);
    lastPyro = clock.elapsedTime;
  }
  function update(dt, t, kick, strobing, fade) {
    var speed = reduced ? 0.25 : 1;
    spin *= Math.exp(-dt * 2.2);
    cube.rotation.y += dt * (0.32 * speed + spin);
    cube.rotation.x = -0.42 + 0.08 * Math.sin(t * 0.4 * speed);
    cube.scale.setScalar((0.9 + 0.1 * fade) * (1 + (reduced ? 0 : show.kick * 0.035)));
    cubeMat.color.setScalar(fade);
    edgeColor.setHSL(show.hue, 0.9, 0.6);
    edgeMat.color.copy(strobing ? white : edgeColor);
    edgeMat.opacity = fade * (0.35 + show.level * 0.65);
    // Backdrop: a hue-tinted glow that haze raises, or a near-white flash on a strobe hit.
    if (strobing) scene.background.setRGB(reduced ? 0.25 : 0.85, reduced ? 0.25 : 0.85, reduced ? 0.25 : 0.85);
    else scene.background.setHSL(show.hue, 0.6, fade * show.haze * (0.05 + show.level * 0.04));
    if (kick && show.pyro > 0.04 && t - lastPyro > 3.4 - show.pyro * 2.6 && Math.random() < 0.25 + show.pyro * 0.6) firePyro(0.45 + show.pyro * 0.5);
    cur.x += (mouse.x - cur.x) * 0.05; cur.y += (mouse.y - cur.y) * 0.05;
    var sway = reduced ? 0 : 1;
    camera.position.set(cur.x * 1.2 * sway, -cur.y * 0.6 * sway, baseDist * (1.25 - 0.25 * fade));
    camera.lookAt(0, 0, 0);
  }

  // ---------- Reveal: first time the stage scrolls into view the reel starts and the cube fades up ----------
  var reveal = { t0: -1 };
  (function watchForStage() {
    var stageEl = document.getElementById('top');
    var go = function () {
      if (reveal.t0 >= 0) return;
      reveal.t0 = performance.now();
      video.currentTime = 0;
      playSafe();
    };
    if (!('IntersectionObserver' in window)) return go();
    var io = new IntersectionObserver(function (en) {
      if (en[0].intersectionRatio >= 0.35) { io.disconnect(); go(); }
    }, { threshold: [0, 0.35] });
    io.observe(stageEl);
  })();

  // ---------- Render loop ----------
  // Nothing renders before the reveal, while the stage is scrolled away or fully covered by the
  // intro grid, or in a hidden tab. Mid-morph it drops to every other frame (js/intro.js reports).
  var heroVisible = true, stageCovered = false, morphUntil = 0, frameNo = 0;
  window.__setHeroVisible = function (v) { heroVisible = v; };
  window.__stageCovered = function (covered, morphing) {
    stageCovered = covered;
    if (morphing) morphUntil = performance.now() + 150;
  };
  var clock = new THREE.Clock();
  (function animate(now) {
    requestAnimationFrame(animate);
    now = now || performance.now();
    var dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    var kick = updateAudio(dt, t);
    if (!heroVisible || stageCovered || reveal.t0 < 0) return;
    if (now < morphUntil && (++frameNo & 1)) return;
    var e = Math.min(1, (now - reveal.t0) / 1400), fade = 1 - Math.pow(1 - e, 3);
    update(dt, t, kick, updateStrobe(dt), fade);
    renderer.render(scene, camera);
  })();

  // ---------- Public API for the deck ----------
  window.Stage = {
    state: show,
    set: function (k, v) { show[k] = v; },
    fire: function () { firePyro(1); },
    on: on,
    get playing() { return !video.paused; },
    get muted() { return video.muted; },
    get volume() { return audio.volume; },
    track: function () { return TRACKS[trackIndex]; },
    togglePlay: function () { if (video.paused) playSafe(); else video.pause(); },
    toggleMute: function () {
      // The click that unlocked audio has already unmuted; don't immediately re-mute.
      if (performance.now() - audio.unlockedAt < 400 && !video.muted) return;
      if (video.muted) unmute(0.3); else mute();
    },
    setVolume: function (v) {
      audio.volume = v;
      if (audio.gain) audio.gain.gain.setTargetAtTime(v, SFX.ctx.currentTime, 0.04); else video.volume = v;
      if (v > 0 && video.muted && SFX.unlocked) unmute(0.2);
      emit('mute');
    },
    next: function () { if (TRACKS.length > 1) loadTrack(trackIndex + 1, true); else { video.currentTime = 0; playSafe(); } },
    prev: function () {
      if (TRACKS.length > 1 && video.currentTime < 3) loadTrack(trackIndex - 1, true);
      else { video.currentTime = 0; playSafe(); }
    },
    // Fills `buf` with the live waveform; returns false while there's no audible signal.
    getWaveform: function (buf) {
      if (!audio.analyser || video.muted || video.paused) return false;
      audio.analyser.getByteTimeDomainData(buf);
      return true;
    }
  };
  window.__dbg = { scene: scene, video: video, THREE: THREE, camera: camera, renderer: renderer, show: show, cube: cube };
})();
