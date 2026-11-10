import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { PARTS, MODES, WEB, SIMPLE, SIZE, LAYERS, GLOSSARY, REAL_MM } from "./parts.js";
import { sfx } from "./sfx.js";
import { createCoach } from "./coach.js";
import { PROCEDURAL } from "./procedural.js";
import { createIntro } from "./intro.js";
import { rollTitle, typeText } from "./text.js";
import { createWorkshop } from "./workshop.js";
import { buildFlowGraph, placeFlowLabels } from "./flowmap.js";
import { loadModel } from "./models.js";

const ICON = "../assets/icons/";
const MODEL = "../assets/models/";
const MODEL_V = "5";
const $ = (id) => document.getElementById(id);
const STILL = new URLSearchParams(location.search).has("still");   // for automated screenshots
window.__aocStill = STILL;
const reduceMotion = () => STILL || matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (a, b, lambda, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt));

const prefs = { simple: true };
try { prefs.simple = localStorage.getItem("aoc-words") !== "detailed"; } catch { }
const modeText = (part, mode) => (prefs.simple ? SIMPLE[part.id]?.modes[mode] : null) || part.modes[mode] || part.modes.overview;
const hotText = (part, h) => (prefs.simple ? SIMPLE[part.id]?.hotspots[h.id] : null) || h.text;

const TOTAL = PARTS.reduce((n, p) => n + p.hotspots.length, 0);
let found = new Set();
try { found = new Set(JSON.parse(localStorage.getItem("aoc-found") || "[]")); } catch { }
const saveFound = () => { try { localStorage.setItem("aoc-found", JSON.stringify([...found])); } catch { } };

const MODE_STYLE = {
  overview:  { xray: false },
  framework: { xray: true, tint: "#3fd9e6", rim: 0.9, fill: 0.0, edge: 0.28 },
  power:     { xray: true, tint: "#1f8a99", rim: 0.55, fill: 0.0, edge: 0.12, flow: "#fff200" },
  data:      { xray: true, tint: "#1f8a99", rim: 0.55, fill: 0.0, edge: 0.12, flow: "#ff53e2" },
  airflow:   { xray: true, tint: "#2365b8", rim: 0.6, fill: 0.0, edge: 0.12, air: "#2fb4ff" },
};

// ---------- renderer ----------
const canvas = $("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 760 ? 1.5 : 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
const CAM_Z = 11;
camera.position.set(0, 0.4, CAM_Z);
const keyLight = new THREE.DirectionalLight("#ffffff", 1.4);
keyLight.position.set(4, 8, 6);
scene.add(keyLight, new THREE.AmbientLight("#ffffff", 0.25));

const planePBR = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100);
const planeXR = new THREE.Plane(new THREE.Vector3(0, 1, 0), 100);
let scanY = 100;
function setScan(y) { scanY = y; planePBR.constant = y; planeXR.constant = -y; scanLine.position.y = y; }

const XR = { tint: { value: new THREE.Color("#44e4ed") }, rim: { value: 1.5 }, fill: { value: 0.06 } };
const xrayMat = new THREE.MeshStandardMaterial({
  color: 0x000000, roughness: 1, metalness: 0, envMapIntensity: 0, opacity: 0.55,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  clippingPlanes: [planeXR],
});
xrayMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, { uTint: XR.tint, uRim: XR.rim, uFill: XR.fill });
  sh.fragmentShader = sh.fragmentShader
    .replace("#include <common>", "#include <common>\nuniform vec3 uTint; uniform float uRim; uniform float uFill;")
    .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      float fres = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.0);
      totalEmissiveRadiance = uTint * (fres * uRim + uFill);`);
};
xrayMat.customProgramCacheKey = () => "aoc-xray";
const xrayDim = xrayMat.clone();
xrayDim.opacity = 0.07;
xrayDim.clippingPlanes = [planeXR];   // clone() copies planes; share the live one
xrayDim.onBeforeCompile = xrayMat.onBeforeCompile;
xrayDim.customProgramCacheKey = xrayMat.customProgramCacheKey;
const isDense = (m) => m.userData.dense || /heatsink|fin/i.test(m.name) || /heatsink|fin/i.test(m.parent?.name || "");
const edgeMat = new THREE.LineBasicMaterial({ color: "#44e4ed", transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, clippingPlanes: [planeXR] });

const scanLine = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.025), new THREE.MeshBasicMaterial({ color: "#bff6ff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
scanLine.renderOrder = 10;
scene.add(scanLine);

const shadowTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"); const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(0,0,0,.55)"); grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();

// ---------- flows ----------
const flowUniforms = { uTime: { value: 0 }, uOpacity: { value: 0 }, uGrow: { value: 0 } };
// ---------- airflow particles ----------
const airUniforms = { uTime: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color("#2fb4ff") }, uSize: { value: 30 } };
function buildAir(rig, def) {
  const N = 700;
  const B = rig.box;
  const geo = new THREE.BufferGeometry();
  const seed = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) { seed[i * 4] = Math.random(); seed[i * 4 + 1] = Math.random(); seed[i * 4 + 2] = Math.random(); seed[i * 4 + 3] = Math.random(); }
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
  const dir = new THREE.Vector3(...def.dir).normalize();
  const len = Math.abs(dir.x) * B.x + Math.abs(dir.y) * B.y + Math.abs(dir.z) * B.z;
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...airUniforms, uDir: { value: dir }, uLen: { value: len * 2.6 }, uSpread: { value: new THREE.Vector2(def.spread[0] * Math.max(B.x, B.y) * 0.5, def.spread[1] * Math.max(B.x, B.y) * 0.5) } },
    vertexShader: `attribute vec4 aSeed; uniform float uTime, uLen, uSize; uniform vec3 uDir; uniform vec2 uSpread; varying float vA;
      void main(){
        vec3 up = abs(uDir.y) > 0.9 ? vec3(1.0,0.0,0.0) : vec3(0.0,1.0,0.0);
        vec3 s = normalize(cross(uDir, up)); vec3 t = cross(s, uDir);
        float ph = fract(aSeed.x + uTime * (0.25 + aSeed.w * 0.25));
        float ang = aSeed.y * 6.2831 + ph * 5.0 * (0.6 + aSeed.z);
        float rad = sqrt(aSeed.z);
        vec3 p = uDir * (ph - 0.5) * uLen + (s * cos(ang) * uSpread.x + t * sin(ang) * uSpread.y) * rad * (0.6 + 0.5 * ph);
        vA = sin(ph * 3.14159);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * (0.4 + aSeed.w) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vA;
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;
        gl_FragColor = vec4(uColor, (1.0 - d * 2.0) * vA * uOpacity); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 7;
  return pts;
}

function basisMatrix(basis = ["x", "y", "z"]) {
  const v = (s) => {
    const sign = s.startsWith("-") ? -1 : 1;
    const a = s.replace("-", "");
    return new THREE.Vector3(a === "x" ? sign : 0, a === "y" ? sign : 0, a === "z" ? sign : 0);
  };
  return new THREE.Matrix4().makeBasis(v(basis[0]), v(basis[1]), v(basis[2]));
}

function wrapSpin(root, names) {
  const pivots = [];
  root.updateMatrixWorld(true);
  for (const name of names) {
    const node = root.getObjectByName(name);
    if (!node) continue;
    const parent = node.parent;
    const toParent = new THREE.Matrix4().copy(parent.matrixWorld).invert();
    const box = new THREE.Box3(), m = new THREE.Matrix4();
    node.traverse((o) => {
      if (!o.isMesh || o.userData.twin) return;
      o.geometry.computeBoundingBox();
      box.union(o.geometry.boundingBox.clone().applyMatrix4(m.multiplyMatrices(toParent, o.matrixWorld)));
    });
    const size = box.getSize(new THREE.Vector3());
    const axis = size.x < size.y && size.x < size.z ? new THREE.Vector3(1, 0, 0) : size.y < size.z ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    const pivot = new THREE.Group();
    pivot.name = node.name;
    pivot.position.copy(box.getCenter(new THREE.Vector3()));
    pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
    parent.add(pivot);
    pivot.updateMatrixWorld(true);
    const followers = node.userData.followers || [];
    pivot.attach(node);
    for (const f of followers) pivot.attach(f);
    node.name += "_blades";
    pivots.push(pivot);
  }
  return pivots;
}

// ---------- rigs ----------
class Rig {
  constructor(part) {
    this.part = part;
    this.pivot = new THREE.Group();        // carousel position + turntable rotation
    this.inner = new THREE.Group();        // centred, scaled model lives here
    this.pivot.add(this.inner);
    this.pivot.visible = false;
    scene.add(this.pivot);
    this.ready = false;
    this.pbr = []; this.twins = []; this.edges = [];
    this.fans = [];
    this.mixer = null;
    this.nodePoints = {};
    this.anchors = [];
    this.flows = {};
    this.air = null;
    this.yaw = 0; this.pitch = 0;
  }

  setModel(obj, animations = []) {
    const { part } = this;
    if (part.glb) this.proto = cloneSkinned(obj);   // an untouched copy for the build workshop
    this.clips = animations;
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
    if (part.dense) obj.traverse((o) => { if (part.dense.test(o.name)) o.traverse((m) => { m.userData.dense = true; }); });
    for (const m of meshes) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) { mat.clippingPlanes = [planePBR]; mat.needsUpdate = true; }
      let twin;
      const dense = isDense(m);
      const xm = dense ? xrayDim : xrayMat;
      if (m.isInstancedMesh) { twin = new THREE.InstancedMesh(m.geometry, xm, m.count); twin.instanceMatrix = m.instanceMatrix; }
      else if (m.isSkinnedMesh) { twin = new THREE.SkinnedMesh(m.geometry, xm); twin.bind(m.skeleton, m.bindMatrix); }
      else twin = new THREE.Mesh(m.geometry, xm);
      twin.position.copy(m.position); twin.quaternion.copy(m.quaternion); twin.scale.copy(m.scale);
      twin.renderOrder = 2;
      twin.visible = false;
      twin.userData.twin = true;
      twin.frustumCulled = m.frustumCulled;
      m.parent.add(twin);
      m.userData.followers = [twin];
      this.pbr.push(m); this.twins.push(twin);
      const tris = m.geometry.index ? m.geometry.index.count / 3 : m.geometry.attributes.position.count / 3;
      if (!m.isInstancedMesh && !m.isSkinnedMesh && !dense && tris < 70000) {
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 38), edgeMat);
        e.position.copy(m.position); e.quaternion.copy(m.quaternion); e.scale.copy(m.scale);
        e.visible = false;
        e.renderOrder = 3;
        e.userData.twin = true;
        m.parent.add(e);
        m.userData.followers.push(e);
        this.edges.push(e);
      }
    }

    this.inner.updateMatrixWorld(true);
    const tmpBox = new THREE.Box3();
    const matBoxes = {};
    for (const m of meshes) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      tmpBox.setFromObject(m, true);
      if (tmpBox.isEmpty()) continue;
      for (const mat of mats) if (mat.name) (matBoxes[mat.name] ||= new THREE.Box3()).union(tmpBox);
    }
    this.matPoints = {};
    this.matBoxes = matBoxes;
    for (const [k, b] of Object.entries(matBoxes)) this.matPoints[k] = this.inner.worldToLocal(b.getCenter(new THREE.Vector3()));
    obj.traverse((o) => {
      if (!o.name || this.nodePoints[o.name]) return;
      tmpBox.setFromObject(o, true);
      if (tmpBox.isEmpty()) return;
      this.nodePoints[o.name] = this.inner.worldToLocal(tmpBox.getCenter(new THREE.Vector3()));
    });
    this.anchors = part.hotspots.map((h) => {
      let p;
      if (h.node && this.nodePoints[h.node]) p = this.nodePoints[h.node].clone();
      else if (h.mat && this.matPoints[h.mat]) { p = this.matPoints[h.mat].clone(); p.z = Math.max(p.z, this.box.z * 0.5 * (h.front ?? 0.6)); }
      else p = new THREE.Vector3((h.at?.[0] ?? 0) * this.box.x, (h.at?.[1] ?? 0) * this.box.y, (h.at?.[2] ?? 0.5) * this.box.z);
      const n = new THREE.Vector3(p.x / (this.box.x / 2), p.y / (this.box.y / 2), p.z / (this.box.z / 2));
      const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
      const normal = h.n ? new THREE.Vector3(...h.n)
        : h.node ? new THREE.Vector3(0, 0, 1)
        : ax > ay && ax > az ? new THREE.Vector3(Math.sign(n.x), 0, 0.4) : ay > az ? new THREE.Vector3(0, Math.sign(n.y), 0.4) : new THREE.Vector3(0, 0, Math.sign(n.z) || 1);
      return { h, p, n: normal.normalize() };
    });

    if (animations.length) {
      this.mixer = new THREE.AnimationMixer(obj);
      for (const clip of animations) this.mixer.clipAction(clip).play();
    }
    if (obj.userData.fans) this.fans = obj.userData.fans;
    if (part.spin) this.fans.push(...wrapSpin(obj, part.spin));

    this.flows.power = buildFlowGraph(THREE, this, part.flows, "power", { color: MODE_STYLE.power.flow, uniforms: flowUniforms });
    this.flows.data = buildFlowGraph(THREE, this, part.flows, "data", { color: MODE_STYLE.data.flow, uniforms: flowUniforms });
    for (const g of Object.values(this.flows)) { g.visible = false; this.inner.add(g); }
    if (part.airflow) { this.air = buildAir(this, part.airflow); this.air.visible = false; this.inner.add(this.air); }

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.8 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(this.box.x * 1.3, this.box.z * 1.6 + this.box.x * 0.3, 1);
    shadow.position.y = -Math.max(this.box.y, this.box.z) * 0.62 - 0.35;
    this.shadow = shadow;
    this.pivot.add(shadow);
    this.setupExplode(obj, meshes);
    this.ready = true;
  }

  setupExplode(obj, meshes) {
    const spec = this.part.explode || {};
    const S = this.part.size;
    const items = [];
    if (spec.auto) {
      let root = obj, most = 0;
      obj.traverse((o) => { if (o.children.length > most) { most = o.children.length; root = o; } });
      for (const c of root.children) {
        if (c.userData.twin) continue;   // x-ray twins and edges ride along with their mesh
        let has = false; c.traverse((o) => { if (o.isMesh) has = true; });
        if (has) items.push({ obj: c, label: spec.labels?.[c.name], dir: spec.dirs?.[c.name] });
      }
    }
    obj.traverse((o) => { if (o.userData.explode) items.push({ obj: o, dir: o.userData.explode, label: o.userData.label }); });
    for (const [re, dir, label] of spec.mats || []) {
      let first = true;
      for (const m of meshes) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        if (mats.some((mt) => re.test(mt.name || ""))) { items.push({ obj: m, dir, label: first ? label : undefined, group: label }); first = false; }
      }
    }
    this.inner.updateMatrixWorld(true);
    const half = this.box.clone().multiplyScalar(0.5);
    const b = new THREE.Box3();
    for (const it of items) {
      b.setFromObject(it.obj, true);
      if (b.isEmpty()) continue;
      const cI = this.inner.worldToLocal(b.getCenter(new THREE.Vector3()));
      let oI;
      if (it.dir) oI = new THREE.Vector3(...it.dir).multiplyScalar(S);
      else {
        const k = THREE.MathUtils.clamp(cI.z / half.z, -1, 1);
        oI = new THREE.Vector3((cI.x / half.x) * 0.05 * S, (cI.y / half.y) * 0.04 * S, (k * 0.3 + Math.sign(k) * 0.03) * S);
      }
      const p0 = this.inner.localToWorld(cI.clone()), p1 = this.inner.localToWorld(cI.clone().add(oI));
      const parent = it.obj.parent;
      const off = parent.worldToLocal(p1).sub(parent.worldToLocal(p0));
      it.base = it.obj.position.clone();
      it.off = off;
      it.followers = (it.obj.userData.followers || []).map((f) => ({ f, base: f.position.clone() }));
      it.cI = cI; it.oI = oI;
    }
    this.exItems = items.filter((it) => it.off);
    this.canExplode = this.exItems.length > 1;
    this.ex = 0;
  }

  applyExplode(a) {
    this.ex = a;
    for (const it of this.exItems) {
      it.obj.position.copy(it.base).addScaledVector(it.off, a);
      for (const { f, base } of it.followers) f.position.copy(base).addScaledVector(it.off, a);
    }
  }

  applyMode(mode) {
    const st = MODE_STYLE[mode];
    for (const t of this.twins) t.visible = true;
    for (const e of this.edges) e.visible = true;
    for (const m of this.pbr) m.visible = true;
    this.flows.power.visible = mode === "power";
    this.flows.data.visible = mode === "data";
    if (this.air) this.air.visible = mode === "airflow";
    this.shadow.material.opacity = st.xray ? 0.15 : 0.8;
  }

  settle(mode) {
    const xr = MODE_STYLE[mode].xray;
    for (const t of this.twins) t.visible = xr;
    for (const e of this.edges) e.visible = xr;
    for (const m of this.pbr) m.visible = !xr;
  }
}

const rigs = PARTS.map((p) => new Rig(p));
if (new URLSearchParams(location.search).has("debug")) window.__aoc = { scene, rigs, camera };   // console inspection only

// ---------- loading ----------
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const loadState = { done: 0, total: 0 };
function loadAll() {
  const glbs = rigs.filter((r) => r.part.glb);
  loadState.total = glbs.length;
  for (const r of rigs) if (r.part.proc) r.setModel(PROCEDURAL[r.part.proc]());
  const order = [...glbs].sort((a, b) => (a.part.id === state.partId() ? -1 : b.part.id === state.partId() ? 1 : 0));
  const perFile = new Map();
  return order.reduce((p, r) => p.then(() => new Promise((resolve) => {
    loadModel(loader, `${MODEL}${r.part.glb}?v=${MODEL_V}`, (gltf) => {
      r.setModel(gltf.scene, gltf.animations);
      loadState.done++;
      updateLoad(1, r);
      onRigReady(r);
      resolve();
    }, (e) => { if (e.total) { perFile.set(r, e.loaded / e.total); updateLoad(perFile.get(r), r); } },
    (err) => { console.error("model failed", r.part.glb, err); loadState.done++; resolve(); });
  })), Promise.resolve());
}
function updateLoad(frac, r) {
  const k = (loadState.done + (frac < 1 ? frac : 0)) / loadState.total;
  $("loadBar").style.transform = `scaleX(${Math.min(1, k)})`;
  const cur = rigs[state.part];
  if (cur.ready) { $("start").disabled = false; $("startText").textContent = "Click to Follow the Power"; }
  else $("startText").textContent = `Loading parts ${Math.round(k * 100)}%`;
  $("startBuild").disabled = !rigs.every((r) => r.ready);
}
function onRigReady(r) {
  if (rigs[state.part] === r && started) { r.pivot.visible = true; r.applyMode(state.mode); setScan(MODE_STYLE[state.mode].xray ? -100 : 100); r.settle(state.mode); buildHotspots(); }
}

// ---------- state ----------
const state = {
  part: 0, mode: "overview", hotspot: -1, focus: null, explode: new URLSearchParams(location.search).has("ex") ? 1 : 0,
  partId() { return PARTS[this.part].id; },
};
let started = false;
let slide = null;          // carousel transition
let scan = null;           // mode transition
const drag = { active: false, x: 0, y: 0, yaw: 0, pitch: 0, vYaw: 0, vPitch: 0, lastMove: 0 };
let zoom = 1, zoomTarget = 1;

// ---------- DOM: modes, parts, web ----------
const els = {
  modes: $("modes"), parts: $("parts"), flowLabels: $("flowLabels"), title: $("title"), desc: $("desc"), model: $("model"), ghost: $("ghost"),
  hotspots: $("hotspots"), callout: $("callout"), line: $("calloutLine"), web: $("web"), index: $("index"), indexList: $("indexList"),
};

MODES.forEach((m) => {
  const b = document.createElement("button");
  b.className = "mode";
  b.dataset.mode = m.id;
  b.innerHTML = `<span class="mode__tick"></span><span class="mode__label">${m.label}</span>`;
  b.setAttribute("aria-label", `${m.label} view (${m.key})`);
  b.addEventListener("click", () => setMode(m.id));
  els.modes.appendChild(b);
});
PARTS.forEach((p, i) => {
  const name = p.title.join(" ").trim();
  const b = document.createElement("button");
  b.className = "part";
  b.innerHTML = `<img src="${ICON}${p.icon}" alt=""><span class="part__tip">${name.toLowerCase()}</span>`;
  b.setAttribute("aria-label", name);
  b.addEventListener("click", () => setPart(i));
  els.parts.appendChild(b);
  const li = document.createElement("li");
  li.innerHTML = `<button><img src="${ICON}${p.icon}" alt=""><span><b>${p.title[0]}</b> ${p.title[1]}</span><span class="dots" aria-hidden="true"></span><small>${Object.keys(p.modes).length} views${p.proc ? " · simplified" : ""}</small></button>`;
  li.firstChild.addEventListener("click", () => { setPart(i); toggleIndex(false); });
  els.indexList.appendChild(li);
});

(function buildWeb() {
  const R = 50, C = 62;
  const pos = PARTS.map((p, i) => { const a = -Math.PI / 2 + (i / PARTS.length) * Math.PI * 2; return [C + Math.cos(a) * R, C + Math.sin(a) * R]; });
  const col = { power: "#fff200", data: "#ff53e2", airflow: "#009dff" };
  const idx = Object.fromEntries(PARTS.map((p, i) => [p.id, i]));
  const lines = WEB.map(([a, b, k]) => {
    const [x1, y1] = pos[idx[a]], [x2, y2] = pos[idx[b]];
    return `<path data-a="${a}" data-b="${b}" d="M${x1} ${y1} Q${C} ${C} ${x2} ${y2}" stroke="${col[k]}" />`;
  }).join("");
  els.web.innerHTML = `<svg viewBox="0 0 124 124" aria-hidden="true"><circle cx="${C}" cy="${C}" r="${R}" class="web__ring"/>${lines}</svg>` +
    PARTS.map((p, i) => `<button class="web__node" data-i="${i}" style="left:${(pos[i][0] / 124) * 100}%;top:${(pos[i][1] / 124) * 100}%" aria-label="Go to ${p.title.join(" ").trim()}"><img src="${ICON}${p.icon}" alt=""></button>`).join("");
  els.web.querySelectorAll(".web__node").forEach((b) => b.addEventListener("click", () => setPart(+b.dataset.i)));
})();

// ---------- hotspots + callout ----------
const HOTSPOT_SVG = `<svg viewBox="0 0 34 34" fill="none" aria-hidden="true"><path d="M33.5 17C33.5 26.1 26.1 33.5 17 33.5C7.9 33.5 .5 26.1 .5 17C.5 7.9 7.9 .5 17 .5C26.1 .5 33.5 7.9 33.5 17Z" stroke="white"/><circle opacity=".8" cx="17" cy="17" r="12.14" fill="white"/><path d="M24.5 17C24.5 21.1 21.1 24.5 17 24.5C12.9 24.5 9.5 21.1 9.5 17C9.5 12.9 12.9 9.5 17 9.5C21.1 9.5 24.5 12.9 24.5 17Z" stroke="currentColor"/></svg>`;
function buildHotspots() {
  els.hotspots.innerHTML = "";
  const rig = rigs[state.part];
  buildExLabels();
  if (!rig.ready) return;
  rig.anchors.forEach((a, i) => {
    const b = document.createElement("button");
    b.className = "hotspot" + (found.has(`${rig.part.id}:${a.h.id}`) ? " is-found" : "");
    b.innerHTML = `${HOTSPOT_SVG}<span class="hotspot__n" aria-hidden="true">${i + 1}</span><span class="hotspot__label" aria-hidden="true">${a.h.title}</span>`;
    b.setAttribute("aria-label", `${a.h.title} — show detail`);
    b.addEventListener("mouseenter", () => { if (!state.focus) setHotspot(i); });
    b.addEventListener("focus", () => { if (!state.focus) setHotspot(i); });
    b.addEventListener("pointerdown", beginDrag);
    b.addEventListener("click", (e) => { e.stopPropagation(); if (e.detail !== 0 && drag.moved > 6) return; focusHotspot(i); });
    els.hotspots.appendChild(b);
  });
  if (state.hotspot < 0 || state.hotspot >= rig.anchors.length) state.hotspot = bestHotspot(rig);
  setHotspot(state.hotspot, true);
}
function bestHotspot(rig) {
  const [pitch, yaw] = rig.part.tilt;
  const e = new THREE.Euler(pitch, yaw, 0, "YXZ");
  let best = 0, bestZ = -Infinity;
  rig.anchors.forEach((a, i) => { const z = a.n.clone().applyEuler(e).z; if (z > bestZ + 0.05) { bestZ = z; best = i; } });
  return best;
}
function setHotspot(i, silent = false) {
  const rig = rigs[state.part];
  const a = rig.anchors[i];
  state.hotspot = i;
  [...els.hotspots.children].forEach((b, k) => b.classList.toggle("is-active", k === i));
  if (!a) { els.callout.hidden = true; return; }
  els.callout.hidden = false;
  const text = hotText(PARTS[state.part], a.h);
  els.callout.querySelector(".callout__title").textContent = a.h.title;
  const txt = els.callout.querySelector(".callout__text");
  if (silent) linkTerms(txt, text); else typeText(txt, text, { cps: 140, eraseCps: 600 }).then(() => linkTerms(txt, text));
  const mc = $("mCallout");
  mc.hidden = false;
  mc.querySelector("b").textContent = `${i + 1} · ${a.h.title}`;
  linkTerms(mc.querySelector("p"), text);
  els.line.classList.remove("draw"); void els.line.getBoundingClientRect(); els.line.classList.add("draw");
}
function focusHotspot(i) {
  setHotspot(i);
  coach.event("focus");
  sfx.pop();
  const h = rigs[state.part].anchors[i]?.h;
  if (h) markFound(PARTS[state.part], h, i);
  state.focus = i;
  sfx.duck(true);   // reading: the music steps back
  document.body.classList.add("is-focus");
  els.callout.querySelector(".callout__close").hidden = false;
}
function unfocus() {
  if (state.focus != null) sfx.duck(false);
  state.focus = null;
  document.body.classList.remove("is-focus");
  els.callout.querySelector(".callout__close").hidden = true;
}
els.callout.querySelector(".callout__close").addEventListener("click", unfocus);
els.callout.querySelector(".callout__close").hidden = true;

const v3 = new THREE.Vector3(), v3b = new THREE.Vector3(), camDir = new THREE.Vector3();
function updateHotspots() {
  const rig = rigs[state.part];
  updateExLabels(rig);
  const apart = (rig.ex || 0) > 0.15 || ws.active || !!lineup;
  els.hotspots.classList.toggle("is-apart", apart);
  const graph = rig.ready && MODE_STYLE[state.mode].flow ? rig.flows[state.mode] : null;
  els.flowLabels.style.opacity = slide || apart ? 0 : flowUniforms.uOpacity.value;
  if (!graph) placeFlowLabels(THREE, els.flowLabels, null);
  if (!rig.ready || slide || apart) { els.hotspots.style.opacity = 0; els.callout.style.opacity = 0; els.line.style.opacity = 0; return; }
  els.hotspots.style.opacity = ""; els.callout.style.opacity = ""; els.line.style.opacity = "";
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const nm = new THREE.Matrix3().getNormalMatrix(rig.inner.matrixWorld);
  let active = null;
  const rings = [];
  rig.anchors.forEach((a, i) => {
    v3.copy(a.p); rig.inner.localToWorld(v3);
    v3b.copy(a.n).applyMatrix3(nm).normalize();
    camDir.copy(camera.position).sub(v3).normalize();
    const facing = v3b.dot(camDir);
    const sp = v3.clone().project(camera);
    const x = (sp.x * 0.5 + 0.5) * w, y = (-sp.y * 0.5 + 0.5) * h;
    const b = els.hotspots.children[i];
    if (!b) return;
    b.style.transform = `translate(${x}px, ${y}px)`;
    b.classList.toggle("is-hidden", facing < -0.05);
    if (i === state.hotspot) active = { x, y, facing };
    if (facing >= -0.05) rings.push({ x, y, r: 21 });
  });
  if (graph && flowUniforms.uOpacity.value > 0.02) placeFlowLabels(THREE, els.flowLabels, graph, rig.inner, camera, w, h, prefs.simple, rings);
  if (!active || els.callout.hidden) { els.line.querySelector("path").setAttribute("d", ""); return; }
  let minX = Infinity, maxX = -Infinity;
  for (let k = 0; k < 8; k++) {
    v3.set((k & 1 ? 0.5 : -0.5) * rig.box.x, (k & 2 ? 0.5 : -0.5) * rig.box.y, (k & 4 ? 0.5 : -0.5) * rig.box.z);
    rig.inner.localToWorld(v3).project(camera);
    const sx = (v3.x * 0.5 + 0.5) * w;
    minX = Math.min(minX, sx); maxX = Math.max(maxX, sx);
  }
  const cw = els.callout.offsetWidth, ch = els.callout.offsetHeight;
  const roomR = w - maxX, roomL = minX;
  const right = roomR >= cw + 40 || roomL < cw + 40 ? (roomR >= roomL ? true : active.x < w * 0.5) : active.x >= (minX + maxX) / 2;
  const dx = Math.min(150, w * 0.12);
  let cx = right ? Math.max(active.x + dx, maxX + 28) : Math.min(active.x - dx - cw, minX - 28 - cw);
  let cy = active.y - 58;
  const nav = document.body.classList.contains("is-compact") ? 12 : $("prev").getBoundingClientRect().right - canvas.getBoundingClientRect().left + 14;
  cx = Math.max(nav, Math.min(w - cw - nav, cx));
  cy = Math.max(70, Math.min(h - ch - 12, cy));
  els.callout.style.transform = `translate(${cx}px, ${cy}px)`;
  els.callout.classList.toggle("is-left", !right);
  els.callout.classList.toggle("is-over", right ? cx < maxX : cx + cw > minX);
  els.callout.classList.toggle("is-dim", active.facing < -0.05);
  const ex = right ? cx : cx + cw, ey = cy + 22;
  const r = 17;
  const ang = Math.atan2(ey - active.y, ex - active.x);
  const sx = active.x + Math.cos(ang) * r, sy = active.y + Math.sin(ang) * r;
  const kx = right ? ex - 24 : ex + 24;
  els.line.querySelector("path").setAttribute("d", `M${sx.toFixed(1)} ${sy.toFixed(1)} L${kx.toFixed(1)} ${ey.toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)}`);
}

// ---------- text + controls ----------
function renderText(dir = 1, animate = true) {
  const part = PARTS[state.part];
  const html = `<b>${part.title[0]}</b>${part.title[1] ? " " + part.title[1] : ""}`;
  rollTitle(els.title, html, dir);
  const text = modeText(part, state.mode);
  if (animate) typeText(els.desc, text).then(() => linkTerms(els.desc, text)); else linkTerms(els.desc, text);
  els.model.textContent = part.model;
  $("size").textContent = SIZE[part.id]?.[prefs.simple ? "simple" : "detailed"] || "";
  const view = MODES.find((m) => m.id === state.mode).label;
  $("srScene").textContent = `${part.title.join(" ").trim()}, ${view} view. ${text} ${part.hotspots.length} features to explore: ${part.hotspots.map((h, k) => `${k + 1}, ${h.title}`).join("; ")}.`;
  els.ghost.textContent = part.ghost;
  els.ghost.classList.toggle("is-long", part.ghost.length > 3);
  $("modelNote").textContent = part.proc ? "Simplified stand-in model" : "";
}
function renderControls() {
  const part = PARTS[state.part];
  [...els.modes.children].forEach((b) => {
    const on = b.dataset.mode === state.mode;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", on);
    b.disabled = !part.modes[b.dataset.mode];
  });
  [...els.parts.children].forEach((b, i) => { b.classList.toggle("is-active", i === state.part); b.setAttribute("aria-current", i === state.part); });
  [...els.indexList.querySelectorAll("button")].forEach((b, i) => b.classList.toggle("is-active", i === state.part));
  document.querySelectorAll("[data-mode-link]").forEach((b) => { b.classList.toggle("is-active", b.dataset.modeLink === state.mode); b.disabled = !part.modes[b.dataset.modeLink]; });
  els.web.querySelectorAll(".web__node").forEach((b) => b.classList.toggle("is-active", +b.dataset.i === state.part));
  els.web.querySelectorAll("path").forEach((p) => p.classList.toggle("is-on", p.dataset.a === part.id || p.dataset.b === part.id));
}
function syncHash() {
  const h = `#${PARTS[state.part].id}/${state.mode}`;
  if (location.hash !== h) history.replaceState(null, "", h);
}

// ---------- theme ----------
function applyTheme(mode, flash = true) {
  const wasDark = MODE_STYLE[document.body.dataset.mode]?.xray;
  document.body.dataset.mode = mode;
  const st = MODE_STYLE[mode];
  if (st.xray) { XR.tint.value.set(st.tint); XR.rim.value = st.rim; XR.fill.value = st.fill; edgeMat.color.set(st.tint); edgeMat.opacity = st.edge; }
  if (flash && !reduceMotion() && wasDark !== st.xray) {
    const f = document.createElement("div");
    f.className = "flash " + (st.xray ? "flash--in" : "flash--out");
    document.body.appendChild(f);
    f.addEventListener("animationend", () => f.remove());
  }
}

// ---------- actions ----------
function setMode(mode, opts = {}) {
  const part = PARTS[state.part];
  if (!part.modes[mode] || (mode === state.mode && !opts.force)) return;
  const from = state.mode;
  state.mode = mode;
  applyTheme(mode);
  const rig = rigs[state.part];
  if (rig.ready) {
    rig.applyMode(mode);
    const wasX = MODE_STYLE[from].xray, isX = MODE_STYLE[mode].xray;
    if (wasX !== isX) sfx.scan(isX); else sfx.tick();
    sfx.mood(mode);
    flowUniforms.uGrow.value = 0;
    if (wasX !== isX && !reduceMotion()) {
      rig.inner.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(rig.inner, true);
      scan = { t0: performance.now(), dur: 1100, top: bb.max.y + 0.15, bottom: bb.min.y - 0.15, toX: isX, rig };
    } else { setScan(isX ? -100 : 100); rig.settle(mode); }
  }
  renderText(1, true);
  renderControls();
  syncHash();
  pulseSound();
  coach.event("mode");
}
function setPart(i, dir) {
  if (lineup) exitLineup();
  if (ws.active) exitBuild();
  i = (i + PARTS.length) % PARTS.length;
  if (i === state.part) return;
  dir = dir ?? (i > state.part ? 1 : -1);
  const from = rigs[state.part], to = rigs[i];
  unfocus();
  state.part = i;
  state.hotspot = -1;
  coach.event("part");
  sfx.slide(dir);
  if (!PARTS[i].modes[state.mode]) { state.mode = "overview"; }
  applyTheme(state.mode, false);
  if (to.ready) { to.applyMode(state.mode); to.settle(state.mode); }
  setScan(MODE_STYLE[state.mode].xray ? -100 : 100);
  if (from.ready && from !== to) { from.applyMode(state.mode); from.settle(state.mode); }
  slide = { from, to, dir, t0: performance.now(), dur: reduceMotion() ? 1 : 1050 };
  to.pivot.visible = true;
  from.leaveYaw = drag.yaw + (from.sway || 0); from.leavePitch = drag.pitch;
  to.leaveYaw = 0; to.leavePitch = 0; to.sway = 0;
  drag.yaw = 0; drag.pitch = 0; zoomTarget = 1;
  renderText(dir, true);
  renderControls();
  buildHotspots();
  syncHash();
}
function stepMode(d) {
  const avail = MODES.map((m) => m.id).filter((m) => PARTS[state.part].modes[m]);
  setMode(avail[(avail.indexOf(state.mode) + d + avail.length) % avail.length]);
}
function toggleIndex(open = els.index.hidden) {
  els.index.hidden = !open;
  document.body.classList.toggle("menu-open", open);
  $("menuBtn").setAttribute("aria-expanded", open);
  if (open) els.indexList.querySelector(".is-active")?.focus();
}
function pulseSound() { }

// ---------- size line-up ----------
let lineup = null;
function enterLineup() {
  if (ws.active) exitBuild();
  toggleIndex(false); unfocus();
  state.explode = 0;
  if (state.mode !== "overview") setMode("overview");
  const ready = rigs.filter((r) => r.ready);
  const total = ready.reduce((a, r) => a + REAL_MM[r.part.id], 0) + (ready.length - 1) * 45;
  const ROW = 8.6;
  const k = ROW / total;                                        // scene units per millimetre for the whole row
  let x = -ROW / 2;
  const base = -0.75;                                           // everything stands on one shelf line
  lineup = { dist: Math.max(1.08, 1.08 / Math.min(1, camera.aspect / 1.6)), rigs: ready };
  for (const r of ready) {
    const s = (REAL_MM[r.part.id] * k) / r.part.size;
    const w = Math.max(r.box.x, r.box.z * 0.6) * s;
    r.inLineup = true;
    r.lineYaw = -0.35;
    r.pivot.visible = true;
    r.applyMode("overview"); r.settle("overview");
    r.pivot.scale.setScalar(s);
    r.pivot.rotation.set(-0.18, -0.35, 0, "YXZ");
    r.pivot.position.set(x + w / 2, base + (r.box.y * s) / 2, 0);
    r.shadow.visible = false;
    x += w + 45 * k;
  }
  document.body.classList.add("is-lineup");
  rollTitle(els.title, "<b>SIZE</b> LINE-UP", 1);
  typeText(els.desc, prefs.simple ? "Every part at its real size, side by side. Look how tiny the CPU is next to the graphics card!" : `All ${ready.length} parts at true relative scale (longest side shown). Tap a part to explore it.`);
  const layer = $("lineLabels");
  layer.innerHTML = ready.map((r) => `<button class="lineup-label" data-id="${r.part.id}"><b>${TRAY_NAMES[r.part.id] || r.part.title.join(" ").trim()}</b><span>${(REAL_MM[r.part.id] / 10).toFixed(REAL_MM[r.part.id] < 100 ? 1 : 0)} cm</span></button>`).join("");
  layer.querySelectorAll(".lineup-label").forEach((b) => {
    b.addEventListener("click", () => { const i = PARTS.findIndex((p) => p.id === b.dataset.id); exitLineup(); setPart(i); });
    b.addEventListener("mouseenter", () => { const r = rigs.find((x) => x.part.id === b.dataset.id); r.hoverSpin = 0.9; });
    b.addEventListener("mouseleave", () => { const r = rigs.find((x) => x.part.id === b.dataset.id); r.hoverSpin = 0; });
  });
  sfx.wide();
}
function updateLineupLabels() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const layer = $("lineLabels");
  lineup.rigs.forEach((r, i) => {
    v3.copy(r.pivot.position); v3.y = -0.75 - 0.1;
    v3.project(camera);
    const el = layer.children[i];
    if (el) el.style.transform = `translate(${((v3.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-v3.y * 0.5 + 0.5) * h).toFixed(1)}px) translateX(-50%)`;
  });
}
function exitLineup() {
  if (!lineup) return;
  for (const r of lineup.rigs) {
    r.inLineup = false; r.hoverSpin = 0;
    r.pivot.scale.setScalar(1); r.pivot.position.set(0, 0, 0);
    r.pivot.visible = r === rigs[state.part];
    r.shadow.visible = true;
  }
  lineup = null;
  $("lineLabels").innerHTML = "";
  document.body.classList.remove("is-lineup");
  renderText(1, true); renderControls(); buildHotspots();
}
$("lineupBtn").addEventListener("click", () => (lineup ? exitLineup() : enterLineup()));
$("lineupFromIndex").addEventListener("click", enterLineup);
$("lineupExit").addEventListener("click", exitLineup);

// ---------- build-a-PC workshop ----------
const TRAY_NAMES = { mthr: "Motherboard", cpu: "Processor (CPU)", cooler: "CPU cooler", ram: "Memory (RAM)", storage: "Storage (SSD)", gpu: "Graphics card", psu: "Power supply", case: "PC case" };
const ws = createWorkshop({
  scene, camera, canvas, rigs, sfx, toast, prefs, basisMatrix, wrapSpin, procedural: PROCEDURAL,
  icon: (id) => ICON + PARTS.find((p) => p.id === id).icon,
});
if (window.__aoc) window.__aoc.ws = ws;
function enterBuild() {
  if (lineup) exitLineup();
  toggleIndex(false); unfocus();
  state.explode = 0;
  if (state.mode !== "overview") setMode("overview");
  if (!ws.enter()) return;
  for (const r of rigs) r.pivot.visible = false;
  if (coach.active) coach.finish(false);
}
function exitBuild() {
  if (!ws.active) return;
  ws.exit();
  const rig = rigs[state.part];
  rig.pivot.visible = true; rig.applyMode(state.mode); rig.settle(state.mode);
  camera.position.set(0, 0.4, CAM_Z);
  fit();
  renderText(1, true); renderControls(); buildHotspots();
}
$("buildBtn").addEventListener("click", enterBuild);
$("wsExit").addEventListener("click", exitBuild);
$("buildFromIndex").addEventListener("click", enterBuild);

// ---------- exploded view ----------
function buildExLabels() {
  const layer = $("exLabels");
  layer.innerHTML = "";
  const rig = rigs[state.part];
  const seenL = new Set();
  rig.exLabelItems = (rig.exItems || []).filter((it) => it.label && !seenL.has(it.label) && seenL.add(it.label));
  for (const it of rig.exLabelItems) {
    const d = document.createElement("button");
    d.className = "exlabel";
    d.innerHTML = `<span>${it.label}</span>${LAYERS[it.label] ? `<em class="exlabel__tip">${LAYERS[it.label]}</em>` : ""}`;
    d.setAttribute("aria-label", `${it.label}: ${LAYERS[it.label] || ""}`);
    d.addEventListener("click", () => {
      const open = !d.classList.contains("is-open");
      layer.querySelectorAll(".exlabel.is-open").forEach((x) => x.classList.remove("is-open"));
      d.classList.toggle("is-open", open);
      if (open) sfx.pop();
    });
    layer.appendChild(d);
  }
  renderExplodeBtn();
}
function updateExLabels(rig) {
  const layer = $("exLabels");
  const a = rig.ex || 0;
  layer.style.opacity = a > 0.5 && !slide ? 1 : 0;
  if (a <= 0.5 || !rig.exLabelItems) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const pos = rig.exLabelItems.map((it, i) => {
    v3.copy(it.cI).addScaledVector(it.oI, a);
    rig.inner.localToWorld(v3).project(camera);
    const el = layer.children[i];
    return { el, x: (v3.x * 0.5 + 0.5) * w, y: (-v3.y * 0.5 + 0.5) * h, w: el ? el.offsetWidth : 60 };
  });
  const cx = pos.reduce((a, p) => a + p.x, 0) / Math.max(pos.length, 1), cy = pos.reduce((a, p) => a + p.y, 0) / Math.max(pos.length, 1);
  for (const p of pos) { const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1; p.x += (dx / d) * 34; p.y += (dy / d) * 22; }
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
      const A = pos[i], B = pos[j];
      const overlapX = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
      const dy = B.y - A.y;
      if (overlapX > 0 && Math.abs(dy) < 20) { const push = (20 - Math.abs(dy)) / 2 * (dy >= 0 ? 1 : -1); A.y -= push; B.y += push; }
    }
  }
  for (const p of pos) if (p.el) p.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
}
function renderExplodeBtn() {
  const b = $("explode");
  const rig = rigs[state.part];
  const can = rig.ready && rig.canExplode;
  b.disabled = !can;
  b.setAttribute("aria-pressed", String(!!state.explode && can));
  b.querySelector("span").textContent = !can ? "One solid piece" : state.explode ? "Put it back together" : "Take it apart";
  b.title = !can ? "This part is a single solid piece — try the X-ray views instead." : "";
}
function toggleExplode(force) {
  const rig = rigs[state.part];
  if (!rig.ready || !rig.canExplode) return;
  state.explode = force ?? (state.explode ? 0 : 1);
  if (state.explode) unfocus();
  sfx.spread(!!state.explode);
  renderExplodeBtn();
  coach.event("explode");
}
$("explode").addEventListener("click", () => toggleExplode());

// ---------- glossary ----------
const TERM_RE = (() => {
  const alts = GLOSSARY.flatMap((g, gi) => g.match.map((m) => ({ m, gi }))).sort((a, b) => b.m.length - a.m.length);
  return { re: new RegExp(`(?<![\\w-])(${alts.map((a) => a.m).join("|")})(?![\\w-])`, "gi"), alts };
})();
const escHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function termFor(word) {
  for (const { m, gi } of TERM_RE.alts) if (new RegExp(`^(?:${m})$`, "i").test(word)) return gi;
  return -1;
}
function linkTerms(el, text) {
  if (el._typeToken && el.textContent !== text && el.querySelector(".type-caret")) return;   // still typing
  const used = new Set();
  el.innerHTML = escHtml(text).replace(TERM_RE.re, (w) => {
    const gi = termFor(w);
    if (gi < 0 || used.has(gi)) return w;
    used.add(gi);
    return `<button class="term" data-g="${gi}">${w}</button>`;
  });
  el.setAttribute("aria-label", text);
}
const pop = document.createElement("div");
pop.className = "term-pop";
pop.hidden = true;
pop.setAttribute("role", "dialog");
document.body.appendChild(pop);
function showTerm(gi, anchor) {
  const g = GLOSSARY[gi];
  pop.innerHTML = `<b>${escHtml(g.term)}</b><p>${escHtml(prefs.simple ? g.simple : g.detailed)}</p><button class="term-pop__more">Open the glossary →</button>`;
  pop.hidden = false;
  const r = anchor.getBoundingClientRect();
  const w = Math.min(280, innerWidth - 24);
  pop.style.width = w + "px";
  pop.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left)) + "px";
  const above = r.top > 200;
  pop.style.top = (above ? r.top - 10 : r.bottom + 10) + "px";
  pop.classList.toggle("is-above", above);
  pop.querySelector(".term-pop__more").addEventListener("click", () => { pop.hidden = true; openGlossary(g.term); });
  sfx.pop();
}
document.addEventListener("click", (e) => {
  const t = e.target.closest(".term");
  if (t) { e.stopPropagation(); showTerm(+t.dataset.g, t); return; }
  if (!e.target.closest(".term-pop")) pop.hidden = true;
});
function openGlossary(focusTerm = "") {
  toggleIndex(false);
  const box = $("glossary");
  box.hidden = false;
  document.body.classList.add("menu-open");
  sfx.duck(true);
  sfx.menu(true);
  const q = $("glossaryQ");
  q.value = focusTerm;
  renderGlossary();
  q.focus();
}
function closeGlossary() { $("glossary").hidden = true; document.body.classList.remove("menu-open"); sfx.menu(false); if (state.focus == null) sfx.duck(false); }
function renderGlossary() {
  const q = $("glossaryQ").value.trim().toLowerCase();
  const list = GLOSSARY.map((g, gi) => ({ g, gi })).filter(({ g }) => !q || g.term.toLowerCase().includes(q) || g.simple.toLowerCase().includes(q) || g.detailed.toLowerCase().includes(q))
    .sort((a, b) => a.g.term.localeCompare(b.g.term));
  $("glossaryList").innerHTML = list.map(({ g }) => `<li><dt>${escHtml(g.term)}</dt><dd>${escHtml(prefs.simple ? g.simple : g.detailed)}<span class="gl-parts">${g.parts.map((pid) => { const p = PARTS.find((x) => x.id === pid); return `<button data-go="${pid}"><img src="${ICON}${p.icon}" alt="">${escHtml(p.title.join(" ").trim().toLowerCase())}</button>`; }).join("")}</span></dd></li>`).join("") || `<li class="gl-none">No match — try another word.</li>`;
  $("glossaryList").querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => { closeGlossary(); setPart(PARTS.findIndex((p) => p.id === b.dataset.go)); }));
}
$("glossaryQ").addEventListener("input", renderGlossary);
$("glossaryClose").addEventListener("click", closeGlossary);
$("glossaryBtn").addEventListener("click", () => openGlossary());
$("glossary").addEventListener("click", (e) => { if (e.target === $("glossary")) closeGlossary(); });

// ---------- full-screen 3D on phones ----------
$("fullBtn").addEventListener("click", () => {
  const on = !document.body.classList.contains("is-full");
  document.body.classList.toggle("is-full", on);
  $("fullBtn").setAttribute("aria-pressed", String(on));
  $("fullBtn").setAttribute("aria-label", on ? "Exit full-screen 3D" : "Full-screen 3D");
  window.scrollTo(0, 0);
  fit();
});

// ---------- discoveries ----------
function markFound(part, h, i) {
  const key = `${part.id}:${h.id}`;
  if (found.has(key)) return;
  found.add(key);
  saveFound();
  els.hotspots.children[i]?.classList.add("is-found", "just-found");
  setTimeout(() => sfx.found(), 120);
  renderFound(true);
  const partDone = part.hotspots.every((x) => found.has(`${part.id}:${x.id}`));
  if (found.size === TOTAL) setTimeout(celebrate, 900);
  else if (partDone) setTimeout(() => { toast(`★ You found everything on the ${part.title.join(" ").trim().toLowerCase()}!`, "badge"); sfx.badge(); }, 700);
  else toast(`Discovered: ${h.title} · ${found.size}/${TOTAL}`);
}
function renderFound(bump = false) {
  const k = found.size / TOTAL;
  $("foundBar").style.strokeDashoffset = String(94.25 * (1 - k));
  $("foundText").textContent = `${found.size}/${TOTAL}`;
  $("found").setAttribute("aria-label", `Discoveries: ${found.size} of ${TOTAL} found. Open the parts list.`);
  if (bump) { $("found").classList.remove("bump"); void $("found").offsetWidth; $("found").classList.add("bump"); }
  els.indexList.querySelectorAll("li").forEach((li, pi) => {
    const p = PARTS[pi];
    li.querySelector(".dots").innerHTML = p.hotspots.map((h) => `<i class="${found.has(`${p.id}:${h.id}`) ? "on" : ""}"></i>`).join("");
  });
}
let toastTimer = 0;
function toast(msg, kind = "", action = null) {
  const t = $("toast");
  t.textContent = msg;
  if (action) {
    const b = document.createElement("button");
    b.className = "toast__go";
    b.textContent = action.label;
    b.addEventListener("click", () => { t.hidden = true; action.run(); });
    t.appendChild(b);
  }
  t.className = "toast " + kind;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, action ? 9000 : kind === "badge" ? 4200 : 2600);
}
let finaleFx = null;
function celebrate() {
  sfx.badge();
  $("celebrate").querySelector(".celebrate__eyebrow").textContent = `${TOTAL} / ${TOTAL} features found`;
  $("celebrate").hidden = false;
  finaleFx ||= createIntro($("celebrateFx"), "../assets/img/circuit-a.jpg");
  finaleFx.play();
  $("celebrate").querySelector("button").focus();
}
$("celebrate").querySelector("[data-close]").addEventListener("click", () => { $("celebrate").hidden = true; finaleFx?.stop(); });
$("celebrate").querySelector("[data-reset]").addEventListener("click", () => {
  found.clear(); saveFound(); renderFound(); buildHotspots(); $("celebrate").hidden = true;
});
$("found").addEventListener("click", () => toggleIndex(true));
$("sound").addEventListener("click", () => {
  sfx.muted = !sfx.muted;
  $("sound").setAttribute("aria-pressed", String(sfx.muted));
  $("sound").setAttribute("aria-label", sfx.muted ? "Sound off" : "Sound on");
  if (!sfx.muted) sfx.tick();
});
$("sound").setAttribute("aria-pressed", String(sfx.muted));

// ---------- input ----------
$("prev").addEventListener("click", () => setPart(state.part - 1, -1));
$("next").addEventListener("click", () => setPart(state.part + 1, 1));
$("partPrev").addEventListener("click", () => setPart(state.part - 1, -1));
$("partNext").addEventListener("click", () => setPart(state.part + 1, 1));
$("menuBtn").addEventListener("click", () => toggleIndex());
els.index.addEventListener("click", (e) => { if (e.target === els.index) toggleIndex(false); });
document.querySelectorAll("[data-mode-link]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.modeLink)));

function beginDrag(e) { if (ws.active) return; drag.active = true; drag.x = e.clientX; drag.y = e.clientY; drag.moved = 0; drag.from = e.currentTarget; }
canvas.addEventListener("pointerdown", beginDrag);
addEventListener("pointermove", (e) => {
  if (!drag.active) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  drag.vYaw = dx * 0.008; drag.vPitch = dy * 0.006;
  drag.yaw += drag.vYaw; drag.pitch = THREE.MathUtils.clamp(drag.pitch + drag.vPitch, -0.7, 0.9);
  drag.lastMove = performance.now();
  if (drag.moved > 60) coach.event("drag");
});
addEventListener("pointerup", () => {
  if (!drag.active) return;
  drag.active = false;
  if (drag.from === canvas && drag.moved < 4 && state.focus != null) unfocus();
});
canvas.addEventListener("dblclick", () => { if (ws.active) return; drag.yaw = 0; drag.pitch = 0; zoomTarget = 1; unfocus(); });
canvas.addEventListener("wheel", (e) => { if (ws.active) return; e.preventDefault(); coach.event("drag"); zoomTarget = THREE.MathUtils.clamp(zoomTarget * (1 + e.deltaY * 0.0012), 0.55, 1.5); }, { passive: false });
let pinch = null;
canvas.addEventListener("touchstart", (e) => { if (e.touches.length === 2) pinch = { d: dist(e.touches), z: zoomTarget }; }, { passive: true });
canvas.addEventListener("touchmove", (e) => { if (pinch && e.touches.length === 2) zoomTarget = THREE.MathUtils.clamp(pinch.z * (pinch.d / dist(e.touches)), 0.55, 1.5); }, { passive: true });
canvas.addEventListener("touchend", () => { pinch = null; });
function dist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }

document.addEventListener("keydown", (e) => {
  if (!started) { if ((e.key === "Enter" || e.key === " ") && !$("start").disabled) { e.preventDefault(); start(); } return; }
  if (e.key === "Escape" && lineup) { exitLineup(); return; }
  if (e.key === "Escape") { if (!$("glossary").hidden) closeGlossary(); else if (!pop.hidden) pop.hidden = true; else if (!els.index.hidden) toggleIndex(false); else if (ws.busy) ws.closeList(); else if (ws.active) exitBuild(); else unfocus(); return; }
  if (!$("glossary").hidden) return;
  if (ws.active) {
    if (e.target.closest?.("input, .ws-card, .ws-pop")) return;   // the bench handles its own keys
    const k = e.key.toLowerCase();
    if (k === "a" || k === "d") ws.orbitBy(k === "a" ? -0.15 : 0.15, 0);
    else if (k === "w" || k === "s") ws.orbitBy(0, k === "w" ? -0.08 : 0.08);
    else if (k === "+" || k === "=") ws.zoomBy(0.9);
    else if (k === "-" || k === "_") ws.zoomBy(1.1);
    return;
  }
  if (e.key === "g" || e.key === "G") { openGlossary(); e.preventDefault(); return; }
  if (!els.index.hidden) return;
  if (e.key === "ArrowRight") setPart(state.part + 1, 1);
  else if (e.key === "ArrowLeft") setPart(state.part - 1, -1);
  else if (e.key === "ArrowDown") { e.preventDefault(); stepMode(1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); stepMode(-1); }
  else if (/^[1-5]$/.test(e.key)) setMode(MODES[+e.key - 1].id);
  else if (e.key === "e" || e.key === "E") toggleExplode();
  else if ("aAdD".includes(e.key) && e.key.length === 1) { drag.vYaw = (e.key.toLowerCase() === "a" ? -1 : 1) * 0.014; drag.lastMove = performance.now(); coach.event("drag"); }
  else if ("wWsS".includes(e.key) && e.key.length === 1) { drag.pitch = THREE.MathUtils.clamp(drag.pitch + (e.key.toLowerCase() === "w" ? -0.12 : 0.12), -0.7, 0.9); drag.lastMove = performance.now(); }
  else if (e.key === "+" || e.key === "=") zoomTarget = THREE.MathUtils.clamp(zoomTarget * 0.88, 0.55, 1.5);
  else if (e.key === "-" || e.key === "_") zoomTarget = THREE.MathUtils.clamp(zoomTarget * 1.12, 0.55, 1.5);
  else if (e.key === "0") { drag.yaw = 0; drag.pitch = 0; zoomTarget = 1; unfocus(); }
});
addEventListener("hashchange", () => {
  const [pid, mode] = location.hash.slice(1).split("/");
  const pi = PARTS.findIndex((p) => p.id === pid);
  if (pi >= 0) setPart(pi);
  if (mode) setMode(mode);
});

// ---------- layout ----------
function fit() {
  const compact = innerWidth < 760 || innerWidth / innerHeight < 0.95;
  document.body.classList.toggle("is-compact", compact);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  if (!compact) camera.setViewOffset(w, h, 0, h * 0.13, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  intro.resize();
  ws.fit();
}
addEventListener("resize", fit);

// ---------- tour ----------
const centerOfPart = () => {
  const rig = rigs[state.part];
  if (!rig.ready) return null;
  const r = canvas.getBoundingClientRect();
  const p = new THREE.Vector3().setFromMatrixPosition(rig.inner.matrixWorld).project(camera);
  return { x: r.left + (p.x * 0.5 + 0.5) * r.width + r.width * 0.06, y: r.top + (-p.y * 0.5 + 0.5) * r.height };
};
const rectPoint = (el, fx = 0.5, fy = 0.5) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width * fx, y: b.top + b.height * fy }; };
const coach = createCoach([
  { on: "drag", icon: "drag", text: "Drag the part to spin it around. Scroll or pinch to zoom in.", target: centerOfPart },
  { on: "focus", icon: "tap", text: "Tap a glowing ring to fly in for a closer look.", target: () => rectPoint(els.hotspots.querySelector(".hotspot.is-active:not(.is-hidden)") || els.hotspots.querySelector(".hotspot:not(.is-hidden)") || els.hotspots.firstChild) },
  { on: "mode", icon: "xray", above: true, text: "Switch views to X-ray the part and watch power, data and air flow through it.", target: () => rectPoint(document.querySelector(".mode:nth-child(2)"), 0.1, 0.5) },
  { on: "explode", icon: "parts", above: true, text: "Take it apart to see every layer it's built from.", target: () => rectPoint($("explode"), 0.15, 0.5) },
  { on: "part", icon: "parts", above: true, text: `Meet the other ${PARTS.length - 1} parts with these arrows, or press the arrow keys.`, target: () => rectPoint($("partNext")) },
], { onFinish: () => setTimeout(() => toast("Tour done! Next challenge: build a whole computer.", "badge", { label: "Build a PC", run: enterBuild }), 600) });
$("help").addEventListener("click", () => coach.start(true));

// ---------- wording toggle ----------
function renderLang() {
  document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.lang === "simple") === prefs.simple)));
}
document.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => {
  prefs.simple = b.dataset.lang === "simple";
  try { localStorage.setItem("aoc-words", prefs.simple ? "simple" : "detailed"); } catch { }
  renderLang();
  renderText(1, true);
  if (rigs[state.part].ready) setHotspot(state.hotspot, false);
  if (!$("glossary").hidden) renderGlossary();
}));
renderLang();
renderFound();   // show progress carried over from earlier visits

// ---------- intro ----------
const intro = createIntro($("introFx"), "../assets/img/circuit-a.jpg");
function start() {
  if (started) return;
  started = true;
  document.body.classList.remove("intro-settled");
  document.body.classList.add("started");
  $("app").setAttribute("aria-hidden", "false");
  const rig = rigs[state.part];
  setTimeout(() => intro.stop(), 1200);
  if (rig.ready) {
    rig.pivot.visible = true; rig.applyMode(state.mode); rig.settle(state.mode);
    setScan(MODE_STYLE[state.mode].xray ? -100 : 100);
    slide = { from: null, to: rig, dir: 1, t0: performance.now() + 250, dur: reduceMotion() ? 1 : 1400 };
  }
  renderText(1, true);
  renderControls();
  buildHotspots();
  canvas.focus({ preventScroll: true });
  sfx.mood(state.mode);
  sfx.boot();
  if (!STILL) setTimeout(() => { if (!ws.active) coach.start(); }, 1900);
}
$("start").addEventListener("click", start);
$("startBuild").addEventListener("click", () => {
  start();
  $("startBuild").disabled = true;
  const wait = setInterval(() => { if (rigs.every((r) => r.ready)) { clearInterval(wait); enterBuild(); } }, 150);
});
$("home").addEventListener("click", () => {
  if (ws.active) exitBuild();
  const glitch = document.createElement("div");
  glitch.className = "glitch";
  glitch.innerHTML = Array.from({ length: 18 }, () => {
    const y = Math.random() * 100, h = 1 + Math.random() * 6, x = Math.random() * 30 - 15;
    return `<i style="top:${y}%;height:${h}%;transform:translateX(${x}%);animation-delay:${(Math.random() * 0.18).toFixed(2)}s"></i>`;
  }).join("");
  document.body.appendChild(glitch);
  setTimeout(() => glitch.remove(), 700);
  const wipe = document.createElement("div");
  wipe.className = "wipe";
  wipe.innerHTML = "<i></i>".repeat(8);
  setTimeout(() => document.body.appendChild(wipe), 260);
  setTimeout(() => {
    started = false;
    document.body.classList.remove("started");
    $("app").setAttribute("aria-hidden", "true");
    unfocus(); toggleIndex(false);
    intro.play();
  }, 780);
  setTimeout(() => wipe.remove(), 1600);
});

// ---------- loop ----------
const clock = new THREE.Clock();
let lastInput = performance.now(), skip = false;
for (const ev of ["pointerdown", "pointermove", "wheel", "keydown", "touchstart"]) addEventListener(ev, () => { lastInput = performance.now(); }, { passive: true });
function frame() {
  const idle = performance.now() - lastInput > 6000 && !slide && !scan && state.focus == null;
  if (idle && (skip = !skip)) { requestAnimationFrame(frame); return; }
  if (!els.index.hidden || (!started && document.body.classList.contains("intro-settled"))) { clock.getDelta(); requestAnimationFrame(frame); return; }
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (ws.active) { ws.update(dt, t); renderer.render(scene, camera); requestAnimationFrame(frame); return; }
  flowUniforms.uTime.value = t;
  airUniforms.uTime.value = t;
  const st = MODE_STYLE[state.mode];
  const flowTo = st.flow && !scan ? 1 : 0, airTo = st.air && !scan ? 0.9 : 0;
  flowUniforms.uOpacity.value = STILL ? flowTo : damp(flowUniforms.uOpacity.value, flowTo, 6, dt);
  flowUniforms.uGrow.value = STILL ? 99 : flowTo ? flowUniforms.uGrow.value + dt : 0;
  airUniforms.uOpacity.value = STILL ? airTo : damp(airUniforms.uOpacity.value, airTo, 5, dt);

  const W = Math.max(5.5, camera.aspect * 4.2);
  if (slide) {
    const k = ease(Math.min(1, Math.max(0, (performance.now() - slide.t0) / slide.dur)));
    if (slide.from) { slide.from.pivot.position.x = -slide.dir * W * k; slide.from.slideYaw = -slide.dir * 0.9 * k; }
    slide.to.pivot.position.x = slide.dir * W * (1 - k);
    slide.to.slideYaw = slide.dir * 0.9 * (1 - k);
    if (k >= 1) {
      if (slide.from && slide.from !== slide.to) { slide.from.pivot.visible = false; slide.from.slideYaw = 0; }
      slide = null;
    }
  }

  if (!drag.active) {
    drag.vYaw *= 0.94; drag.yaw += drag.vYaw;
    drag.vPitch = 0;
  }
  const focusZoom = THREE.MathUtils.clamp(0.5 + (4.6 - PARTS[state.part].size) * 0.12, 0.6, 0.82);
  zoom = damp(zoom, state.focus != null ? Math.min(zoomTarget, focusZoom) : zoomTarget, 5, dt);
  const cur = rigs[state.part];
  camera.position.z = CAM_Z * zoom * Math.max(1, 1.0 / camera.aspect) * (1 + 0.16 * (cur.ex || 0)) * (lineup ? lineup.dist : 1);
  if (lineup) updateLineupLabels();

  for (const r of rigs) {
    if (!r.ready || !r.pivot.visible) continue;
    if (r.inLineup) { if (r.mixer) r.mixer.update(dt); for (const f of r.fans) f.rotation.z += dt * 3.5; r.pivot.rotation.y = damp(r.pivot.rotation.y, r.lineYaw + (r.hoverSpin || 0), 4, dt); continue; }
    const isCur = r === rigs[state.part];
    const [tiltX, baseYaw] = r.part.tilt;
    let yaw = baseYaw + (r.slideYaw || 0) - 0.45 * (r.ex || 0), pitch = tiltX, px = r.pivot.position.x, py = 0;
    if (!isCur) { yaw += r.leaveYaw || 0; pitch += r.leavePitch || 0; }
    if (isCur) {
      const idle = performance.now() - drag.lastMove > 2500 && state.focus == null;
      r.sway = damp(r.sway || 0, idle && !reduceMotion() ? Math.sin(t * 0.35) * 0.32 : 0, 1.5, dt);
      yaw += drag.yaw + r.sway;
      pitch += drag.pitch;
      if (state.focus != null && r.anchors[state.focus]) {
        const a = r.anchors[state.focus];
        const nq = a.n.clone().applyQuaternion(r.inner.quaternion);
        yaw = -Math.atan2(nq.x, nq.z) * 0.85 + baseYaw * 0.15;
        pitch = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(nq.y, -1, 1)) * 0.7, -0.6, 0.9) + tiltX * 0.25;
        drag.yaw = yaw - baseYaw; drag.pitch = pitch - tiltX;
        const local = a.p.clone().applyEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
        px = -local.x; py = -local.y + 0.25;
      }
      r.pivot.position.y = damp(r.pivot.position.y, py, 5, dt);
      if (!slide) r.pivot.position.x = damp(r.pivot.position.x, px, 5, dt);
    }
    r.pivot.rotation.order = "YXZ";
    r.pivot.rotation.y = STILL ? yaw : damp(r.pivot.rotation.y, yaw, slide ? 30 : 8, dt);
    r.pivot.rotation.x = STILL ? pitch : damp(r.pivot.rotation.x, pitch, 8, dt);
    if (r.canExplode) {
      const to = isCur ? state.explode : 0;
      const a = STILL ? to : damp(r.ex, to, 4.5, dt);
      if (Math.abs(a - r.ex) > 1e-4) r.applyExplode(Math.abs(a - to) < 1e-3 ? to : a);
    }
    if (r.mixer) r.mixer.update(dt * (state.mode === "airflow" ? 3.2 : 1));
    for (const f of r.fans) f.rotation.z += dt * (state.mode === "airflow" ? 14 : 3.5);
  }

  if (scan) {
    const k = Math.min(1, (performance.now() - scan.t0) / scan.dur);
    const e = ease(k);
    const y = scan.toX ? THREE.MathUtils.lerp(scan.top, scan.bottom, e) : THREE.MathUtils.lerp(scan.bottom, scan.top, e);
    setScan(y);
    scanLine.material.opacity = Math.sin(k * Math.PI) * 0.9;
    if (k >= 1) { setScan(scan.toX ? -100 : 100); scanLine.material.opacity = 0; scan.rig.settle(state.mode); scan = null; }
  }

  renderer.render(scene, camera);
  if (started) updateHotspots();
  requestAnimationFrame(frame);
}

// ---------- boot ----------
(function boot() {
  const [pid, mode] = location.hash.slice(1).split("/");
  const pi = PARTS.findIndex((p) => p.id === pid);
  if (pi >= 0) state.part = pi;
  if (mode && PARTS[state.part].modes[mode]) state.mode = mode;
  applyTheme(state.mode, false);
  fit();
  intro.play();
  loadAll();
  updateLoad(0);
  requestAnimationFrame(frame);
  if (pi >= 0) {           // deep links skip the intro once the part is ready
    const wait = setInterval(() => { if (rigs[state.part].ready) { clearInterval(wait); document.body.classList.add("no-intro-anim"); start(); } }, 100);
  }
  if (new URLSearchParams(location.search).has("lineup")) {
    const wait = setInterval(() => { if (started && rigs.every((r) => r.ready)) { clearInterval(wait); enterLineup(); } }, 150);
  }
  const q = new URLSearchParams(location.search);
  if (q.has("build")) {
    const wait = setInterval(() => {
      if (!started || !rigs.every((r) => r.ready)) return;
      clearInterval(wait);
      enterBuild();
      ws.quickFill(+q.get("build") || 0, q.get("preset"));
      if (q.has("on")) ws.powerOn();
    }, 150);
  }
})();
