import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const M = {
  pcb:    () => new THREE.MeshStandardMaterial({ color: "#14301f", roughness: 0.6, metalness: 0.1 }),
  pcbBlk: () => new THREE.MeshStandardMaterial({ color: "#111317", roughness: 0.55, metalness: 0.15 }),
  chip:   () => new THREE.MeshStandardMaterial({ color: "#0b0b0d", roughness: 0.35, metalness: 0.2 }),
  gold:   () => new THREE.MeshStandardMaterial({ color: "#d9a83a", roughness: 0.25, metalness: 1 }),
  alu:    () => new THREE.MeshStandardMaterial({ color: "#b9bec6", roughness: 0.3, metalness: 1 }),
  steel:  () => new THREE.MeshStandardMaterial({ color: "#2b2e33", roughness: 0.5, metalness: 0.8 }),
  copper: () => new THREE.MeshStandardMaterial({ color: "#c46b3c", roughness: 0.3, metalness: 1 }),
  plastic:() => new THREE.MeshStandardMaterial({ color: "#1a1c20", roughness: 0.7, metalness: 0 }),
  white:  () => new THREE.MeshStandardMaterial({ color: "#e9ebee", roughness: 0.5, metalness: 0 }),
  glow:   () => new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#bfe9ff", emissiveIntensity: 1.2, roughness: 0.4 }),
};

function ex(obj, dir, label) { obj.userData.explode = dir; obj.userData.label = label; return obj; }

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function boxes(list, mat) {
  const geos = list.map(([w, h, d, x, y, z]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  return new THREE.Mesh(mergeGeometries(geos), mat);
}

function fan(radius, blades = 7, mat = M.plastic()) {
  const g = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, radius * 0.22, 32).rotateX(Math.PI / 2), mat);
  g.add(hub);
  const bladeGeo = new THREE.BoxGeometry(radius * 0.62, radius * 0.34, radius * 0.03).translate(radius * 0.55, 0, 0);
  for (let i = 0; i < blades; i++) {
    const b = new THREE.Mesh(bladeGeo, mat);
    b.rotation.x = 0.45;
    const pivot = new THREE.Group();
    pivot.rotation.z = (i / blades) * Math.PI * 2;
    pivot.add(b);
    g.add(pivot);
  }
  return g;
}

export function buildRam() {
  const g = new THREE.Group();
  const pcb = M.pcb(), chip = M.chip(), gold = M.gold(), alu = M.steel();
  g.add(ex(box(13.3, 3.1, 0.12, pcb), [0, 0, -0.02], "Circuit board"));
  const chips = [];
  for (let i = 0; i < 8; i++) chips.push([1.1, 1.05, 0.14, -5.4 + i * 1.54, 0.15, 0.13]);
  g.add(ex(boxes(chips, chip), [0, 0, 0.16], "Memory chips"));
  const fingers = [];
  for (let i = 0; i < 72; i++) {
    const x = -6.4 + i * 0.178;
    if (Math.abs(x - (-1.5)) < 0.22) continue;
    fingers.push([0.12, 0.5, 0.14, x, -1.33, 0]);
  }
  g.add(ex(boxes(fingers, gold), [0, -0.12, 0], "Gold contacts"));
  g.add(ex(box(13.4, 0.9, 0.5, alu, 0, 1.25, 0), [0, 0.2, 0.04], "Heat spreader"));
  g.add(ex(box(13.0, 0.12, 0.42, M.glow(), 0, 1.75, 0), [0, 0.3, 0.04], "Light bar"));
  return g;
}

export function buildSsd() {
  const g = new THREE.Group();
  g.add(ex(box(8.0, 2.2, 0.08, M.pcbBlk()), [0, 0, -0.04], "Circuit board"));
  g.add(ex(box(1.5, 1.5, 0.16, M.chip(), -1.45, 0, 0.1), [0, 0.04, 0.2], "Controller"));
  g.add(ex(box(0.8, 0.9, 0.14, M.chip(), -0.2, 0.3, 0.1), [0, 0.14, 0.24], "Cache chip"));
  g.add(ex(box(1.7, 1.6, 0.16, M.chip(), 1.0, 0, 0.1), [0, 0, 0.2], "Flash chips"));
  g.add(ex(box(1.7, 1.6, 0.16, M.chip(), 2.95, 0, 0.1), [0, 0, 0.2]));
  const label = box(4.2, 1.7, 0.01, M.white(), 1.6, 0, 0.19);
  label.material.transparent = true;
  label.material.opacity = 0.18;
  g.add(ex(label, [0, 0, 0.36], "Label sticker"));
  const pins = [];
  for (let i = 0; i < 30; i++) {
    const y = -0.95 + i * 0.066;
    if (Math.abs(y - 0.45) < 0.1) continue;
    pins.push([0.4, 0.04, 0.1, -3.82, y, 0]);
  }
  g.add(boxes(pins, M.gold()));
  const notch = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 24, Math.PI), M.gold());
  notch.position.set(3.95, 0, 0);
  notch.rotation.z = Math.PI / 2;
  g.add(notch);
  return g;
}

export function buildCooler() {
  const g = new THREE.Group();
  const finMat = M.alu();
  const fins = [];
  for (let i = 0; i < 34; i++) fins.push([11.5, 0.06, 5.2, 0, -5.5 + i * 0.36, -0.4]);
  const finStack = boxes(fins, finMat);
  finStack.userData.dense = true;
  g.add(ex(finStack, [0, 0.03, -0.1], "Fin stack"));
  g.add(ex(box(11.8, 0.4, 5.4, M.steel(), 0, 6.8, -0.4), [0, 0.16, -0.1], "Top cover"));
  const pipeMat = M.copper();
  for (let i = 0; i < 4; i++) {
    const x = -2.4 + i * 1.6;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x - 0.9, 6.4, -0.4), new THREE.Vector3(x - 0.9, -6.4, -0.4),
      new THREE.Vector3(x, -7.6, -0.4), new THREE.Vector3(x + 0.9, -6.4, -0.4), new THREE.Vector3(x + 0.9, 6.4, -0.4),
    ]);
    g.add(ex(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.28, 10, false), pipeMat), [0, -0.06, 0.04], i === 0 ? "Heat pipes" : undefined));
  }
  g.add(ex(box(4.6, 0.9, 4.0, pipeMat, 0, -7.9, -0.4), [0, -0.16, 0.04], "Copper base"));
  const frame = new THREE.Mesh(
    new THREE.ExtrudeGeometry((() => {
      const s = new THREE.Shape(); s.moveTo(-6, -6); s.lineTo(6, -6); s.lineTo(6, 6); s.lineTo(-6, 6); s.lineTo(-6, -6);
      const h = new THREE.Path(); h.absarc(0, 0, 5.6, 0, Math.PI * 2, true); s.holes.push(h); return s;
    })(), { depth: 1.2, bevelEnabled: false }),
    M.plastic());
  frame.position.set(0, 0.3, 2.3);
  g.add(ex(frame, [0, 0, 0.2], "Fan frame"));
  const f = fan(5.4, 9);
  f.position.set(0, 0.3, 2.9);
  g.add(ex(f, [0, 0, 0.36], "Fan"));
  g.userData.fans = [f];
  return g;
}

export function buildPsu() {
  const g = new THREE.Group();
  const steel = M.steel();
  g.add(ex(box(15, 8.6, 14, steel), [0, -0.04, 0], "Steel case"));
  const grille = new THREE.Group();
  for (let r = 1; r <= 6; r++) grille.add(new THREE.Mesh(new THREE.TorusGeometry(r * 0.95, 0.07, 6, 64), M.alu()));
  grille.rotation.x = Math.PI / 2;
  grille.position.set(0, 4.36, 0);
  g.add(ex(grille, [0, 0.44, 0], "Fan grille"));
  const hole = new THREE.Mesh(new THREE.CircleGeometry(6.2, 64), M.plastic());
  hole.rotation.x = -Math.PI / 2;
  hole.position.set(0, 4.31, 0);
  g.add(ex(hole, [0, 0.12, 0]));
  const f = fan(5.8, 9, M.plastic());
  f.rotation.x = -Math.PI / 2;
  f.position.set(0, 4.0, 0);
  g.add(ex(f, [0, 0.28, 0], "Fan"));
  g.userData.fans = [f];
  const vents = [];
  for (let row = 0; row < 7; row++) for (let col = 0; col < 13; col++) {
    const x = 0.8 + col * 0.5 + (row % 2) * 0.25, y = -2.8 + row * 0.75;
    vents.push([0.32, 0.5, 0.06, x, y, 7.02]);
  }
  const vent = boxes(vents, M.plastic());
  vent.userData.dense = true;
  g.add(ex(vent, [0, 0, 0.22], "Exhaust vent"));
  g.add(ex(box(2.4, 1.6, 0.3, M.chip(), -4.4, 0.9, 7.05), [-0.06, 0.04, 0.3], "Wall socket"));
  g.add(ex(box(0.9, 1.4, 0.35, M.chip(), -4.4, -1.5, 7.05), [-0.06, -0.04, 0.3], "Switch"));
  const cableMat = M.chip();
  for (let i = 0; i < 6; i++) {
    const y = -2.5 + i * 0.75;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(7.5, y, 2), new THREE.Vector3(9.5, y - 0.4, 2.5), new THREE.Vector3(11, y - 1.8, 1.0), new THREE.Vector3(11.8, y - 3.5, -1.5),
    ]);
    g.add(ex(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.22, 8, false), cableMat), [0.3, 0, 0], i === 0 ? "Output cables" : undefined));
  }
  g.add(ex(box(0.6, 5.2, 3.2, M.plastic(), 7.6, -0.6, 2), [0.2, 0, 0], "Cable plate"));
  return g;
}

export const PROCEDURAL = { ram: buildRam, ssd: buildSsd, cooler: buildCooler, psu: buildPsu };
