// The interactive stage: Erick's 3D concert stage whose LED screen IS the intro media grid, with
// moving-head beams, truss washes, spark-fountain pyro, strobe and haze. Everything the deck can
// touch is exposed on window.Stage (see the bottom of this file).
//
// How the grid gets onto the screen: the grid stays ordinary HTML (so its videos, hover and links
// keep working) and sits behind the canvas. The 3D screen is drawn as a see-through hole, so the
// grid shows through it, while the booth, trusses and beams draw over it like real objects in front
// of a screen. Every frame the grid is warped (CSS matrix3d) onto where the screen lands on screen.
// At the top of the page the camera sits square in front of the screen so the grid simply fills the
// window; scrolling (js/intro.js gives the progress) pulls the camera back to the whole stage.
(function () {
  var statusEl = document.getElementById('status');
  var SFX = window.SFX;
  function fail(msg) { statusEl.textContent = msg; }
  window.addEventListener('error', function (e) { fail('Error: ' + (e.message || 'unknown')); });
  if (typeof THREE === 'undefined' || !THREE.GLTFLoader || !window.MeshoptDecoder) { fail('3D libraries failed to load.'); return; }
  var SEQ = window.StageSeq;   // from js/intro.js: scroll progress + the grid element
  if (!SEQ) { fail('Stage sequence missing.'); return; }
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Quality tier: phones / low-core devices get smaller textures, a lower resolution range,
  // cheaper shadows, slower reflection updates, no beam floor-spots, fewer sparks, fewer blur taps.
  // Test overrides: ?quality=high|low  ?dpr=<fixed pixel ratio, disables adaptive>  ?post=0 (no depth of field / edge haze)
  function param(name) { return (location.search.match(new RegExp('[?&]' + name + '=([^&]+)')) || [])[1]; }
  var LOW = param('quality') ? param('quality') === 'low'
    : (window.matchMedia && matchMedia('(pointer: coarse)').matches) || (navigator.hardwareConcurrency || 8) <= 4;
  var DEVICE_DPR = window.devicePixelRatio || 1;
  var Q = LOW
    ? { dprMin: 0.75, dprMax: 1.5, dprStart: 1.25, shadow: 1024, shadowType: THREE.PCFShadowMap, envRes: 64, envFaceEvery: 3, spots: 0, sparks: 900, taps: 8 }
    : { dprMin: 1, dprMax: 2, dprStart: 1.5, shadow: 2048, shadowType: THREE.PCFSoftShadowMap, envRes: 96, envFaceEvery: 2, spots: 3, sparks: 2400, taps: 12 };
  // Depth of field + edge haze run as one extra full-screen pass (see "Post"). It renders the scene
  // into an off-screen target, which can't use MSAA here, but the blur softens edges anyway.
  var POST = param('post') !== '0';
  var AA = !POST && !LOW && DEVICE_DPR < 1.5;
  var FIXED_DPR = param('dpr') ? parseFloat(param('dpr')) : 0;

  // The homepage playlist (grid + stage share it). Add a line per song: { artist, title, src }.
  // It plays in this order; clicking the DJ booth crossfades to the next one, and each song blends
  // into the next when it ends. artist/title show on the booth's little screen. .mp3 works, and so
  // does the sound of an .mp4. The music drives the lights.
  // gain (optional) evens the songs out against each other: 1 = as is, 0.73 = a bit quieter. Leave
  // it off for a normally mastered song; add e.g. gain: 0.8 if one stands out as too loud. The
  // overall stage level is LEVEL.stage in js/page-audio.js.
  var TRACKS = [
    { artist: 'Internet Girl', title: 'PULL UP', src: 'assets/PULL UP2.mp3', gain: 0.76 },   // cut so the drop lands on the zoom-out
    { artist: 'yaego, kučka', title: 'ketamina', src: 'assets/yaego, kučka - ketamina.mp3', gain: 0.73 },
    { artist: 'Blood Cultures', title: 'Unarchiver', src: 'assets/Blood Cultures - Unarchiver_Cut.mp3', gain: 0.97 },
    { artist: 'Feng', title: 'XY', src: 'assets/XY.mp3' },
    { artist: 'Ferdous', title: 'Gravity', src: 'assets/Ferdous - Gravity.mp3', gain: 0.95 },
    { artist: 'Ferdous', title: 'Sad Nebula', src: 'assets/Ferdous - Sad Nebula.mp3', gain: 0.92 },
  ];
  // Erick's stage, reduced for the web from assets/erick_concert_stage.glb (111 MB, 1.17M triangles,
  // 395 draw calls) with gltfpack 1.3:
  //   gltfpack -i erick_concert_stage.glb -o erick_concert_stage-lite.glb -si 0.1 -mm -cc -tw -tl 512
  // = 10% of the triangles (168k), meshes merged by material (58 draw calls), meshopt-compressed
  // geometry and 512px WebP textures: 3.1 MB. Needs js/vendor/meshopt_decoder.js on the page.
  var ASSETS = { model: 'assets/erick_concert_stage-lite.glb' };

  // Everything the controls change. Values are 0..1. dim: the light bar's dim/bright slider.
  // strobe / pyro / haze have no control any more (the deck is gone) and keep these settings.
  var show = { hue: 0.36, dim: 1, strobe: 0, pyro: 0.35, haze: 0.45, level: 0, kick: 0 };

  // ---------- Renderer / scene / camera ----------
  var wrap = document.getElementById('wrap'), frame = SEQ.frame, pin = SEQ.pin;
  var nav = document.getElementById('nav'), deckEl = document.getElementById('deck');
  var renderer;
  // alpha: the canvas is see-through where the LED screen is, so the grid behind it shows.
  try { renderer = new THREE.WebGLRenderer({ antialias: AA, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { fail('WebGL is not available in this browser.'); return; }
  // Start a little low when the post pass is on: the pull-back happens in the first seconds, before
  // the adaptive resolution has had time to step down (it then steps up if there is headroom).
  renderer.setPixelRatio(FIXED_DPR || Math.min(DEVICE_DPR, POST ? Math.min(1.2, Q.dprStart) : Q.dprStart));
  renderer.setClearColor(0x000000, 1);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = Q.shadowType;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  wrap.appendChild(renderer.domElement);
  wrap.style.opacity = 0;   // the stage fades in around the screen as the camera pulls back

  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0);
  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
  var SCREEN_LAYER = 2;     // the see-through screen: main camera only (not in reflections)
  var ENV_LAYER = 1;        // studio panels + a picture of the grid: reflections only
  camera.layers.enable(SCREEN_LAYER);
  var W = 1, H = 1, navPx = 64, deckPx = 0;
  function resize() {
    W = pin.clientWidth || window.innerWidth || 800; H = pin.clientHeight || window.innerHeight || 600;
    navPx = nav ? nav.offsetHeight : 64; deckPx = deckEl ? deckEl.offsetHeight : 0;   // overlay the canvas (the deck is gone; kept in case a bottom bar returns)
    renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
    sizeScreen();
    if (post) post.resize();
    dirtyView = true;
  }

  // ---------- Base lighting ----------
  // Light budget: every light is evaluated per pixel by every PBR material, so the count matters
  // far more than anything else here (measured: each point light ~1.5 ms/frame at 2x DPR).
  // Fixed rig: hemisphere + 1 shadowed directional + 3 point lights (screen glow, 2 truss washes)
  // + up to 3 floor spots on desktop. Strobe and pyro flashes reuse these instead of adding lights.
  var HEMI_BASE = 0.55, KEY_BASE = 0.7;
  var hemi = new THREE.HemisphereLight(0x8899ff, 0x201a10, HEMI_BASE);
  scene.add(hemi);
  var key = new THREE.DirectionalLight(0xffffff, KEY_BASE);
  key.position.set(8, 16, 12); key.castShadow = true; key.shadow.mapSize.set(Q.shadow, Q.shadow);
  key.shadow.camera.left = -18; key.shadow.camera.right = 18; key.shadow.camera.top = 18; key.shadow.camera.bottom = -18;
  key.shadow.camera.near = 1; key.shadow.camera.far = 60; scene.add(key);

  // A dark venue for the reflections: invisible to the main camera but seen by the cube camera.
  // Kept dim on purpose, a brightly lit room made every glossy surface read tan and washed out;
  // the bright things the stage should reflect are the screen (the grid picture) and the lights.
  (function buildEnvironment() {
    var room = new THREE.Mesh(new THREE.BoxGeometry(80, 40, 80), new THREE.MeshBasicMaterial({ color: 0x04050a, side: THREE.BackSide }));
    room.position.y = 12; room.layers.set(ENV_LAYER); scene.add(room); freeze(room);
    function panel(w, h, color, power, x, y, z) {
      var c = new THREE.Color(color); c.multiplyScalar(power);
      var p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
      p.position.set(x, y, z); p.lookAt(0, 6, 0); p.layers.set(ENV_LAYER); scene.add(p); freeze(p);
    }
    panel(26, 14, 0xffffff, 0.7,  22, 16,  26);   // house lights, far and dim
    panel(8, 22, 0x5a86ff, 1.2,  -30, 12,   8);
    panel(20, 8, 0xff3fc0, 0.6,  -14, 24, -30);
    panel(60, 2.5, 0xffffff, 1.4,  0, 34,   0);   // rig strips overhead: long highlights on the glossy floor
    panel(60, 2.5, 0xffffff, 1.4,  0, 34,  12);
    panel(60, 2.5, 0xffffff, 1.4,  0, 34, -12);
    panel(30, 6, 0xffffff, 0.3,   0, 6, 38);
  })();
  // Live reflections, rendered one cube face per frame into two targets that swap once all six
  // faces are fresh. Spreading the work avoids a 6-render spike every few frames, and materials
  // always sample the finished target (no feedback loop, no toggling scene.environment, which
  // would force a shader-program switch). Mipmapped, so rough surfaces get blurrier reflections
  // and glossy ones sharper.
  function envTarget() {
    return new THREE.WebGLCubeRenderTarget(Q.envRes, { format: THREE.RGBAFormat, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  }
  var envRTs = [envTarget(), envTarget()], envRead = 0, envFace = 0, envTick = 0;
  var envCam = new THREE.CubeCamera(0.2, 120, envRTs[1]);
  envCam.layers.enable(0); envCam.layers.enable(ENV_LAYER);   // shared with its six face cameras
  envCam.position.set(0.8, 4.6, 1.2);
  scene.add(envCam);
  scene.environment = envRTs[0].texture;
  function updateEnvFace() {
    if (++envTick < Q.envFaceEvery) return;
    envTick = 0;
    var prev = renderer.getRenderTarget();
    renderer.setRenderTarget(envRTs[1 - envRead], envFace);
    renderer.render(scene, envCam.children[envFace]);
    renderer.setRenderTarget(prev);
    if (++envFace === 6) { envFace = 0; envRead = 1 - envRead; scene.environment = envRTs[envRead].texture; }
  }

  // ---------- The LED screen ----------
  // On the backdrop ("Cube1" in the model: 14.5 x 9.6, front face at z = -3.9). Its shape follows
  // the window's, so at the top of the page the grid can fill the window exactly; it's as big as
  // fits on the backdrop.
  var SCREEN_C = new THREE.Vector3(-0.2, 6.0, -3.85), SCREEN_MAX_W = 14.2, SCREEN_MAX_H = 9.4;
  var screenW = SCREEN_MAX_W, screenH = 8.8;
  var unitPlane = new THREE.PlaneGeometry(1, 1);
  // The hole: writes transparent black (colour and alpha both zeroed) but still writes depth, so
  // anything behind it is hidden and anything in front draws over the grid.
  var hole = new THREE.Mesh(unitPlane, new THREE.MeshBasicMaterial({
    color: 0x000000, fog: false, toneMapped: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.ZeroFactor,
    blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.ZeroFactor
  }));
  hole.layers.set(SCREEN_LAYER); hole.position.copy(SCREEN_C); scene.add(hole);
  // Matte black surround over the backdrop, just behind the screen: real LED walls sit in a flat
  // black frame, and the glossy backdrop beside a narrow (phone-shaped) screen read tan.
  var surround = new THREE.Mesh(new THREE.PlaneGeometry(14.6, 9.7), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.95, metalness: 0 }));
  surround.position.set(SCREEN_C.x, SCREEN_C.y, SCREEN_C.z - 0.03); surround.receiveShadow = true; scene.add(surround); freeze(surround);
  // A small live picture of the grid, for reflections only (see "Grid picture").
  var mirrorCanvas = document.createElement('canvas'); mirrorCanvas.width = 160; mirrorCanvas.height = 100;
  var mirrorTex = new THREE.CanvasTexture(mirrorCanvas);
  mirrorTex.encoding = THREE.sRGBEncoding; mirrorTex.minFilter = THREE.LinearFilter; mirrorTex.generateMipmaps = false;
  var proxy = new THREE.Mesh(unitPlane, new THREE.MeshBasicMaterial({ map: mirrorTex, color: new THREE.Color(1.6, 1.6, 1.6), toneMapped: false, fog: false }));
  proxy.layers.set(ENV_LAYER); proxy.position.copy(SCREEN_C); scene.add(proxy);
  // Light spill from the screen onto the booth and floor. Kept well forward of the backdrop: close
  // to it, it painted a broad tan highlight across the glossy black wall.
  var glow = new THREE.PointLight(0x9bb4ff, 0.9, 22); glow.position.set(SCREEN_C.x, SCREEN_C.y - 1.5, SCREEN_C.z + 6); scene.add(glow);
  var glowTarget = new THREE.Color(0x9bb4ff);
  // The audio-reactive visualizer (js/visualizer.js): drawn on a plane just in front of the hole.
  // It fades in over the grid once the page content starts scrolling over the stage (vizMix), and the
  // grid behind it is hidden (and its videos paused) once it's fully covered.
  var viz = window.Visualizer ? window.Visualizer(THREE, renderer) : null, vizMix = 0, vizScreen = null;
  if (viz) {
    vizScreen = new THREE.Mesh(unitPlane, new THREE.MeshBasicMaterial({ map: viz.texture, transparent: true, opacity: 0, toneMapped: false, fog: false, depthWrite: false }));
    vizScreen.position.set(SCREEN_C.x, SCREEN_C.y, SCREEN_C.z + 0.004);
    vizScreen.layers.set(SCREEN_LAYER); vizScreen.renderOrder = 1; vizScreen.visible = false;
    scene.add(vizScreen);
  }
  function sizeScreen() {
    var a = W / H;
    if (a >= SCREEN_MAX_W / SCREEN_MAX_H) { screenW = SCREEN_MAX_W; screenH = SCREEN_MAX_W / a; }
    else { screenH = SCREEN_MAX_H; screenW = SCREEN_MAX_H * a; }
    hole.scale.set(screenW, screenH, 1); proxy.scale.copy(hole.scale);
    hole.updateMatrixWorld(); proxy.updateMatrixWorld();
    if (vizScreen) { vizScreen.scale.copy(hole.scale); vizScreen.updateMatrixWorld(); viz.setAspect(screenW / screenH); }
  }

  // ---------- Grid picture (for reflections) ----------
  // ~4 fps: draw each tile's image/video into a tiny canvas laid out like the grid, which the stage
  // reflects. Never read pixels back from it: a readback makes the browser wait for the GPU to
  // finish everything queued, and doing that 8x a second caused a long, visible hitch each time
  // (measured on a 2x screen: 24 long frames in 3 s with it, none without).
  // Only same-origin files are drawn: a cross-origin one would "taint" the canvas and WebGL would
  // refuse it.
  var mctx = mirrorCanvas.getContext('2d'), mirrorOK = param('mirror') !== '0', mirrorAt = 0;   // ?mirror=0: test switch
  function sameOrigin(src) { try { return new URL(src, location.href).origin === location.origin; } catch (e) { return false; } }
  function updateMirror(now) {
    if (!mirrorOK || now - mirrorAt < 250) return;
    mirrorAt = now;
    var fw = frame.offsetWidth, fh = frame.offsetHeight;
    if (!fw || !fh) return;
    var mw = 160, mh = Math.max(16, Math.round(mw * fh / fw)), s = mw / fw;
    if (mirrorCanvas.height !== mh) mirrorCanvas.height = mh;
    mctx.fillStyle = '#000'; mctx.fillRect(0, 0, mw, mh);
    var tiles = frame.querySelectorAll('.tile');
    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i], x = t.offsetLeft * s, y = t.offsetTop * s, w = t.offsetWidth * s, h = t.offsetHeight * s;
      var m = t.querySelector('.ic-photo') || t.querySelector('video, img');
      var ready = m && sameOrigin(m.currentSrc || m.src) && (m.tagName === 'VIDEO' ? m.readyState >= 2 : m.complete && m.naturalWidth);
      if (ready) { try { mctx.drawImage(m, x, y, w, h); continue; } catch (e) { /* not drawable yet */ } }
      mctx.fillStyle = '#0b0b0b'; mctx.fillRect(x, y, w, h);
    }
    mirrorTex.needsUpdate = true;
  }

  // ---------- Camera: from square in front of the screen to the whole stage ----------
  // p (scroll progress) 0: the screen fills the window exactly, so the grid looks like a plain page.
  // p 1: the whole stage, framed in the band between the nav and the deck. The view sways a little
  // toward the cursor, more the further back the camera is.
  var STAGE_T = new THREE.Vector3(-0.2, 5.7, 0);   // where the wide shot looks
  var mouse = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  var MAX_YAW = reduced ? 0 : 0.12, MAX_PITCH = reduced ? 0 : 0.04;
  window.addEventListener('pointermove', function (e) {
    mouse.x = (e.clientX / (window.innerWidth || 1)) * 2 - 1;
    mouse.y = (e.clientY / (window.innerHeight || 1)) * 2 - 1;
  });
  document.documentElement.addEventListener('mouseleave', function () { mouse.x = 0; mouse.y = 0; });
  var fillPos = new THREE.Vector3(), widePos = new THREE.Vector3(), target = new THREE.Vector3();
  var tmpSph = new THREE.Spherical(), tmpVec = new THREE.Vector3(), dirtyView = true, shownView = '';
  function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function updateCamera(p) {
    var t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), a = W / H, e = ease(p);
    fillPos.set(SCREEN_C.x, SCREEN_C.y, SCREEN_C.z + (screenH / 2) / t);
    // Wide shot: fit the stage into the band between the nav and the deck (both overlay the canvas).
    var navH = navPx, deckH = deckPx;
    var band = Math.max(0.35, (H - navH - deckH) / H), stageW = a < 1 ? 11.5 : 20.6;
    var D = Math.max((12.6 * 1.12) / (2 * t * band), (stageW * 0.98) / (2 * t * a));   // a little tight: the edge haze takes the outskirts
    widePos.copy(STAGE_T).add(tmpVec.setFromSpherical(tmpSph.set(D, Math.PI / 2 - 0.05, 0)));
    camera.position.lerpVectors(fillPos, widePos, e);
    target.lerpVectors(SCREEN_C, STAGE_T, e);
    cur.x += (mouse.x - cur.x) * 0.05; cur.y += (mouse.y - cur.y) * 0.05;
    if (e > 0) {
      tmpSph.setFromVector3(tmpVec.subVectors(camera.position, target));
      tmpSph.theta -= cur.x * MAX_YAW * e;
      tmpSph.phi = Math.min(Math.max(tmpSph.phi - cur.y * MAX_PITCH * e, 0.2), Math.PI * 0.8);
      camera.position.copy(target).add(tmpVec.setFromSpherical(tmpSph));
    }
    camera.lookAt(target);
    camera.updateMatrixWorld();
    // Shift the picture so the stage centres in the visible band (the nav and deck aren't there at p 0).
    var shift = Math.round(((navH + (H - deckH)) / 2 - H / 2) * e);
    var view = W + 'x' + H + ':' + shift;
    if (view !== shownView || dirtyView) {
      shownView = view; dirtyView = false;
      if (shift) camera.setViewOffset(W, H, 0, -shift, W, H); else camera.clearViewOffset();
    }
  }

  // ---------- Warp the grid onto the screen ----------
  // Project the screen's corners and map the grid's rectangle onto them with a homography, written
  // as a CSS matrix3d. At p 0 the screen fills the window, so no transform at all (crisp text).
  var corners = [new THREE.Vector3(-0.5, 0.5, 0), new THREE.Vector3(0.5, 0.5, 0), new THREE.Vector3(0.5, -0.5, 0), new THREE.Vector3(-0.5, -0.5, 0)];
  var pv = new THREE.Vector3(), q = [0, 0, 0, 0, 0, 0, 0, 0], shownWarp = '';
  function warpGrid(p) {
    if (p <= 0) { if (shownWarp !== 'none') { frame.style.transform = ''; shownWarp = 'none'; } return; }
    for (var i = 0; i < 4; i++) {
      pv.copy(corners[i]).applyMatrix4(hole.matrixWorld).project(camera);
      q[i * 2] = (pv.x + 1) / 2 * W; q[i * 2 + 1] = (1 - pv.y) / 2 * H;
    }
    var fw = frame.offsetWidth || W, fh = frame.offsetHeight || H;
    // Unit square -> quad (Heckbert), then scale the grid's size down to the unit square.
    var x0 = q[0], y0 = q[1], x1 = q[2], y1 = q[3], x2 = q[4], y2 = q[5], x3 = q[6], y3 = q[7];
    var dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    var den = dx1 * dy2 - dx2 * dy1 || 1e-9;
    var g = (dx3 * dy2 - dx2 * dy3) / den, h = (dx1 * dy3 - dx3 * dy1) / den;
    var a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0, d = y1 - y0 + g * y1, f = y3 - y0 + h * y3, k = y0;
    var m = [a / fw, d / fw, 0, g / fw, b / fh, f / fh, 0, h / fh, 0, 0, 1, 0, c, k, 0, 1];
    var css = 'matrix3d(' + m.join(',') + ')';
    if (css !== shownWarp) { frame.style.transform = css; shownWarp = css; }
  }

  resize();
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(pin);

  // ---------- Events for the stage controls (js/stage-ui.js) ----------
  var handlers = {};
  function on(ev, cb) { (handlers[ev] = handlers[ev] || []).push(cb); }
  function emit(ev) { (handlers[ev] || []).forEach(function (cb) { cb(); }); }

  // ---------- Music: two players that crossfade ----------
  // Clicking the DJ booth (or reaching the end of a song) blends into the next track over XFADE
  // seconds instead of cutting. Two <audio> elements take turns: the next song loads into the idle
  // one, fades up while the current one fades down, then the old one stops.
  // Audio graph, built on the first click/tap/key press (browsers block sound until then):
  //   player A -> gain A \
  //                       analyser -> master (volume / mute) -> speakers
  //   player B -> gain B /
  // Before that gesture the music plays silently, which still drives the light show (idle pulse).
  var XFADE = 1.6;
  function makePlayer() {
    var el = document.createElement('audio');   // plays .mp3 and the sound of .mp4 alike
    el.preload = 'auto'; el.muted = true;
    el.addEventListener('error', function () { if (el === active()) statusEl.textContent = 'This track could not be loaded.'; });
    el.addEventListener('playing', function () { if (el === active() && !loading()) statusEl.textContent = ''; });
    return { el: el, gain: null };
  }
  var players = [makePlayer(), makePlayer()], curP = 0, trackIndex = 0, xfadeAt = -1e9;
  function active() { return players[curP].el; }
  function playEl(el) { var p = el.play(); if (p && p.catch) p.catch(function () {}); }
  function playSafe() { if (!userPaused) playEl(active()); }
  var userPaused = false;   // paused from the nav player: nothing restarts the music by itself
  function loadInto(pl, i) { pl.el.src = TRACKS[i].src; pl.el.load(); }
  function trackGain(i) { var g = TRACKS[i].gain; return typeof g === 'number' ? g : 1; }
  loadInto(players[0], 0);

  // The fader starts at 50%; after that, the visitor's own volume and mute carry over between pages
  // (js/page-audio.js keeps them). What comes out of the speakers is fader x STAGE_LEVEL, set with
  // the rest of the site's sound balance in js/page-audio.js.
  var PA = window.PageAudio, prefs = PA ? PA.prefs : { volume: 0.5, muted: false };
  var STAGE_LEVEL = PA && PA.LEVEL ? PA.LEVEL.stage : 0.5;
  var audio = { analyser: null, master: null, freq: null, volume: prefs.volume, muted: prefs.muted, unlockedAt: -1e9 };
  SFX.onUnlock(function () {
    var ctx = SFX.ctx;
    audio.unlockedAt = performance.now();
    if (ctx) {
      try {
        audio.analyser = ctx.createAnalyser(); audio.analyser.fftSize = 1024; audio.analyser.smoothingTimeConstant = 0.72;
        audio.freq = new Uint8Array(audio.analyser.frequencyBinCount);
        audio.master = ctx.createGain(); audio.master.gain.value = 0;
        audio.analyser.connect(audio.master); audio.master.connect(ctx.destination);
        players.forEach(function (pl, k) {
          var src = ctx.createMediaElementSource(pl.el);
          pl.gain = ctx.createGain(); pl.gain.gain.value = k === curP ? trackGain(trackIndex) : 0;
          src.connect(pl.gain); pl.gain.connect(audio.analyser);
        });
      } catch (e) { audio.analyser = audio.master = null; }
    }
    players.forEach(function (pl) { pl.el.muted = false; });
    if (PA && PA.setAnalyser && audio.analyser) PA.setAnalyser(audio.analyser);
    applyVolume(1.6);
    if (reveal.t0 >= 0 && active().paused && !userPaused) playSafe();
  });
  // Volume and mute go through the master gain (or the elements themselves without Web Audio).
  function applyVolume(fade) {
    var v = audio.muted ? 0 : audio.volume * STAGE_LEVEL;
    if (audio.master) {
      var t = SFX.ctx.currentTime, g = audio.master.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v, t + (fade || 0.12));
    } else players[curP].el.volume = Math.min(1, v * trackGain(trackIndex));
    if (PA) PA.save(audio.volume, audio.muted);
    emit('mute');
  }
  // The nav player (js/nav-audio.js): play/pause, back, skip, and its volume bar.
  function togglePlay() {
    var el = active();
    if (el.paused) { userPaused = false; playSafe(); applyVolume(0.4); }
    else {
      userPaused = true;
      if (audio.master) {
        var t = SFX.ctx.currentTime, g = audio.master.gain;
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.3);
        setTimeout(function () { if (userPaused) el.pause(); }, 320);
      } else el.pause();
    }
    emit('track');
  }
  if (PA && PA.setTransport) {
    PA.setTransport({
      isPlaying: function () { return !active().paused && !userPaused; },
      toggle: togglePlay,
      next: function () { nextTrack(1); },
      prev: function () { nextTrack(-1); },
      title: function () { var tr = TRACKS[trackIndex]; return tr.artist + ' — ' + tr.title; }
    });
    PA.onVolume(function (v) { audio.volume = v; audio.muted = false; applyVolume(); });
  }
  // Leaving for another page: fade the music out first (js/page-audio.js waits for it); Back
  // restores it.
  if (PA) {
    PA.fadeOut = function () {
      if (!audio.master || audio.muted || active().paused) return 0;
      var t = SFX.ctx.currentTime, g = audio.master.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.7);
      return 700;
    };
    PA.fadeIn = function () { if (audio.master) applyVolume(1.2); };
  }
  function nextTrack(dir) {
    userPaused = false;   // skipping plays the next song
    if (TRACKS.length < 2) { active().currentTime = 0; playSafe(); return; }
    trackIndex = (trackIndex + (dir || 1) + TRACKS.length) % TRACKS.length;
    var from = players[curP], to = players[1 - curP];
    loadInto(to, trackIndex);
    curP = 1 - curP;
    xfadeAt = performance.now();
    emit('track');
    if (from.gain && to.gain) {
      var t = SFX.ctx.currentTime;
      to.gain.gain.cancelScheduledValues(t); to.gain.gain.setValueAtTime(0, t); to.gain.gain.linearRampToValueAtTime(trackGain(trackIndex), t + XFADE);
      from.gain.gain.cancelScheduledValues(t); from.gain.gain.setValueAtTime(from.gain.gain.value, t); from.gain.gain.linearRampToValueAtTime(0, t + XFADE);
      playEl(to.el);
      setTimeout(function () { if (players[curP] !== from) from.el.pause(); }, XFADE * 1000 + 150);
    } else { from.el.pause(); to.el.volume = Math.min(1, (audio.muted ? 0 : audio.volume * STAGE_LEVEL) * trackGain(trackIndex)); playEl(to.el); }   // sound still locked: just switch
  }

  // ---------- Shared textures ----------
  function radialTexture(stops) {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  var glowTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]);
  var sparkTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.6)'], [1, 'rgba(255,255,255,0)']]);
  // Additive light that leaves alpha alone: over the screen hole it adds glow on top of the grid
  // instead of covering it (plain additive blending would also raise alpha and hide the grid).
  var ADD = {
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor
  };

  // ---------- Moving-head beams ----------
  // Six fixtures hang under the light bar. Each is a soft additive light cone whose visibility
  // scales with haze, plus a lens flare sprite. Every other one also lights the floor (desktop).
  var BEAM_VS = [
    'varying float vAlong; varying vec3 vN; varying vec3 vV;',
    'void main() {',
    '  vAlong = uv.y;',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);',
    '  gl_Position = projectionMatrix * mv;',
    '}'].join('\n');
  var BEAM_FS = [
    'uniform vec3 uColor; uniform float uIntensity; uniform float uHaze;',
    'varying float vAlong; varying vec3 vN; varying vec3 vV;',
    'void main() {',
    '  float core = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);',
    '  float fall = pow(vAlong, 1.7);',
    '  float a = uIntensity * core * fall * (0.08 + uHaze * 0.9);',
    '  gl_FragColor = vec4(uColor * a, 1.0);',
    '}'].join('\n');
  var BEAM_LEN = 13;
  var beamGeo = new THREE.ConeGeometry(1.45, BEAM_LEN, 24, 1, true);   // soft additive cone: 24 sides is plenty
  beamGeo.translate(0, -BEAM_LEN / 2, 0);   // apex at the fixture, cone opens downward
  var beams = [];
  [-5.6, -3.4, -1.2, 0.8, 3.0, 5.2].forEach(function (x, i) {   // along the light bar
    var group = new THREE.Group();
    group.position.set(x, 8.4, 3.1);
    var mat = new THREE.ShaderMaterial(Object.assign({
      uniforms: { uColor: { value: new THREE.Color() }, uIntensity: { value: 0 }, uHaze: { value: show.haze } },
      vertexShader: BEAM_VS, fragmentShader: BEAM_FS,
      transparent: true, depthWrite: false, side: THREE.DoubleSide
    }, ADD));
    var cone = new THREE.Mesh(beamGeo, mat); cone.renderOrder = 2;
    group.add(cone);
    var lens = new THREE.Sprite(new THREE.SpriteMaterial(Object.assign({ map: glowTex, color: 0xffffff, depthWrite: false, transparent: true, fog: false }, ADD)));
    lens.scale.set(1.5, 1.5, 1); lens.renderOrder = 3;
    group.add(lens);
    scene.add(group);
    var spot = null;
    if (i % 2 === 1 && beams.filter(function (b) { return b.spot; }).length < Q.spots) {
      spot = new THREE.SpotLight(0xffffff, 0, 28, 0.2, 0.7, 1.2);
      spot.position.copy(group.position); scene.add(spot); scene.add(spot.target);
    }
    beams.push({ group: group, mat: mat, lens: lens, spot: spot, phase: i * 1.37, side: x < -0.2 ? -1 : 1, power: 0 });
  });
  var beamDir = new THREE.Vector3(), beamColor = new THREE.Color(), white = new THREE.Color(1, 1, 1);

  // Truss washes: coloured lights at the uprights that tint the truss and floor. They also carry
  // the warm flare when the pyro on their side fires (no extra lights for pyro).
  var washes = [new THREE.PointLight(0xffffff, 0, 26, 1.4), new THREE.PointLight(0xffffff, 0, 26, 1.4)];
  washes[0].position.set(-7.6, 5.2, 4.6); washes[1].position.set(7.3, 5.2, 4.6);   // front truss towers
  washes.forEach(function (w) { scene.add(w); });
  var washPower = 0, pyroFlare = [0, 0], PYRO_COLOR = new THREE.Color(0xffa04a);

  // ---------- Pyro: spark fountains along the stage front ----------
  var N = Q.sparks;
  var sPos = new Float32Array(N * 3), sVel = new Float32Array(N * 3), sCol = new Float32Array(N * 3);
  var sLife = new Float32Array(N), sMax = new Float32Array(N), sNext = 0;
  for (var si = 0; si < N; si++) sPos[si * 3 + 1] = -100;
  var sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3).setUsage(THREE.DynamicDrawUsage));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3).setUsage(THREE.DynamicDrawUsage));
  var sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial(Object.assign({
    size: 0.17, map: sparkTex, vertexColors: true, depthWrite: false,
    transparent: true, sizeAttenuation: true, toneMapped: false, fog: false
  }, ADD)));
  sparks.frustumCulled = false; sparks.renderOrder = 4; sparks.visible = false;
  scene.add(sparks);
  var emitters = [[-6.0, 1.15, 3.7], [-4.3, 1.15, 3.7], [3.9, 1.15, 3.7], [5.6, 1.15, 3.7]].map(function (p) {
    return { x: p[0], y: p[1], z: p[2], burn: 0, acc: 0 };
  });
  var clock = new THREE.Clock(), lastPyro = -10, sAlive = 0;
  function firePyro(power, which) {
    power = power || 1;
    emitters.forEach(function (e, i) { if (!which || which.indexOf(i) >= 0) e.burn = Math.max(e.burn, 0.35 + 0.65 * power); });
    lastPyro = clock.elapsedTime;
  }
  function updatePyro(dt) {
    var rate = LOW ? 150 : 320;
    var leftBurn = 0, rightBurn = 0;
    emitters.forEach(function (e, ei) {
      if (e.burn <= 0) return;
      e.burn -= dt;
      if (ei < 2) leftBurn = Math.max(leftBurn, e.burn); else rightBurn = Math.max(rightBurn, e.burn);
      e.acc += rate * dt;
      while (e.acc >= 1) {
        e.acc -= 1;
        var k = sNext; sNext = (sNext + 1) % N;
        if (sLife[k] <= 0) sAlive++;
        sPos[k * 3] = e.x + (Math.random() - 0.5) * 0.25; sPos[k * 3 + 1] = e.y; sPos[k * 3 + 2] = e.z + (Math.random() - 0.5) * 0.25;
        sVel[k * 3] = (Math.random() - 0.5) * 2.2; sVel[k * 3 + 1] = 8 + Math.random() * 5.5; sVel[k * 3 + 2] = (Math.random() - 0.5) * 2.2;
        sMax[k] = sLife[k] = 0.8 + Math.random() * 0.9;
      }
    });
    pyroFlare[0] = Math.min(1, leftBurn * 2); pyroFlare[1] = Math.min(1, rightBurn * 2);
    // Idle: no CPU loop, no buffer upload, no draw call.
    sparks.visible = sAlive > 0;
    if (!sAlive) return;
    var drag = 1 - 0.7 * dt;
    for (var i = 0; i < N; i++) {
      if (sLife[i] <= 0) continue;
      sLife[i] -= dt;
      var i3 = i * 3;
      if (sLife[i] <= 0) { sAlive--; sPos[i3 + 1] = -100; sCol[i3] = sCol[i3 + 1] = sCol[i3 + 2] = 0; continue; }
      sVel[i3 + 1] -= 9.8 * dt;
      sVel[i3] *= drag; sVel[i3 + 1] *= drag; sVel[i3 + 2] *= drag;
      sPos[i3] += sVel[i3] * dt; sPos[i3 + 1] += sVel[i3 + 1] * dt; sPos[i3 + 2] += sVel[i3 + 2] * dt;
      if (sPos[i3 + 1] < 1.1) { sPos[i3 + 1] = 1.1; sVel[i3 + 1] *= -0.25; }
      var f = sLife[i] / sMax[i], fl = 0.75 + Math.random() * 0.5;   // flicker
      sCol[i3] = 1.6 * f * fl; sCol[i3 + 1] = (0.55 + 0.45 * f) * 1.3 * f * fl; sCol[i3 + 2] = (0.15 + 0.6 * f * f) * f * fl;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.color.needsUpdate = true;
  }

  // ---------- Strobe (capped at 3 flashes/second, the WCAG limit for flashing content) ----------
  // Flashes by boosting the hemisphere + key lights that already exist, not with an extra light.
  var strobePhase = 0, strobeFlash = 0;
  function updateStrobe(dt) {
    if (show.strobe > 0.03) {
      var rate = 0.6 + show.strobe * 2.4;            // 0.6 .. 3 Hz
      if (reduced) rate = Math.min(rate, 1);
      strobePhase += dt * rate;
      if (strobePhase >= 1) { strobePhase -= 1; strobeFlash = 0.06; }
    } else strobePhase = 0.98;                       // first flash lands right away when turned up
    strobeFlash -= dt;
    var onNow = strobeFlash > 0, boost = onNow ? (reduced ? 1.2 : 3.2) : 0;
    hemi.intensity = HEMI_BASE + boost;
    key.intensity = KEY_BASE + boost * 1.4;
    return onNow;
  }

  // ---------- Audio analysis (or an idle 120 BPM pulse while muted/locked) ----------
  var avgBass = 0.2, lastKick = -1, lastBeatIdx = -1;
  function updateAudio(dt, t) {
    var lvl = 0, kick = false, el = active();
    // Near the end of a song, blend into the next one.
    if (!el.paused && el.duration > XFADE * 2 && el.duration - el.currentTime < XFADE && performance.now() - xfadeAt > 4000) nextTrack(1);
    if (audio.analyser && !audio.muted && !el.paused) {
      audio.analyser.getByteFrequencyData(audio.freq);
      var bass = 0, mid = 0, i;
      for (i = 1; i < 7; i++) bass += audio.freq[i];
      for (i = 7; i < 80; i++) mid += audio.freq[i];
      bass /= 6 * 255; mid /= 73 * 255;
      lvl = Math.min(1, bass * 0.7 + mid * 0.6);
      avgBass += (bass - avgBass) * 0.04;
      if (bass > avgBass * 1.2 && bass > 0.32 && t - lastKick > 0.28) { kick = true; lastKick = t; }
    } else if (!el.paused) {
      var beat = (t * 2) % 1;
      lvl = 0.32 + 0.38 * Math.pow(1 - beat, 5);
      var idx = Math.floor(t * 2);
      if (idx !== lastBeatIdx) { lastBeatIdx = idx; kick = true; }
    }
    show.level += (lvl - show.level) * 0.35;
    show.kick = kick ? 1 : Math.max(0, show.kick - dt * 3.5);
    return kick;
  }

  // ---------- Per-frame lighting rig update ----------
  function updateRig(dt, t, kick, strobing) {
    var hz = show.haze;
    scene.fog.density = 0.002 + hz * 0.02;
    scene.fog.color.setHSL(show.hue, 0.5, 0.012 + hz * 0.035);
    var speed = reduced ? 0.25 : 1;
    // Master level for the lights: the dim/bright slider, plus a brief dip while one track blends
    // into the next (the "transition" when the DJ booth is clicked).
    var xf = (performance.now() - xfadeAt) / (XFADE * 1000);
    var dip = xf >= 0 && xf < 1 ? 1 - 0.6 * Math.sin(Math.PI * xf) : 1;
    var lightK = (0.06 + 0.94 * show.dim) * dip;
    beams.forEach(function (b, i) {
      var tilt = -0.42 + 0.2 * Math.sin(t * 0.55 * speed + b.phase);
      var pan = b.side * 0.12 + 0.28 * Math.sin(t * 0.37 * speed + b.phase * 1.3);
      b.group.rotation.set(tilt, 0, pan);
      var h = (show.hue + (i % 2 ? 0.045 : -0.045) + 1) % 1;
      beamColor.setHSL(h, 0.9, 0.56);
      if (strobing) beamColor.copy(white);
      var inten = b.power * (0.55 + show.level * 0.9 + show.kick * 0.5) * (strobing ? 1.8 : 1) * lightK;
      b.mat.uniforms.uColor.value.copy(beamColor);
      b.mat.uniforms.uIntensity.value = inten;
      b.mat.uniforms.uHaze.value = hz;
      b.lens.material.color.copy(beamColor).lerp(white, 0.5);
      b.lens.material.opacity = Math.min(1, b.power * (0.6 + show.level) * lightK);
      if (b.spot) {
        b.group.updateMatrixWorld();
        beamDir.set(0, -1, 0).transformDirection(b.group.matrixWorld);
        b.spot.target.position.copy(b.group.position).addScaledVector(beamDir, 10);
        b.spot.color.copy(beamColor);
        b.spot.intensity = inten * 2.4;
      }
    });
    washes.forEach(function (w, i) {
      w.color.setHSL((show.hue + (i ? 0.08 : 0)) % 1, 0.85, 0.5).lerp(PYRO_COLOR, pyroFlare[i]);
      w.intensity = washPower * (1.1 + show.level * 1.6 + show.kick * 0.8) * lightK + pyroFlare[i] * 6;
    });
    // Light spill from the screen: a soft, desaturated version of the Colour dial. (It used to sample
    // the grid's average colour, but reading pixels back stalled the GPU; see "Grid picture".)
    glowTarget.setHSL(show.hue, 0.3, 0.62);
    glow.color.lerp(glowTarget, 0.08);
    glow.intensity = 0.9 * (0.35 + 0.65 * lightK);
    // Auto pyro on the beat; the dial sets how often.
    if (kick && show.pyro > 0.04 && t - lastPyro > 3.4 - show.pyro * 2.6 && Math.random() < 0.25 + show.pyro * 0.6) {
      var pair = Math.random() < 0.5 ? [0, 3] : [1, 2];
      firePyro(0.45 + show.pyro * 0.5, show.pyro > 0.8 ? null : pair);
    }
  }

  // ---------- Stage model (keeps its own materials and textures) ----------
  var model = null, mats = [];
  // Upload the model's textures now, behind the reveal, not on the first visible frame.
  function uploadTextures() {
    var maxA = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
    mats.forEach(function (m) {
      ['map', 'normalMap'].forEach(function (k) {
        if (!m[k]) return;
        m[k].anisotropy = Math.min(LOW ? 4 : 8, maxA);
        renderer.initTexture(m[k]);
      });
    });
  }

  // Parts that lost their textures on export come in plain white/cream. Give them simple dark
  // surfaces: matte-ish black speakers and ceiling, dark grey trusses with a metallic sheen so the
  // beams and the screen catch them. Only light-coloured, untextured materials are touched, because
  // one of the light bar's (black) materials shares the "0012_Bisque_1" name with the trusses.
  var RESURFACE = {
    '0012_Bisque_1':   { color: 0x2b2b2b, roughness: 0.4, metalness: 0.6 },    // truss towers + overhead grid
    'SpeakerTripod01': { color: 0x0e0e0e, roughness: 0.6, metalness: 0 },      // front speakers + tripods
    'FrontColor':      { color: 0x0e0e0e, roughness: 0.6, metalness: 0 },      // hanging line arrays
    '':                { color: 0x111111, roughness: 0.8, metalness: 0 }       // ceiling panel under the roof
  };
  function resurface(m) {
    var r = RESURFACE[m.name || ''], hsl = {};
    if (!r || m.map) return false;
    m.color.getHSL(hsl);
    if (hsl.l < 0.5) return false;
    m.color.set(r.color).convertSRGBToLinear();   // hex values above are as they look on screen
    m.roughness = r.roughness; m.metalness = r.metalness;
    return true;
  }
  // A real stage is mostly gloss-black: painted deck, plastic and metal cases. Out of the exporter
  // nearly everything is fully rough (1.0), which reads as clay. Bring the roughness down so the
  // floor and cases pick up the beams, the washes and the screen in their reflections.
  function glossify(m) {
    if (!m.isMeshStandardMaterial) return;
    var hsl = {}; m.color.getHSL(hsl);
    if (m.map) m.roughness = Math.min(m.roughness, 0.55);          // the DJ gear
    else if (hsl.l < 0.06) m.roughness = Math.min(m.roughness, 0.32);   // black deck, cases, backdrop
    else m.roughness = Math.min(m.roughness, 0.5);
    m.envMapIntensity = 1.2;
  }

  var loader = new THREE.GLTFLoader();
  loader.setMeshoptDecoder(window.MeshoptDecoder);   // the stage file uses meshopt compression
  loader.load(ASSETS.model, function (gltf) {
    model = gltf.scene;
    var box = new THREE.Box3().setFromObject(model);
    var s0 = box.getSize(new THREE.Vector3());
    model.scale.multiplyScalar(20 / (Math.max(s0.x, s0.y, s0.z) || 1));
    model.updateMatrixWorld(true);
    box.setFromObject(model);
    var c = box.getCenter(new THREE.Vector3());
    model.position.x -= c.x; model.position.z -= c.z; model.position.y -= box.min.y;
    model.traverse(function (o) {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true;
        var arr = Array.isArray(o.material) ? o.material : [o.material];
        arr.forEach(function (m) {
          if (mats.indexOf(m) >= 0) return;
          if (!resurface(m)) glossify(m); else m.envMapIntensity = 1.2;
          mats.push(m);
        });
      }
    });
    scene.add(model);
    freeze(model);
    onAllLoaded();
  }, null, function (err) { console.error(err); fail('Could not load the 3D model: ' + ((err && err.message) || err)); });

  // ---------- Interactive parts: hover highlight ----------
  // The light bar, the DJ booth and both speaker columns can be clicked (js/stage-ui.js). On
  // hover each one lights up with a fresnel rim glow plus its edges drawn as a fine silver
  // wireframe, so it reads as "this does something".
  // The model's meshes are merged by material (for speed), so the parts aren't separate objects:
  // after loading, the triangles inside each part's box are copied out into an overlay of their own.
  // The overlays only draw while they're showing.
  var ZONES = {
    lights:  new THREE.Box3(new THREE.Vector3(-6.7, 8.15, 2.5), new THREE.Vector3(6.3, 10.45, 4.0)),
    booth:   new THREE.Box3(new THREE.Vector3(-3.6, 1.25, -0.3), new THREE.Vector3(2.8, 4.1, 2.05)),
    speaker: new THREE.Box3(new THREE.Vector3(-7.45, 4.9, 2.7), new THREE.Vector3(-6.35, 11.0, 4.3)),    // left column
    speakerR: new THREE.Box3(new THREE.Vector3(5.95, 4.9, 2.7), new THREE.Vector3(7.05, 11.0, 4.3))     // right column
  };
  var HL_VS = [
    'varying vec3 vN; varying vec3 vV;',
    'void main() {',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);',
    '  gl_Position = projectionMatrix * mv;',
    '}'].join('\n');
  var HL_FS = [
    'uniform vec3 uColor; uniform float uAlpha; uniform float uTime;',
    'varying vec3 vN; varying vec3 vV;',
    'void main() {',
    '  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);',
    '  float sweep = 0.75 + 0.25 * sin(gl_FragCoord.x * 0.012 + gl_FragCoord.y * 0.008 - uTime * 2.4);   // slow light sweep',
    '  gl_FragColor = vec4(uColor * uAlpha * (0.05 + 0.85 * rim) * sweep, 1.0);',
    '}'].join('\n');
  var highlights = {}, hlColor = new THREE.Color(), hlBuilt = false;
  function readPos(attr, i, out) {
    // gltfpack stores positions as integers (dequantized by the node transform); if an attribute is
    // flagged normalized, scale it back to -1..1 the way the GPU would.
    out.fromBufferAttribute(attr, i);
    if (attr.normalized) {
      var a = attr.array, d = a instanceof Int8Array ? 127 : a instanceof Uint8Array ? 255 : a instanceof Int16Array ? 32767 : a instanceof Uint16Array ? 65535 : 1;
      out.multiplyScalar(1 / d);
    }
    return out;
  }
  function buildHighlights() {
    if (hlBuilt || !model) return;
    hlBuilt = true;
    var names = Object.keys(ZONES), acc = {}, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), m = new THREE.Vector3();
    names.forEach(function (n) { acc[n] = []; });
    model.traverse(function (o) {
      if (!o.isMesh) return;
      var P = o.geometry.attributes.position, I = o.geometry.index, n = I ? I.count : P.count, w = o.matrixWorld;
      for (var t = 0; t < n; t += 3) {
        readPos(P, I ? I.getX(t) : t, a).applyMatrix4(w);
        readPos(P, I ? I.getX(t + 1) : t + 1, b).applyMatrix4(w);
        readPos(P, I ? I.getX(t + 2) : t + 2, c).applyMatrix4(w);
        m.copy(a).add(b).add(c).multiplyScalar(1 / 3);
        for (var z = 0; z < names.length; z++) {
          if (ZONES[names[z]].containsPoint(m)) { acc[names[z]].push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); break; }
        }
      }
    });
    names.forEach(function (n) {
      if (!acc[n].length) return;
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(acc[n], 3));
      g.computeVertexNormals();
      // Push the shell out a hair along each face normal so it sits on top of the part, not in it.
      var p = g.attributes.position, nn = g.attributes.normal;
      for (var i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + nn.getX(i) * 0.015, p.getY(i) + nn.getY(i) * 0.015, p.getZ(i) + nn.getZ(i) * 0.015);
      var shell = new THREE.Mesh(g, new THREE.ShaderMaterial(Object.assign({
        uniforms: { uColor: { value: new THREE.Color(1, 1, 1) }, uAlpha: { value: 0 }, uTime: { value: 0 } },
        vertexShader: HL_VS, fragmentShader: HL_FS, transparent: true, depthWrite: false, depthFunc: THREE.LessEqualDepth
      }, ADD)));
      var lines = new THREE.LineSegments(new THREE.EdgesGeometry(g, 32), new THREE.LineBasicMaterial(Object.assign({
        color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthFunc: THREE.LessEqualDepth, fog: false, toneMapped: false
      }, ADD)));
      shell.renderOrder = lines.renderOrder = 5;
      // Main camera only (the screen's layer): kept out of the reflection renders, which would
      // otherwise need their own shader variants (that compile was a 400 ms freeze on first show).
      shell.layers.set(SCREEN_LAYER); lines.layers.set(SCREEN_LAYER);
      shell.visible = lines.visible = false;
      shell.frustumCulled = lines.frustumCulled = false;
      scene.add(shell); scene.add(lines); freeze(shell); freeze(lines);
      highlights[n] = { shell: shell, lines: lines, alpha: 0, target: 0, tris: acc[n].length / 9 };
    });
  }
  // Fade each overlay toward its target. A gentle one-off pulse the first time the whole stage is in
  // view shows that these three can be touched.
  var hlPulse = -1;
  function updateHighlights(dt, t, p) {
    if (!hlBuilt) return;
    if (hlPulse < 0 && p > 0.97 && washPower >= 1) hlPulse = t;
    hlColor.setHSL(show.hue, 0.35, 0.82);
    var k = 1 - Math.exp(-dt / 0.18);
    Object.keys(highlights).forEach(function (n, i) {
      var h = highlights[n], pulse = 0;
      if (hlPulse >= 0) { var e = (t - hlPulse - i * 0.35) / 1.6; if (e > 0 && e < 1) pulse = 0.55 * Math.sin(Math.PI * e); }
      h.alpha += (Math.max(h.target, pulse) - h.alpha) * k;
      if (h.alpha < 0.003 && h.target === 0 && !pulse) h.alpha = 0;
      var on = h.alpha > 0;
      h.shell.visible = h.lines.visible = on;
      if (!on) return;
      h.shell.material.uniforms.uAlpha.value = h.alpha;
      h.shell.material.uniforms.uTime.value = t;
      h.shell.material.uniforms.uColor.value.copy(hlColor);
      h.lines.material.color.copy(hlColor);
      h.lines.material.opacity = h.alpha * 0.9;
    });
  }
  // Where a part is on screen (CSS px within the stage view), for the controls to sit on.
  var corner = new THREE.Vector3();
  function zoneRect(name) {
    var bx = ZONES[name]; if (!bx) return null;
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (var i = 0; i < 8; i++) {
      corner.set(i & 1 ? bx.max.x : bx.min.x, i & 2 ? bx.max.y : bx.min.y, i & 4 ? bx.max.z : bx.min.z).project(camera);
      var x = (corner.x + 1) / 2 * W, y = (1 - corner.y) / 2 * H;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  // Static objects: compute their matrices once instead of every frame.
  function freeze(root) {
    root.updateMatrixWorld(true);
    root.traverse(function (o) { o.matrixAutoUpdate = false; });
  }

  var allLoaded = false, stageReady = false;   // stageReady: hover overlays built, controls can show
  function loading() { return !allLoaded; }
  function onAllLoaded() {
    var w0 = performance.now();
    if (allLoaded) return;
    allLoaded = true;
    uploadTextures();
    // Nothing that casts shadows ever moves, so draw the shadow map once (it also stopped being
    // re-rendered for every reflection face).
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    // Warm-up while the visitor is still looking at the grid: compile every shader, fill both
    // reflection targets and draw one frame (into the post target too), so pulling back is smooth.
    updateCamera(0.5);
    renderer.compile(scene, camera);
    for (var i = 0; i < 12 * Q.envFaceEvery; i++) updateEnvFace();
    draw();
    if (statusEl.textContent === 'Setting the stage…') statusEl.textContent = '';
    perf.loadedAt = Math.round(w0); perf.warmupMs = Math.round(performance.now() - w0);   // for tuning (window.__dbg.perf)
    if (reveal.pending) startReveal();
    // (The stage's hover wireframes and road-case controls were removed: music is run from the nav
    // player now, js/nav-audio.js. buildHighlights() is kept below in case they come back.)
    setTimeout(function () {
      updateCamera(1);
      draw(1);
      stageReady = true;
      emit('ready');
    }, 300);
  }

  // ---------- Reveal: fixtures strike one by one and the reel starts, as the camera pulls back ----------
  var reveal = { t0: -1, pending: false };
  function maybeReveal(p) {
    if (reveal.t0 >= 0 || reveal.pending || p < 0.08) return;
    if (allLoaded) startReveal();
    else { reveal.pending = true; statusEl.textContent = 'Setting the stage…'; }
  }
  function startReveal() {
    reveal.pending = false;
    reveal.t0 = performance.now();
    perf.settleUntil = reveal.t0 + 1500;
    active().currentTime = 0;
    playSafe();
  }
  // Fixtures strike one by one, then the washes fade up. Silent: the music carries the reveal. Driven by the
  // frame clock rather than timers, so it can't drift from what's drawn.
  function updateReveal(now) {
    if (reveal.t0 < 0 || washPower >= 1) return;
    var e = now - reveal.t0;
    beams.forEach(function (b, i) {
      var at = 250 + i * 150;
      if (e >= at && !b.struck) b.struck = true;   // (no sound: the music carries the reveal)
      b.power = Math.min(1, Math.max(0, (e - at) / 220));
    });
    washPower = Math.min(1, Math.max(0, (e - 250 - beams.length * 150) / 900));
  }

  // ---------- Post: depth of field + edge haze ----------
  // The scene renders into an off-screen target with its depth. Then:
  // 1. Blur pass, at half resolution (a quarter of the pixels; a soft blur loses nothing by it):
  //    each pixel is blurred by its distance from the screen's depth (the screen and the booth stay
  //    sharp, the front speakers, trusses and the dark beyond go soft), plus extra toward the edges
  //    of the picture, where the model's hard edges and the end of the set would give it away.
  // 2. Composite, full resolution: sharp where in focus, the blurred copy where not, and a slow
  //    coloured haze that thickens toward the edges.
  // Colours stay premultiplied the whole way, so the see-through screen hole survives the blur.
  // Both effects ramp in with the scroll: at the top of the page the grid is untouched.
  // Measured before splitting into two passes: one full-resolution pass cost ~7 ms/frame at 1.75x.
  var POST_VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  var POST_COMMON = [
    '#include <packing>',
    'uniform sampler2D tColor; uniform sampler2D tDepth;',
    'uniform vec2 uRes; uniform float uNear; uniform float uFar; uniform float uFocus;',
    'uniform float uDof; uniform float uEdgeBlur; uniform float uMaxBlur;',
    'varying vec2 vUv;',
    'float edgeOf(vec2 uv) {',
    '  vec2 c = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);',
    '  return smoothstep(0.42, 1.0, length(c) / length(vec2(uRes.x / uRes.y, 1.0) * 0.5));   // 0 centre .. 1 corner',
    '}',
    '// Blur radius in full-resolution pixels.',
    'float radiusAt(vec2 uv) {',
    '  float d = -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar);',
    '  float coc = clamp(abs(d - uFocus) / max(d, 0.001), 0.0, 1.0) * uDof;',
    '  return max(coc, edgeOf(uv) * uEdgeBlur) * uMaxBlur;',
    '}'].join('\n');
  var BLUR_FS = POST_COMMON + '\n' + [
    'float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
    'void main() {',
    '  float rad = radiusAt(vUv);',
    '  vec4 acc = texture2D(tColor, vUv); float n = 1.0;',
    '  if (rad > 0.6) {',
    '    float rot = hash(gl_FragCoord.xy) * 6.2832;   // per-pixel rotation hides the tap pattern',
    '    for (int i = 0; i < TAPS; i++) {',
    '      float fi = float(i) + 0.5;',
    '      float a = fi * 2.39996 + rot;   // golden-angle spiral',
    '      acc += texture2D(tColor, vUv + vec2(cos(a), sin(a)) * sqrt(fi / float(TAPS)) * rad / uRes); n += 1.0;',
    '    }',
    '  }',
    '  gl_FragColor = acc / n;',
    '}'].join('\n');
  var COMPOSITE_FS = POST_COMMON + '\n' + [
    'uniform sampler2D tBlur; uniform float uHaze; uniform vec3 uHazeColor; uniform float uTime;',
    'void main() {',
    '  vec4 col = mix(texture2D(tColor, vUv), texture2D(tBlur, vUv), smoothstep(0.6, 2.5, radiusAt(vUv)));',
    '  float drift = 0.85 + 0.15 * sin(vUv.x * 5.0 + uTime * 0.15) * sin(vUv.y * 3.0 - uTime * 0.11);',
    '  float h = clamp(edgeOf(vUv) * uHaze * drift, 0.0, 1.0);',
    '  gl_FragColor = col * (1.0 - h) + vec4(uHazeColor, 1.0) * h;',
    '}'].join('\n');
  function makePost() {
    var opts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: false };
    var rt = new THREE.WebGLRenderTarget(2, 2, opts);
    rt.texture.encoding = THREE.sRGBEncoding;   // 8-bit, so store display-encoded colour (no banding in the darks)
    rt.texture.generateMipmaps = false;
    rt.depthTexture = new THREE.DepthTexture(2, 2);
    rt.depthTexture.type = THREE.UnsignedIntType;
    var half = new THREE.WebGLRenderTarget(2, 2, Object.assign({ depthBuffer: false }, opts));
    half.texture.generateMipmaps = false;
    var shared = {
      tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, uRes: { value: new THREE.Vector2(1, 1) },
      uNear: { value: camera.near }, uFar: { value: camera.far }, uFocus: { value: 20 },
      uDof: { value: 0 }, uEdgeBlur: { value: 0 }, uMaxBlur: { value: 6 }
    };
    function pass(fs, extra, defines) {
      var m = new THREE.ShaderMaterial({ defines: defines || {}, uniforms: Object.assign({}, shared, extra || {}),
        vertexShader: POST_VS, fragmentShader: fs, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
      var s = new THREE.Scene(), q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m);
      q.frustumCulled = false; s.add(q);
      return { scene: s, u: m.uniforms };
    }
    var blur = pass(BLUR_FS, null, { TAPS: Q.taps });
    var comp = pass(COMPOSITE_FS, { tBlur: { value: half.texture }, uHaze: { value: 0 }, uHazeColor: { value: new THREE.Color() }, uTime: { value: 0 } });
    var pcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return {
      rt: rt, u: shared, comp: comp.u, enabled: true,
      resize: function () {
        var d = renderer.getPixelRatio(), w = Math.max(2, Math.round(W * d)), h = Math.max(2, Math.round(H * d));
        rt.setSize(w, h); half.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
        shared.uRes.value.set(w, h);
        shared.uMaxBlur.value = (LOW ? 4 : 6) * d;   // ~same softness at any resolution
      },
      render: function () {
        renderer.setRenderTarget(half); renderer.render(blur.scene, pcam);
        renderer.setRenderTarget(null); renderer.render(comp.scene, pcam);
      }
    };
  }
  var post = POST ? makePost() : null;
  if (post) post.resize();
  var focusVec = new THREE.Vector3();
  function draw(p) {
    if (!post || !post.enabled) { renderer.setRenderTarget(null); renderer.render(scene, camera); return; }
    renderer.setRenderTarget(post.rt);
    renderer.render(scene, camera);
    var e = ease(p == null ? 1 : p), u = post.u, c = post.comp;
    // Focus on the screen: its distance along the view direction.
    u.uFocus.value = -focusVec.copy(SCREEN_C).applyMatrix4(camera.matrixWorldInverse).z;
    u.uDof.value = 0.55 * e;
    u.uEdgeBlur.value = 0.9 * e;
    c.uHaze.value = (0.32 + show.haze * 0.4) * e;
    c.uHazeColor.value.setHSL(show.hue, 0.35, 0.05 + show.haze * 0.05);
    c.uTime.value = clock.elapsedTime;
    post.render();
  }

  // ---------- Adaptive resolution ----------
  // Watches real frame times and trades render resolution for frame rate, aiming for at least
  // 60 fps (also on 120 Hz screens). Steps down quickly when frames are late, steps up only after
  // ~4 s of comfortable frames, and stops stepping up if it keeps flip-flopping (same idea as
  // drei's PerformanceMonitor). If even the minimum resolution is too slow, it drops the floor
  // spots, slows reflection updates and turns the depth of field off, once.
  var BUDGET = 1000 / 60;
  var perf = {
    // With depth of field + haze on, resolution above 1.5x is spent on pixels the blur softens anyway
    // (measured: 1.75x on a 2x screen took the whole 16.7 ms frame budget on the GPU).
    dpr: renderer.getPixelRatio(), min: Math.min(DEVICE_DPR, Q.dprMin), max: Math.min(DEVICE_DPR, POST ? Math.min(1.5, Q.dprMax) : Q.dprMax),
    frames: [], last: 0, good: 0, slowAtMin: 0, flips: 0, lastDir: 0, noMoreUp: false, fellBack: false, settleUntil: 0
  };
  function stepResolution(dir, now) {
    if (dir > 0 && perf.noMoreUp) return;
    var next = Math.round(Math.min(perf.max, Math.max(perf.min, perf.dpr * (dir > 0 ? 1.15 : 0.8))) * 20) / 20;
    if (next === perf.dpr) return;
    if (perf.lastDir && dir !== perf.lastDir && ++perf.flips >= 3) perf.noMoreUp = true;
    perf.lastDir = dir; perf.good = 0; perf.dpr = next;
    renderer.setPixelRatio(next);
    if (post) post.resize();
    perf.settleUntil = now + 600;   // ignore the frames around the resize itself
  }
  function adaptResolution(now) {
    if (FIXED_DPR) return;
    if (perf.last) perf.frames.push(now - perf.last);
    perf.last = now;
    if (now < perf.settleUntil) { perf.frames.length = 0; return; }
    if (perf.frames.length < 45) return;
    var f = perf.frames.sort(function (a, b) { return a - b; }), med = f[f.length >> 1];
    // Slow frames come in clumps (a GPU-bound frame doubles to ~33 ms) that never move the median,
    // so also count them: more than 1 in 10 over budget counts as slow.
    var late = f.filter(function (x) { return x > BUDGET * 1.5; }).length / f.length;
    perf.frames = [];
    if (med > BUDGET * 1.2 || late > 0.1) {
      if (perf.dpr > perf.min) stepResolution(-1, now);
      else if (++perf.slowAtMin >= 3 && !perf.fellBack) {
        perf.fellBack = true;
        beams.forEach(function (b) { if (b.spot) b.spot.visible = false; });
        Q.envFaceEvery = Math.max(Q.envFaceEvery, 4);
        if (post) post.enabled = false;
      }
    } else if (med < BUDGET * 1.06 && late < 0.03 && ++perf.good >= 5) stepResolution(1, now);
  }

  // ---------- Visualizer on the screen + the stage as a backdrop ----------
  // ps = how far past the full-stage view (window heights). From there the content scrolls over the
  // stage: the visualizer takes over the screen, and the stage renders a little lighter (resolution
  // capped at BG_DPR) since it's now a backdrop behind text and cards.
  var BG_DPR = 1.25, FULL_MAX = perf.max, shownGridHidden = false;
  var worksEl = document.getElementById('work');
  function updateViz(dt, kick, ps, now) {
    // Only once the Selected Works section scrolls up into view: it starts when the section's top
    // reaches 95% of the window and has fully taken over by 35%. Above that, the grid stays on.
    var wt = worksEl ? worksEl.getBoundingClientRect().top / (window.innerHeight || H) : 99;
    var want = viz ? smooth(0.95, 0.35, wt) : 0;
    vizMix += (want - vizMix) * Math.min(1, dt * 6);
    if (Math.abs(vizMix - want) < 0.002) vizMix = want;
    var on = vizMix > 0.001;
    if (vizScreen) vizScreen.visible = on;
    if (on) {
      var audible = audio.analyser && !audio.muted && !active().paused;
      viz.render(dt, { freq: audible ? audio.freq : null, level: show.level, kick: kick, hue: 0, volume: audio.volume, playing: audible });
      vizScreen.material.map = viz.texture;
      vizScreen.material.opacity = vizMix;
      // Reflections show the visualizer instead of the grid picture once it dominates.
      proxy.material.map = vizMix > 0.5 ? viz.texture : mirrorTex;
    } else if (proxy.material.map !== mirrorTex) proxy.material.map = mirrorTex;
    var hidden = vizMix >= 0.999;
    if (hidden !== shownGridHidden) {
      shownGridHidden = hidden;
      frame.style.visibility = hidden ? 'hidden' : '';
      if (SEQ.setGridHidden) SEQ.setGridHidden(hidden);
    }
    var cap = ps > 0.6 ? Math.min(FULL_MAX, BG_DPR) : FULL_MAX;
    if (cap !== perf.max) {
      perf.max = cap;
      if (perf.dpr > cap) { perf.dpr = cap; renderer.setPixelRatio(cap); if (post) post.resize(); perf.settleUntil = now + 600; }
    }
    return hidden;
  }

  // ---------- Render loop ----------
  // While the grid fills the window (p 0) nothing 3D is drawn at all. Nothing runs while the
  // section is scrolled away (js/site.js) or the tab is hidden.
  var heroVisible = true, shownK = -1;
  window.__setHeroVisible = function (v) { heroVisible = v; };
  function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  (function animate(now) {
    requestAnimationFrame(animate);
    now = now || performance.now();
    var dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    var kick = updateAudio(dt, t);
    if (!heroVisible) { perf.last = 0; return; }
    var p = SEQ.progress(), ps = SEQ.past ? SEQ.past() : 0;
    maybeReveal(p);
    updateCamera(p);
    var gridHidden = allLoaded && updateViz(dt, kick, ps, now);
    if (!gridHidden) warpGrid(p);
    // The stage fades in around the screen over the first part of the pull-back.
    var k = allLoaded ? smooth(0.0, 0.3, p) : 0;
    if (Math.abs(k - shownK) > 0.001) { wrap.style.opacity = k.toFixed(3); shownK = k; }
    if (k <= 0) { perf.last = 0; return; }
    updateReveal(now);
    var strobing = updateStrobe(dt);
    updateRig(dt, t, kick, strobing);
    updatePyro(dt);
    updateHighlights(dt, t, p);
    if (vizMix < 0.5) updateMirror(now);
    updateEnvFace();
    draw(p);
    adaptResolution(now);
  })();

  // ---------- Public API for the stage controls (js/stage-ui.js) ----------
  window.Stage = {
    state: show,
    on: on,
    get ready() { return stageReady; },
    progress: SEQ.progress,
    // Lights
    setHue: function (h) { show.hue = ((h % 1) + 1) % 1; emit('lights'); },
    setDim: function (d) { show.dim = Math.min(1, Math.max(0, d)); emit('lights'); },
    fire: function () { firePyro(1); },
    // Hover overlays + where each part is on screen
    highlight: function (name, on) { if (highlights[name]) highlights[name].target = on ? 1 : 0; },
    zoneRect: zoneRect,
    // Music
    track: function () { return TRACKS[trackIndex]; },
    nextTrack: function () { nextTrack(1); },
    prevTrack: function () { nextTrack(-1); },
    get playing() { return !active().paused; },
    get muted() { return audio.muted; },
    get volume() { return audio.volume; },
    setVolume: function (v) {
      audio.volume = Math.min(1, Math.max(0, v));
      if (audio.volume > 0 && audio.muted) audio.muted = false;   // turning it up un-mutes
      applyVolume();
    },
    toggleMute: function () { audio.muted = !audio.muted; applyVolume(0.25); },
    // Fills `buf` with the live waveform; returns false while there's no audible signal.
    getWaveform: function (buf) {
      if (!audio.analyser || audio.muted || active().paused) return false;
      audio.analyser.getByteTimeDomainData(buf);
      return true;
    }
  };
  window.__dbg = { scene: scene, players: players, audio: audio, THREE: THREE, camera: camera, renderer: renderer, show: show, beams: beams, perf: perf, post: post, highlights: highlights, quality: LOW ? 'low' : 'high', progress: SEQ.progress };
})();
