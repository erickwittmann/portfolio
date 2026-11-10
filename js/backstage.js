// Backstage unlock: tracks visited case studies and reveals the backstage link at 4/4.
(function () {
  var PROJECTS = ['beyond-fashion', 'boiler-room', 'anatomy-of-a-computer', 'project01'];
  var KEY = 'ew-backstage';

  var css = document.querySelector('link[href$="css/style.css"]');
  var ROOT = css ? css.getAttribute('href').replace(/css\/style\.css$/, '') : '';
  var HREF = ROOT + 'backstage.html';

  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY) || '{}'); return { seen: s.seen || [], closed: !!s.closed }; }
    catch (e) { return { seen: [], closed: false }; }
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

  var state = load();
  var test = (location.search.match(/[?&]backstage=(\w+)/) || [])[1];
  if (test === 'reset') state = { seen: [], closed: false };
  if (test === 'unlock') state = { seen: PROJECTS.slice(), closed: false };

  var m = location.pathname.match(/\/work\/([\w-]+?)(?:\.html)?\/?$/);
  var here = m && PROJECTS.indexOf(m[1]) > -1 ? m[1] : null;
  var before = count();
  if (here && state.seen.indexOf(here) < 0) state.seen.push(here);
  save(state);

  function count() {
    return PROJECTS.filter(function (p) { return state.seen.indexOf(p) > -1; }).length;
  }
  var n = count(), ALL = PROJECTS.length, unlocked = n >= ALL;
  var justNow = unlocked && before < ALL;

  // ---------- "seen 2 / 4" on case study pages ----------
  var eyebrow = here && document.querySelector('.next-case .eyebrow');
  if (eyebrow) {
    var tally = document.createElement('span');
    tally.className = 'bs-tally' + (unlocked ? ' is-full' : '');
    tally.textContent = unlocked ? 'seen ' + n + ' / ' + ALL + ' · backstage open' : 'seen ' + n + ' / ' + ALL;
    tally.title = unlocked ? '' : 'See all ' + ALL + ' case studies…';
    eyebrow.appendChild(tally);
  }

  if (!unlocked || /backstage\.html?$|\/backstage\/?$/.test(location.pathname)) return;

  // ---------- Footer link ----------
  var brand = document.querySelector('footer .brand');
  if (brand) {
    var link = document.createElement('a');
    link.className = 'bs-foot'; link.href = HREF;
    link.innerHTML = '<span class="bs-dot" aria-hidden="true"></span>backstage';
    brand.parentNode.insertBefore(link, brand.nextSibling);
  }

  // ---------- The floating button ----------
  if (state.closed && !justNow) return;
  var card = document.createElement('div');
  card.className = 'bs-card' + (justNow ? ' is-new' : '');
  card.setAttribute('role', 'status');
  card.innerHTML =
    '<p class="bs-card-head"><span class="px-flower" aria-hidden="true"></span>' + ALL + ' / ' + ALL + ' projects seen</p>' +
    '<a class="bs-go" href="' + HREF + '">go backstage <span aria-hidden="true">→</span></a>' +
    '<button type="button" class="bs-x" aria-label="Hide the backstage button">×</button>';
  document.body.appendChild(card);
  requestAnimationFrame(function () { requestAnimationFrame(function () { card.classList.add('is-in'); }); });
  card.querySelector('.bs-x').addEventListener('click', function () {
    state.closed = true; save(state);
    card.classList.remove('is-in');
    setTimeout(function () { card.remove(); }, 400);
  });
  card.querySelector('.bs-go').addEventListener('click', function () { state.closed = true; save(state); });
})();
