// Easter egg: recent reels. The pixel flower next to the footer's name turns on hover; clicking it
// opens a drawer under the footer with Erick's latest Instagram reels.
//
// ---------- The reels: the one place to edit ----------
// Paste a reel's link (Instagram: ••• on the reel > Copy link), newest first. 3–6 is plenty.
// Leave the list empty and the drawer just points to the profile.
window.REELS = [
  // 'https://www.instagram.com/reel/XXXXXXXXXXX/',
];
var REELS_PROFILE = 'https://www.instagram.com/erickwittmann/';
//
// The reels are Instagram's own embeds. Their script (instagram.com/embed.js) only loads the first
// time the drawer opens, so the rest of the time this costs nothing.
// (Instagram doesn't let a static site list "the latest reels" by itself; that needs Instagram's
// API with a token on a server, e.g. a Cloudflare Worker. Until then the list above is it.)
(function () {
  var footer = document.querySelector('footer');
  var brand = footer && footer.querySelector('.brand');
  if (!brand) return;
  var reels = (window.REELS || []).filter(Boolean);

  var egg = document.createElement('button');
  egg.type = 'button'; egg.className = 'px-egg';
  egg.setAttribute('aria-expanded', 'false'); egg.setAttribute('aria-controls', 'reels');
  egg.setAttribute('aria-label', 'Recent reels');
  egg.innerHTML = '<span class="px-flower" aria-hidden="true"></span><span class="px-egg-hint" aria-hidden="true">psst — recent reels</span>';
  brand.parentNode.insertBefore(egg, brand);

  var drawer = document.createElement('section');
  drawer.className = 'reels'; drawer.id = 'reels'; drawer.hidden = true;
  drawer.setAttribute('aria-label', 'Recent reels');
  var head =
    '<hr class="px-rule">' +
    '<div class="reels-head"><h3><span class="px-flower" aria-hidden="true"></span>recent reels</h3>' +
    '<p>straight from <a class="px-link" href="' + REELS_PROFILE + '" target="_blank" rel="noopener">@erickwittmann</a></p>' +
    '<button type="button" class="reels-close">close ×</button></div>';
  var body = reels.length
    ? '<div class="reels-track">' + reels.map(function (u) {
        return '<blockquote class="instagram-media" data-instgrm-permalink="' + u.replace(/"/g, '') + '" data-instgrm-version="14">' +
          '<a href="' + u.replace(/"/g, '') + '" target="_blank" rel="noopener">View this reel on Instagram</a></blockquote>';
      }).join('') + '</div>'
    : '<div class="reels-empty"><p>loops, experiments and behind-the-scenes from whatever i’m making this week.</p>' +
      '<a class="reels-btn px-frame" href="' + REELS_PROFILE + '" target="_blank" rel="noopener"><span class="px-flower" aria-hidden="true"></span>watch on instagram ↗</a></div>';
  drawer.innerHTML = head + body;
  footer.parentNode.insertBefore(drawer, footer.nextSibling);

  var loaded = false;
  function loadEmbeds() {
    if (loaded || !reels.length) return;
    loaded = true;
    if (window.instgrm) { window.instgrm.Embeds.process(); return; }
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.instagram.com/embed.js';
    document.body.appendChild(s);
  }
  function open(on) {
    drawer.hidden = !on;
    egg.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (!on) { egg.focus(); return; }
    drawer.classList.remove('is-in'); void drawer.offsetWidth; drawer.classList.add('is-in');
    loadEmbeds();
    var y = drawer.getBoundingClientRect().top + (window.scrollY || window.pageYOffset) - 40;
    if (window.SmoothScroll) window.SmoothScroll.scrollTo(y, { duration: 1 });
    else window.scrollTo({ top: y, behavior: 'smooth' });
  }
  egg.addEventListener('click', function () { open(drawer.hidden); });
  drawer.querySelector('.reels-close').addEventListener('click', function () { open(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !drawer.hidden) open(false); });
})();
