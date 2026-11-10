import * as THREE from "three";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { CASE, CATEGORIES, CAT, ORDER, PRESETS, option, stats, warnings } from "./catalog.js";
import { BUILD_TEXT } from "./parts.js";

const $ = (id) => document.getElementById(id);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
const damp = (a, b, lambda, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt));
const money = (v) => "$" + Math.round(v).toLocaleString("en-US");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const K = 0.0105;   // scene units per millimetre
const LEAN = { mthr: 0, psu: 0.3, gpu: 0.35, cooler: 0.6, ram: 0.7, storage: 0.85, cpu: 0.9 };
const IN_CASE = {
  board: [-72, 41, -63],
  psu: { pos: [-124, -165, 6], basis: ["-z", "-y", "-x"] },   // under the shroud, fan down, plug to the rear
  cut: { z: 60, y: -100, floor: -190 },
};
const HIDE_ON_BOARD = /^(CPULid|CPU_Base|Ram\d|RGBM|M2_)/;
const ALL = new Set(ORDER);

const ROWS = [
  { id: "fps", label: ["Game speed", "Gaming, 1440p (est.)"], max: 220, good: 1, unit: " fps",
    fmt: (v) => (v ? `${Math.round(v)} fps` : "—"),
    note: (s, simple) => (!s.fps ? (simple ? "Needs a CPU, memory and graphics card" : "Needs CPU + RAM + GPU") : s.fps < 45 ? "Choppy" : s.fps < 90 ? "Smooth" : s.fps < 150 ? "Super smooth" : "Ultra smooth") },
  { id: "multi", label: ["Doing lots at once", "Multitasking score"], max: 300, good: 1, unit: "",
    fmt: (v) => (v ? `${Math.round(v)}` : "—"), note: () => "" },
  { id: "ram", label: ["Desk space (memory)", "Memory"], max: 64, good: 1, unit: " GB",
    fmt: (v) => (v ? `${Math.round(v)} GB` : "—"), note: () => "" },
  { id: "storage", label: ["Room for games", "Storage"], max: 2000, good: 1, unit: " GB",
    fmt: (v) => (!v ? "—" : v >= 1000 ? `${+(v / 1000).toFixed(1)} TB` : `${Math.round(v)} GB`),
    note: (s, simple) => (!s.storage ? "" : simple ? `About ${Math.floor(s.storage / 100)} big games` : `${s.speed.toLocaleString("en-US")} MB/s`) },
  { id: "draw", label: ["Power used", "Peak power draw"], max: (s) => s.psu || 1000, good: -1, unit: " W",
    fmt: (v, s) => `${Math.round(v)} W${s.psu ? ` of ${s.psu}` : ""}`,
    note: (s, simple) => (!s.psu ? (simple ? "No power supply yet" : "No PSU installed") : `${Math.round((s.draw / s.psu) * 100)}% of the power supply`),
    level: (s) => (!s.psu ? "" : s.draw > s.psu * 0.95 ? "bad" : s.draw > s.psu * 0.8 ? "warn" : "") },
  { id: "temp", label: ["CPU temperature", "CPU temp under load"], min: 30, max: 100, good: -1, unit: " °C",
    fmt: (v) => (v ? `${Math.round(v)} °C` : "—"), note: (s, simple) => (!s.temp ? "" : s.temp >= 90 ? (simple ? "Too hot — it slows down!" : "Throttling") : s.temp >= 80 ? "Warm" : "Cool"),
    level: (s) => (s.temp >= 90 ? "bad" : s.temp >= 80 ? "warn" : "") },
];

export function createWorkshop(ctx) {
  const { scene, camera, canvas, rigs, sfx, toast, prefs, basisMatrix, wrapSpin, procedural, icon } = ctx;
  const rig = (id) => rigs.find((r) => r.part.id === id);

  // ---------- state ----------
  const sel = { ...PRESETS.balanced.pick };
  try { Object.assign(sel, JSON.parse(localStorage.getItem("aoc-ws") || "{}")); } catch { }
  const save = () => { try { localStorage.setItem("aoc-ws", JSON.stringify(sel)); } catch { } };
  const has = new Set();
  const pieces = {};           // category → { obj, fans, mixer }
  const anims = [];
  const view = { yaw: -0.38, pitch: 0.1, toYaw: -0.38, toPitch: 0.1, zoom: 1, dist: 12, lean: 0, focus: new THREE.Vector3(), hold: 0 };
  let active = false, built = false, drag = null, ghost = null, powered = false, bootT = 0, hintTimer = 0, preview = null;
  const shown = {};             // numbers on screen, eased toward the real values

  // ---------- scene ----------
  const root = new THREE.Group();
  root.scale.setScalar(K);
  root.visible = false;
  scene.add(root);
  const glow = new THREE.PointLight("#7fd4ff", 0, 6, 1.6);      // the "RGB" that comes on with the power
  glow.position.set(-40, 40, 40);
  root.add(glow);
  const cutLocal = [new THREE.Plane(new THREE.Vector3(0, 0, -1), IN_CASE.cut.z), new THREE.Plane(new THREE.Vector3(0, 1, 0), -IN_CASE.cut.y), new THREE.Plane(new THREE.Vector3(0, -1, 0), IN_CASE.cut.floor)];
  const cutWorld = cutLocal.map((p) => p.clone());
  const ghostMat = new THREE.MeshBasicMaterial({ color: "#3dff9a", transparent: true, opacity: 0.25, depthWrite: false });
  let caseObj = null, caseFans = [];

  function partCopy(id) {
    const r = rig(id);
    const obj = r.part.proc ? procedural[r.part.proc]() : cloneSkinned(r.proto);
    const fans = (r.part.spin ? wrapSpin(obj, r.part.spin) : []).concat(obj.userData.fans || []);
    const holder = new THREE.Group();
    holder.quaternion.setFromRotationMatrix(basisMatrix(r.part.basis));
    holder.position.copy(r.norm.center).negate();
    holder.add(obj);
    const g = new THREE.Group();
    g.scale.setScalar(r.norm.s);
    g.add(holder);
    let mixer = null;
    if (r.clips?.length) { mixer = new THREE.AnimationMixer(obj); for (const c of r.clips) mixer.clipAction(c).play(); }
    return { g, fans, mixer };
  }

  function buildCase() {
    const c = partCopy("case");
    caseFans = c.fans;
    c.g.traverse((o) => {
      if (!o.isMesh) return;
      o.material = [].concat(o.material).map((m) => { const k = m.clone(); k.clippingPlanes = cutWorld; k.clipIntersection = true; return k; });
      if (o.material.length === 1) o.material = o.material[0];
    });
    c.g.getObjectByName("glass").visible = false;   // side panel off while building
    caseObj = new THREE.Group();
    caseObj.add(c.g);
    caseObj.scale.setScalar(466 / rig("case").part.size);   // the 4000D is 466 mm tall
    root.add(caseObj);
  }

  // ---------- where each part goes ----------
  function boardRef() {
    const mb = rig("mthr");
    return { mb, mm: 305 / mb.box.y, origin: new THREE.Vector3(...IN_CASE.board), top: mb.matBoxes.BaseBoardM.max.z };
  }
  const onBoard = (b, p) => p.clone().multiplyScalar(b.mm).add(b.origin);   // board part space → case millimetres
  const matBox = (mb, re) => {
    const out = new THREE.Box3();
    for (const [k, box] of Object.entries(mb.matBoxes)) if (re.test(k)) out.union(box);
    return out;
  };
  function landing(q, s, contact, target) {
    return target.clone().sub(contact.clone().multiplyScalar(s).applyQuaternion(q));
  }
  function ramSlots(b, n) {
    const box = matBox(b.mb, /^Ram\d/);
    const xs = [0, 1, 2, 3].map((i) => THREE.MathUtils.lerp(box.min.x + 0.045, box.max.x - 0.045, i / 3));
    return { xs: n >= 4 ? xs : [xs[1], xs[3]], y: box.getCenter(new THREE.Vector3()).y };
  }

  function poseFor(cat, opt = option(cat, sel)) {
    const q = new THREE.Quaternion();
    if (cat === "mthr") { const b = boardRef(); return { pos: b.origin.clone(), quat: q, scale: b.mm }; }
    if (cat === "psu") {
      return { pos: new THREE.Vector3(...IN_CASE.psu.pos), quat: q.setFromRotationMatrix(basisMatrix(IN_CASE.psu.basis)), scale: opt.mm / rig("psu").part.size };
    }
    const b = boardRef(), r = rig(cat), k = 1 / b.mm;   // k: board units per mm
    const sock = matBox(b.mb, /^CPU_Base/);
    const cpuR = rig("cpu"), cpuS = (40 * k) / cpuR.part.size;
    const cpuTop = new THREE.Vector3(sock.getCenter(new THREE.Vector3()).x, sock.getCenter(new THREE.Vector3()).y, sock.min.z + cpuR.box.z * cpuS);
    if (cat === "cpu") {
      const s = (40 * k) / r.part.size;
      const p = landing(q, s, new THREE.Vector3(0, 0, -r.box.z / 2), cpuTop.clone().setZ(sock.min.z));
      return { pos: onBoard(b, p), quat: q, scale: 40 / r.part.size };
    }
    if (cat === "cooler") {
      q.setFromRotationMatrix(basisMatrix(["y", "z", "x"]));
      const s = (opt.mm * k) / r.part.size;
      const base = r.matBoxes["Material.004"];
      const contact = base ? new THREE.Vector3(base.getCenter(new THREE.Vector3()).x, base.min.y, base.getCenter(new THREE.Vector3()).z) : new THREE.Vector3(0, -r.box.y / 2, 0);
      return { pos: onBoard(b, landing(q, s, contact, cpuTop)), quat: q, scale: opt.mm / r.part.size };
    }
    if (cat === "storage") {
      const m2 = matBox(b.mb, /^M2_Base/);
      const s = (80 * k) / r.part.size;
      const t = m2.getCenter(new THREE.Vector3()).setZ(m2.min.z);
      return { pos: onBoard(b, landing(q, s, new THREE.Vector3(0, 0, -r.box.z / 2), t)), quat: q, scale: 80 / r.part.size };
    }
    if (cat === "gpu") {
      q.setFromRotationMatrix(basisMatrix(["x", "z", "-y"]));   // standing out of the slot, fans facing down
      const s = (opt.mm * k) / r.part.size;
      const ext = r.box.clone().applyQuaternion(q); ext.set(Math.abs(ext.x), Math.abs(ext.y), Math.abs(ext.z)).multiplyScalar(s);
      const p = new THREE.Vector3(-b.mb.box.x / 2 + ext.x / 2 - 0.05, -0.17 * b.mb.box.y, b.top + ext.z / 2 - 0.02);   // bracket at the rear, like a real card
      return { pos: onBoard(b, p), quat: q, scale: opt.mm / r.part.size };
    }
    if (cat === "ram") {
      q.setFromRotationMatrix(basisMatrix(["y", "z", "x"]));   // standing in the slots, chips facing the front
      const s = (133 * k) / r.part.size;
      const slots = ramSlots(b, opt.sticks);
      const sticks = slots.xs.map((x) => onBoard(b, landing(q, s, new THREE.Vector3(0, -r.box.y / 2, 0), new THREE.Vector3(x, slots.y, b.top + 0.035))));
      const c = sticks.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / sticks.length);
      return { pos: c, quat: new THREE.Quaternion(), scale: 1, sticks: sticks.map((p) => p.sub(c)), stickQuat: q, stickScale: 133 / r.part.size };
    }
    return null;
  }

  function makePiece(cat) {
    const pose = poseFor(cat);
    const obj = new THREE.Group();
    const fans = [], mixers = [];
    const add = (id, pos, quat, scale) => {
      const c = partCopy(id);
      c.g.scale.multiplyScalar(scale);
      if (quat) c.g.quaternion.copy(quat);
      if (pos) c.g.position.copy(pos);
      obj.add(c.g);
      fans.push(...c.fans);
      if (c.mixer) mixers.push(c.mixer);
      return c.g;
    };
    if (cat === "ram") for (const p of pose.sticks) add("ram", p, pose.stickQuat, pose.stickScale);
    else {
      const g = add(cat, null, null, 1);
      if (cat === "mthr") g.traverse((o) => { if (o.isMesh && [].concat(o.material).some((m) => HIDE_ON_BOARD.test(m.name || ""))) o.visible = false; });
    }
    setPose(obj, pose);
    obj.userData.cat = cat;
    return { obj, fans, mixers, pose };
  }
  function setPose(obj, p) { obj.position.copy(p.pos); obj.quaternion.copy(p.quat); obj.scale.setScalar(p.scale); }

  function showGhost(cat) {
    hideGhost();
    const p = makePiece(cat);
    p.obj.traverse((o) => { if (o.isMesh) { o.material = ghostMat; o.renderOrder = 8; } });
    ghost = { cat, obj: p.obj };
    root.add(p.obj);
  }
  function hideGhost() { if (ghost) { root.remove(ghost.obj); ghost = null; } }

  // ---------- rules ----------
  const needsMissing = (cat) => CAT[cat].needs.filter((n) => !has.has(n));
  const dependents = (cat) => CATEGORIES.filter((c) => c.needs.includes(cat) && has.has(c.id)).map((c) => c.id);
  const nextUp = () => ORDER.find((c) => !has.has(c) && !needsMissing(c).length);
  const name = (cat) => CAT[cat].name.replace(/ \(.*\)/, "").toLowerCase();

  // ---------- install / remove ----------
  function install(cat, piece, fromAuto = false) {
    has.add(cat);
    pieces[cat] = piece;
    if (piece.obj.parent !== root) root.add(piece.obj);
    hideGhost();
    const from = { pos: piece.obj.position.clone(), quat: piece.obj.quaternion.clone(), scale: piece.obj.scale.x };
    const to = piece.pose;
    const hover = to.pos.clone().add(new THREE.Vector3(0, 0, fromAuto ? 160 : 70));   // line up just in front, then press home
    view.focus.copy(to.pos); view.cat = cat;
    view.hold = performance.now() + (fromAuto ? 900 : 560) + 700;   // stay close a moment to see it seated
    anims.push({
      obj: piece.obj, t0: performance.now(), dur: fromAuto ? 900 : 560,
      step: (k) => {
        if (k < 0.62) {
          const e = ease(k / 0.62);
          piece.obj.position.lerpVectors(from.pos, hover, e);
          piece.obj.quaternion.slerpQuaternions(from.quat, to.quat, e);
          piece.obj.scale.setScalar(THREE.MathUtils.lerp(from.scale, to.scale, e));
        } else piece.obj.position.lerpVectors(hover, to.pos, easeOutBack((k - 0.62) / 0.38));
      },
      done: () => { setPose(piece.obj, to); sfx.found(); vibrate(18); },
    });
    sfx.pop();
    priceTag(`+${money(option(cat, sel).price)}`, to.pos);
    const ram = cat === "ram" && option("ram", sel).sticks >= 4;
    flashHint(ram ? "Click! All four slots filled — that's a lot of desk space." : BUILD_TEXT[cat].done, "good");
    if (has.size === ALL.size && !built) setTimeout(() => flashHint(prefs.simple ? "Every part is in! Press Power on to bring it to life." : "Build complete. Power it on to POST.", "good", 6000), 1400);
    renderAll();
  }
  function remove(cat) {
    const p = pieces[cat];
    priceTag(`−${money(option(cat, sel).price)}`, p.pose.pos, "down");
    delete pieces[cat];
    has.delete(cat);
    if (powered) powerOff();
    renderAll();
    return p;
  }
  function flyAway(p) {
    const from = p.obj.position.clone(), s0 = p.obj.scale.x;
    const to = from.clone().add(new THREE.Vector3(0, -260, 160));
    anims.push({ t0: performance.now(), dur: 380, step: (k) => { const e = ease(k); p.obj.position.lerpVectors(from, to, e); p.obj.scale.setScalar(s0 * (1 - 0.8 * e)); }, done: () => root.remove(p.obj) });
  }
  function swap(cat) {
    const old = pieces[cat];
    if (!old) return;
    root.remove(old.obj);
    const p = makePiece(cat);
    pieces[cat] = p;
    root.add(p.obj);
    const s = p.pose.scale;
    anims.push({ obj: p.obj, t0: performance.now(), dur: 380, step: (k) => p.obj.scale.setScalar(s * (0.86 + 0.14 * easeOutBack(k))), done: () => p.obj.scale.setScalar(s) });
  }

  function autoInstall(cat) {
    if (has.has(cat)) {
      if (dependents(cat).length) return refuseRemove(cat);
      flyAway(remove(cat));
      sfx.tick();
      return;
    }
    if (needsMissing(cat).length) return refuseAdd(cat);
    const p = makePiece(cat);
    p.obj.position.copy(p.pose.pos).add(new THREE.Vector3(60, -300, 220));
    p.obj.scale.setScalar(p.pose.scale * 0.6);
    root.add(p.obj);
    install(cat, p, true);
  }
  function refuseAdd(cat) {
    const need = needsMissing(cat)[0];
    flashHint(`The ${name(cat)} goes ${BUILD_TEXT[cat].where} — put the ${name(need)} in first.`, "bad");
    shakeCard(cat); shakeCard(need, "is-call");
    sfx.tick();
  }
  function refuseRemove(cat) {
    const dep = dependents(cat)[0];
    flashHint(`Take the ${name(dep)} out first — it's plugged into the ${name(cat)}.`, "bad");
    shakeCard(dep, "is-call");
    sfx.tick();
  }

  // ---------- power ----------
  function powerOn() {
    const s = stats(sel, has);
    if (s.draw > s.psu * 0.95) {
      flashHint(prefs.simple ? `Click… nothing! This PC needs about ${s.draw} W, but the power supply only gives ${s.psu} W. Pick a bigger one.` : `No POST: ~${s.draw} W peak on a ${s.psu} W PSU trips its over-current protection. Fit a bigger PSU.`, "bad", 7000);
      shakeCard("psu", "is-call");
      sfx.scan(true);
      glow.color.set("#ff3b3b");
      anims.push({ t0: performance.now(), dur: 700, step: (k) => { glow.intensity = Math.sin(k * Math.PI * 4) > 0 ? 3 : 0; }, done: () => { glow.intensity = 0; } });
      return;
    }
    powered = true; built = true;
    bootT = performance.now();
    sfx.boot();
    setTimeout(() => sfx.badge(), 1400);
    try { localStorage.setItem("aoc-built", "1"); } catch { }
    toast(prefs.simple ? "★ It's alive! You built a computer." : "★ POST passed — your build boots.", "badge");
    renderAll();
    flashHint(prefs.simple ? "It's alive! Now swap parts with the arrows and watch the numbers change." : "Running. Swap options to compare builds live.", "good", 5000);
  }
  function powerOff() { powered = false; glow.intensity = 0; }

  // ---------- pointer ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), v = new THREE.Vector3(), w = new THREE.Vector3();
  function toNdc(x, y) { const r = canvas.getBoundingClientRect(); ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); return ndc; }
  function screenOf(local) {
    v.copy(local); root.localToWorld(v).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
  }
  function pointerAt(x, y, through) {
    ray.setFromCamera(toNdc(x, y), camera);
    camera.getWorldDirection(w);
    plane.setFromNormalAndCoplanarPoint(w, root.localToWorld(v.copy(through)));
    const hit = ray.ray.intersectPlane(plane, new THREE.Vector3());
    return hit ? root.worldToLocal(hit) : through.clone();
  }

  function startLive() {
    const { cat } = drag;
    if (drag.from === "bench") {
      if (has.has(cat)) { flashHint(prefs.simple ? "That part is already in! Use the arrows to swap it for another one." : "Already installed — use the arrows to swap the option.", ""); return false; }
      if (needsMissing(cat).length) { refuseAdd(cat); return false; }
      drag.piece = makePiece(cat);
      root.add(drag.piece.obj);
      drag.piece.obj.position.copy(pointerAt(drag.x, drag.y - drag.lift, drag.piece.pose.pos));
    } else {
      if (dependents(cat).length) { refuseRemove(cat); return false; }
      drag.piece = remove(cat);
    }
    showGhost(cat);
    drag.live = true;
    drag.want = drag.piece.obj.position.clone();
    document.body.classList.add("ws-dragging");
    flashHint(`Drop it ${BUILD_TEXT[cat].where} — on the glowing outline.`, "", 60000);
    sfx.pop();
    return true;
  }
  function onMove(e) {
    if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      drag.x = e.clientX; drag.y = e.clientY;
      if (!drag.live) {
        if (Math.hypot(dx, dy) < 8) return;
        if (drag.from === "bench" && drag.touch && Math.abs(dx) > Math.abs(dy) * 1.2) { drag = null; return; }   // a sideways swipe scrolls the bench
        if (!startLive()) { drag = null; return; }
      }
      const pose = drag.piece.pose;
      const at = pointerAt(drag.x, drag.y - drag.lift, pose.pos);
      const t = screenOf(pose.pos);
      const reach = snapRadius(pose);
      const near = Math.hypot(drag.x - t.x, drag.y - drag.lift - t.y) < reach;
      if (near && !drag.near) { sfx.tick(); vibrate(8); }
      drag.near = near;
      drag.want = near ? at.lerp(pose.pos, 0.85) : at;
      document.body.classList.toggle("ws-snap", near);
      chip(e.clientX, e.clientY);
      return;
    }
    if (orbit && e.pointerId === orbit.id) {
      view.toYaw = THREE.MathUtils.clamp(view.toYaw + (e.clientX - orbit.x) * 0.006, -1.1, 0.6);
      view.toPitch = THREE.MathUtils.clamp(view.toPitch + (e.clientY - orbit.y) * 0.004, -0.2, 0.5);
      orbit.x = e.clientX; orbit.y = e.clientY;
    }
  }
  function onUp(e) {
    if (orbit && e.pointerId === orbit.id) orbit = null;
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    document.body.classList.remove("ws-dragging", "ws-snap");
    chip();
    if (!d.live) {
      if (d.from === "bench" && e.type === "pointerup") nudge(d.cat);
      return;
    }
    if (d.near && e.type === "pointerup") { install(d.cat, d.piece); return; }
    hideGhost();
    flyAway(d.piece);
    flashHint(d.from === "case" ? `The ${name(d.cat)} is back on the bench.` : prefs.simple ? "Almost! Drop it right on the glowing green outline." : "Missed the slot — release over the green outline.", "");
    sfx.tick();
  }
  function snapRadius(pose) {
    const a = screenOf(pose.pos), b = screenOf(pose.pos.clone().add(new THREE.Vector3(60, 0, 0)));
    return THREE.MathUtils.clamp(Math.hypot(a.x - b.x, a.y - b.y) * 1.4, 46, 120);
  }
  function nudge(cat) {
    const card = cardEl(cat);
    card?.classList.remove("is-nudge"); void card?.offsetWidth; card?.classList.add("is-nudge");
    if (has.has(cat)) { flashHint(prefs.simple ? "It's in! Drag it out of the case to take it out, or use the arrows to swap it." : "Installed. Drag it out of the case to remove it.", ""); return; }
    if (needsMissing(cat).length) return refuseAdd(cat);
    flashHint(`Drag the ${name(cat)} up ${BUILD_TEXT[cat].where} — it glows where it goes.`, "");
    showGhost(cat);
    clearTimeout(nudge.t);
    nudge.t = setTimeout(() => { nudge.t = 0; if (!drag) hideGhost(); }, 1600);
  }

  let orbit = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (!active || drag) return;
    ray.setFromCamera(toNdc(e.clientX, e.clientY), camera);
    const hit = ray.intersectObjects(Object.values(pieces).map((p) => p.obj), true)[0];
    let cat = null;
    for (let o = hit?.object; o && !cat; o = o.parent) cat = o.userData.cat || null;
    if (cat && !anims.some((a) => a.obj === pieces[cat].obj)) {   // not while it's still clicking in
      drag = { cat, from: "case", sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, id: e.pointerId, live: false, lift: 0, touch: e.pointerType === "touch" };
      return;
    }
    orbit = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("wheel", (e) => { if (active) { e.preventDefault(); view.zoom = THREE.MathUtils.clamp(view.zoom * (1 + e.deltaY * 0.001), 0.7, 1.35); } }, { passive: false });
  addEventListener("pointermove", onMove);
  addEventListener("pointerup", onUp);
  addEventListener("pointercancel", onUp);
  const vibrate = (ms) => { try { navigator.vibrate?.(ms); } catch { } };

  function chip(x, y) {
    const c = $("wsChip");
    const bench = $("wsBench").getBoundingClientRect();
    const show = drag && drag.live && x != null && y > bench.top;
    c.hidden = !show;
    if (!show) return;
    c.innerHTML = `<img src="${icon(drag.cat)}" alt=""><span>${esc(option(drag.cat, sel).name)}</span>`;
    c.style.transform = `translate(${x}px, ${y}px)`;
  }

  function priceTag(text, at, kind = "up") {
    const st = canvas.getBoundingClientRect(), p = screenOf(at);
    const el = document.createElement("span");
    el.className = "ws-tag ws-tag--" + kind;
    el.textContent = text;
    el.style.left = `${p.x - st.left}px`;
    el.style.top = `${p.y - st.top}px`;
    canvas.parentElement.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }

  // ---------- bench ----------
  const cards = $("wsCards");
  const cardEl = (cat) => cards.querySelector(`[data-cat="${cat}"]`);
  function shakeCard(cat, cls = "shake") {
    const c = cardEl(cat);
    if (!c) return;
    c.classList.remove(cls); void c.offsetWidth; c.classList.add(cls);
    setTimeout(() => c.classList.remove(cls), 1200);
  }
  cards.innerHTML = ORDER.map((cat) => `
    <div class="ws-card" data-cat="${cat}" role="listitem">
      <button class="ws-card__grab" data-grab>
        <img src="${icon(cat)}" alt="">
        <span class="ws-card__cat">${esc(CAT[cat].name)}</span>
        <span class="ws-card__state"></span>
      </button>
      <div class="ws-card__opt">
        <button class="ws-card__step" data-step="-1" aria-label="Cheaper option">‹</button>
        <button class="ws-card__name" data-list aria-haspopup="listbox"></button>
        <button class="ws-card__step" data-step="1" aria-label="Next option">›</button>
      </div>
      <p class="ws-card__line"></p>
    </div>`).join("");
  cards.querySelectorAll(".ws-card").forEach((card) => {
    const cat = card.dataset.cat;
    card.addEventListener("pointerdown", (e) => {
      if (e.button > 0 || e.target.closest(".ws-card__opt") || !active) return;
      drag = { cat, from: "bench", sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, id: e.pointerId, live: false, touch: e.pointerType === "touch", lift: e.pointerType === "touch" ? 56 : 0 };
      try { card.setPointerCapture(e.pointerId); } catch { }
    });
    card.addEventListener("pointerenter", () => { if (!drag && !has.has(cat) && !needsMissing(cat).length && active) showGhost(cat); });
    card.addEventListener("pointerleave", () => { if (!drag && ghost?.cat === cat && !nudge.t) hideGhost(); });
    card.querySelector("[data-grab]").addEventListener("click", (e) => { if (e.detail === 0) autoInstall(cat); });   // keyboard only: pointers drag
    card.querySelectorAll("[data-step]").forEach((b) => {
      b.addEventListener("click", () => stepOption(cat, +b.dataset.step));
      b.addEventListener("pointerenter", () => { if (!b.disabled) previewOption(cat, neighbour(cat, +b.dataset.step)); });
      b.addEventListener("pointerleave", () => previewOption(null));
      b.addEventListener("focus", () => previewOption(cat, neighbour(cat, +b.dataset.step)));
      b.addEventListener("blur", () => previewOption(null));
    });
    card.querySelector("[data-list]").addEventListener("click", (e) => { e.stopPropagation(); openList(cat); });
  });
  const neighbour = (cat, d) => { const o = CAT[cat].options, i = o.findIndex((x) => x.id === sel[cat]); return o[THREE.MathUtils.clamp(i + d, 0, o.length - 1)].id; };
  function stepOption(cat, d) {
    setOption(cat, neighbour(cat, d));
    const n = neighbour(cat, d);
    previewOption(n === sel[cat] ? null : cat, n);
  }
  function setOption(cat, id) {
    if (sel[cat] === id) return;
    sel[cat] = id;
    save();
    if (has.has(cat)) swap(cat);
    if (ghost?.cat === cat && !drag) showGhost(cat);
    sfx.tick();
    renderAll();
  }
  function applyPreset(key) {
    Object.assign(sel, PRESETS[key].pick);
    save();
    for (const cat of has) swap(cat);
    sfx.pop();
    flashHint(`${PRESETS[key].label} parts picked — ${money(stats(sel, ALL).price)} with everything in.`, "");
    renderAll();
  }

  const pop = $("wsPop");
  function openList(cat) {
    const cur = option(cat, sel);
    pop.innerHTML = `<p class="ws-pop__title">${esc(CAT[cat].name)}</p>` + CAT[cat].options.map((o) => {
      const d = o.price - cur.price;
      return `<button class="ws-pop__opt${o.id === cur.id ? " is-on" : ""}" data-id="${o.id}" role="option" aria-selected="${o.id === cur.id}">
        <span class="ws-pop__name">${esc(o.name)}</span><span class="ws-pop__price">${money(o.price)}${o.id === cur.id ? "" : `<em class="${d > 0 ? "up" : "down"}">${d > 0 ? "+" : "−"}${money(Math.abs(d))}</em>`}</span>
        <span class="ws-pop__line">${esc(prefs.simple ? o.simple : o.line)}</span></button>`;
    }).join("");
    pop.hidden = false;
    const r = cardEl(cat).getBoundingClientRect();
    const pw = Math.min(300, innerWidth - 24);
    pop.style.width = pw + "px";
    pop.style.left = Math.max(12, Math.min(innerWidth - pw - 12, r.left + r.width / 2 - pw / 2)) + "px";
    pop.style.top = Math.max(12, r.top - pop.offsetHeight - 10) + "px";
    pop.querySelectorAll("[data-id]").forEach((b) => {
      b.addEventListener("click", () => { setOption(cat, b.dataset.id); closeList(); });
      b.addEventListener("pointerenter", () => previewOption(cat, b.dataset.id));
      b.addEventListener("focus", () => previewOption(cat, b.dataset.id));
    });
    pop.querySelector(".is-on")?.focus();
    sfx.tick();
  }
  function closeList() { pop.hidden = true; previewOption(null); }
  document.addEventListener("pointerdown", (e) => { if (!pop.hidden && !e.target.closest("#wsPop, [data-list]")) closeList(); });

  // ---------- spec panel ----------
  const statsEl = $("wsStats");
  statsEl.innerHTML = ROWS.map((r) => `
    <li class="ws-stat" data-row="${r.id}">
      <p class="ws-stat__top"><span class="ws-stat__label"></span><b class="ws-stat__val"></b><em class="ws-stat__delta"></em></p>
      <span class="ws-stat__bar"><i></i></span>
      <small class="ws-stat__note"></small>
    </li>`).join("");

  function previewOption(cat, id) {
    preview = cat ? { cat, id } : null;
    const A = stats(sel, ALL), B = cat ? stats({ ...sel, [cat]: id }, ALL) : null;
    const pd = $("wsDelta");
    const dp = B ? B.price - A.price : 0;
    pd.textContent = B && dp ? `${dp > 0 ? "+" : "−"}${money(Math.abs(dp))}` : "";
    pd.className = "ws-total__delta " + (dp > 0 ? "up" : "down");
    for (const r of ROWS) {
      const el = statsEl.querySelector(`[data-row="${r.id}"] .ws-stat__delta`);
      const d = B ? Math.round(B[r.id] - A[r.id]) : 0;
      el.textContent = d ? `${d > 0 ? "+" : "−"}${Math.abs(d)}${r.unit}` : "";
      el.className = "ws-stat__delta " + (d * r.good > 0 ? "good" : "bad");
    }
  }

  function renderCards() {
    const next = nextUp();
    cards.querySelectorAll(".ws-card").forEach((card) => {
      const cat = card.dataset.cat, o = option(cat, sel), inn = has.has(cat), locked = !inn && needsMissing(cat).length > 0;
      card.classList.toggle("is-in", inn);
      card.classList.toggle("is-locked", locked);
      card.classList.toggle("is-next", cat === next && !drag);
      card.querySelector(".ws-card__state").textContent = inn ? "✓ In the case" : locked ? `Needs ${name(needsMissing(cat)[0])}` : "Drag me ↑";
      card.querySelector("[data-list]").innerHTML = `${esc(o.name)} <small>${money(o.price)}</small>`;
      const i = CAT[cat].options.indexOf(o);
      card.querySelector('[data-step="-1"]').disabled = i === 0;
      card.querySelector('[data-step="1"]').disabled = i === CAT[cat].options.length - 1;
      card.querySelector(".ws-card__line").textContent = prefs.simple ? o.simple : o.line;
      card.querySelector("[data-grab]").setAttribute("aria-label", `${CAT[cat].name}: ${o.name}, ${money(o.price)}. ${inn ? "In the case. Press Enter to take it out." : locked ? `Put the ${name(needsMissing(cat)[0])} in first.` : "Drag it into the case, or press Enter to put it in."}`);
    });
  }
  let target = stats(sel, has);
  function renderStats() {
    target = stats(sel, has);
    const simple = prefs.simple;
    const planned = stats(sel, ALL).price;
    $("wsPlanned").textContent = (planned !== target.price ? `${simple ? "With every part you picked" : "Full build as picked"}: ${money(planned)} · ` : "") + "example prices in US dollars";
    for (const r of ROWS) {
      const li = statsEl.querySelector(`[data-row="${r.id}"]`);
      li.querySelector(".ws-stat__label").textContent = r.label[simple ? 0 : 1];
      li.querySelector(".ws-stat__note").textContent = r.note(target, simple);
      li.dataset.level = r.level?.(target) || "";
      const max = typeof r.max === "function" ? r.max(target) : r.max, min = r.min || 0;
      li.querySelector(".ws-stat__bar i").style.transform = `scaleX(${THREE.MathUtils.clamp((target[r.id] - min) / (max - min), 0, 1)})`;
    }
    const warns = warnings(sel, has, target, simple);
    $("wsWarn").innerHTML = warns.slice(0, 2).map((x) => `<li class="is-${x.level}">${esc(x.text)}</li>`).join("");
    $("wsSr").textContent = `Total ${money(target.price)}. ${ROWS.map((r) => `${r.label[simple ? 0 : 1]}: ${r.fmt(target[r.id], target)}`).join(". ")}.`;
    if (preview) previewOption(preview.cat, preview.id);
  }
  function renderPower() {
    const b = $("wsPower");
    b.hidden = has.size < ALL.size;
    b.classList.toggle("is-on", powered);
    b.innerHTML = powered ? "<span>●</span> Running" : "<span>⏻</span> Power on";
    b.disabled = powered;
  }
  let hintSticky = 0;
  function renderHint() {
    if (performance.now() < hintSticky) return;
    const el = $("wsHint");
    const next = nextUp();
    el.className = "ws-bench__hint";
    el.textContent = powered ? (prefs.simple ? "It's alive! Swap parts with the arrows and watch the numbers change." : "Running. Swap options to compare builds live.")
      : next ? BUILD_TEXT[next].ask : prefs.simple ? "Every part is in! Press Power on." : "All parts installed — power it on.";
  }
  function flashHint(text, kind = "", ms = 3600) {
    const el = $("wsHint");
    el.textContent = text;
    el.className = "ws-bench__hint" + (kind ? " is-" + kind : "");
    hintSticky = performance.now() + ms;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { hintSticky = 0; renderHint(); }, ms);
  }
  function renderAll() { renderCards(); renderStats(); renderPower(); renderHint(); }

  document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => applyPreset(b.dataset.preset)));
  $("wsPower").addEventListener("click", powerOn);
  $("wsReset").addEventListener("click", () => reset(true));
  $("wsSpecToggle").addEventListener("click", () => {
    const open = $("wsSpec").classList.toggle("is-open");
    $("wsSpecToggle").setAttribute("aria-expanded", String(open));
  });
  function reset(sound) {
    for (const cat of [...has]) { const p = remove(cat); flyAway(p); }
    powerOff();
    built = false;
    if (sound) { sfx.slide(); flashHint(prefs.simple ? "All parts are back on the bench. Start again with the motherboard!" : "Cleared. Start with the motherboard.", ""); }
    renderAll();
  }

  // ---------- layout: keep the case in the space the bench and spec panel leave free ----------
  function fit() {
    if (!active) return;
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    const cr = canvas.getBoundingClientRect();
    const compact = document.body.classList.contains("is-compact");
    const spec = $("wsSpec").getBoundingClientRect(), bench = $("wsBench").closest(".panel").getBoundingClientRect();
    const L = cr.left + 12, R = (compact ? cr.right : spec.left) - 16;
    const T = cr.top + (compact ? spec.bottom - cr.top + 6 : 86), B = Math.min(cr.bottom, bench.top + (compact ? 0 : 20)) - 8;
    const fx = ((L + R) / 2 - cr.left) / cw, fy = ((T + B) / 2 - cr.top) / ch;
    camera.setViewOffset(cw, ch, (0.5 - fx) * cw, (0.5 - fy) * ch, cw, ch);
    camera.updateProjectionMatrix();
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    view.dist = Math.max((520 * K * ch) / (2 * tan * Math.max(80, B - T)), (560 * K * ch) / (2 * tan * Math.max(80, R - L)));
  }

  // ---------- per-frame ----------
  function update(dt, t) {
    view.yaw = damp(view.yaw, view.toYaw, 6, dt);
    view.pitch = damp(view.pitch, view.toPitch, 6, dt);
    root.rotation.set(view.pitch, view.yaw, 0, "YXZ");
    if (drag?.live) { view.focus.copy(drag.piece.pose.pos); view.cat = drag.cat; }
    view.lean = damp(view.lean, drag?.live || performance.now() < view.hold ? LEAN[view.cat] || 0 : 0, 3.2, dt);
    root.position.copy(view.focus).multiplyScalar(-K * view.lean).applyEuler(root.rotation);
    camera.position.set(0, 0, view.dist * view.zoom * (1 - 0.42 * view.lean));
    root.updateMatrixWorld(true);
    cutWorld.forEach((p, i) => p.copy(cutLocal[i]).applyMatrix4(root.matrixWorld));

    if (drag?.live) {
      const o = drag.piece.obj;
      const prev = o.position.x;
      o.position.x = damp(o.position.x, drag.want.x, 18, dt);
      o.position.y = damp(o.position.y, drag.want.y, 18, dt);
      o.position.z = damp(o.position.z, drag.want.z, 18, dt);
      const vx = (o.position.x - prev) / Math.max(dt, 1e-3);   // mm per second
      drag.swing = damp(drag.swing || 0, THREE.MathUtils.clamp(-vx * 0.0004, -0.3, 0.3), 10, dt);
      o.quaternion.copy(drag.piece.pose.quat).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), drag.near ? 0 : drag.swing));
    }
    const now = performance.now();
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i], k = Math.min(1, (now - a.t0) / a.dur);
      a.step(k);
      if (k >= 1) { anims.splice(i, 1); a.done?.(); }
    }
    if (ghost) ghostMat.opacity = drag?.near ? 0.03 : 0.2 + 0.08 * Math.sin(t * 6);   // once it snaps, the real part is the preview
    const label = $("wsTarget");
    label.hidden = !ghost;
    if (ghost) {
      const st = canvas.getBoundingClientRect(), p = screenOf(ghost.obj.position);
      label.textContent = drag?.near ? (prefs.simple ? "Let go!" : "Release to fit") : BUILD_TEXT[ghost.cat].slot;
      label.classList.toggle("is-near", !!drag?.near);
      label.style.transform = `translate(${(p.x - st.left).toFixed(1)}px, ${(p.y - st.top).toFixed(1)}px)`;
    }

    const boot = powered ? Math.min(1, (now - bootT) / 1800) : 0;
    const spin = dt * 9 * boot;
    for (const f of caseFans) f.rotation.z += spin;
    for (const p of Object.values(pieces)) {
      for (const f of p.fans) f.rotation.z += spin * 1.4;
      for (const m of p.mixers) m.update(dt * boot);
    }
    glow.intensity = powered ? 2.2 * boot : glow.intensity;
    if (powered) glow.color.setHSL((t * 0.08) % 1, 0.8, 0.6);

    const tp = target;
    shown.price = damp(shown.price ?? tp.price, tp.price, 9, dt);
    $("wsTotal").textContent = money(shown.price);
    for (const r of ROWS) {
      shown[r.id] = damp(shown[r.id] ?? tp[r.id], tp[r.id], 9, dt);
      if (Math.abs(shown[r.id] - tp[r.id]) < 0.5) shown[r.id] = tp[r.id];
      const el = statsEl.querySelector(`[data-row="${r.id}"] .ws-stat__val`);
      const txt = r.fmt(shown[r.id], tp);
      if (el.textContent !== txt) el.textContent = txt;
    }
  }

  // ---------- enter / exit ----------
  function enter() {
    if (!rigs.every((r) => r.ready)) { toast("Still loading the parts…"); return false; }
    if (!caseObj) buildCase();
    active = true;
    root.visible = true;
    document.body.classList.add("is-ws");
    $("wsSpec").hidden = false;
    $("wsBench").hidden = false;
    view.toYaw = -0.38; view.toPitch = 0.1; view.zoom = 1;
    renderAll();
    requestAnimationFrame(fit);
    fit();
    sfx.slide();
    return true;
  }
  function exit() {
    if (!active) return;
    active = false;
    drag = null; orbit = null;
    hideGhost(); closeList(); chip();
    root.visible = false;
    document.body.classList.remove("is-ws", "ws-dragging", "ws-snap");
    $("wsSpec").hidden = true;
    $("wsBench").hidden = true;
  }

  function quickFill(n, presetKey) {
    if (presetKey && PRESETS[presetKey]) Object.assign(sel, PRESETS[presetKey].pick);
    for (const cat of ORDER.slice(0, n)) if (!has.has(cat)) { const p = makePiece(cat); root.add(p.obj); has.add(cat); pieces[cat] = p; }
    renderAll();
  }

  return {
    enter, exit, update, fit, quickFill, powerOn,
    target(cat) { const p = screenOf(poseFor(cat).pos); return [Math.round(p.x), Math.round(p.y)]; },   // tests: where a part should be dropped
    get active() { return active; },
    get busy() { return !!drag || !pop.hidden; },
    orbitBy(dy, dp) { view.toYaw = THREE.MathUtils.clamp(view.toYaw + dy, -1.1, 0.6); view.toPitch = THREE.MathUtils.clamp(view.toPitch + dp, -0.2, 0.5); },
    zoomBy(k) { view.zoom = THREE.MathUtils.clamp(view.zoom * k, 0.7, 1.35); },
    closeList, refresh: renderAll,
  };
}
