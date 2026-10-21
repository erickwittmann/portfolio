// Background music for each page — the one place to set it.
//
// One line per page: the page's file name (without .html) and the track to play behind it.
// Put the track in assets/ and write the path from the site's main folder, like 'assets/song.mp3'
// (works from any page; no ../ needed). Remove or comment out a line for no music on that page.
//
// The track fades in on the visitor's first click (browsers block sound before that), loops, fades
// out when they click through to another page, and a small "Sound on/off" button appears on the
// page. Volume and mute carry over from page to page. (js/page-audio.js does all of that.)
//
// The homepage isn't listed here: its music is the stage playlist, TRACKS in js/hero.js.
window.PAGE_MUSIC = {
  'beyond-fashion': 'assets/unplug reality.mp3'      // e.g. 'assets/Ferdous - Sad Nebula.mp3'
  // 'etch-a-sketch': 'assets/your-track.mp3',
  // 'boiler-room':   'assets/your-track.mp3',   // work/boiler-room.html
};
