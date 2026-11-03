/* Intro from the prototype video (0:00–0:03):
   a 1-bit circuit board resolves from big pixels to fine detail, then dissolves away and leaves the title. */

const INK = [12, 12, 12], PAPER = [220, 220, 220];

export function createIntro(canvas, src) {
  const ctx = canvas.getContext("2d");
  const small = document.createElement("canvas");
  const sctx = small.getContext("2d", { willReadFrequently: true });
  const img = new Image();
  img.src = src;
  let raf = 0, t0 = 0, dissolveSeed = [];
  let w = 0, h = 0;

  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // draw the circuit as 1-bit pixels of size p, threshold th
  function mosaic(p, th) {
    const cw = Math.max(2, Math.ceil(w / p)), ch = Math.max(2, Math.ceil(h / p));
    small.width = cw; small.height = ch;
    // cover-fit the source
    const s = Math.max(cw / img.width, ch / img.height);
    const iw = img.width * s, ih = img.height * s;
    sctx.drawImage(img, (cw - iw) / 2, (ch - ih) / 2, iw, ih);
    const d = sctx.getImageData(0, 0, cw, ch);
    const a = d.data;
    for (let i = 0; i < a.length; i += 4) {
      const lum = a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11;
      const c = lum > th ? INK : PAPER;
      a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; a[i + 3] = 255;
    }
    sctx.putImageData(d, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, cw * p, ch * p);
  }

  function specks(time) {
    // the sparse dotted texture that lingers under the title
    ctx.fillStyle = "rgb(220,220,220)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#0c0c0c";
    const step = 30;
    let seed = Math.floor(time * 7);
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) {
      const r = rnd();
      if (r < 0.1) ctx.fillRect(x, y, 2, 2);
      else if (r < 0.115) ctx.fillRect(x, y, 6 + rnd() * 14, 1.5);
    }
  }

  function frame(now) {
    const t = (now - t0) / 1000;
    if (!img.complete || !img.width) { raf = requestAnimationFrame(frame); return; }
    if (t < 1.7) {
      // pixels shrink 64 → 3, threshold sweeps so the board "develops"
      const k = t / 1.7;
      const p = Math.max(3, Math.round(64 * Math.pow(1 - k, 2.2)));
      mosaic(p, 120 - 50 * k);
    } else if (t < 2.7) {
      // dissolve: blocks drop out to paper in random order
      const k = (t - 1.7) / 1.0;
      mosaic(3, 70);
      const bs = 24;
      const cols = Math.ceil(w / bs), rows = Math.ceil(h / bs);
      if (dissolveSeed.length !== cols * rows) dissolveSeed = Array.from({ length: cols * rows }, () => Math.random());
      ctx.fillStyle = "rgb(220,220,220)";
      for (let i = 0; i < dissolveSeed.length; i++) {
        if (dissolveSeed[i] < k * 1.15) ctx.fillRect((i % cols) * bs, Math.floor(i / cols) * bs, bs, bs);
      }
    } else {
      specks(t);
      document.body.classList.add("intro-settled");   // the 3D scene can stop drawing behind the title
    }
    raf = requestAnimationFrame(frame);
  }

  return {
    play() {
      size();
      cancelAnimationFrame(raf);
      t0 = performance.now();
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) t0 -= 3000;
      raf = requestAnimationFrame(frame);
    },
    stop() { cancelAnimationFrame(raf); },
    resize: size,
  };
}
