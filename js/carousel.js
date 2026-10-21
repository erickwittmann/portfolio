// Case study carousels: any .cs-media figure with two or more images/videos slowly crossfades
// between them. A thin bar along the bottom fills up until the next one arrives.
// - The bar's own CSS animation is the clock: when it finishes filling, the next item comes in.
//   So the bar and the swap can never drift apart.
// - Images stay SECONDS each. A video plays from the start when it comes up and stays for its own
//   length, so the bar shows how far through it is. Only the showing video plays; the next one
//   starts loading ahead of time.
// - Pauses while it's off screen (bar and video too).
// - Click or tap to skip ahead.
// - Reduced motion: no automatic swapping and no slow zoom; clicking still steps through.
// To add items, just add more <img> or <video> lines inside the figure (see work/beyond-fashion.html).
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

    // Items that fail to load remove themselves (onerror), so always ask for the current list.
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
      // Restart the bar (and the item's slow zoom) from empty.
      fill.style.animation = 'none'; void fill.offsetWidth; fill.style.animation = '';
    }
    if (!reduced) fill.addEventListener('animationend', function () { show(index + 1); });
    // A missing file removes itself (onerror="this.remove()"). If it was the one showing, move on
    // right away instead of leaving the frame empty for a whole turn.
    fig.addEventListener('error', function (e) {
      if (e.target.classList && e.target.classList.contains('is-on')) setTimeout(function () { show(index); }, 0);
    }, true);
    fig.addEventListener('click', function () { show(index + 1); });
    // A video's length is only known once its metadata loads; if it's showing, time the bar by it.
    Array.prototype.forEach.call(fig.querySelectorAll('video'), function (v) {
      v.addEventListener('loadedmetadata', function () { if (v === current()) show(index); });
    });

    // Pause while off screen; the bar, the zoom and a playing video pause with it.
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
