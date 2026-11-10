// Splash grid: seeded modular layout of images and video loops that flexes toward the cursor.
(function () {
  var section = document.getElementById('top'), pin = section && section.querySelector('.stage-pin, .intro-pin');
  var frame = document.getElementById('intro-frame'), grid = document.getElementById('intro-grid');
  var nav = document.getElementById('nav');
  if (!section || !pin || !frame || !grid) return;
  var STAGE = section.classList.contains('stage-seq');   // stage mode (stage.html); otherwise splash
  if (STAGE) document.documentElement.classList.add('has-seq');
  var MEDIA = (window.INTRO_MEDIA || []).map(function (m) { return typeof m === 'string' ? { src: m } : m; });
  var LINKS = window.INTRO_LINKS || [], PORTRAITS = window.INTRO_PORTRAITS || [];
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = window.matchMedia && !matchMedia('(hover: hover) and (pointer: fine)').matches;
  var MAX_VIDEOS = touch ? 1 : 4;        // simultaneous decoders are the expensive part
  MAX_VIDEOS = Math.max(MAX_VIDEOS, MEDIA.filter(function (m) { return m.always && isVideo(m.src); }).length);
  var AMP = 1.7;
  var SIGMA = 0.17;                      // reach of the swell, as a fraction of the grid
  var FLEX_UNTIL = 1.01;
  var TEXT_TILE = window.INTRO_TEXT_TILE === true;

  // ---------- Layout seed ----------
  function param(name) { return (location.search.match(new RegExp('[?&]' + name + '(?:=([^&]*))?(&|$)')) || [])[1]; }
  var forced = param('seed'), shuffling = /[?&]shuffle(=|&|$)/.test(location.search);
  var locked = window.INTRO_SEED != null && !shuffling;
  var seed = forced ? +forced : locked ? +window.INTRO_SEED : Math.floor(Math.random() * 1e6);
  var rand = (function (a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  })(seed);
  if (!locked || forced) showSeed(seed);
  function showSeed(n) {
    if (window.console) console.info('Intro layout ' + n + ' — to keep it, set window.INTRO_SEED = ' + n + ' in js/intro-media.js');
    var local = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\]|)$/.test(location.hostname);
    if (!local) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'seed-badge';
    b.textContent = 'Layout ' + n + ' · click to copy';
    b.title = 'Set window.INTRO_SEED = ' + n + ' in js/intro-media.js to keep this layout';
    b.addEventListener('click', function () {
      var done = function () { b.textContent = 'Copied ' + n + ' → INTRO_SEED in js/intro-media.js'; };
      if (navigator.clipboard) navigator.clipboard.writeText(String(n)).then(done, done); else done();
    });
    document.body.appendChild(b);
  }

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(a) { return a[Math.floor(rand() * a.length)]; }

  // ---------- Layout: tracks + recursive subdivision into tiles ----------
  var W = pin.clientWidth || window.innerWidth, H = pin.clientHeight || window.innerHeight;
  var cells = touch ? 10 : 15;
  var C = clamp(Math.round(Math.sqrt(cells * W / H)), 2, 6);
  var R = clamp(Math.round(cells / C), 2, 6);
  var minTiles = touch ? 5 : 6, maxTiles = touch ? 8 : 11;
  var distinct = MEDIA.filter(function (m) { return !isVideo(m.src); }).length +
    Math.min(MAX_VIDEOS, MEDIA.filter(function (m) { return isVideo(m.src); }).length);
  maxTiles = Math.max(2, Math.min(maxTiles, distinct + (TEXT_TILE ? 1 : 0)));
  minTiles = Math.min(minTiles, maxTiles);

  function subdivide() {
    var out = [];
    (function split(r, depth) {
      var w = r.c1 - r.c0, h = r.r1 - r.r0;
      if (w * h === 1 || (depth >= 2 && rand() < 0.22 + depth * 0.1)) { out.push(r); return; }
      var vertical = w > h ? true : h > w ? false : rand() < 0.5;
      if (vertical && w < 2) vertical = false;
      if (!vertical && h < 2) vertical = true;
      if (vertical) {
        var cx = r.c0 + 1 + Math.floor(rand() * (w - 1));
        split({ c0: r.c0, r0: r.r0, c1: cx, r1: r.r1 }, depth + 1); split({ c0: cx, r0: r.r0, c1: r.c1, r1: r.r1 }, depth + 1);
      } else {
        var ry = r.r0 + 1 + Math.floor(rand() * (h - 1));
        split({ c0: r.c0, r0: r.r0, c1: r.c1, r1: ry }, depth + 1); split({ c0: r.c0, r0: ry, c1: r.c1, r1: r.r1 }, depth + 1);
      }
    })({ c0: 0, r0: 0, c1: C, r1: R }, 0);
    return out;
  }
  function isVideo(src) { return /\.(mp4|webm|mov|m4v)(#|\?|$)/i.test(src); }
  function sum(w, a, b) { var s = 0; for (var j = a; j < b; j++) s += w[j]; return s; }
  var MAX_CROP = 1.8;
  function cropOf(tileAspect, mediaAspect) { var r = tileAspect / mediaAspect; return r > 1 ? r : 1 / r; }

  // ---------- Layout + fill: one name tile, the rest media ----------
  function build() {
    var tiles = subdivide(), i;
    for (var tries = 0; tries < 40 && (tiles.length < minTiles || tiles.length > maxTiles); tries++) tiles = subdivide();
    var bc = [], br = [];
    for (i = 0; i < C; i++) bc.push(0.55 + rand() * 1.1);
    for (i = 0; i < R; i++) br.push(0.6 + rand() * 0.9);
    var sc = sum(bc, 0, C), sr = sum(br, 0, R);
    tiles.forEach(function (t) { t.aspect = (sum(bc, t.c0, t.c1) / sc * W) / (sum(br, t.r0, t.r1) / sr * H); });

    var small = tiles.map(function (t, k) { return k; }).filter(function (k) {
      var t = tiles[k]; return (t.c1 - t.c0) * (t.r1 - t.r0) <= 2;
    });
    var textIndex = small.length ? pick(small) : Math.floor(rand() * tiles.length);
    var free = shuffle(tiles.map(function (t, k) { return k; }).filter(function (k) { return k !== textIndex; }));
    var pool = shuffle(MEDIA.filter(function (m) { return m.always; })).concat(shuffle(MEDIA.filter(function (m) { return !m.always; })));
    var loose = [], media = {}, videos = 0, dropped = 0;
    for (var n = 0; loose.length < free.length && n < pool.length; n++) {
      var m = pool[n];
      if (isVideo(m.src) && videos >= MAX_VIDEOS) continue;
      if (m.aspect) {
        var fits = free.filter(function (k) { return cropOf(tiles[k].aspect, m.aspect) <= MAX_CROP; });
        if (!fits.length || free.length - 1 < loose.length) { dropped += m.always ? 100 : 1; continue; }
        var k = pick(fits);
        free.splice(free.indexOf(k), 1); media[k] = m;
      } else loose.push(m);
      if (isVideo(m.src)) videos++;
    }
    free.forEach(function (k, j) { if (!loose[j]) dropped += 1000; media[k] = loose[j] || { src: 'art:reel' }; });
    if (!TEXT_TILE) {
      var used = Object.keys(media).map(function (k) { return media[k]; });
      var spare = pool.filter(function (m) { return used.indexOf(m) < 0 && !(isVideo(m.src) && videos >= MAX_VIDEOS); });
      var fitting = spare.filter(function (m) { return !m.aspect || cropOf(tiles[textIndex].aspect, m.aspect) <= MAX_CROP; });
      media[textIndex] = fitting[0] || spare[0] || { src: 'art:reel' };
    }
    return { tiles: tiles, baseC: bc, baseR: br, textIndex: textIndex, media: media, dropped: dropped };
  }
  var L = build();
  for (var attempt = 0; attempt < 24 && L.dropped; attempt++) { var L2 = build(); if (L2.dropped < L.dropped) L = L2; }
  var tiles = L.tiles, baseC = L.baseC, baseR = L.baseR, textIndex = L.textIndex;

  function centers(w) {
    var total = sum(w, 0, w.length), acc = 0;
    return w.map(function (v) { var c = (acc + v / 2) / total; acc += v; return c; });
  }
  var cenC = centers(baseC), cenR = centers(baseR);
  var curC = baseC.slice(), curR = baseR.slice();

  function artTile(name) { return Object.assign(document.createElement('div'), { className: 'art art-' + name }); }
  function guardFit(el, t, w, h) {
    var a = w / h;
    if (w && h && (a > 2.4 || a < 0.5) && cropOf(t.aspect, a) > MAX_CROP * 1.15) el.classList.add('tile--fit');
  }

  var vids = [], tileEls = [];
  tiles.forEach(function (t, k) {
    var el;
    if (k === textIndex && TEXT_TILE) {
      el = document.createElement('div');
      el.className = 'tile tile--text';
      if (PORTRAITS.length) {
        var ph = new Image(); ph.className = 'ic-photo'; ph.alt = 'Erick Wittmann'; ph.decoding = 'async';
        var tryPortraits = shuffle(PORTRAITS.slice());
        ph.onerror = function () {
          if (tryPortraits.length) ph.src = tryPortraits.pop();
          else { ph.remove(); el.classList.remove('has-photo'); }
        };
        ph.src = tryPortraits.pop();
        el.appendChild(ph); el.classList.add('has-photo');
      }
      el.insertAdjacentHTML('beforeend', '<div class="ic-top"><p class="ic-name">Erick Wittmann</p><p class="ic-role">Motion &amp; Audiovisual Designer</p></div>' +
        '<div class="ic-foot"><nav class="ic-links" aria-label="Social"></nav><a class="ic-scroll" href="#about">To the stage ↓</a></div>');
      var links = el.querySelector('.ic-links');
      LINKS.forEach(function (l) { var a = document.createElement('a'); a.href = l.href; a.textContent = l.label; links.appendChild(a); });
      el.querySelector('.ic-scroll').addEventListener('click', function (e) {
        e.preventDefault();
        if (window.SmoothScroll) window.SmoothScroll.scrollTo(seqEnd(), { duration: 2.4 });
        else window.scrollTo({ top: seqEnd(), behavior: reduced ? 'auto' : 'smooth' });
      });
    } else {
      var m = L.media[k] || { src: 'art:reel' };
      el = document.createElement(m.href ? 'a' : 'div');
      if (m.href) el.href = m.href;
      el.className = 'tile';
      var media;
      if (m.src.indexOf('art:') === 0) media = artTile(m.src.slice(4));
      else if (isVideo(m.src)) {
        media = document.createElement('video');
        media.muted = true; media.loop = true; media.playsInline = true;
        media.setAttribute('muted', ''); media.setAttribute('playsinline', ''); media.preload = 'metadata'; media.src = m.src;
        media.addEventListener('loadedmetadata', function () { guardFit(el, t, this.videoWidth, this.videoHeight); });
        media.onerror = function () {   // never leave a blank tile
          vids.splice(vids.indexOf(media), 1);
          media.replaceWith(artTile('reel'));
        };
        vids.push(media);
      } else {
        media = new Image(); media.alt = m.caption || ''; media.decoding = 'async';
        media.onload = function () { guardFit(el, t, this.naturalWidth, this.naturalHeight); };
        media.src = m.src;
        media.onerror = function () { media.replaceWith(artTile('reel')); };
      }
      el.appendChild(media);
      if (m.caption) { var cap = document.createElement('span'); cap.className = 'tile-cap'; cap.textContent = m.caption; el.appendChild(cap); }
    }
    el.style.gridColumn = (t.c0 + 1) + ' / ' + (t.c1 + 1);
    el.style.gridRow = (t.r0 + 1) + ' / ' + (t.r1 + 1);
    el.style.setProperty('--d', (k * 60) + 'ms');   // staggered fade-in
    el.addEventListener('pointerenter', function () {
      tileEls.forEach(function (o) { o.classList.toggle('is-focus', o === el); });
      if (window.SFX) SFX.tick();
    });
    grid.appendChild(el);
    tileEls.push(el);
  });
  frame.addEventListener('pointerleave', function () { tileEls.forEach(function (o) { o.classList.remove('is-focus'); }); });

  // ---------- Videos: play while the stage section is on screen and the tab is visible ----------
  var onScreen = true, gridHidden = false;
  function syncVideos() {
    var want = onScreen && !gridHidden && !document.hidden;
    vids.forEach(function (v) {
      if (want && v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      if (!want && !v.paused) v.pause();
    });
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) {
    onScreen = en[0].isIntersecting; syncVideos();
    if (onScreen && touch && !reduced && typeof wake === 'function') wake();
  }).observe(section);
  document.addEventListener('visibilitychange', syncVideos);
  syncVideos();

  // ---------- Scroll progress: 0 = grid fills the window, 1 = whole stage in view ----------
  var deck = document.getElementById('deck');
  function seqStart() { return section.getBoundingClientRect().top + (window.scrollY || window.pageYOffset); }
  function seqEnd() { return seqStart() + section.offsetHeight - pin.clientHeight; }
  function progress() {
    if (!STAGE) return 0;   // splash: there is no camera move
    var y = window.scrollY || window.pageYOffset, s = seqStart();
    return clamp((y - s) / Math.max(1, section.offsetHeight - pin.clientHeight), 0, 1);
  }
  function past() { if (!STAGE) return 0; return Math.max(0, ((window.scrollY || window.pageYOffset) - seqEnd()) / Math.max(1, pin.clientHeight)); }
  window.StageSeq = {
    stage: STAGE, progress: progress, past: past, end: seqEnd, frame: frame, pin: pin,
    setGridHidden: function (h) { if (h !== gridHidden) { gridHidden = h; syncVideos(); } }
  };
  var shownP = -1;
  function onScroll() {
    if (!STAGE) return;
    var p = progress();
    var ps = past();
    pin.style.setProperty('--scrim', smooth(0.05, 0.9, ps).toFixed(3));
    document.documentElement.classList.toggle('is-past-stage', ps > 0.35);
    if (p === shownP) return;
    shownP = p;
    var na = smooth(0.25, 0.7, p);
    if (nav) { nav.style.setProperty('--nav-a', na.toFixed(3)); nav.classList.toggle('is-off', na < 0.05); }
    var da = smooth(0.55, 0.95, p);
    if (deck) { deck.style.setProperty('--deck-a', da.toFixed(3)); deck.classList.toggle('is-off', da < 0.05); }
    if (touch && !reduced && p < 0.02) wake();
    if (pointer.inside && p < FLEX_UNTIL) wake();   // back near the top with the cursor over the grid
  }
  window.addEventListener('scroll', function () { requestAnimationFrame(onScroll); }, { passive: true });
  window.addEventListener('resize', function () { shownP = -1; onScroll(); });

  // ---------- Cursor flex ----------
  var pointer = { x: 0, y: 0, inside: false }, running = false, last = 0, t0 = performance.now();
  frame.addEventListener('pointermove', function (e) { pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true; wake(); });
  frame.addEventListener('pointerleave', function () { pointer.inside = false; wake(); });

  function flex(cur, base, cen, focus, k) {
    var moved = false;
    for (var j = 0; j < cur.length; j++) {
      var g = focus === null ? 0 : Math.exp(-Math.pow(focus - cen[j], 2) / (2 * SIGMA * SIGMA));
      var d = (base[j] * (1 + AMP * g) - cur[j]) * k;
      if (Math.abs(d) > 0.0005) { cur[j] += d; moved = true; }
    }
    return moved;
  }
  function tracks(w) {
    return w.map(function (v) { return 'minmax(0,' + v.toFixed(4) + 'fr)'; }).join(' ');
  }
  function wake() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); } }

  function tick(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var fx = null, fy = null;
    if (!reduced) {
      var pz = progress();
      if (pointer.inside && pz < FLEX_UNTIL) {
        var r = frame.getBoundingClientRect();
        fx = (pointer.x - r.left) / r.width; fy = (pointer.y - r.top) / r.height;
      } else if (touch && pz < 0.02) {
        var t = (now - t0) / 1000;
        fx = 0.5 + 0.38 * Math.sin(t * 0.21); fy = 0.5 + 0.34 * Math.sin(t * 0.29 + 1.3);
      }
    }
    var k = 1 - Math.exp(-dt / (pointer.inside ? 0.22 : 0.6));
    var mc = flex(curC, baseC, cenC, fx, k), mr = flex(curR, baseR, cenR, fy, k);
    if (mc) grid.style.gridTemplateColumns = tracks(curC);
    if (mr) grid.style.gridTemplateRows = tracks(curR);
    var p2 = progress();
    if (mc || mr || (pointer.inside && p2 < FLEX_UNTIL) || (touch && !reduced && p2 < 0.02 && onScreen)) requestAnimationFrame(tick); else running = false;
  }
  grid.style.gridTemplateColumns = tracks(curC);
  grid.style.gridTemplateRows = tracks(curR);
  requestAnimationFrame(function () { section.classList.add('is-built'); });
  onScroll();
  if (!STAGE && touch && !reduced) wake();
})();
