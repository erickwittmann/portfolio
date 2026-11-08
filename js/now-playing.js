// Now playing: the song the site is playing, with a link out to it on Spotify. It lives in the nav
// player's dropdown (js/nav-audio.js), above the volume bar, and opens with it on hover/focus.
// It follows the nav player: the stage playlist on the homepage, the page's own music elsewhere.
// It appears once a song has started. Load after js/nav-audio.js.
//
// ---------- The song list: the one place to edit ----------
// One line per audio file, keyed by its path from the site's main folder (the same path as in
// TRACKS in js/hero.js or js/page-music.js). spotify: the song's open.spotify.com/track link.
// Leave spotify '' and the card links to a Spotify search for the artist and title instead.
// A file not listed here still shows, named from its file name ("Artist - Title.mp3").
window.SONGS = {
  'assets/PULL UP2.mp3':                         { artist: 'Internet Girl',   title: 'PULL UP',    spotify: 'https://open.spotify.com/track/2EZbh6qrqdrsF41mbryyfQ' },
  'assets/yaego, kučka - ketamina.mp3':          { artist: 'yaego, KUČKA',    title: 'ketamina',   spotify: 'https://open.spotify.com/track/0mzHbZ09hL9uUeV7rJ1ylR' },
  'assets/Blood Cultures - Unarchiver_Cut.mp3':  { artist: 'Blood Cultures',  title: 'Unarchiver', spotify: 'https://open.spotify.com/track/0WJVieYte28pUxC9hNfs0D' },
  'assets/XY.mp3':                               { artist: 'Feng',            title: 'XY',         spotify: 'https://open.spotify.com/track/5kI88ybsxuqXdmnOATVXN7' },
  'assets/Ferdous - Gravity.mp3':                { artist: 'Ferdous',         title: 'Gravity',    spotify: 'https://open.spotify.com/track/4IR1ACM7QnpToR5zCzxrVs' },
  'assets/Ferdous - Sad Nebula.mp3':             { artist: 'Ferdous',         title: 'Sad Nebula', spotify: 'https://open.spotify.com/track/1XImSknjBxOJWfDXBdRSQ9' },
  // Artist unknown: fill in artist + spotify for these two.
  'assets/unplug reality.mp3':                   { artist: '',                title: 'unplug reality', spotify: '' },
  'assets/Expansion.mp3':                        { artist: '',                title: 'Expansion',  spotify: '' }
};

(function () {
  var PA = window.PageAudio, vol = document.querySelector('.nav-audio .na-vol');
  if (!PA || !vol) return;
  var root = (document.currentScript && document.currentScript.src || location.href).replace(/js\/now-playing\.js.*$/, '');

  // Song details for whatever file is playing.
  var byUrl = {};
  Object.keys(window.SONGS).forEach(function (k) { byUrl[new URL(k, root).href] = window.SONGS[k]; });
  function lookup(src) {
    var url = new URL(src, location.href).href, s = byUrl[url];
    if (!s) {
      var name = decodeURIComponent(url.split('/').pop().replace(/\.[a-z0-9]+$/i, '')).replace(/_cut$/i, ''), parts = name.split(' - ');
      s = parts.length > 1 ? { artist: parts[0], title: parts.slice(1).join(' - ') } : { artist: '', title: name };
    }
    var q = (s.artist ? s.artist + ' ' : '') + s.title;
    return { artist: s.artist, title: s.title, href: s.spotify || 'https://open.spotify.com/search/' + encodeURIComponent(q) };
  }

  // The song block, at the top of the dropdown panel (above the volume bar).
  var song = document.createElement('a');
  song.className = 'na-song';
  song.target = '_blank'; song.rel = 'noopener'; song.hidden = true;
  song.innerHTML =
    '<span class="sound-bars" aria-hidden="true"><i></i><i></i><i></i></span>' +
    '<span class="na-song-text"><span class="na-song-label">Now playing</span><span class="na-song-title"></span><span class="na-song-artist"></span></span>' +
    '<svg class="na-spotify" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11"/>' +
    '<path d="M6.2 9.1c3.9-1.2 8.3-.8 11.6 1.1M7 12.3c3.1-.9 6.6-.6 9.3.9M7.7 15.3c2.5-.7 5.1-.5 7.2.7"/></svg>';
  vol.insertBefore(song, vol.firstChild);
  vol.classList.add('has-song');
  var titleEl = song.querySelector('.na-song-title'), artistEl = song.querySelector('.na-song-artist'), labelEl = song.querySelector('.na-song-label');

  // Checked twice a second: only touches the page when something changed.
  var shownSrc = '', everPlayed = false, state = '';
  function tick() {
    if (document.hidden) return;
    var t = PA.transport, src = t && t.src ? t.src() : '', playing = !!(t && t.isPlaying());
    if (playing) everPlayed = true;
    if (src && src !== shownSrc) {
      shownSrc = src;
      var s = lookup(src);
      titleEl.textContent = s.title; artistEl.textContent = s.artist; artistEl.hidden = !s.artist;
      song.href = s.href;
      song.setAttribute('aria-label', 'Now playing: ' + s.title + (s.artist ? ' by ' + s.artist : '') + '. Open on Spotify');
      song.classList.remove('is-swap'); void song.offsetWidth; song.classList.add('is-swap');
    }
    var show = !!src && everPlayed, next = (show ? 'on' : 'off') + (playing ? '' : ' paused');
    if (next === state) return;
    state = next;
    song.hidden = !show;
    song.classList.toggle('is-paused', !playing);
    labelEl.textContent = playing ? 'Now playing' : 'Paused';
  }
  setInterval(tick, 500); tick();
})();
