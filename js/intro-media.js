// Media for the intro grid (it plays on the stage's LED screen).
//
// LAYOUT: until a layout is locked, every load shuffles a new one. Refresh until you like one; a
// small badge in the corner (local preview only, e.g. Live Server) shows its number. Put that
// number here to show the same layout to everyone. null = shuffle every load.
// To keep shuffling for a while after locking, add ?shuffle to the address.
// The layout is built for the screen's shape, so a very different window (a phone vs. a laptop)
// gets its own version of it, but the same one every time on that screen.
window.INTRO_SEED = 392357;
//
// To add an image or video, add a line. Either a plain path / URL:
//   'assets/intro/boiler-room-01.jpg',
//   'https://example.com/some-image.jpg',
// or an object with an optional caption (shown on hover) and link (where a click goes):
//   { src: 'assets/intro/beyond-fashion-loop.mp4', caption: 'Beyond Fashion', href: 'work/beyond-fashion.html' },
//
// Videos (.mp4 / .webm / .mov) autoplay muted and loop. Keep them short and light: 720p, a few MB.
// '#t=12' after a video path starts it 12 seconds in (handy for showing different parts of one reel).
// aspect: width / height, for anything that isn't a normal shape (very wide, very tall). The grid
//   then only places it in a tile of a similar shape, so it isn't cropped to a blurry slice.
//   e.g. 1920x614 -> aspect: 3.13. Pieces left without one are still protected: if one turns out
//   too far off its tile, it's shown whole (letterboxed) instead of cropped.
// 'art:<name>' entries are placeholder artwork: delete them once your own media is in.
window.INTRO_MEDIA = [
  { src: 'assets/hero.mp4#t=3', caption: 'Motion Reel 2025–26' },
  { src: 'assets/Beyond Fashion Compressed.mp4', caption: 'Beyond Fashion — VJ Set', href: 'work/beyond-fashion.html' },
  { src: 'assets/EtchaSketch rec.mp4', caption: 'Multiplayer Etch-a-Sketch' },
  { src: 'assets/1920x1080 Fred Again.mp4', caption: 'Boiler Room Audiovisuals' },
  { src: 'assets/imagineritposter.png', caption: 'Imagine RIT Poster' },
  { src: 'assets/ErickWittmannEveryday_16.gif', caption: '20 Days of Motion' },
  { src: 'assets/caed red.jpg'},
  { src: 'assets/TD Viz.mp4', caption: 'TouchDesigner' },
  { src: 'assets/Digital Graffiti Cropped.mp4', caption: 'Projection Mapping', aspect: 3.13 }
];

// Links in the one text tile.
window.INTRO_LINKS = [
  { label: 'Instagram', href: 'https://www.instagram.com/erickwittmann' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/erick-wittmann-b228b2305/' }
  // { label: 'Behance', href: 'https://www.behance.net/erickwittmann' },   // hidden for now
  // { label: 'Vimeo', href: '' }   // hidden for now: vimeo.com/erickwittmann is "page not found"
];

// Portraits for the name tile. One is picked at random on every page load.
// Add a line per photo, same as above. Leave the list empty for a text-only tile.
// Portrait-shaped crops work best: the tile is often tall and narrow. Keep each under ~300 KB.
window.INTRO_PORTRAITS = [
  'assets/portrait1.jpg',
  'assets/portrait2.png',
  'assets/portrait3.png',
  'assets/portrait4.png',
  'assets/portrait5.png'
];
