// The site's playlist: the homepage plays it (js/playlist.js), and so does the archived 3D stage
// (stage.html, js/stage/hero.js). Add a line per song: { artist, title, src }.
// It plays in this order; skip (nav player) crossfades to the next one, and each song blends
// into the next when it ends. Spotify links and display names: js/now-playing.js. .mp3 works, and so
// does the sound of an .mp4. 
// gain (optional) evens the songs out against each other: 1 = as is, 0.73 = a bit quieter. Leave
// it off for a normally mastered song; add e.g. gain: 0.8 if one stands out as too loud. The
// overall level is LEVEL.stage in js/page-audio.js.
window.TRACKS = [
  { artist: 'Feng', title: 'XY', src: 'assets/XY.mp3' },
  // PULL UP (Internet Girl, assets/PULL UP2.mp3, gain 0.65) is out for now.
  { artist: 'yaego, kučka', title: 'ketamina', src: 'assets/yaego, kučka - ketamina.mp3', gain: 0.73 },
  { artist: 'Blood Cultures', title: 'Unarchiver', src: 'assets/Blood Cultures - Unarchiver_Cut.mp3', gain: 0.97 },
  { artist: 'Ferdous', title: 'Gravity', src: 'assets/Ferdous - Gravity.mp3', gain: 0.95 },
  { artist: 'Ferdous', title: 'Sad Nebula', src: 'assets/Ferdous - Sad Nebula.mp3', gain: 0.92 },
];
