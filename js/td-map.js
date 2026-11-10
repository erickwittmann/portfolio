// Boiler Room: interactive TouchDesigner network map.
(function () {
  document.querySelectorAll('.td-map').forEach(function (map) {
    var toggle = map.querySelector('.td-toggle');
    var base = 'all';   // what shows when nothing is hovered
    function show(v) { map.setAttribute('data-show', v); }
    function setBase(v) {
      base = v; show(v);
      var none = v === 'none';
      toggle.textContent = none ? 'See all' : 'Hide all';
      toggle.setAttribute('aria-pressed', none ? 'false' : 'true');
      map.querySelectorAll('.td-label').forEach(function (l) { l.setAttribute('aria-pressed', l.dataset.stage === v ? 'true' : 'false'); });
    }
    toggle.addEventListener('click', function () { setBase(base === 'none' ? 'all' : 'none'); });
    map.querySelectorAll('.td-label, .td-box, .td-steps li').forEach(function (el) {
      var stage = el.dataset.stage;
      el.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') show(stage); });
      el.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') show(base); });
      el.addEventListener('focus', function () { show(stage); });
      el.addEventListener('blur', function () { show(base); });
      el.addEventListener('click', function () { setBase(base === stage ? 'all' : stage); });
    });
    setBase('all');
  });
})();
