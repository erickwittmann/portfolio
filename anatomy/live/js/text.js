/* Text motion from the prototype video: the title rolls like a ticker, the description erases then types out. */

const reduce = () => window.__aocStill || matchMedia("(prefers-reduced-motion: reduce)").matches;

export function rollTitle(el, html, dir = 1) {
  const roll = el.querySelector(".roll");
  const items = roll.querySelectorAll(".roll__item");
  const old = items[items.length - 1];
  if (old && old.innerHTML === html) return;
  el.setAttribute("aria-label", html.replace(/<[^>]+>/g, ""));
  const nu = document.createElement("span");
  nu.className = "roll__item";
  nu.innerHTML = html;
  roll.appendChild(nu);
  if (reduce() || !old) { if (old) old.remove(); return; }
  const opts = { duration: 620, easing: "cubic-bezier(.7,0,.2,1)", fill: "both" };
  old.animate([{ transform: "translateY(0)", opacity: 1 }, { transform: `translateY(${-100 * dir}%)`, opacity: 0 }], opts)
    .finished.then(() => old.remove(), () => old.remove());
  nu.animate([{ transform: `translateY(${100 * dir}%)`, opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], opts);
  // drop stale items if someone mashes the arrows
  [...roll.querySelectorAll(".roll__item")].slice(0, -2).forEach((n) => n.remove());
}

// eraseFrom: "end" backspaces; "start" eats the old copy from its first letter, as in the final cut of the video
export function typeText(el, text, { cps = 75, eraseCps = 260, eraseFrom = "end" } = {}) {
  const token = (el._typeToken = (el._typeToken || 0) + 1);
  el.setAttribute("aria-label", text);
  if (reduce()) { el.textContent = text; return Promise.resolve(); }
  const from = el.textContent;
  const caret = '<span class="type-caret" aria-hidden="true"></span>';
  return new Promise((resolve) => {
    const t0 = performance.now();
    const eraseDur = (from.length / eraseCps) * 1000;
    function frame(now) {
      if (el._typeToken !== token) return resolve();
      const dt = now - t0;
      if (dt < eraseDur) {
        const n = Math.max(0, Math.round(from.length * (1 - dt / eraseDur)));
        el.innerHTML = eraseFrom === "start" ? escapeHtml(from.slice(from.length - n)) : escapeHtml(from.slice(0, n)) + caret;
      } else {
        const n = Math.min(text.length, Math.round(((dt - eraseDur) / 1000) * cps));
        el.innerHTML = escapeHtml(text.slice(0, n)) + (n < text.length ? caret : "");
        if (n >= text.length) return resolve();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}
