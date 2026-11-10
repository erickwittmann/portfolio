// Case study carousels: crossfading media with progress ticks.
(function () {
  var SECONDS = 6;   // how long each image stays
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  Array.prototype.forEach.call(document.querySelectorAll('.cs-media'), function (fig) {
    if (fig.querySelectorAll('img, video').length < 2) return;
    fig.classList.add('is-carousel');
    var bar = document.createElement('span');
    bar.className = 'cs-progress'; bar.setAttribute('aria-hidden', 'true');
    bar.appendChild(document.createElement('i'));
    fig.appendChild(bar);
    var fill = bar.firstChild, index = 0, paused = false;

    function items() { return fig.querySelectorAll('img, video'); }
    function isVideo(el) { return el.tagName === 'VIDEO'; }
    function current() { return items()[index]; }
    function lengthOf(el) { return isVideo(el) && isFinite(el.duration) && el.duration > 0 ? el.duration : SECONDS; }
    function playIfShown(v) {
      if (v !== current() || paused) return;
      var p = v.play(); if (p && p.catch) p.catch(function () {});
    }
    function show(i) {
      var list = items();
      if (list.length < 2) {   // down to one: just show it
        fig.classList.remove('is-carousel'); bar.remove();
        if (list[0]) { list[0].classList.add('is-on'); if (isVideo(list[0])) playIfShown(list[0]); }
        return;
      }
      index = (i + list.length) % list.length;
      Array.prototype.forEach.call(list, function (el, k) {
        var on = k === index;
        el.classList.toggle('is-on', on);
        el.setAttribute('aria-hidden', on ? 'false' : 'true');
        if (isVideo(el) && !on) el.pause();
      });
      var el = list[index], next = list[(index + 1) % list.length];
      if (isVideo(el)) {
        if (el.preload === 'none') el.preload = 'auto';
        try { el.currentTime = 0; } catch (e) {}
        playIfShown(el);
      }
      if (isVideo(next) && next.preload === 'none') next.preload = 'auto';   // ready by the time it's up
      fig.style.setProperty('--slide', lengthOf(el).toFixed(2) + 's');
      fill.style.animation = 'none'; void fill.offsetWidth; fill.style.animation = '';
    }
    if (!reduced) fill.addEventListener('animationend', function () { show(index + 1); });
    fig.addEventListener('error', function (e) {
      if (e.target.classList && e.target.classList.contains('is-on')) setTimeout(function () { show(index); }, 0);
    }, true);
    fig.addEventListener('click', function () { show(index + 1); });
    Array.prototype.forEach.call(fig.querySelectorAll('video'), function (v) {
      v.addEventListener('loadedmetadata', function () { if (v === current()) show(index); });
    });

    var visible = true;
    function sync() {
      paused = reduced || !visible;
      fig.classList.toggle('is-paused', paused);
      var el = current();
      if (el && isVideo(el)) { if (paused) el.pause(); else playIfShown(el); }   // reduced motion: video holds its first frame
    }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; sync(); }).observe(fig);
    show(0);
    sync();
  });
})();
