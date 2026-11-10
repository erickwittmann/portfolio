// Pixel trail on the portrait and key words.
(function () {
  var LIFE = [0.45, 1.1];              // s, how long a pixel stays lit (random in range)
  var COLOURS = ['#ffffff', '#ff1f1f', '#12b4f4', '#000000', '#ff1ff0', '#1ff01f'];
  var DARK = document.documentElement.classList.contains('theme-dark');   // stage.html
  function pick(list) { return list[(Math.random() * list.length) | 0]; }
  function life() { return LIFE[0] + Math.random() * (LIFE[1] - LIFE[0]); }

  // ---------- Words ----------
  var WORD_COLOURS = COLOURS.map(function (c) { return c === (DARK ? '#000000' : '#ffffff') ? '#fff64f' : c; });
  Array.prototype.forEach.call(document.querySelectorAll('.px-word'), function (el) {
    var text = el.textContent;
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
      var from = lastI < 0 ? i : lastI, step = i > from ? 1 : -1;
      for (var k = from; k !== i + step; k += step) if (k !== lastI) light(letters[k]);
      lastI = i;
    }
    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerdown', move, { passive: true });
    el.addEventListener('pointerleave', function () { lastI = -1; });
  });

  // ---------- Canvas trails ----------
  var SPARK = 0.35;
  function trail(canvas, opts) {
    var g = canvas.getContext('2d'), cols, rows;
    var cells = {}, count = 0, last = null, running = false, prev = 0;
    function size(c, r) { cols = canvas.width = c; rows = canvas.height = r; cells = {}; count = 0; last = null; }
    function light(x, y) {
      if (x < 0 || y < 0 || x >= cols || y >= rows || (opts.inside && !opts.inside(x, y, cols, rows))) return;
      var k = x + ',' + y;
      if (!cells[k]) count++;
      cells[k] = { x: x, y: y, c: pick(opts.colours), t: life() };
    }
    function visit(x, y) {
      light(x, y);
      if (Math.random() < SPARK) {
        var d = [[1, 0], [-1, 0], [0, 1], [0, -1]][(Math.random() * 4) | 0];
        light(x + d[0], y + d[1]);
      }
    }
    function move(e, rect) {
      var r = rect && rect.width ? rect : canvas.getBoundingClientRect();
      var p = { x: Math.floor((e.clientX - r.left) / r.width * cols), y: Math.floor((e.clientY - r.top) / r.height * rows) };
      if (last && (last.x !== p.x || last.y !== p.y)) {
        var n = Math.max(Math.abs(p.x - last.x), Math.abs(p.y - last.y));
        for (var i = 1; i <= n; i++) visit(Math.round(last.x + (p.x - last.x) * i / n), Math.round(last.y + (p.y - last.y) * i / n));
      } else if (!last) visit(p.x, p.y);
      last = p;
      if (!running && count) { running = true; prev = performance.now(); requestAnimationFrame(tick); }
    }
    function tick(now) {
      var dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      g.clearRect(0, 0, cols, rows);
      for (var k in cells) {
        var c = cells[k];
        c.t -= dt;
        if (c.t <= 0) { delete cells[k]; count--; continue; }
        g.fillStyle = c.c;
        g.fillRect(c.x, c.y, 1, 1);
      }
      if (count) requestAnimationFrame(tick); else running = false;
    }
    size(opts.cols, opts.rows);
    return { move: move, leave: function () { last = null; }, size: size };
  }

  var fig = document.querySelector('.portrait');
  var disc = fig && fig.querySelector('.pixel-trail');
  if (disc && disc.getContext) {
    var GRID = 24;
    var d = trail(disc, { cols: GRID, rows: GRID, colours: COLOURS, inside: function (x, y) {
      var dx = x + 0.5 - GRID / 2, dy = y + 0.5 - GRID / 2;
      return dx * dx + dy * dy <= (GRID / 2 - 0.5) * (GRID / 2 - 0.5);
    } });
    fig.addEventListener('pointermove', d.move, { passive: true });
    fig.addEventListener('pointerdown', d.move, { passive: true });
    fig.addEventListener('pointerleave', d.leave);
  }

  var bar = document.querySelector('.enter-bar');
  var barCanvas = bar && bar.querySelector('.pixel-trail');
  if (barCanvas && barCanvas.getContext) {
    var CELL = 18;                     // CSS px per cell
    var box = bar.getBoundingClientRect();
    function grid() { return [Math.max(1, Math.round(box.width / CELL)), Math.max(1, Math.round(box.height / CELL))]; }
    var gs = grid(), b = trail(barCanvas, { cols: gs[0], rows: gs[1], colours: WORD_COLOURS }), over = false;
    function onMove(e) {
      if (!bar.isConnected) { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerdown', onMove); removeEventListener('resize', onSize); return; }
      var r = box;
      var hit = e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom;
      if (hit) b.move(e, box); else if (over) b.leave();
      over = hit;
    }
    function onSize() { box = bar.getBoundingClientRect(); var n = grid(); b.size(n[0], n[1]); }
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerdown', onMove, { passive: true });
    addEventListener('resize', onSize);
  }
})();
