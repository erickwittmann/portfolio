// The code viewer on backstage.html: pick a file on the left, its source loads from the site
// (same folder as the page) and shows with line numbers and light highlighting. Nothing is copied
// into the page, so it always shows the current file.
(function () {
  var box = document.getElementById('bs-code');
  if (!box) return;
  var tabs = [].slice.call(box.querySelectorAll('.bs-files [data-src]'));
  var nameEl = box.querySelector('.bs-win-name'), metaEl = box.querySelector('.bs-win-meta');
  var rawEl = box.querySelector('.bs-win-raw'), body = box.querySelector('.bs-win-body');
  var gutter = box.querySelector('.bs-gutter'), code = box.querySelector('.bs-src code');
  var cache = {}, current = null;

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // One pass over the text: comments, strings, keywords, numbers. Anything else is left plain.
  var JS = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|\b(var|let|const|function|return|if|else|for|while|do|new|this|typeof|in|of|break|continue|switch|case|default|try|catch|throw|true|false|null|undefined)\b|\b(\d+(?:\.\d+)?(?:e-?\d+)?)\b/g;
  var CSS = /(\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|(@[\w-]+|![\w]+)|(-?\d*\.?\d+(?:px|vh|vw|svh|em|rem|%|s|ms|deg|fr)?)\b/g;
  function highlight(text, css) {
    var re = css ? CSS : JS, out = '', last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      out += esc(text.slice(last, m.index));
      var cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'k' : 'n';
      out += '<span class="t-' + cls + '">' + esc(m[0]) + '</span>';
      last = re.lastIndex;
    }
    return out + esc(text.slice(last));
  }

  function show(tab) {
    var src = tab.getAttribute('data-src');
    current = src;
    tabs.forEach(function (t) { t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); });
    nameEl.textContent = src; rawEl.href = src; metaEl.textContent = '';
    if (cache[src]) return paint(src, cache[src]);
    code.textContent = 'loading…'; gutter.textContent = '';
    fetch(src).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (t) {
        t = t.replace(/\r\n?/g, '\n');   // Windows line endings would show as blank lines
        cache[src] = t;
        if (current === src) paint(src, t);
      })
      .catch(function () {
        if (current !== src) return;
        code.innerHTML = 'Couldn’t load this file here. <a class="px-link" href="' + src + '" target="_blank" rel="noopener">Open it directly ↗</a>';
      });
  }
  function paint(src, text) {
    var lines = text.replace(/\n$/, '').split('\n').length;
    var nums = ''; for (var i = 1; i <= lines; i++) nums += i + '\n';
    gutter.textContent = nums;
    code.innerHTML = highlight(text, /\.css$/.test(src));
    metaEl.textContent = lines.toLocaleString() + ' lines · ' + (text.length / 1024).toFixed(1) + ' KB';
    body.scrollTop = 0;
  }

  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { show(t); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); show(n);
    });
  });
  // Load the first file once the viewer is near the screen, not on page load.
  var first = tabs[0];
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { io.disconnect(); if (!current) show(first); }
    }, { rootMargin: '400px 0px' });
    io.observe(box);
  } else show(first);
})();
