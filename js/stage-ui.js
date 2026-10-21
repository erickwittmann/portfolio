// Stage controls: the stage itself is the control surface (replaces the old deck bar).
// - Light bar: hover it and a colour gradient appears along it; click or slide along the bar (or
//   the gradient) to set the light colour. A small road-case module under it dims/brightens.
// - DJ booth: click it to change track (the music crossfades; js/hero.js). A little screen above
//   it shows what's playing.
// - Speaker columns (left and right): a volume fader and a mute button dock at the foot of the one
//   you're over; hovering either lights up both.
// Each part is an invisible button laid over it on screen (so it works with mouse, touch and the
// keyboard), kept in place every frame from Stage.zoneRect(). Hovering or focusing one lights up
// its outline in 3D (Stage.highlight) and opens its panel; panels close shortly after you leave.
// Styling: road cases (black laminate, aluminium edges, chrome ball corners) with faux-3D chrome
// and glossy parts after the Mausoleum "Provoker" cover; see css/style.css "Stage controls".
(function () {
  var Stage = window.Stage, pin = document.querySelector('.stage-pin');
  if (!Stage || !pin) return;
  var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  // Scroll progress from which the controls work: as soon as the stage has faded in around the
  // screen (js/hero.js fades it in over 0 to 0.3), not only once the whole stage is in view.
  var SHOW_FROM = 0.3;

  function el(tag, cls, parent, html) {
    var e = document.createElement(tag); if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    (parent || ui).appendChild(e); return e;
  }
  var ui = el('div', 'stage-ui', pin);
  ui.setAttribute('aria-label', 'Stage controls');

  // ---------- Sliders (custom, so they look the part and behave the same in every browser) ----------
  // A track with a chrome-ball knob. Drag anywhere on it, or use the arrow keys / Home / End.
  function slider(root, opts) {
    root.setAttribute('role', 'slider'); root.tabIndex = 0;
    root.setAttribute('aria-label', opts.label);
    root.setAttribute('aria-orientation', opts.vertical ? 'vertical' : 'horizontal');
    root.setAttribute('aria-valuemin', 0); root.setAttribute('aria-valuemax', 100);
    var knob = root.querySelector('.rc-knob'), fill = root.querySelector('.rc-fill'), value = opts.value;
    function paint() {
      var pct = (value * 100).toFixed(1) + '%';
      if (opts.vertical) { knob.style.bottom = pct; if (fill) fill.style.height = pct; }
      else { knob.style.left = pct; if (fill) fill.style.width = pct; }
      root.setAttribute('aria-valuenow', Math.round(value * 100));
      if (opts.text) root.setAttribute('aria-valuetext', opts.text(value));
    }
    function set(v, user) { value = Math.min(1, Math.max(0, v)); paint(); if (user) opts.onInput(value); }
    function fromEvent(e) {
      var r = root.getBoundingClientRect();
      return opts.vertical ? 1 - (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
    }
    root.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation();
      root.setPointerCapture(e.pointerId); root.classList.add('is-dragging'); dragging++;
      set(fromEvent(e), true);
    });
    root.addEventListener('pointermove', function (e) { if (root.hasPointerCapture(e.pointerId)) set(fromEvent(e), true); });
    function end(e) { if (root.classList.contains('is-dragging')) { root.classList.remove('is-dragging'); dragging--; } }
    root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
    root.addEventListener('keydown', function (e) {
      var step = { ArrowUp: 0.05, ArrowRight: 0.05, ArrowDown: -0.05, ArrowLeft: -0.05, PageUp: 0.2, PageDown: -0.2 }[e.key];
      if (e.key === 'Home') set(0, true); else if (e.key === 'End') set(1, true); else if (step) set(value + step, true); else return;
      e.preventDefault();
    });
    paint();
    return { set: set };
  }
  var dragging = 0;

  // ---------- Parts: invisible hotspot + panel each ----------
  var parts = {};
  // A part = one panel plus one or more hotspots, each over a region of the stage (a zone in
  // js/hero.js). The speakers have two (left and right column); the panel docks by whichever one
  // was last hovered or focused (p.anchor).
  var hotspots = [];   // { zone, hot, part }
  function part(name, label, panelHtml, panelCls, zones) {
    var panel = el('div', 'rc ' + panelCls, ui, panelHtml);
    zones = zones || [name];
    var p = parts[name] = { name: name, zones: zones, anchor: zones[0], hots: [], panel: panel, over: 0, focus: false, open: false, timer: 0, rects: {} };
    function enter() { p.over++; update(); }
    function leave() { p.over = Math.max(0, p.over - 1); update(); }
    zones.forEach(function (zone, i) {
      var hot = el('button', 'hotspot hotspot--' + zone);
      hot.type = 'button'; hot.setAttribute('aria-label', label + (zones.length > 1 ? (i ? ' (right)' : ' (left)') : ''));
      hot.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { p.anchor = zone; enter(); } });
      hot.addEventListener('focusin', function () { p.anchor = zone; });
      p.hots.push(hot); hotspots.push({ zone: zone, hot: hot, part: p });
    });
    p.hot = p.hots[0];
    p.hots.concat([panel]).forEach(function (n) {
      if (n === panel) n.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') enter(); });
      n.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') leave(); });
      n.addEventListener('focusin', function () { p.focus = true; update(); });
      n.addEventListener('focusout', function () { p.focus = false; update(); });
    });
    // The panel's chrome catches a moving glint from the cursor.
    panel.addEventListener('pointermove', function (e) {
      var r = panel.getBoundingClientRect();
      panel.style.setProperty('--mx', ((e.clientX - r.left) / r.width).toFixed(3));
    });
    function update() {
      clearTimeout(p.timer);
      var want = p.over > 0 || p.focus || p.pinned || p.flash || (p === dragPart && dragging > 0);
      if (want) setOpen(true); else p.timer = setTimeout(function () { if (!dragging) setOpen(false); }, 450);
    }
    function setOpen(o) {
      if (o === p.open) return;
      p.open = o; panel.classList.toggle('is-open', o);
      p.hots.forEach(function (h) { h.classList.toggle('is-active', o); });
      zones.forEach(function (z) { Stage.highlight(z, o); });   // both speaker columns light up together
      if (o) place(p);
    }
    p.update = update; p.setOpen = setOpen;
    // Touch: a tap opens the panel and keeps it open until you tap elsewhere.
    // (The booth is the exception: every tap changes track and shows its screen for a moment.)
    p.hots.forEach(function (h, i) {
      h.addEventListener('click', function () { if (!fine && name !== 'booth') { p.anchor = zones[i]; p.pinned = !p.pinned; update(); if (p.open) place(p); } });
    });
    return p;
  }
  var dragPart = null;
  document.addEventListener('pointerdown', function (e) {
    if (fine) return;
    Object.keys(parts).forEach(function (n) {
      var p = parts[n];
      if (p.pinned && !p.hots.some(function (h) { return h.contains(e.target); }) && !p.panel.contains(e.target)) { p.pinned = false; p.update(); }
    });
  });

  // ---------- Light bar: colour along the bar + dim/bright ----------
  var lights = part('lights', 'Light bar: slide along it to change the light colour',
    '<div class="rc-rail" data-role="hue"><span class="rc-rail-grad"></span><span class="rc-knob"></span></div>' +
    '<div class="rc-mod">' +
    '  <span class="rc-chrome">Dim</span>' +
    '  <div class="rc-slider" data-role="dim"><span class="rc-track"><span class="rc-fill"></span></span><span class="rc-knob"></span></div>' +
    '  <span class="rc-chrome">Bright</span>' +
    '</div>', 'rc-lights');
  var HUES = ['Red', 'Orange', 'Yellow', 'Lime', 'Green', 'Teal', 'Cyan', 'Blue', 'Indigo', 'Purple', 'Magenta', 'Pink', 'Red'];
  var hueSlider = slider(lights.panel.querySelector('[data-role=hue]'), {
    label: 'Light colour', value: Stage.state.hue, onInput: function (v) { Stage.setHue(v); },
    text: function (v) { return HUES[Math.round(v * 12)]; }
  });
  slider(lights.panel.querySelector('[data-role=dim]'), {
    label: 'Light level', value: Stage.state.dim, onInput: function (v) { Stage.setDim(v); },
    text: function (v) { return Math.round(v * 100) + '%'; }
  });
  // Sliding on the light bar itself sets the colour too: position along the bar = hue.
  (function () {
    var hot = lights.hot, active = false;
    function hueAt(e) { var r = hot.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); }
    hot.addEventListener('pointerdown', function (e) {
      active = true; dragPart = lights; dragging++; hot.setPointerCapture(e.pointerId);
      hueSlider.set(hueAt(e), true);
    });
    hot.addEventListener('pointermove', function (e) { if (active) hueSlider.set(hueAt(e), true); });
    function end() { if (active) { active = false; dragging--; dragPart = null; lights.update(); } }
    hot.addEventListener('pointerup', end); hot.addEventListener('pointercancel', end);
    hot.addEventListener('keydown', function (e) {   // keyboard: arrows on the bar step the colour
      var d = { ArrowRight: 1 / 24, ArrowLeft: -1 / 24 }[e.key];
      if (d) { e.preventDefault(); hueSlider.set((Stage.state.hue + d + 1) % 1, true); }
    });
  })();

  // ---------- DJ booth: change track ----------
  var booth = part('booth', 'DJ booth: change track',
    '<span class="rc-chrome rc-title">Now playing</span>' +
    '<div class="rc-lcd" aria-live="polite"><span class="rc-lcd-text"></span></div>' +
    '<span class="rc-hint">Click the decks to change track</span>', 'rc-booth');
  var lcd = booth.panel.querySelector('.rc-lcd'), lcdText = booth.panel.querySelector('.rc-lcd-text');
  booth.panel.querySelector('.rc-hint').textContent = fine ? 'Click the decks to change track' : 'Tap the decks to change track';
  function showTrack(animate) {
    var t = Stage.track();
    var txt = t.artist + ' — ' + t.title;
    if (!animate) { lcdText.textContent = txt; return; }
    lcd.classList.remove('is-swap'); void lcd.offsetWidth; lcd.classList.add('is-swap');
    setTimeout(function () { lcdText.textContent = txt; }, 220);   // swap mid-flicker
  }
  Stage.on('track', function () { showTrack(true); });
  showTrack(false);
  booth.hot.addEventListener('click', function () {
    Stage.nextTrack();
    // A click opens the screen briefly even without hover (touch, keyboard).
    booth.flash = true; booth.update();
    clearTimeout(booth.flashTimer);
    booth.flashTimer = setTimeout(function () { booth.flash = false; booth.update(); }, 2200);
  });

  // ---------- Speaker columns (left + right): volume + mute ----------
  var speaker = part('speaker', 'Speakers: volume',
    '<span class="rc-chrome">Vol</span>' +
    '<div class="rc-slider rc-slider--v" data-role="vol"><span class="rc-track"><span class="rc-fill"></span></span><span class="rc-knob"></span></div>' +
    '<button type="button" class="rc-btn" aria-pressed="false"><span class="sr-only">Mute</span></button>' +
    '<span class="rc-chrome rc-btn-label">Mute</span>', 'rc-speaker', ['speaker', 'speakerR']);
  var volSlider = slider(speaker.panel.querySelector('[data-role=vol]'), {
    label: 'Volume', vertical: true, value: Stage.volume, onInput: function (v) { Stage.setVolume(v); },
    text: function (v) { return Math.round(v * 100) + '%'; }
  });
  var muteBtn = speaker.panel.querySelector('.rc-btn');
  muteBtn.addEventListener('click', function (e) { e.stopPropagation(); Stage.toggleMute(); });
  function syncMute() {
    muteBtn.setAttribute('aria-pressed', Stage.muted ? 'true' : 'false');
    muteBtn.classList.toggle('is-on', Stage.muted);
    speaker.panel.querySelector('.rc-btn-label').textContent = Stage.muted ? 'Muted' : 'Mute';
  }
  Stage.on('mute', syncMute); syncMute();
  Stage.on('mute', function () { volSlider.set(Stage.muted ? 0 : Stage.volume); });

  // ---------- Placement: follow the parts on screen every frame ----------
  function place(p) {
    var r = p.rects[p.anchor]; if (!r) return;
    var pw = p.panel.offsetWidth, ph = p.panel.offsetHeight, W = pin.clientWidth, H = pin.clientHeight, x, y;
    if (p.name === 'lights') { x = r.x + r.w / 2 - pw / 2; y = r.y + r.h + 6; var u = parseFloat(getComputedStyle(ui).getPropertyValue('--u')) || 1; p.panel.style.setProperty('--rail-w', Math.max(150, Math.min(r.w * 0.7, 520 * u)).toFixed(0) + 'px'); }   // the colour rail: up to 70% of the bar, never wider than 520px x the size scale
    else if (p.name === 'booth') { x = r.x + r.w / 2 - pw / 2; y = r.y - ph - 12; }
    else if (p.anchor === 'speakerR') { x = r.x - pw - 10; y = r.y + r.h - ph; }   // right column: dock on its left
    else { x = r.x + r.w + 10; y = r.y + r.h - ph; }   // left column: docked at the foot, on its right
    x = Math.min(W - pw - 8, Math.max(8, x)); y = Math.min(H - ph - 8, Math.max(8, y));
    p.panel.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
  }
  var live = false, onScreen = true, lastHue = -1, lastLevel = -1;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { onScreen = en[0].isIntersecting; if (onScreen) tick(); }).observe(pin.parentNode);
  function tick() {
    if (!onScreen) return;
    requestAnimationFrame(tick);
    var on = Stage.ready && Stage.progress() > SHOW_FROM;
    if (on !== live) {
      live = on; ui.classList.toggle('is-live', on);
      if (!on) Object.keys(parts).forEach(function (n) { parts[n].over = 0; parts[n].pinned = false; parts[n].setOpen(false); });
    }
    // Panels pick up the stage's light: its colour and the beat.
    var s = Stage.state;
    if (Math.abs(s.hue - lastHue) > 0.002) { lastHue = s.hue; ui.style.setProperty('--scene', 'hsl(' + Math.round(s.hue * 360) + ' 85% 58%)'); }
    if (Math.abs(s.level - lastLevel) > 0.02) { lastLevel = s.level; ui.style.setProperty('--beat', s.level.toFixed(2)); }
    if (!live) return;
    hotspots.forEach(function (h) {
      var r = Stage.zoneRect(h.zone);
      if (!r || !isFinite(r.x)) return;
      h.part.rects[h.zone] = r;
      h.hot.style.transform = 'translate(' + r.x.toFixed(1) + 'px,' + r.y.toFixed(1) + 'px)';
      h.hot.style.width = r.w.toFixed(1) + 'px'; h.hot.style.height = r.h.toFixed(1) + 'px';
    });
    Object.keys(parts).forEach(function (n) { if (parts[n].open) place(parts[n]); });
  }
  Stage.on('lights', function () { if (Math.abs(Stage.state.hue - lastHue) > 0.002) lastHue = -1; });
  tick();
})();
