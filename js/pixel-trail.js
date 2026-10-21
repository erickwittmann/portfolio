// Pixel trail, two places:
// - The about portrait's yellow disc: the cursor's path across the circle lights up grid cells in
//   flat RGB/CMY colours, each one blinking off after a random beat. The canvas is only GRID x GRID
//   pixels; CSS scales it to the disc with image-rendering:pixelated, so a frame is a handful of 1px
//   fillRects. The loop runs only while some cell is lit.
// - Key words in the copy (class="px-word"): same idea, one pixel per letter. Each letter the cursor
//   crosses turns into a solid block of colour, then the letter comes back.
(function () {
  var LIFE = [0.45, 1.1];              // s, how long a pixel stays lit (random in range)
  var COLOURS = ['#ffffff', '#ff1f1f', '#12b4f4', '#000000', '#ff1ff0', '#1ff01f'];
  function pick(list) { return list[(Math.random() * list.length) | 0]; }
  function life() { return LIFE[0] + Math.random() * (LIFE[1] - LIFE[0]); }

  // ---------- Words ----------
  // Black would vanish on the black page, so words swap it for the disc's yellow.
  var WORD_COLOURS = COLOURS.map(function (c) { return c === '#000000' ? '#fff64f' : c; });
  Array.prototype.forEach.call(document.querySelectorAll('.px-word'), function (el) {
    var text = el.textContent;
    // Screen readers get the plain word; the letter spans are visual only.
    el.textContent = '';
    var sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = text;
    var vis = document.createElement('span'); vis.setAttribute('aria-hidden', 'true');
    var letters = [];
    for (var i = 0; i < text.length; i++) {
      if (/\s/.test(text[i])) { vis.appendChild(document.createTextNode(text[i])); continue; }
      var s = document.createElement('span'); s.className = 'px-ch'; s.textContent = text[i];
      s.dataset.i = letters.length; letters.push(s); vis.appendChild(s);
    }
    el.appendChild(sr); el.appendChild(vis);
    var lastI = -1;
    function light(s) {
      s.style.backgroundColor = pick(WORD_COLOURS);
      s.classList.add('is-px');
      clearTimeout(s._off);
      s._off = setTimeout(function () { s.classList.remove('is-px'); s.style.backgroundColor = ''; }, life() * 1000);
    }
    function move(e) {
      var t = e.target.closest && e.target.closest('.px-ch');
      if (!t) return;
      var i = +t.dataset.i;
      if (i === lastI) return;
      // Light every letter between the last one and this one so a fast swipe leaves no gaps.
      var from = lastI < 0 ? i : lastI, step = i > from ? 1 : -1;
      for (var k = from; k !== i + step; k += step) if (k !== lastI) light(letters[k]);
      lastI = i;
    }
    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerdown', move, { passive: true });
    el.addEventListener('pointerleave', function () { lastI = -1; });
  });

  // ---------- Disc ----------
  var fig = document.querySelector('.portrait');
  var canvas = fig && fig.querySelector('.pixel-trail');
  if (!canvas || !canvas.getContext) return;
  var GRID = 24;                       // cells across the diameter
  var SPARK = 0.35;                    // chance a lit cell also lights a neighbour, for a ragged edge
  canvas.width = canvas.height = GRID;
  var g = canvas.getContext('2d');
  var cells = {};                      // "x,y" -> { x, y, c, t }
  var count = 0, last = null, running = false, prev = 0;

  function inside(x, y) {
    var dx = x + 0.5 - GRID / 2, dy = y + 0.5 - GRID / 2;
    return dx * dx + dy * dy <= (GRID / 2 - 0.5) * (GRID / 2 - 0.5);
  }
  function light(x, y) {
    if (!inside(x, y)) return;
    var k = x + ',' + y;
    if (!cells[k]) count++;
    cells[k] = { x: x, y: y, c: pick(COLOURS), t: life() };
  }
  function visit(x, y) {
    light(x, y);
    if (Math.random() < SPARK) {
      var d = [[1, 0], [-1, 0], [0, 1], [0, -1]][(Math.random() * 4) | 0];
      light(x + d[0], y + d[1]);
    }
  }
  function toCell(e) {
    var r = canvas.getBoundingClientRect();
    return { x: Math.floor((e.clientX - r.left) / r.width * GRID), y: Math.floor((e.clientY - r.top) / r.height * GRID) };
  }
  function move(e) {
    var p = toCell(e);
    if (last && (last.x !== p.x || last.y !== p.y)) {
      // Walk every cell between the last and current position so fast swipes leave no gaps.
      var n = Math.max(Math.abs(p.x - last.x), Math.abs(p.y - last.y));
      for (var i = 1; i <= n; i++) visit(Math.round(last.x + (p.x - last.x) * i / n), Math.round(last.y + (p.y - last.y) * i / n));
    } else if (!last) visit(p.x, p.y);
    last = p;
    if (!running && count) { running = true; prev = performance.now(); requestAnimationFrame(tick); }
  }
  fig.addEventListener('pointermove', move, { passive: true });
  fig.addEventListener('pointerdown', move, { passive: true });
  fig.addEventListener('pointerleave', function () { last = null; });

  function tick(now) {
    var dt = Math.min(0.05, (now - prev) / 1000); prev = now;
    g.clearRect(0, 0, GRID, GRID);
    for (var k in cells) {
      var c = cells[k];
      c.t -= dt;
      if (c.t <= 0) { delete cells[k]; count--; continue; }
      g.fillStyle = c.c;
      g.fillRect(c.x, c.y, 1, 1);
    }
    if (count) requestAnimationFrame(tick); else running = false;
  }
})();
