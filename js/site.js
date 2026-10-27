(function () {
  // (The homepage's stage used to pause when scrolled out of view. It now stays fixed behind the
  // page as a backdrop, so it keeps running; it still stops while the tab is hidden.)
  if ('IntersectionObserver' in window) {

    // Fade sections up as they enter the viewport.
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

    // Project cover + case-study videos: nothing downloads until a cover is close to the screen, and each one
    // only plays (decodes) while it's on screen. Reduced motion: load the first frame as a still.
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
    // Videos inside a carousel (a figure with 2+ images/videos) are run by js/carousel.js instead.
    document.querySelectorAll('.cover video, .cs-hero video, .cs-media video').forEach(function (v) {
      var fig = v.closest('.cs-media');
      if (fig && fig.querySelectorAll('img, video').length > 1) return;
      vio.observe(v);
    });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('is-in'); });
  }
})();
