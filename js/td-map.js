// The Program map (work/boiler-room.html): the TouchDesigner network with an outline per stage.
// - Hover (or keyboard-focus) a stage's label or outline: only that stage stays outlined, its label
//   lights up and its line in the list below is picked out.
// - Click/tap a stage to keep it highlighted; click it again to go back.
// - "Hide all" / "See all" turns every outline off / on (the states from the Figma variants).
// The state lives in data-show on .td-map: "all", "none" or a stage name; the CSS does the rest.
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
