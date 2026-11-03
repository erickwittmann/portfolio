/* First-visit tour: a pulsing ring on the thing to try, a short instruction, and it moves on as soon as you do it. */

const KEY = "aoc-coach-v4";
const store = {
  get() { try { return localStorage.getItem(KEY) === "done"; } catch { return false; } },
  set() { try { localStorage.setItem(KEY, "done"); } catch { /* private mode */ } },
};

export function createCoach(steps, { onFinish } = {}) {
  const root = document.createElement("div");
  root.className = "coach";
  root.hidden = true;
  root.innerHTML = `
    <div class="coach__ring" aria-hidden="true"><i></i></div>
    <div class="coach__card" role="dialog" aria-live="polite" aria-label="Tour">
      <div class="coach__icon" aria-hidden="true"></div>
      <p class="coach__text"></p>
      <div class="coach__row">
        <span class="coach__dots"></span>
        <button class="coach__skip">Skip tour</button>
        <button class="coach__next">Next</button>
      </div>
    </div>`;
  document.body.appendChild(root);
  const ring = root.querySelector(".coach__ring");
  const card = root.querySelector(".coach__card");
  let i = -1, raf = 0, active = false;

  function show(n) {
    i = n;
    if (i >= steps.length) return finish(true);
    const s = steps[i];
    root.hidden = false;
    root.dataset.icon = s.icon || "";
    card.querySelector(".coach__text").textContent = s.text;
    card.querySelector(".coach__dots").innerHTML = steps.map((_, k) => `<i class="${k === i ? "on" : k < i ? "done" : ""}"></i>`).join("");
    card.querySelector(".coach__next").textContent = i === steps.length - 1 ? "Got it" : "Next";
    card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop");
  }
  function place() {
    if (!active) return;
    const s = steps[i];
    const p = s && s.target();
    if (p) {
      ring.style.transform = `translate(${p.x}px, ${p.y}px)`;
      ring.style.opacity = 1;
      const cw = card.offsetWidth, ch = card.offsetHeight;
      const W = innerWidth, H = innerHeight;
      let x = p.x + (s.side === "left" ? -cw - 40 : 40);
      let y = s.above ? p.y - ch - 36 : p.y + (s.below ? 34 : -ch / 2);
      if (s.above) x = p.x - 30;
      if (x + cw > W - 12) x = p.x - cw - 40;
      if (x < 12) x = Math.min(W - cw - 12, p.x + 40);
      y = Math.max(80, Math.min(H - ch - 12, y));
      if (W < 560) {
        // phones: dock the card full-width at whichever edge is away from the target, so it never covers the part
        x = 12;
        const stage = document.querySelector(".stage")?.getBoundingClientRect();
        const bottom = stage ? Math.min(stage.bottom, H) : H;
        y = p.y > H * 0.4 ? 74 : bottom - ch - 10;
      }
      card.style.transform = `translate(${x}px, ${y}px)`;
    }
    raf = requestAnimationFrame(place);
  }
  function finish(completed = false) {
    const was = active;
    active = false;
    cancelAnimationFrame(raf);
    root.hidden = true;
    store.set();
    if (was && completed && onFinish) onFinish();
  }
  card.querySelector(".coach__next").addEventListener("click", () => show(i + 1));
  card.querySelector(".coach__skip").addEventListener("click", () => finish(false));

  return {
    start(force = false) {
      if (!force && store.get()) return;
      active = true;
      show(0);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(place);
    },
    // the tour advances when you actually do the thing
    event(name) {
      if (!active || steps[i]?.on !== name) return;
      const at = i;   // many drag events can arrive; only advance once per step
      setTimeout(() => { if (active && i === at) show(at + 1); }, 450);
    },
    get active() { return active; },
    finish,
  };
}
