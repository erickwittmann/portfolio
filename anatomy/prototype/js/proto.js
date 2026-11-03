/* Anatomy of a Computer — prototype build.
   The final motion mockup (EIII P2 Prototype.mp4, 23 s) as a working site, on the framework of the Figma record.

   Shot list, from the mockup:
   0:00  a 1-bit circuit board resolves from big pixels, the title arrives, the board dissolves to specks
   0:03  "Click to Start Experience": the title dissolves away while the first part drifts in from the upper right
   0:05  next part: the copy is eaten from its first letter, the parts slide right → left as the new one turns
         into pose, the title ticks upward, the part icon flips, the new copy types out
   0:08  hotspot rings fade in once the part has settled
   0:09  a ring opens the x-ray: dissolve to the dark circuit board, the callout is ruled out from the ring
   0:11  dissolve back to the photograph
   0:18  exit: a warm scan wipe, then a 1-bit pan through the machine, a glitch to black, and the title again
   From the Figma prototype page: views Overview / Framework / Power / Data, "(1) to go down, (2) to go up!" */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { PARTS as SOURCE } from "../../live/js/parts.js";
import { PROCEDURAL } from "../../live/js/procedural.js";
import { createIntro } from "../../live/js/intro.js";
import { rollTitle, typeText } from "../../live/js/text.js";
import { buildFlowGraph, placeFlowLabels } from "../../live/js/flowmap.js";
import { sfx } from "../../live/js/sfx.js";
import { loadModelAsync } from "../../live/js/models.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const STILL = Q.has("still");
window.__aocStill = STILL;
const reduceMotion = () => STILL || matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (a, b, l, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-l * dt));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ICON = "../assets/icons/";
const MODEL = "../assets/models/";

// ---------- content: the mockup's own copy where it has some, the live build's elsewhere ----------
const ORDER = ["psu", "gpu", "cpu", "mthr", "ram", "storage", "cooler", "case"];
const COPY = {
  psu: { title: ["POWER SUPPLY", "UNIT"], overview: "Everything starts here. The power supply unit, or PSU, turns wall electricity into stable, regulated power for the motherboard, CPU, GPU and drives." },
  gpu: { overview: "The Graphics Processing Unit, or GPU, turns data into the images on your screen. Thousands of cores render in parallel, so each new frame arrives in a blink.",
         hot: { ports: ["Display Port (3)", "Up to three screens plug in here over DisplayPort, carrying HD video and audio."] } },
  cpu: { overview: "The Central Processing Unit, or CPU, is the computer's \"brain\": it fetches every program's instructions and carries them out, billions each second.",
         hot: { tab: ["Corner Tab", "This corner tab lines the CPU up with the socket, so it only goes in the right way round."] } },
};
// the mockup shows the graphics card from its flow-through side, gold fingers on top
const VIEW = {
  psu: { size: 2.4, tilt: [0.16, 0.5], lighten: 2.6 },   // the mockup's PSU is a light grey box
  // the mockup's own chip; its printing is modelled geometry, so the x-ray shows the lid's lettering by its edges
  cpu: {
    glb: "cpu7950.glb", model: "AMD Ryzen 9 7950X3D", basis: ["x", "y", "z"], size: 2.7, tilt: [-0.62, 0.1, -0.1], xrayFront: true, edgeLimit: 60000,
    hotspots: [
      { id: "tab",  at: [-0.45, 0.45, 0.5], n: [-0.3, 0.3, 1], title: "Corner Tab", text: "" },
      { id: "ihs",  at: [0.12, 0.1, 0.5], title: "Heat Spreader", text: "The metal lid protects the silicon and spreads its heat evenly into the cooler above it." },
      { id: "pins", at: [0.3, -0.3, -0.5], n: [0, 0, -1], title: "Contact Pads", text: "1,718 flat gold pads on the underside press onto springy pins in the AM5 socket." },
    ],
    // dies hidden under the lid: placement schematic, connections per AMD's Raphael platform
    modes: {
      framework: "Three chiplets under the heat spreader: two 5 nm compute dies with eight Zen 4 cores each — one with a 3D V-Cache die stacked on top — and a 6 nm I/O die with the DDR5 and PCIe 5.0 controllers and small RDNA 2 graphics. 128 MB of L3 cache in all.",
      power: "The AM5 socket feeds separate rails through its 1,718 contacts: one for the cores and one for the I/O die. The CPU asks the motherboard's regulators for exactly the voltage it needs, within a 120 W budget.",
      data: "Both compute dies talk to the I/O die over Infinity Fabric. From there: two DDR5 channels to memory, 16 lanes for the graphics card, two ×4 links for NVMe SSDs (PCIe 5.0 where the board allows) and a PCIe 4.0 ×4 link to the chipset.",
    },
    flows: {
      nodes: {
        vcore: { at: [-0.46, 0.34], label: "Core rail", note: "VDDCR" },
        vsoc:  { at: [0.46, -0.34], label: "SoC rail", note: "VDDCR_SOC" },
        ccd0:  { at: [-0.2, 0.2], label: "CCD 0", note: { power: "8 cores", data: "8 cores · 96 MB L3 (3D V-Cache)" } },
        ccd1:  { at: [-0.2, -0.16], label: "CCD 1", note: { power: "8 cores", data: "8 cores · 32 MB L3" } },
        iod:   { at: [0.16, 0.02], label: "I/O die", note: { data: "6 nm · RDNA 2 graphics" } },
        mem:   { at: [0.46, 0.26], label: "Memory", note: "DDR5 × 2 channels" },
        gfx:   { at: [0.12, -0.47], label: "Graphics lanes", note: "x16 · PCIe 5.0-capable" },
        nvme:  { at: [-0.22, -0.47], label: "NVMe lanes", note: "2 × x4" }, nvme2: { at: [-0.36, -0.47] },
        chip:  { at: [0.4, -0.47], label: "Chipset link", note: "PCIe 4.0 x4" },
      },
      power: [["vcore", "ccd0", 3], ["vcore", "ccd1", 3], ["vsoc", "iod", 3]],
      data: [
        ["ccd0", "iod", 2, { kind: "pairs", both: true, label: "Infinity Fabric" }], ["ccd1", "iod", 2, { kind: "pairs", both: true }],
        ["iod", "mem", 4, { kind: "ddr", both: true, label: "2 × 64-bit" }],
        ["iod", "gfx", 4, { kind: "pairs", both: true }], ["iod", "nvme", 2, { kind: "pairs", both: true }], ["iod", "nvme2", 2, { kind: "pairs", both: true }], ["iod", "chip", 2, { kind: "pairs", both: true }],
      ],
    },
  },
  gpu: {
    basis: ["z", "-x", "-y"], tilt: [0.32, -0.42, 0.2], dense: /fan|Armature|heatsink/i, mirror: true,
    hotspots: [
      { id: "ports", node: "ports", n: [-1, 0, 0.3], title: "Display Port", text: "" },
      { id: "pcie", at: [-0.18, 0.49, 0], n: [0, 1, 0.35], title: "PCIe Connector", text: "The gold fingers plug into the motherboard's longest slot and carry data to and from the CPU." },
      { id: "fan", node: "fan", n: [0, 0, 1], title: "Flow-through Fan", text: "This fan pulls air straight through the card's open back and pushes it out above the card, toward the CPU cooler." },
    ],
  },
};
const PARTS = ORDER.map((id) => {
  const src = { ...SOURCE.find((p) => p.id === id), ...VIEW[id] }, c = COPY[id] || {};
  return {
    ...src,
    title: c.title || src.title,
    modes: { ...src.modes, overview: c.overview || src.modes.overview },
    hotspots: src.hotspots.map((h) => (c.hot?.[h.id] ? { ...h, title: c.hot[h.id][0], text: c.hot[h.id][1] } : h)),
  };
});
const MODES = [["overview", "Overview"], ["framework", "Framework"], ["power", "Power"], ["data", "Data"]];
const LOOK = {   // x-ray styling per view, after the Figma frames
  framework: { rim: 1.0, edge: 0.8 },
  power:     { rim: 0.6, edge: 0.2, flow: "power" },
  data:      { rim: 0.6, edge: 0.2, flow: "data" },
};

// ---------- renderer ----------
const canvas = $("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
const key = new THREE.DirectionalLight("#ffffff", 1.6);
key.position.set(-4, 8, 6);
scene.add(key, new THREE.AmbientLight("#ffffff", 0.3));

// x-ray: an additive fresnel twin of every mesh, plus its hard edges
const XR = { rim: { value: 1 } };
// premultiplied glow: the shader writes colour × opacity with an alpha that covers it, both summed.
// (Alpha must be written: GPU compositing drops colour where a transparent canvas has zero alpha.)
const GLOW = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor };
const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
// `this` is the material: textured twins light up their printing (text, labels, pads) by its edges
function xrayCompile(sh) {
  sh.uniforms.uRim = XR.rim;
  const inv = !!this.userData.invert;
  const tex = this.emissiveMap ? `
      float l = dot(texture2D(emissiveMap, vEmissiveMapUv).rgb, vec3(0.3, 0.59, 0.11));
      float edge = clamp(length(vec2(dFdx(l), dFdy(l))) * 7.0, 0.0, 1.0);
      tex = ${inv ? "(1.0 - l) * 0.08 + edge * 3.2" : "l * 0.12 + edge * 1.8"};` : "";
  sh.fragmentShader = sh.fragmentShader
    .replace("#include <common>", "#include <common>\nuniform float uRim;")
    .replace("#include <emissivemap_fragment>", `
      float tex = 0.0;${tex}
      float fres = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.0);
      totalEmissiveRadiance = vec3(0.12, 0.62, 1.0) * (fres * uRim * 1.3 + 0.008 + tex);`)
    // pure glow: no lighting at all (its specular sheen was the grey haze), and no tone mapping to wash out the cyan
    .replace("vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;", "vec3 outgoingLight = totalEmissiveRadiance;")
    .replace("#include <dithering_fragment>", `#include <dithering_fragment>
      gl_FragColor.rgb *= opacity;
      gl_FragColor.a = max(max(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b);`);
}
const xrayMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1, metalness: 0, envMapIntensity: 0, opacity: 0.42, side: THREE.DoubleSide, toneMapped: false, ...GLOW });
xrayMat.onBeforeCompile = xrayCompile;
xrayMat.customProgramCacheKey = () => "proto-xray";
const xrayDim = xrayMat.clone();
xrayDim.opacity = 0.07;
xrayDim.onBeforeCompile = xrayCompile;
xrayDim.customProgramCacheKey = xrayMat.customProgramCacheKey;
// one x-ray material per texture
const xrayByMap = new Map();
function xrayFor(src, dense, invert = false) {
  if (dense || !src?.map) return dense ? xrayDim : xrayMat;
  const key = src.map.uuid + (invert ? "-inv" : "");
  if (!xrayByMap.has(key)) {
    const m = xrayMat.clone();
    m.emissiveMap = src.map;
    m.userData.invert = invert;
    m.onBeforeCompile = xrayCompile;
    m.customProgramCacheKey = () => (invert ? "proto-xray-map-inv" : "proto-xray-map");
    xrayByMap.set(key, m);
  }
  return xrayByMap.get(key);
}
const edgeMat = new THREE.LineBasicMaterial({ color: "#3fd2ff", opacity: 0.45, ...ADD });

// power / data wiring (flowmap.js): shared clock for the light travelling along the wires
const flowUniforms = { uTime: { value: 0 }, uGrow: { value: 0 } };

function basisMatrix(basis = ["x", "y", "z"]) {
  const v = (s) => { const k = s.startsWith("-") ? -1 : 1, a = s.replace("-", ""); return new THREE.Vector3(a === "x" ? k : 0, a === "y" ? k : 0, a === "z" ? k : 0); };
  return new THREE.Matrix4().makeBasis(v(basis[0]), v(basis[1]), v(basis[2]));
}
// fans aren't always modelled around their hub: pivot each at its centre, z along its thinnest side
function wrapSpin(root, names) {
  const out = [];
  root.updateMatrixWorld(true);
  for (const name of names) {
    const node = root.getObjectByName(name);
    if (!node) continue;
    const parent = node.parent, toParent = new THREE.Matrix4().copy(parent.matrixWorld).invert(), box = new THREE.Box3(), m = new THREE.Matrix4();
    node.traverse((o) => { if (o.isMesh && !o.userData.twin) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(m.multiplyMatrices(toParent, o.matrixWorld))); } });
    const s = box.getSize(new THREE.Vector3());
    const axis = s.x < s.y && s.x < s.z ? new THREE.Vector3(1, 0, 0) : s.y < s.z ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    const pivot = new THREE.Group();
    pivot.position.copy(box.getCenter(new THREE.Vector3()));
    pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
    parent.add(pivot);
    pivot.updateMatrixWorld(true);
    const followers = node.userData.followers || [];
    pivot.attach(node);
    for (const f of followers) pivot.attach(f);
    out.push(pivot);
  }
  return out;
}

// ---------- parts ----------
class Rig {
  constructor(part) {
    this.part = part;
    this.pivot = new THREE.Group();
    this.inner = new THREE.Group();
    this.pivot.add(this.inner);
    this.pivot.visible = false;
    scene.add(this.pivot);
    this.pbr = []; this.twins = []; this.edges = []; this.fans = []; this.mixer = null;
    this.nodePoints = {}; this.matBoxes = {}; this.anchors = []; this.flows = {};
    this.ready = false;
  }
  setModel(obj, clips = []) {
    const { part } = this;
    this.proto = part.glb ? cloneSkinned(obj) : null;   // untouched copy for the 1-bit finale
    this.clips = clips;
    const holder = new THREE.Group();
    holder.quaternion.setFromRotationMatrix(basisMatrix(part.basis));
    holder.add(obj);
    const norm = new THREE.Group();
    norm.add(holder);
    this.inner.add(norm);
    norm.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(holder, true);
    const size = bb.getSize(new THREE.Vector3()), center = bb.getCenter(new THREE.Vector3());
    holder.position.sub(center);
    const s = part.size / Math.max(size.x, size.y, size.z);
    norm.scale.setScalar(s);
    this.norm = { center: center.clone(), s };
    this.box = size.multiplyScalar(s);
    norm.updateMatrixWorld(true);

    const meshes = [];
    obj.traverse((o) => { if (o.isMesh) meshes.push(o); });
    if (part.lighten) for (const m of meshes) for (const mat of [].concat(m.material)) {
      if (!mat.color) continue;
      const c = mat.color.multiplyScalar(part.lighten);
      c.setRGB(Math.min(c.r, 0.92), Math.min(c.g, 0.92), Math.min(c.b, 0.92));
    }
    if (part.dense) obj.traverse((o) => { if (part.dense.test(o.name)) o.traverse((m) => { m.userData.dense = true; }); });
    for (const m of meshes) {
      const tris = m.geometry.index ? m.geometry.index.count / 3 : m.geometry.attributes.position.count / 3;
      // very dense meshes (pin grids, fin stacks, fan blades) would pile up into a white wall
      const dense = m.userData.dense || tris > 30000 || /heatsink|fin/i.test(m.name) || /heatsink|fin/i.test(m.parent?.name || "");
      const xm = xrayFor([].concat(m.material)[0], dense, part.xrayInvert);
      let twin;
      if (m.isInstancedMesh) { twin = new THREE.InstancedMesh(m.geometry, xm, m.count); twin.instanceMatrix = m.instanceMatrix; }
      else if (m.isSkinnedMesh) { twin = new THREE.SkinnedMesh(m.geometry, xm); twin.bind(m.skeleton, m.bindMatrix); }
      else twin = new THREE.Mesh(m.geometry, xm);
      twin.position.copy(m.position); twin.quaternion.copy(m.quaternion); twin.scale.copy(m.scale);
      Object.assign(twin, { renderOrder: 2, visible: false });
      twin.userData.twin = true;
      m.parent.add(twin);
      m.userData.followers = [twin];
      this.pbr.push(m); this.twins.push(twin);
      if (!m.isInstancedMesh && !m.isSkinnedMesh && !dense && tris < (part.edgeLimit || 15000)) {   // edges of a pin grid would drown the rest
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 38), edgeMat);
        e.position.copy(m.position); e.quaternion.copy(m.quaternion); e.scale.copy(m.scale);
        Object.assign(e, { renderOrder: 3, visible: false });
        e.userData.twin = true;
        m.parent.add(e);
        m.userData.followers.push(e);
        this.edges.push(e);
      }
    }

    // anchor points from node names, material names or fractions of the part's box
    this.inner.updateMatrixWorld(true);
    const tmp = new THREE.Box3();
    for (const m of meshes) {
      tmp.setFromObject(m, true);
      if (tmp.isEmpty()) continue;
      for (const mat of [].concat(m.material)) if (mat.name) (this.matBoxes[mat.name] ||= new THREE.Box3()).union(tmp);
    }
    const matPoints = Object.fromEntries(Object.entries(this.matBoxes).map(([k, b]) => [k, this.inner.worldToLocal(b.getCenter(new THREE.Vector3()))]));
    obj.traverse((o) => {
      if (!o.name || this.nodePoints[o.name]) return;
      tmp.setFromObject(o, true);
      if (!tmp.isEmpty()) this.nodePoints[o.name] = this.inner.worldToLocal(tmp.getCenter(new THREE.Vector3()));
    });
    this.anchors = part.hotspots.map((h) => {
      let p;
      if (h.node && this.nodePoints[h.node]) p = this.nodePoints[h.node].clone();
      else if (h.mat && matPoints[h.mat]) { p = matPoints[h.mat].clone(); p.z = Math.max(p.z, this.box.z * 0.5 * (h.front ?? 0.6)); }
      else p = new THREE.Vector3((h.at?.[0] ?? 0) * this.box.x, (h.at?.[1] ?? 0) * this.box.y, (h.at?.[2] ?? 0.5) * this.box.z);
      const n = new THREE.Vector3(p.x / (this.box.x / 2), p.y / (this.box.y / 2), p.z / (this.box.z / 2));
      const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
      const normal = h.n ? new THREE.Vector3(...h.n) : h.node ? new THREE.Vector3(0, 0, 1)
        : ax > ay && ax > az ? new THREE.Vector3(Math.sign(n.x), 0, 0.4) : ay > az ? new THREE.Vector3(0, Math.sign(n.y), 0.4) : new THREE.Vector3(0, 0, Math.sign(n.z) || 1);
      return { h, p, n: normal.normalize() };
    });

    if (clips.length) { this.mixer = new THREE.AnimationMixer(obj); for (const c of clips) this.mixer.clipAction(c).play(); }
    if (obj.userData.fans) this.fans.push(...obj.userData.fans);
    if (part.spin) this.fans.push(...wrapSpin(obj, part.spin));
    const mirrorY = !!part.mirror;   // shown upside down from the live build: its box-fraction anchors flip
    this.flows.power = buildFlowGraph(THREE, this, part.flows, "power", { color: "#fff200", uniforms: flowUniforms, mirrorY });
    this.flows.data = buildFlowGraph(THREE, this, part.flows, "data", { color: "#ff53e2", uniforms: flowUniforms, mirrorY });
    for (const g of Object.values(this.flows)) { g.visible = false; this.inner.add(g); }
    this.ready = true;
  }
  look(mode) {
    const x = mode !== "overview";
    // front-only x-ray: the solid part stays as an invisible depth layer so only its nearest surface glows
    for (const m of this.pbr) {
      m.visible = !x || !!this.part.xrayFront;
      if (this.part.xrayFront) for (const mat of [].concat(m.material)) mat.colorWrite = !x;
    }
    for (const t of this.twins) t.visible = x;
    for (const e of this.edges) e.visible = x;
    this.flows.power.visible = mode === "power";
    this.flows.data.visible = mode === "data";
  }
}
const rigs = PARTS.map((p) => new Rig(p));

// ---------- state ----------
const state = { part: 0, mode: "overview", hot: -1, peek: false, shownAt: Infinity };
let started = false, slide = null, exiting = false;
const view = { yaw: 0, pitch: 0, vYaw: 0, drag: null, lastMove: 0 };

// ---------- loading (the first part first) ----------
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
(async function load() {
  for (const r of rigs) {
    if (r.part.proc) { r.setModel(PROCEDURAL[r.part.proc]()); continue; }
    try {
      const g = await loadModelAsync(loader, `${MODEL}${r.part.glb}?v=5`);
      r.setModel(g.scene, g.animations);
    } catch (e) { console.error("model failed", r.part.glb, e); }
    if (r === rigs[0]) { $("start").disabled = false; $("startText").textContent = "Click to Start Experience"; }
  }
})();

// ---------- DOM ----------
const els = { title: $("title"), desc: $("desc"), icon: $("partIcon"), hotspots: $("hotspots"), callout: $("callout"), modes: $("modes") };
MODES.forEach(([id, label]) => {
  const b = document.createElement("button");
  b.className = "mode";
  b.dataset.mode = id;
  b.innerHTML = `<span class="mode__tick"></span><span class="mode__label">${label}</span>`;
  b.setAttribute("aria-label", `${label} view`);
  b.addEventListener("click", () => setMode(id));
  els.modes.appendChild(b);
});
PARTS.forEach((p, i) => {
  const li = document.createElement("li");
  li.innerHTML = `<button><img src="${ICON}${p.icon}" alt=""><span><b>${p.title[0]}</b> ${p.title[1]}</span></button>`;
  li.firstChild.addEventListener("click", () => { toggleIndex(false); go(i); });
  $("indexList").appendChild(li);
});
const titleHtml = (p) => `<b>${p.title[0]}</b>${p.title[1] ? " " + p.title[1] : ""}`;

function renderChrome() {
  [...els.modes.children].forEach((b) => b.classList.toggle("is-on", b.dataset.mode === state.mode));
  $("indexList").querySelectorAll("button").forEach((b, i) => b.classList.toggle("is-on", i === state.part));
  const p = PARTS[state.part];
  $("sr").textContent = `${p.title.join(" ").trim()}, ${MODES.find((m) => m[0] === state.mode)[1]} view. ${p.modes[state.mode] || p.modes.overview}`;
}
function setIcon(p, flip) {
  const img = els.icon.querySelector("img");
  if (!flip || reduceMotion()) { img.src = ICON + p.icon; return; }
  els.icon.classList.remove("flip"); void els.icon.offsetWidth; els.icon.classList.add("flip");
  setTimeout(() => { img.src = ICON + p.icon; }, 300);
}

// ---------- part carousel (0:05) ----------
function go(i, dir) {
  if (exiting || !started) return;
  i = (i + PARTS.length) % PARTS.length;
  if (i === state.part || slide) return;
  dir = dir ?? (i > state.part ? 1 : -1);
  const from = rigs[state.part], to = rigs[i];
  if (!to.ready) return;
  closeHot(false);
  const wasX = state.mode !== "overview";
  if (wasX) { state.mode = "overview"; document.body.dataset.mode = "overview"; sfx.mood("overview"); }
  sfx.slide(dir);
  state.part = i;
  const p = PARTS[i];
  // leaving an x-ray view dissolves back to the photograph instead of cutting
  const toPhoto = () => { from.look("overview"); to.look("overview"); };
  if (wasX) dissolve(toPhoto); else toPhoto();
  // the copy goes first, then the slide, then the title and icon mid-slide
  typeText(els.desc, p.modes.overview, { eraseFrom: "start", eraseCps: 340, cps: 170 });
  const d0 = reduceMotion() ? 0 : 150;
  slide = { from, to, dir, t0: performance.now() + d0, dur: reduceMotion() ? 1 : 1000 };
  to.pivot.visible = true;
  view.yaw = 0; view.pitch = 0; view.vYaw = 0;
  setTimeout(() => { rollTitle(els.title, titleHtml(p), 1); setIcon(p, true); }, reduceMotion() ? 0 : 450);
  hideHotspots();
  renderChrome();
}

// ---------- views: dissolve between photograph and x-ray (0:09, 0:11) ----------
const snap = $("snap"), snapCtx = snap.getContext("2d");
function dissolve(swap) {
  if (reduceMotion()) { swap(); return; }
  // freeze the current frame on a 2D canvas, change the scene underneath, then fade the freeze away
  renderer.render(scene, camera);
  snap.width = canvas.width; snap.height = canvas.height;
  snapCtx.clearRect(0, 0, snap.width, snap.height);
  snapCtx.drawImage(canvas, 0, 0);
  snap.style.transition = "none"; snap.style.opacity = "1";
  void snap.offsetWidth;
  swap();
  snap.style.transition = "opacity .42s linear"; snap.style.opacity = "0";
}
function setMode(mode, { keepCopy = false } = {}) {
  if (exiting || !started || slide || mode === state.mode) return;
  const rig = rigs[state.part];
  if (!rig.ready) return;
  if ((state.mode === "overview") !== (mode === "overview")) sfx.scan(mode !== "overview"); else sfx.tick();
  sfx.mood(mode);
  dissolve(() => {
    state.mode = mode;
    document.body.dataset.mode = mode;
    const l = LOOK[mode];
    if (l) { XR.rim.value = l.rim; edgeMat.opacity = l.edge; }
    rig.look(mode);
    flowUniforms.uGrow.value = 0;   // the new view's wiring draws itself on
  });
  if (!keepCopy) typeText(els.desc, PARTS[state.part].modes[mode] || PARTS[state.part].modes.overview, { eraseFrom: "start", eraseCps: 420, cps: 190 });
  if (mode === "overview") closeHot(false);
  renderChrome();
}
function stepMode(d) {
  const i = MODES.findIndex((m) => m[0] === state.mode);
  const n = THREE.MathUtils.clamp(i + d, 0, MODES.length - 1);
  if (n !== i) { state.peek = false; setMode(MODES[n][0]); }
}

// ---------- hotspots (0:08) + callout ----------
function buildHotspots() {
  els.hotspots.innerHTML = "";
  const rig = rigs[state.part];
  rig.anchors.forEach((a, i) => {
    const b = document.createElement("button");
    b.className = "hotspot";
    b.setAttribute("aria-label", `${a.h.title}: show detail`);
    b.addEventListener("click", (e) => { e.stopPropagation(); state.hot === i ? closeHot(true) : openHot(i); });
    els.hotspots.appendChild(b);
  });
  const show = () => [...els.hotspots.children].forEach((b, i) => setTimeout(() => b.classList.add("is-shown"), reduceMotion() ? 0 : i * 140));
  if (reduceMotion()) show(); else setTimeout(show, 1500);
}
function hideHotspots() { els.hotspots.innerHTML = ""; }
function openHot(i) {
  const rig = rigs[state.part], a = rig.anchors[i];
  if (!a) return;
  state.hot = i;
  [...els.hotspots.children].forEach((b, k) => b.classList.toggle("is-on", k === i));
  sfx.pop();
  sfx.duck(true);
  $("calloutTitle").textContent = a.h.title;
  $("calloutText").textContent = a.h.text;
  // a ring opens the x-ray; inside an x-ray view it just changes the callout
  if (state.mode === "overview") { state.peek = true; setMode("framework", { keepCopy: true }); }
  const c = els.callout;
  c.hidden = false;
  c.classList.remove("is-in"); void c.offsetWidth;
  setTimeout(() => c.classList.add("is-in"), state.peek && !reduceMotion() ? 440 : 0);   // after the dissolve, as at 0:09.5
}
function closeHot(back) {
  if (state.hot >= 0) sfx.duck(false);
  state.hot = -1;
  els.callout.hidden = true;
  els.callout.classList.remove("is-in");
  [...els.hotspots.children].forEach((b) => b.classList.remove("is-on"));
  if (back && state.peek) { state.peek = false; setMode("overview", { keepCopy: true }); }
}

const v3 = new THREE.Vector3(), nrm = new THREE.Vector3(), toCam = new THREE.Vector3();
const unit = () => Math.min(innerWidth / 1920, innerHeight / 1080);   // the CSS --u, for artboard sizes
const rings = [];   // on-screen hotspot rings, which the flow labels steer around
function placeHotspots() {
  const rig = rigs[state.part];
  if (!rig.ready || slide) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const nm = new THREE.Matrix3().getNormalMatrix(rig.inner.matrixWorld);
  let ring = null;
  rings.length = 0;
  rig.anchors.forEach((a, i) => {
    const b = els.hotspots.children[i];
    if (!b) return;
    v3.copy(a.p); rig.inner.localToWorld(v3);
    nrm.copy(a.n).applyMatrix3(nm).normalize();
    toCam.copy(camera.position).sub(v3).normalize();
    const p = v3.project(camera);
    const x = (p.x * 0.5 + 0.5) * w, y = (-p.y * 0.5 + 0.5) * h;
    b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    b.classList.toggle("is-back", nrm.dot(toCam) < -0.1);
    if (i === state.hot) ring = { x, y, r: b.offsetWidth / 2 };
    if (b.classList.contains("is-shown")) rings.push({ x, y, r: b.offsetWidth / 2 + 4 });
  });
  if (!ring || els.callout.hidden) return;
  // the callout sits beside its ring, its rule running from the title to the ring (left side preferred)
  const c = els.callout, th = $("calloutTitle").offsetHeight;
  if (w / h < 1) { c.style.width = ""; c.style.transform = ""; return; }   // phones: the callout is a card under the header (CSS)
  // beside its ring, never over a side arrow: narrower rather than overlapping
  const cr = canvas.getBoundingClientRect(), pr = $("prev").getBoundingClientRect(), nx = $("next").getBoundingClientRect();
  const minX = pr.right - cr.left + 14, maxX = nx.left - cr.left - 14, want = Math.min(300 * unit(), 340);
  const roomL = ring.x - ring.r - minX, roomR = maxX - ring.x - ring.r;
  const left = roomL >= Math.min(want, 200) || roomL >= roomR;
  const cw = Math.max(170, Math.min(want, left ? roomL : roomR));
  c.style.width = `${cw}px`;
  c.classList.toggle("is-right", !left);
  c.style.transform = `translate(${(left ? ring.x - ring.r - cw : ring.x + ring.r).toFixed(1)}px, ${(ring.y - th).toFixed(1)}px)`;
}

// component labels on the power / data traces
function placeFlows() {
  const rig = rigs[state.part], layer = $("flowLabels");
  const graph = rig.ready && LOOK[state.mode]?.flow && !slide && !exiting ? rig.flows[state.mode] : null;
  layer.classList.toggle("is-on", !!graph);
  placeFlowLabels(THREE, layer, graph, rig.inner, camera, canvas.clientWidth, canvas.clientHeight, false, rings);
}

// ---------- start (0:03) ----------
const intro = createIntro($("introFx"), "../assets/img/circuit-a.jpg");
function start(first = 0) {
  if (started || !rigs[first].ready) return;
  started = true;
  state.part = first; state.mode = "overview"; state.hot = -1; state.peek = false;
  document.body.dataset.mode = "overview";
  document.body.classList.add("started");
  $("app").setAttribute("aria-hidden", "false");
  setTimeout(() => intro.stop(), 1000);
  const rig = rigs[first], p = PARTS[first];
  for (const r of rigs) { r.pivot.visible = r === rig; r.pivot.position.set(0, 0, 0); if (r.ready) r.look("overview"); }
  // it drifts in from the upper right while the title dissolves
  slide = { from: null, to: rig, dir: 1, t0: performance.now() + 150, dur: reduceMotion() ? 1 : 1150, drift: true };
  els.title.querySelector(".roll").innerHTML = "";
  rollTitle(els.title, titleHtml(p), 1);
  setIcon(p, false);
  els.desc.textContent = "";
  setTimeout(() => typeText(els.desc, p.modes.overview, { cps: 170 }), reduceMotion() ? 0 : 900);
  hideHotspots();
  renderChrome();
  canvas.focus({ preventScroll: true });
  sfx.mood("overview");
  sfx.boot();   // the score fades in under the first part's drift
}
$("start").addEventListener("click", () => start());

// ---------- exit (0:18–0:23) ----------
let bit = null;
async function exitSequence() {
  if (exiting || !started) return;
  exiting = true;
  closeHot(false);
  toggleIndex(false);
  const ex = $("exit"), warm = $("exitWarm"), bitCanvas = $("bit"), glitch = $("glitch");
  sfx.scan(false);
  // a warm copy of the screen scans in from the top…
  renderer.render(scene, camera);
  const ws = $("exitSnap");
  ws.width = canvas.width; ws.height = canvas.height;
  ws.getContext("2d").drawImage(canvas, 0, 0);
  ex.classList.add("is-on");
  const wipe = (el, ms) => el.animate([{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)" }], { duration: reduceMotion() ? 1 : ms, easing: "cubic-bezier(.5,0,.3,1)", fill: "forwards" }).finished;
  await wipe(warm, 420);
  // …then the machine itself, in 1 bit, panning slowly
  bit ||= createBitScene(bitCanvas);
  const showBit = bit.ready();
  if (showBit) { bit.play(); await wipe(bitCanvas, 420); }
  let skip = false;
  const onSkip = () => { skip = true; };
  ex.addEventListener("click", onSkip, { once: true });
  for (let t = 0; showBit && t < 3600 && !skip; t += 100) await wait(100);
  // glitch to black, the score tape-stopping into it
  sfx.stop();
  glitch.innerHTML = Array.from({ length: 16 }, () => `<i style="left:${Math.random() * 96}%;top:${Math.random() * 98}%;width:${4 + Math.random() * 60}px;height:${2 + Math.random() * 4}px"></i>`).join("");
  glitch.classList.add("is-black");
  await wait(reduceMotion() ? 0 : 650);
  bit?.stop();
  // back to the title
  started = false;
  document.body.classList.remove("started");
  $("app").setAttribute("aria-hidden", "true");
  for (const r of rigs) r.pivot.visible = false;
  for (const el of [document.querySelector(".intro__title"), $("start")]) { el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; }
  intro.play();
  sfx.resume();   // the bed returns with the title
  ex.classList.remove("is-on");
  for (const el of [warm, bitCanvas]) el.getAnimations().forEach((a) => a.cancel());
  glitch.classList.remove("is-black");
  glitch.innerHTML = "";
  exiting = false;
}
$("home").addEventListener("click", exitSequence);

/* The finale: motherboard, graphics card and cooler assembled in board space, rendered through a 1-bit
   threshold with Sobel outlines (white on #2e2e2e, like the mockup's machine footage). */
function createBitScene(target) {
  const r2 = new THREE.WebGLRenderer({ canvas: target, antialias: false });
  r2.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  r2.toneMapping = THREE.ACESFilmicToneMapping;
  const sc = new THREE.Scene();
  sc.environment = new THREE.PMREMGenerator(r2).fromScene(new RoomEnvironment(), 0.04).texture;
  const sun = new THREE.DirectionalLight("#ffffff", 2.6);
  sun.position.set(-3, 5, 4);
  sc.add(sun, new THREE.AmbientLight("#ffffff", 0.15));
  const cam = new THREE.PerspectiveCamera(42, 1, 0.05, 50);
  const rt = new THREE.WebGLRenderTarget(4, 4);
  const post = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: rt.texture }, px: { value: new THREE.Vector2() } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `uniform sampler2D tSrc; uniform vec2 px; varying vec2 vUv;
      float L(vec2 o){ return dot(texture2D(tSrc, vUv + o * px).rgb, vec3(0.3, 0.59, 0.11)); }
      void main(){
        float gx = -L(vec2(-1,-1)) - 2.0*L(vec2(-1,0)) - L(vec2(-1,1)) + L(vec2(1,-1)) + 2.0*L(vec2(1,0)) + L(vec2(1,1));
        float gy = -L(vec2(-1,-1)) - 2.0*L(vec2(0,-1)) - L(vec2(1,-1)) + L(vec2(-1,1)) + 2.0*L(vec2(0,1)) + L(vec2(1,1));
        float on = max(step(0.56, L(vec2(0.0))), step(0.38, length(vec2(gx, gy))));
        gl_FragColor = vec4(mix(vec3(0.18), vec3(1.0), on), 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post);
  const postScene = new THREE.Scene(); postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let built = false, raf = 0, t0 = 0;
  const rig = (id) => rigs.find((r) => r.part.id === id);
  const copy = (id) => {   // a fresh part in its explorer "part space"
    const r = rig(id);
    const obj = r.part.proc ? PROCEDURAL[r.part.proc]() : cloneSkinned(r.proto);
    const holder = new THREE.Group();
    holder.quaternion.setFromRotationMatrix(basisMatrix(r.part.basis));
    holder.position.copy(r.norm.center).negate();
    holder.add(obj);
    const g = new THREE.Group(); g.scale.setScalar(r.norm.s); g.add(holder);
    const out = new THREE.Group(); out.add(g);
    return out;
  };
  function build() {
    const mb = rig("mthr"), k = mb.box.y / 305;   // board units per millimetre (ATX is 305 mm tall)
    const top = mb.matBoxes.BaseBoardM?.max.z ?? -mb.box.z / 2;
    sc.add(copy("mthr"));
    // graphics card standing out of the top PCIe slot, bracket at the rear, fans down
    const gpu = rig("gpu"), gq = new THREE.Quaternion().setFromRotationMatrix(basisMatrix(["x", "z", "-y"])), gs = (285 * k) / gpu.part.size;
    const ext = gpu.box.clone().applyQuaternion(gq); ext.set(Math.abs(ext.x), Math.abs(ext.y), Math.abs(ext.z)).multiplyScalar(gs);
    const g = copy("gpu"); g.quaternion.copy(gq); g.scale.setScalar(gs);
    g.position.set(-mb.box.x / 2 + ext.x / 2 - 0.05, -0.17 * mb.box.y, top + ext.z / 2 - 0.02);
    sc.add(g);
    // tower cooler on the socket, fan to the front of the case
    const sock = new THREE.Box3();
    for (const [n, b] of Object.entries(mb.matBoxes)) if (/^CPU_Base/.test(n)) sock.union(b);
    const cool = rig("cooler"), cq = new THREE.Quaternion().setFromRotationMatrix(basisMatrix(["y", "z", "x"])), cs = (155 * k) / cool.part.size;
    const base = cool.matBoxes["Material.004"];
    const contact = base ? new THREE.Vector3(base.getCenter(new THREE.Vector3()).x, base.min.y, base.getCenter(new THREE.Vector3()).z) : new THREE.Vector3(0, -cool.box.y / 2, 0);
    const c = copy("cooler"); c.quaternion.copy(cq); c.scale.setScalar(cs);
    const sc0 = sock.getCenter(new THREE.Vector3());
    c.position.set(sc0.x, sc0.y, sock.max.z + 7 * k).sub(contact.clone().multiplyScalar(cs).applyQuaternion(cq));
    sc.add(c);
    built = true;
  }
  function size() {
    const w = target.clientWidth, h = target.clientHeight;
    r2.setSize(w, h, false);
    const pr = r2.getPixelRatio();
    rt.setSize(Math.round(w * pr), Math.round(h * pr));
    post.uniforms.px.value.set(1 / (w * pr), 1 / (h * pr));
    cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  function frame(now) {
    const k = Math.min(1, (now - t0) / 4400);
    // low and close along the graphics card, drifting toward the cooler (0:18.7 → 0:22.2)
    cam.position.set(THREE.MathUtils.lerp(-1.75, -0.2, k), THREE.MathUtils.lerp(-1.45, -1.1, k), THREE.MathUtils.lerp(1.85, 1.6, k));
    cam.lookAt(THREE.MathUtils.lerp(-0.6, 0.35, k), THREE.MathUtils.lerp(-0.35, 0.2, k), 0.15);
    r2.setRenderTarget(rt); r2.render(sc, cam);
    r2.setRenderTarget(null); r2.render(postScene, postCam);
    raf = requestAnimationFrame(frame);
  }
  return {
    ready: () => ["mthr", "gpu", "cooler"].every((id) => rig(id)?.ready),
    play() { if (!built) build(); size(); t0 = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); },
    stop() { cancelAnimationFrame(raf); },
  };
}

// ---------- index ----------
function toggleIndex(open = $("index").hidden) {
  $("index").hidden = !open;
  $("menu").setAttribute("aria-expanded", String(open));
  if (open) $("indexList").querySelector(".is-on")?.focus();
}
$("menu").addEventListener("click", () => toggleIndex());
$("index").addEventListener("click", (e) => { if (e.target === $("index")) toggleIndex(false); });

// ---------- input ----------
for (const [id, d] of [["prev", -1], ["next", 1], ["partPrev", -1], ["partNext", 1]]) $(id).addEventListener("click", () => go(state.part + d, d));
canvas.addEventListener("pointerdown", (e) => { view.drag = { x: e.clientX, moved: 0 }; });
addEventListener("pointermove", (e) => {
  if (!view.drag) return;
  const dx = e.clientX - view.drag.x;
  view.drag.x = e.clientX; view.drag.moved += Math.abs(dx);
  view.vYaw = dx * 0.008; view.yaw += view.vYaw; view.lastMove = performance.now();
});
addEventListener("pointerup", () => {
  if (view.drag && view.drag.moved < 4 && state.hot >= 0) closeHot(true);   // a tap on the background closes the detail
  view.drag = null;
});
document.addEventListener("keydown", (e) => {
  if (!started) { if ((e.key === "Enter" || e.key === " ") && !$("start").disabled) { e.preventDefault(); start(); } return; }
  if (exiting) return;
  if (e.key === "Escape") { if (!$("index").hidden) toggleIndex(false); else closeHot(true); return; }
  if (!$("index").hidden) return;
  if (e.key === "ArrowRight") go(state.part + 1, 1);
  else if (e.key === "ArrowLeft") go(state.part - 1, -1);
  else if (e.key === "1" || e.key === "ArrowDown") { e.preventDefault(); stepMode(1); }   // "(1) to go down,
  else if (e.key === "2" || e.key === "ArrowUp") { e.preventDefault(); stepMode(-1); }   //  (2) to go up!"
  else if (e.key === "m" || e.key === "M") toggleSound();
});
// sound: on by default, M or the index's switch turns it off (remembered)
function toggleSound() {
  sfx.muted = !sfx.muted;
  renderSound();
}
function renderSound() {
  const b = $("soundToggle");
  b.setAttribute("aria-pressed", String(!sfx.muted));
  b.textContent = sfx.muted ? "Sound off" : "Sound on";
}
$("soundToggle").addEventListener("click", toggleSound);
renderSound();

// ---------- layout ----------
function fit() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // the mockup centres its part a little left of middle and well above the footer
  const portrait = w / h < 1;
  camera.setViewOffset(w, h, w * (portrait ? 0 : 0.008), h * (portrait ? 0.12 : 0.065), w, h);
  camera.updateProjectionMatrix();
  // portrait: back off until the widest part (4.6 units) fits the screen's width with a margin
  camera.position.set(0, 0, portrait ? Math.max(12, 5.6 / (2 * Math.tan(THREE.MathUtils.degToRad(14)) * (w / h))) : 9.4 * Math.max(1, 1.62 / (w / h)));
  intro.resize();
}
addEventListener("resize", fit);

// ---------- loop ----------
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (!started || exiting && $("exitWarm").getAnimations().every((a) => a.playState === "finished")) return;
  flowUniforms.uTime.value = t;
  flowUniforms.uGrow.value = STILL ? 99 : LOOK[state.mode]?.flow && !slide ? flowUniforms.uGrow.value + dt : 0;
  const W = Math.max(6, camera.aspect * 4.6);
  if (slide) {
    const k = ease(THREE.MathUtils.clamp((performance.now() - slide.t0) / slide.dur, 0, 1));
    if (slide.drift) {   // the first part: from the upper right, already turned toward its pose
      slide.to.pivot.position.set(W * 0.22 * (1 - k), 1.1 * (1 - k), 0);
      slide.to.slideYaw = 0.6 * (1 - k);
    } else {
      if (slide.from) { slide.from.pivot.position.x = -slide.dir * W * k; slide.from.slideYaw = -slide.dir * 0.9 * k; }
      slide.to.pivot.position.set(slide.dir * W * (1 - k), 0, 0);
      slide.to.slideYaw = slide.dir * 0.9 * (1 - k);
    }
    if (k >= 1) {
      if (slide.from && slide.from !== slide.to) { slide.from.pivot.visible = false; slide.from.slideYaw = 0; }
      slide.to.slideYaw = 0;
      slide = null;
      buildHotspots();
    }
  }
  if (!view.drag) { view.vYaw *= 0.94; view.yaw += view.vYaw; }
  for (const r of rigs) {
    if (!r.ready || !r.pivot.visible) continue;
    const [pitch, yaw0, roll = 0] = r.part.tilt;
    const cur = r === rigs[state.part];
    const idle = cur && !STILL && performance.now() - view.lastMove > 2500 && state.hot < 0 ? Math.sin(t * 0.3) * 0.18 : 0;
    r.sway = damp(r.sway || 0, idle, 1.2, dt);
    r.pivot.rotation.order = "YXZ";
    r.pivot.rotation.y = damp(r.pivot.rotation.y, yaw0 + (r.slideYaw || 0) + (cur ? view.yaw + r.sway : 0), slide ? 30 : 8, dt);
    r.pivot.rotation.x = damp(r.pivot.rotation.x, pitch, 8, dt);
    r.pivot.rotation.z = roll;
    if (r.mixer) r.mixer.update(dt);
    for (const f of r.fans) f.rotation.z += dt * 3;
  }
  renderer.render(scene, camera);
  placeHotspots();
  placeFlows();
}

// ---------- boot ----------
fit();
intro.play();
requestAnimationFrame(frame);
renderChrome();
if (Q.has("debug")) window.__p = { rigs, state, camera, go, setMode, openHot, exitSequence, start };
// ?part=gpu&view=framework&hot=0 jumps straight in (screenshots)
if (Q.has("part")) {
  const pi = Math.max(0, ORDER.indexOf(Q.get("part")));
  const timer = setInterval(() => {
    if (!rigs[pi].ready) return;
    clearInterval(timer);
    document.body.classList.add("instant");
    start(pi);
    slide.dur = 1;
    setTimeout(() => {
      if (Q.has("hot")) openHot(+Q.get("hot"));
      else if (Q.get("view")) setMode(Q.get("view"));
      document.body.classList.remove("instant");
    }, 2200);
  }, 120);
}
