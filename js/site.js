// Shared page behaviour: reveals, video autoplay in view, nav state.
(function () {
  if ('IntersectionObserver' in window) {

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting) {
          if (v.preload === 'none') v.preload = 'auto';
          if (still) { if (v.readyState === 0) v.load(); return; }
          var p = v.play(); if (p && p.catch) p.catch(function () {});
        } else v.pause();
      });
    }, { rootMargin: '200px 0px' });
    document.querySelectorAll('.cover video, .cs-hero video, .cs-media video').forEach(function (v) {
      var fig = v.closest('.cs-media');
      if (fig && fig.querySelectorAll('img, video').length > 1) return;
      vio.observe(v);
    });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('is-in'); });
  }
})();
