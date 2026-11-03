// The build record on the Anatomy of a Computer case study (work/anatomy-of-a-computer.html, "Building It").
// - Reads assets/work/anatomy/process/progress.json (the log of the critique-and-improve loop) and draws it
//   in the page's own look: a facts row, the average-score line over a score matrix, the versions, the issues.
// - Every number shown is worked out here from the JSON; nothing is typed into the page by hand.
// - Screenshots go in .cs-media, so the page's lightbox opens them (Lightbox.bind, js/lightbox.js).
// - No animation of its own, so prefers-reduced-motion needs nothing extra; the containers fade in with .reveal.
(function () {
  var root = document.querySelector('.aoc-process');
  if (!root || !window.fetch) return;
  var BASE = root.getAttribute('data-src');
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var SEV = { 3: 'most serious', 2: 'medium', 1: 'minor' };

  function $(name) { return root.querySelector('[data-aoc="' + name + '"]'); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function one(x) { return (Math.round(x * 10) / 10).toFixed(1); }
  function avg(it) { var k = Object.keys(it.scores), s = 0; k.forEach(function (d) { s += it.scores[d]; }); return s / k.length; }
  // Dates are read as written (the build's own time zone), not shifted to the visitor's.
  function parts(iso) { var m = /^(\d+)-(\d+)-(\d+)T(\d+):(\d+)/.exec(iso); return { y: +m[1], mo: +m[2] - 1, d: +m[3], h: +m[4], mi: m[5] }; }
  function day(iso) { var p = parts(iso); return MONTHS[p.mo] + ' ' + p.d + ', ' + p.y; }
  function clock(iso) { var p = parts(iso), h = p.h % 12 || 12; return h + ':' + p.mi + (p.h < 12 ? ' AM' : ' PM'); }
  function span(a, b) {
    var p = parts(a), q = parts(b);
    if (p.y === q.y && p.mo === q.mo) return MONTHS[p.mo] + ' ' + p.d + (p.d === q.d ? '' : '–' + q.d) + ', ' + p.y;
    return day(a) + ' – ' + day(b);
  }
  // Score → strength of white. Most scores sit between 6 and 10, so the curve is steep enough to tell them apart.
  function tone(s) { return Math.max(0.05, Math.pow(s / 10, 2.5)).toFixed(3); }
  // Change in the average from the version before, compared as shown (one decimal).
  function change(a, b) {
    if (b == null) return '';
    var d = Math.round(a * 10) - Math.round(b * 10);
    return d === 0 ? ' (no change)' : ' (' + (d > 0 ? '+' : '−') + (Math.abs(d) / 10).toFixed(1) + ')';
  }
  function lines(it) { var l = it.metrics.loc; return l.html + l.css + l.js; }

  fetch(BASE + 'progress.json').then(function (r) { if (!r.ok) throw r.status; return r.json(); }).then(render, function () {
    $('status').textContent = 'The build record could not be loaded.';
  });

  function render(d) {
    var its = d.iterations, dims = d.dimensions, iss = d.issues, N = its.length;
    var avgs = its.map(avg), dimLabel = {};
    dims.forEach(function (x) { dimLabel[x.id] = x.label; });
    $('status').remove();

    // ---------- facts row ----------
    var peak = 0; avgs.forEach(function (a, i) { if (a > avgs[peak]) peak = i; });
    var fixed = iss.filter(function (i) { return i.fixed != null; }).length;
    var lastLive = its.filter(function (i) { return i.folder === 'live'; }).pop() || its[N - 1];
    var lastProto = its.filter(function (i) { return i.folder === 'prototype'; }).pop();
    var prompts = d.timeline.filter(function (t) { return t.who === 'user' && t.kind === 'prompt'; }).length;
    [
      ['Versions', String(N), 'v' + its[0].id + ' to v' + its[N - 1].id],
      ['Built', span(its[0].time, its[N - 1].time), 'first to last version'],
      ['Average score', one(avgs[0]) + ' → ' + one(avgs[N - 1]), 'peak ' + one(avgs[peak]) + ' at v' + its[peak].id],
      ['Issues fixed', fixed + ' of ' + iss.length, (iss.length - fixed) + ' still open'],
      ['Lines of code', lines(lastLive).toLocaleString('en-US'), 'live build at v' + lastLive.id +
        (lastProto ? ', plus ' + lines(lastProto).toLocaleString('en-US') + ' in the prototype' : '')],
      ['Direction', prompts + ' prompts', 'from me, steering the loop']
    ].forEach(function (f) {
      var div = el('div');
      div.appendChild(el('dt', null, f[0]));
      div.appendChild(el('dd', null, f[1]));
      div.appendChild(el('dd', 'aoc-stat-sub', f[2]));
      $('stats').appendChild(div);
    });

    // ---------- score matrix, with the average line above its columns ----------
    var table = $('matrix'), note = $('note'), current = null;
    var cg = el('colgroup'); cg.appendChild(el('col', 'aoc-col-head'));
    for (var c = 0; c < N; c++) cg.appendChild(el('col'));
    table.appendChild(cg);
    table.appendChild(el('caption', 'sr-only', 'Self-critique scores, 0 to 10, for each quality in each version'));

    var thead = el('thead'), lineRow = el('tr', 'aoc-line-row'), lineHead = el('th', 'aoc-line-head');
    lineHead.scope = 'row';
    lineHead.appendChild(el('span', null, 'Average'));
    lineRow.appendChild(lineHead);
    var lineCell = el('td'); lineCell.colSpan = N;
    var plot = el('div', 'aoc-plot');
    var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + N + ' 10'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    [10, 5].forEach(function (v) {
      var g = document.createElementNS(NS, 'line');
      g.setAttribute('x1', 0); g.setAttribute('x2', N); g.setAttribute('y1', 10 - v); g.setAttribute('y2', 10 - v);
      g.setAttribute('class', 'aoc-grid'); svg.appendChild(g);
    });
    var pl = document.createElementNS(NS, 'polyline');
    pl.setAttribute('points', avgs.map(function (a, i) { return (i + 0.5) + ',' + (10 - a); }).join(' '));
    svg.appendChild(pl);
    plot.appendChild(svg);
    // Labels: the start, the peak, the biggest drop between two versions, and the end.
    var drop = 1; for (var k = 1; k < N; k++) if (avgs[k] - avgs[k - 1] < avgs[drop] - avgs[drop - 1]) drop = k;
    var marks = [[0, one(avgs[0]), 'below'], [peak, one(avgs[peak]) + ' peak', 'above'], [N - 1, one(avgs[N - 1]), 'above']];
    if (avgs[drop] < avgs[drop - 1]) marks.push([drop, one(avgs[drop]) + ' · ' + its[drop].label, 'below']);
    marks.forEach(function (m) {
      var dot = el('span', 'aoc-mark aoc-mark--' + m[2] + (m[0] === N - 1 ? ' aoc-mark--end' : m[0] === 0 ? ' aoc-mark--start' : ''));
      dot.style.left = ((m[0] + 0.5) / N * 100) + '%';
      dot.style.top = ((10 - avgs[m[0]]) * 10) + '%';
      dot.appendChild(el('b', null, m[1]));
      plot.appendChild(dot);
    });
    plot.appendChild(el('span', 'sr-only', 'Average score by version: ' + avgs.map(function (a, i) { return 'v' + its[i].id + ' ' + one(a); }).join(', ')));
    lineCell.appendChild(plot); lineRow.appendChild(lineCell); thead.appendChild(lineRow);

    var vRow = el('tr'), corner = el('th', 'aoc-corner', 'Quality');
    corner.scope = 'col'; vRow.appendChild(corner);
    its.forEach(function (it, i) {
      var th = el('th'); th.scope = 'col';
      var b = el('button', 'aoc-vbtn', 'v' + it.id);
      b.type = 'button'; b.title = it.label;
      b.addEventListener('click', function () { showVersion(i, true); });
      th.appendChild(b); vRow.appendChild(th);
    });
    thead.appendChild(vRow); table.appendChild(thead);

    var tbody = el('tbody');
    dims.forEach(function (dm) {
      var tr = el('tr'), th = el('th', null, dm.label);
      th.scope = 'row'; th.title = dm.desc; tr.appendChild(th);
      its.forEach(function (it, i) {
        var s = it.scores[dm.id], notes = it.critique.filter(function (c) { return c.dim === dm.id; });
        var td = el('td'), b = el('button', 'aoc-cell' + (notes.length ? ' has-note' : ''));
        b.type = 'button'; b.style.setProperty('--s', tone(s));
        b.setAttribute('aria-label', 'v' + it.id + ', ' + dm.label + ': ' + s + ' of 10' + (notes.length ? ', with a critique note' : ''));
        function show() { showNote(b, it, dm, s, notes); }
        b.addEventListener('mouseenter', show); b.addEventListener('focus', show); b.addEventListener('click', show);
        td.appendChild(b); tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    // Legend for the squares, drawn with the same scale.
    var legend = el('p', 'aoc-legend'); legend.setAttribute('aria-hidden', 'true');
    legend.appendChild(el('span', null, '0'));
    [2, 4, 6, 8, 10].forEach(function (v) { var q = el('i'); q.style.setProperty('--s', tone(v)); q.title = String(v); legend.appendChild(q); });
    legend.appendChild(el('span', null, '10'));
    table.parentNode.parentNode.insertBefore(legend, table.parentNode);

    // Found vs fixed, per version, under the same columns.
    var tfoot = el('tfoot');
    [['Issues found', 'found'], ['Issues fixed', 'fixed']].forEach(function (r) {
      var tr = el('tr'), th = el('th', null, r[0]); th.scope = 'row'; tr.appendChild(th);
      its.forEach(function (it) {
        var n = iss.filter(function (x) { return x[r[1]] === it.id; }).length;
        tr.appendChild(el('td', n ? null : 'is-zero', n ? String(n) : '·'));
      });
      tfoot.appendChild(tr);
    });
    table.appendChild(tfoot);

    function showNote(b, it, dm, s, notes) {
      if (current) current.classList.remove('is-on');
      current = b; b.classList.add('is-on');
      note.textContent = '';
      note.appendChild(el('span', 'aoc-note-head', 'v' + it.id + ' · ' + it.label + ' · ' + dm.label + ' ' + s + '/10'));
      if (!notes.length) note.appendChild(el('span', 'aoc-note-body', 'No critique note for this quality in this version.'));
      notes.forEach(function (n) { note.appendChild(el('span', 'aoc-note-body', n.note + ' (severity ' + n.sev + ')')); });
    }

    // ---------- versions: a strip to pick from, and the picked one in full ----------
    var strip = $('versions'), detail = $('version'), picks = [];
    its.forEach(function (it, i) {
      var li = el('li'), b = el('button', 'aoc-vpick');
      b.type = 'button'; b.setAttribute('aria-pressed', 'false');
      if (it.shots[0]) {
        var img = el('img'); img.src = BASE + it.shots[0].src; img.alt = ''; img.loading = 'lazy';
        b.appendChild(img);
      }
      b.appendChild(el('b', null, 'v' + it.id));
      b.appendChild(el('span', null, it.label));
      b.addEventListener('click', function () { showVersion(i, false); });
      li.appendChild(b); strip.appendChild(li); picks.push(b);
    });

    function showVersion(i, fromMatrix) {
      var it = its[i], prev = i ? avgs[i - 1] : null;
      picks.forEach(function (p, j) { p.setAttribute('aria-pressed', String(j === i)); });
      detail.textContent = '';
      var head = el('div', 'aoc-ver-head');
      head.appendChild(el('span', 'cs-num', 'v' + it.id + (it.kind === 'baseline' ? ' · baseline' : '')));
      head.appendChild(el('h3', null, it.label));
      var m = it.metrics;
      head.appendChild(el('p', 'aoc-ver-meta', day(it.time) + ', ' + clock(it.time) +
        ' · average ' + one(avgs[i]) + change(avgs[i], prev) +
        ' · +' + m.added.toLocaleString('en-US') + ' / −' + m.removed.toLocaleString('en-US') + ' lines' +
        (it.folder === 'prototype' ? ' · prototype build' : '')));
      detail.appendChild(head);
      detail.appendChild(el('p', 'aoc-ver-sum', it.summary));

      var cols = el('div', 'cs-spec-grid aoc-ver-cols');
      var ch = el('div'); ch.appendChild(el('h3', null, 'Changes'));
      var ul = el('ul', 'aoc-ver-list');
      it.changes.forEach(function (c) { var li = el('li'); li.appendChild(el('b', null, c.area)); li.appendChild(document.createTextNode(' ' + c.desc)); ul.appendChild(li); });
      ch.appendChild(ul); cols.appendChild(ch);
      var cr = el('div'); cr.appendChild(el('h3', null, 'Critique of this version'));
      var ul2 = el('ul', 'aoc-ver-list');
      it.critique.forEach(function (c) { var li = el('li'); li.appendChild(el('b', null, dimLabel[c.dim] || c.dim)); li.appendChild(document.createTextNode(' ' + c.note)); ul2.appendChild(li); });
      cr.appendChild(ul2); cols.appendChild(cr);
      detail.appendChild(cols);

      var shots = el('ol', 'sb-grid aoc-ver-shots');
      it.shots.forEach(function (s) {
        var li = el('li'), fig = el('figure', 'cs-media'), img = el('img');
        fig.style.setProperty('--ar', '960 / 600');
        img.src = BASE + s.src; img.alt = 'v' + it.id + ': ' + s.label; img.loading = 'lazy';
        fig.appendChild(img); li.appendChild(fig); li.appendChild(el('span', null, s.label)); shots.appendChild(li);
      });
      detail.appendChild(shots);
      if (window.Lightbox && Lightbox.bind) Lightbox.bind(detail);
      // Keep the picked version in view inside the strip (sideways only; the page itself doesn't move).
      var p = picks[i].parentNode, sc = strip.parentNode;
      sc.scrollLeft = p.offsetLeft - (sc.clientWidth - p.offsetWidth) / 2;
      if (fromMatrix) {
        note.textContent = '';
        note.appendChild(el('span', 'aoc-note-head', 'v' + it.id + ' · ' + it.label + ' · average ' + one(avgs[i])));
        note.appendChild(el('span', 'aoc-note-body', 'Shown in full under Versions, below.'));
      }
    }
    showVersion(N - 1, false);

    // ---------- issue ledger ----------
    var led = $('issues');
    [3, 2, 1].forEach(function (sv) {
      var list = iss.filter(function (x) { return x.sev === sv; })
        .sort(function (a, b) { return (a.fixed == null) - (b.fixed == null); });   // fixed first, open at the end
      var done = list.filter(function (x) { return x.fixed != null; }).length;
      var row = el('div', 'aoc-sev');
      var h = el('h3', null, 'Severity ' + sv); h.appendChild(el('span', null, ' · ' + SEV[sv]));
      row.appendChild(h);
      row.appendChild(el('p', 'aoc-sev-count', list.length + ' found · ' + done + ' fixed'));
      var dots = el('ul', 'aoc-dots');
      list.forEach(function (x) {
        var li = el('li', x.fixed == null ? 'is-open' : null);
        li.title = x.id + ' · ' + x.title + ' (found in v' + x.found + (x.fixed == null ? ', still open)' : ', fixed in v' + x.fixed + ')');
        dots.appendChild(li);
      });
      dots.setAttribute('aria-hidden', 'true');
      row.appendChild(dots);
      led.appendChild(row);
    });
    var open = iss.filter(function (x) { return x.fixed == null; });
    var oh = el('h3', 'aoc-open-head', 'Still open (' + open.length + ')');
    var ol = el('ul', 'aoc-open');
    open.forEach(function (x) {
      var li = el('li'); li.appendChild(el('b', null, x.id));
      li.appendChild(document.createTextNode(' ' + x.title + '. ' + (dimLabel[x.dim] || x.dim) + ', severity ' + x.sev + ', found in v' + x.found + '.'));
      ol.appendChild(li);
    });
    led.appendChild(oh); led.appendChild(ol);

    // ---------- after the record: the record's last entry, ahead of the later milestones in the page ----------
    var first = el('li'); first.appendChild(el('span', null, day(its[N - 1].time)));
    first.appendChild(document.createTextNode('The record ends at v' + its[N - 1].id + ': ' + its[N - 1].label.toLowerCase() + '.'));
    $('after').insertBefore(first, $('after').firstChild);
  }
})();
