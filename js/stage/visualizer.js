// Stage: audio-reactive LED visualizer (mirrors, feedback, threshold, grain).
(function () {
  var LOOK = {
    folds: 6,
    tiles: 2,
    decay: 0.72,
    threshold: 0.55,
    tone: 3,
    grain: 0.35,
    scanlines: 0.18,   // darkness of every other row
    tile: 7,
    edge: 0.95,        // brightness of the glowing edges
    bright: 0.52,
    sizeMin: 0.78,     // picture size at volume 0 ...
    sizeMax: 1.12      // ... and at full volume
  };

  var VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

  var FEED = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uPrev;',
    'uniform sampler2D uSpec;',
    'uniform float uRot, uLevel, uKick, uHue, uAspect, uScale, uDecay, uFolds, uTiles;',
    'const float PI = 3.14159265;',
    'vec3 col6(float i) {',
    '  i = mod(i, 6.0);',
    '  if (i < 1.0) return vec3(1.0, 0.08, 0.08);',
    '  if (i < 2.0) return vec3(0.1, 0.85, 1.0);',
    '  if (i < 3.0) return vec3(0.15, 0.35, 1.0);',
    '  if (i < 4.0) return vec3(1.0, 0.9, 0.0);',
    '  if (i < 5.0) return vec3(1.0, 1.0, 1.0);',
    '  return vec3(1.0, 0.1, 0.85);',
    '}',
    'float spec(float x, float line) { return texture2D(uSpec, vec2(clamp(x, 0.0, 1.0), (line + 0.5) / 6.0)).r; }',
    'void main() {',
    '  vec2 p = vUv - 0.5; p.x *= uAspect;',
    '  vec2 q = p * (0.975 - uKick * 0.05);',
    '  vec3 prev = texture2D(uPrev, vec2(q.x / uAspect, q.y) + 0.5).rgb * uDecay;',
    '  p /= uScale;',
    '  p = abs(fract(p * uTiles * 0.5 + 0.5) - 0.5) * 2.0 / uTiles;',
    '  float r = length(p), a = atan(p.y, p.x), seg = PI / uFolds;',
    '  a = abs(mod(a + uRot, 2.0 * seg) - seg);',   // turns only as the music pushes it
    '  vec2 k = r * vec2(cos(a), sin(a));',
    '  float amp = 0.32 + uKick * 0.08, gap = 0.02 + uLevel * 0.02;',
    '  float th = 0.006 + uLevel * 0.012 + uKick * 0.006;',
    '  float fan = smoothstep(0.0, 0.14, k.x);',
    '  vec3 col = vec3(0.0);',
    '  for (int i = 0; i < 6; i++) {',
    '    float fi = float(i);',
    '    vec3 c = col6(fi + floor(uHue * 6.0));',
    '    float y = (fi * gap + spec(k.x * 1.4, fi) * amp) * fan;',
    '    for (int j = 0; j < 5; j++) {',
    '      float fj = float(j), e = 1.0 - fj * 0.19;',   // each echo a little smaller ...
    '      col = max(col, c * (1.0 - fj * 0.13) * smoothstep(th, th * 0.35, abs(k.y - y * e)));',
    '    }',
    '  }',
    '  gl_FragColor = vec4(max(prev, col), 1.0);',   // "lighten" composite over the trails
    '}'
  ].join('\n');

  var GRIT = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uSrc;',
    'uniform vec2 uRes;',
    'uniform float uTime, uKick, uThresh, uTone, uGrain, uScan, uTile, uEdge, uBright;',
    'float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
    'float lumAt(vec2 uv) { return dot(texture2D(uSrc, uv).rgb, vec3(0.299, 0.587, 0.114)); }',   // perceived brightness: blues read dark
    'void main() {',
    '  vec2 cells = uRes / uTile, id = floor(vUv * cells), f = fract(vUv * cells);',
    '  vec2 c = (id + 0.5) / cells, d = 1.0 / cells;',
    '  float l = lumAt(c);',
    '  float e1 = length(vec2(lumAt(c + vec2(d.x, 0.0)) - lumAt(c - vec2(d.x, 0.0)), lumAt(c + vec2(0.0, d.y)) - lumAt(c - vec2(0.0, d.y))));',
    '  float e2 = length(vec2(lumAt(c + vec2(2.0 * d.x, 0.0)) - lumAt(c - vec2(2.0 * d.x, 0.0)), lumAt(c + vec2(0.0, 2.0 * d.y)) - lumAt(c - vec2(0.0, 2.0 * d.y))));',
    '  float edge = max(clamp(e1 * 2.2, 0.0, 1.0), clamp(e2 * 1.1, 0.0, 1.0) * 0.4);',
    '  float body = floor(l * uTone + 0.5) / uTone * step(uThresh, l);',
    '  float v = body * 0.3 + edge * uEdge;',
    '  v *= mix(0.2, 1.0, step(0.12, f.x) * step(0.12, f.y));',
    '  v *= uBright * (1.0 + uKick * 0.3);',
    '  vec2 px = floor(vUv * uRes);',
    '  v *= 1.0 + (hash(px + floor(uTime * 60.0) * 1.37) - 0.5) * uGrain;',
    '  v *= 1.0 - uScan * mod(px.y, 2.0);',
    '  gl_FragColor = vec4(vec3(clamp(v, 0.0, 1.0)), 1.0);',
    '}'
  ].join('\n');

  window.Visualizer = function (THREE, renderer, opts) {
    opts = opts || {};
    var W = opts.width || 512, aspect = 16 / 9, H = Math.round(W / aspect);
    var rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false };
    var rtA = new THREE.WebGLRenderTarget(W, H, rtOpts), rtB = new THREE.WebGLRenderTarget(W, H, rtOpts);
    var out = new THREE.WebGLRenderTarget(W, H, Object.assign({}, rtOpts, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }));
    if (THREE.sRGBEncoding) out.texture.encoding = THREE.sRGBEncoding;
    var lines = window.SpectrumLines ? SpectrumLines(48, 6) : null, NB = 48;
    var specData = new Uint8Array(NB * 6 * 4), specTex = new THREE.DataTexture(specData, NB, 6, THREE.RGBAFormat);
    specTex.minFilter = specTex.magFilter = THREE.LinearFilter;
    var feed = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FEED, depthTest: false, depthWrite: false,
      uniforms: {
        uPrev: { value: rtA.texture }, uSpec: { value: specTex },
        uRot: { value: 0 }, uLevel: { value: 0 }, uKick: { value: 0 }, uHue: { value: 0 }, uAspect: { value: aspect },
        uScale: { value: 1 }, uDecay: { value: LOOK.decay }, uFolds: { value: LOOK.folds }, uTiles: { value: LOOK.tiles }
      }
    });
    var grit = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: GRIT, depthTest: false, depthWrite: false,
      uniforms: {
        uSrc: { value: rtB.texture }, uRes: { value: new THREE.Vector2(W, H) }, uTime: { value: 0 }, uKick: { value: 0 },
        uThresh: { value: LOOK.threshold }, uTone: { value: LOOK.tone }, uGrain: { value: LOOK.grain }, uScan: { value: LOOK.scanlines },
        uTile: { value: LOOK.tile }, uEdge: { value: LOOK.edge }, uBright: { value: LOOK.bright }
      }
    });
    var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), feed);
    quad.frustumCulled = false;
    var scene = new THREE.Scene(), cam = new THREE.Camera();
    scene.add(quad);
    var t = 0, kick = 0, scale = 1;

    var idle = 1, rot = 0;
    function fillSpectrum(freq, playing, dt) {
      idle += ((playing ? 0 : 1) - idle) * Math.min(1, dt * 2.5);
      if (lines) lines.update(playing ? freq : null);
      for (var l = 0; l < 6; l++) for (var b = 0; b < NB; b++) {
        var v = lines ? lines.rows[l][b] : 0;
        var x = b / NB, pulse = 0.18 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.9 - x * 5 - l * 0.35), 3) * (0.55 + 0.45 * Math.sin(t * 0.3));
        v = v * (1 - idle) + pulse * idle;
        specData[(l * NB + b) * 4] = Math.round(Math.min(1, v) * 255);
      }
      specTex.needsUpdate = true;
    }

    var api = {
      look: LOOK,
      get texture() { return out.texture; },
      setAspect: function (a) {
        if (!(a > 0) || Math.abs(a - aspect) < 0.01) return;
        aspect = a; H = Math.max(32, Math.round(W / Math.max(0.4, a)));
        rtA.setSize(W, H); rtB.setSize(W, H); out.setSize(W, H);
        feed.uniforms.uAspect.value = a; grit.uniforms.uRes.value.set(W, H);
      },
      render: function (dt, a) {
        t += dt;
        kick = a.kick ? 1 : Math.max(0, kick - dt * 5);
        fillSpectrum(a.freq, !!a.playing, dt);
        rot += dt * (a.playing ? (a.level || 0) * 0.5 + (a.kick ? 0.05 : 0) : 0.03) * (a.playing ? 1 - idle : 1);
        var vol = typeof a.volume === 'number' ? a.volume : 0.5;
        scale += ((LOOK.sizeMin + (LOOK.sizeMax - LOOK.sizeMin) * vol) - scale) * Math.min(1, dt * 4);
        var lvl = (a.level || 0) * (1 - idle) + (0.15 + 0.1 * Math.sin(t * 0.9)) * idle;
        var u = feed.uniforms;
        u.uRot.value = rot; u.uLevel.value = lvl; u.uKick.value = kick * (1 - idle); u.uHue.value = a.hue || 0;
        u.uScale.value = scale; u.uDecay.value = LOOK.decay; u.uFolds.value = LOOK.folds; u.uTiles.value = LOOK.tiles;
        u.uPrev.value = rtA.texture;
        var g = grit.uniforms;
        g.uTime.value = t; g.uKick.value = kick * (1 - idle);
        g.uThresh.value = LOOK.threshold; g.uTone.value = LOOK.tone; g.uGrain.value = LOOK.grain; g.uScan.value = LOOK.scanlines;
        g.uTile.value = LOOK.tile; g.uEdge.value = LOOK.edge; g.uBright.value = LOOK.bright;
        var keep = renderer.getRenderTarget(), auto = renderer.autoClear;
        renderer.autoClear = false;
        quad.material = feed; renderer.setRenderTarget(rtB); renderer.render(scene, cam);
        g.uSrc.value = rtB.texture;
        quad.material = grit; renderer.setRenderTarget(out); renderer.render(scene, cam);
        renderer.setRenderTarget(keep);
        renderer.autoClear = auto;
        var tmp = rtA; rtA = rtB; rtB = tmp;   // ping-pong: this frame is next frame's "previous"
      },
      dispose: function () { rtA.dispose(); rtB.dispose(); out.dispose(); specTex.dispose(); feed.dispose(); grit.dispose(); }
    };
    return api;
  };
})();
