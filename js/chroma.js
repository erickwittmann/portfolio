// Chromatic glow on interactive elements, like looking at a light through thick glass: when the
// cursor comes near a link, button or dial, a soft cyan-blue glow slides out from behind one side
// of it and a warm amber glow from the opposite side, spreading further the longer the cursor
// stays, pushed away from the cursor. Leaving lets it ease back into place.
//
// Each lit element gets its own SVG filter: its silhouette is blurred twice (a tight halo and a
// wide bloom), each blur is offset both ways and tinted blue or amber, and the glow sits behind
// the original. JS moves the offsets, blur radii and opacity every frame; elements at rest have
// no filter at all.
(function () {
  if (!window.matchMedia || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var SELECTOR = '.nav a, .links a, footer a, .ico, .knob, .project, .next-case, .tile--text a';
  var RADIUS = 80;          // px from the element's edge where the effect starts
  var GROW = 1.1;           // s, time constant while near: colour shows fast, spread keeps creeping
  var FADE = 0.75;          // s, time constant to ease back after the cursor leaves
  // [colour, opacity, share of the offset]. Blue leans toward the cursor, amber is pushed away.
  var SIDES = [['#1aa8ff', 1, -0.5], ['#f5a11c', 0.9, 1]];
  var NS = 'http://www.w3.org/2000/svg';

  var defs = document.createElementNS(NS, 'svg');
  defs.setAttribute('aria-hidden', 'true');
  defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  document.body.appendChild(defs);

  function node(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    parent.appendChild(n);
    return n;
  }
  var nextId = 0;
  function buildFilter() {
    var id = 'chroma-' + (nextId++);
    var f = node('filter', { id: id, x: '-60%', y: '-120%', width: '220%', height: '340%', 'color-interpolation-filters': 'sRGB' }, defs);
    // Blur once per radius, then offset the blurred copies (cheaper than blurring each copy).
    var tight = node('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: 0, result: 'bt' }, f);
    var wide = node('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: 0, result: 'bw' }, f);
    var offsets = [];
    SIDES.forEach(function (side, k) {
      node('feFlood', { 'flood-color': side[0], 'flood-opacity': side[1], result: 'f' + k }, f);
      ['bt', 'bw'].forEach(function (b) {
        var r = b + k;
        offsets.push({ el: node('feOffset', { in: b, dx: 0, dy: 0, result: 'o' + r }, f), share: side[2] * (b === 'bt' ? 0.6 : 1) });
        node('feComposite', { in: 'f' + k, in2: 'o' + r, operator: 'in', result: 'c' + r }, f);
      });
    });
    // Wide blooms underneath, tight halos on top, blue last so it reads brightest near the edges.
    var merge = node('feMerge', { result: 'glow' }, f);
    ['bw1', 'bw0', 'bt1', 'bt0'].forEach(function (r) { node('feMergeNode', { in: 'c' + r }, merge); });
    var fade = node('feComponentTransfer', { in: 'glow', result: 'faded' }, f);
    var alpha = node('feFuncA', { type: 'linear', slope: 0 }, fade);
    var out = node('feMerge', {}, f);
    node('feMergeNode', { in: 'faded' }, out);
    node('feMergeNode', { in: 'SourceGraphic' }, out);
    return { id: id, offsets: offsets, tight: tight, wide: wide, alpha: alpha };
  }

  var items = Array.prototype.map.call(document.querySelectorAll(SELECTOR), function (el) {
    // Filter the visible artwork, not the whole box: an icon's svg, a project's title block.
    var target = el.matches('.project') ? el.querySelector('.cover-title') : (el.querySelector('svg') || el);
    if (!target) return null;
    var px = parseFloat(getComputedStyle(target).fontSize) || 16;
    var spread = target.tagName.toLowerCase() === 'svg' ? 11 : Math.min(18, Math.max(8, px * 0.5));
    return { el: el, target: target, spread: spread, v: 0, rect: null, cx: 0.7, cy: 0.7, shown: -1, filter: null };
  }).filter(Boolean);

  var mouse = { x: -1e4, y: -1e4 }, rectsDirty = true, running = false, last = 0, lastMove = 0, rectsAt = 0;
  function wake() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); } }
  window.addEventListener('pointermove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; lastMove = performance.now(); wake(); }, { passive: true });
  document.documentElement.addEventListener('mouseleave', function () { mouse.x = mouse.y = -1e4; wake(); });
  window.addEventListener('scroll', function () { rectsDirty = true; wake(); }, { passive: true });
  window.addEventListener('resize', function () { rectsDirty = true; });

  function tick(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    // Read every rect first, then write, so the browser never has to re-layout mid-frame.
    if (rectsDirty || now - rectsAt > 500) {   // also refresh periodically: reveals and layout shifts move things
      items.forEach(function (it) { it.rect = it.el.getBoundingClientRect(); });
      rectsDirty = false; rectsAt = now;
    }
    var busy = false;
    items.forEach(function (it) {
      var r = it.rect;
      var dx = Math.max(r.left - mouse.x, 0, mouse.x - r.right), dy = Math.max(r.top - mouse.y, 0, mouse.y - r.bottom);
      var near = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / RADIUS);
      if (near > 0) {
        // Push the colour away from the cursor (from the element's centre when the cursor is on it).
        var ax = (r.left + r.right) / 2 - mouse.x, ay = (r.top + r.bottom) / 2 - mouse.y, len = Math.sqrt(ax * ax + ay * ay) || 1;
        it.cx += (ax / len - it.cx) * 0.15; it.cy += (ay / len - it.cy) * 0.15;
      }
      var k = 1 - Math.exp(-dt / (near > it.v ? GROW : FADE));
      it.v += (near - it.v) * k;
      if (it.v < 0.002 && near === 0) it.v = 0;
      if (it.v > 0) busy = true;
      if (Math.abs(it.v - it.shown) < 0.002 && !(it.v === 0 && it.shown !== 0)) return;
      it.shown = it.v;
      if (it.v === 0) { it.target.style.filter = ''; return; }
      if (!it.filter) it.filter = buildFilter();
      var d = it.v * it.spread * 0.7;
      it.filter.offsets.forEach(function (o) {
        o.el.setAttribute('dx', (it.cx * d * o.share).toFixed(2));
        o.el.setAttribute('dy', (it.cy * d * o.share).toFixed(2));
      });
      it.filter.tight.setAttribute('stdDeviation', (0.5 + it.v * it.spread * 0.2).toFixed(2));
      it.filter.wide.setAttribute('stdDeviation', (1 + it.v * it.spread * 0.6).toFixed(2));
      it.filter.alpha.setAttribute('slope', Math.min(1, it.v * 1.6).toFixed(3));
      it.target.style.filter = 'url(#' + it.filter.id + ')';
    });
    // Keep going while anything is lit or the cursor just moved; otherwise sleep until it moves.
    if (busy || now - lastMove < 250) requestAnimationFrame(tick); else running = false;
  }
})();
