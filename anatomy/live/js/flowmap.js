/* Power and data paths as real wiring, shared by the live build and the prototype.
   A part's `flows` names its real components (nodes) and joins them with links:

     flows: {
       nodes: {
         eps: { at: [-0.24, 0.46], label: "8-pin EPS", note: "12 V" },
         cpu: { mat: "CPU_BaseM", label: "CPU", simple: "Brain", note: { power: "≈1.2 V", data: "LGA1151" } },
       },
       power: [["eps", "vrm", 3], …],                                        // [from, to, count, options]
       data:  [["cpu", "dimm", 4, { kind: "ddr", both: true, label: "DDR4" }], …],
       plane: -0.46,     // the circuit board's surface, as a depth in box fractions (default: the part's front face)
       normal: [0, 1, 0],// the way the copper faces (default +z, toward the viewer)
       inside: true,     // keep nodes at their own 3D positions instead of laying them on the board plane
       boards: [{ at: [0, -0.2, 0], size: [0.8, 0.7] }],   // a bare circuit board to lay copper on, where the model has none
     }

   Link kinds, as a real board or harness would carry them:
     pour   power through a wide copper pour (the default for power)
     trace  thin copper traces with 45° bends (the default for data); count = traces
     pairs  differential pairs (PCIe, DMI, USB, SATA…); count = pairs
     ddr    a length-matched bus: traces with serpentine meanders
     cable  an insulated harness from harness.js: { harness: "atx24", plug: "to" | "from" | "both", axis: "x" | "y", via: [[x, y, z?]…] }
     field  an isolation gap (a transformer, an opto-coupler): broken copper that the pulse jumps across
   Options: both (pulses run both ways), label (a bus or rail name on the route), fade ("from" | "to": the cable's free end fades out).
   A node is placed by `node` (a named object in the model), `mat` (a material's centre), `mix: [nodeA, nodeB, t]`
   or `at: [x, y, z?]` in box fractions; `off: [x, y, z]` nudges it. A node without a label is a plain endpoint.
   The flow shows as light travelling inside the copper or the insulation. Entering a view, each link draws itself on from
   its upstream end, in the order listed (uniforms.uGrow: seconds since the view's wiring appeared). */
import { HARNESS, INSULATION } from "./harness.js";
import { REAL_MM } from "./parts.js";

export function buildFlowGraph(THREE, rig, flows, mode, { color, uniforms, mirrorY = false } = {}) {
  const V = THREE.Vector3;
  const g = new THREE.Group();
  g.userData.nodes = [];
  const links = flows?.[mode];
  if (!links?.length) return g;
  const B = rig.box, S = Math.max(B.x, B.y, B.z);
  const SP = S * (mode === "data" ? 0.08 : 0.22);   // distance between packets
  const mm = S / (REAL_MM[rig.part.id] || 300);   // scene units per real millimetre, for cables and connectors
  const k = mirrorY ? -1 : 1;   // a part shown upside down mirrors its box fractions top-to-bottom and front-to-back
  const N = new V(...(flows.normal || [0, 0, 1]));
  const front = flows.plane != null ? k * flows.plane * B.z : B.z * 0.5 + 0.02;
  const frac = (f) => new V(f[0] * B.x, k * f[1] * B.y, k * (f[2] ?? 0) * B.z);
  const M = materials(THREE, color, uniforms, mode);
  const pads = [], caps = [];

  const used = new Map();
  const point = (key, quiet = false) => {
    if (used.has(key)) return used.get(key);
    const n = flows.nodes[key];
    if (!n) throw new Error(`flow node "${key}" is not defined for ${rig.part.id}`);
    let p = null;
    if (n.node && rig.nodePoints[n.node]) p = rig.nodePoints[n.node].clone();
    else if (n.mat && rig.matBoxes?.[n.mat]) p = rig.inner.worldToLocal(rig.matBoxes[n.mat].getCenter(new V()));
    else if (n.mix && rig.nodePoints[n.mix[0]] && rig.nodePoints[n.mix[1]]) p = rig.nodePoints[n.mix[0]].clone().lerp(rig.nodePoints[n.mix[1]], n.mix[2] ?? 0.5);
    if (!p) { p = frac(n.at || [0, 0]); if (n.at?.[2] == null) p.z = front; }
    if (n.off) p.add(frac(n.off));
    if (!flows.inside) p.z = front;
    const note = typeof n.note === "object" ? n.note[mode] || "" : n.note || "";
    const out = { key, label: n.label || "", simple: n.simple || n.label || "", note, p };
    if (quiet) return out;
    used.set(key, out);
    g.userData.nodes.push(out);
    return out;
  };
  const busLabel = (a, b, text, p) => text && g.userData.nodes.push({ key: `${a}>${b}`, bus: true, label: text, simple: "", note: "", p });

  for (const bd of flows.boards || []) {
    const geo = new THREE.BoxGeometry(bd.size[0] * B.x, 0.012 * S, bd.size[1] * B.z);
    flowAttr(geo, () => [0, 0, 0, 1]);
    const m = new THREE.Mesh(geo, M.mask);
    m.position.copy(frac(bd.at)).addScaledVector(N, -0.007 * S);
    g.add(m);
  }

  const grow = (li) => [Math.min(li * 0.16, 2.4), 0.85];   // [start, duration] in seconds
  links.forEach(([a, b, count = 3, opt = {}], li) => {
    const A = point(a).p, Bp = point(b).p;
    const kind = opt.kind || (mode === "power" ? "pour" : "trace");
    if (kind === "cable") { buildCable(a, b, A, Bp, opt, li); return; }

    // copper on the board: a right-angle route with 45° corners, then one offset copy per trace
    const centre = chamfer(manhattan(A, Bp), S * 0.022);
    if (centre.length < 2) return;
    busLabel(a, b, opt.label, longestMid(centre));
    const seed = (li * 0.37) % 1, lift = 1 + (li % 9) * 0.06;
    if (kind === "field") {
      const hw = S * 0.0045;
      for (const piece of dashes(centre, S * 0.012, S * 0.014)) g.add(new THREE.Mesh(strip(THREE, piece.pts, N, hw, S * 0.0005 * lift, (s) => [(s + piece.at) / SP, seed, 1, 0.75], false, [grow(li)[0] + 0.4, 0.4]), M.pour));
      return;
    }
    if (kind === "pour") {
      const hw = S * (0.0035 + 0.0016 * Math.min(count, 6));
      g.add(new THREE.Mesh(strip(THREE, centre, N, hw, S * 0.0005 * lift, (s) => [s / SP, seed, 0.85, 1], opt.both, grow(li)), M.pour));
      caps.push([centre[0], hw * 1.15], [centre[centre.length - 1], hw * 1.15]);
      return;
    }
    const offs = [];
    if (kind === "pairs") {
      const pitch = S * 0.011, inner = S * 0.0034;
      for (let p = 0; p < count; p++) for (const m of [-0.5, 0.5]) offs.push((p - (count - 1) / 2) * pitch + m * inner);
    } else {
      const gap = S * (kind === "ddr" ? 0.0078 : 0.0055);
      for (let i = 0; i < count; i++) offs.push((i - (count - 1) / 2) * gap);
    }
    const hw = S * 0.0012;
    offs.forEach((o, i) => {
      let route = offset(centre, N, o);
      // a length-matched bus: the inside traces of a bend are shorter, so they wiggle to catch up
      if (kind === "ddr" && i % 2 === 0) route = meander(route, N, S * 0.0026);
      const rev = opt.both && (kind === "pairs" ? Math.floor(i / 2) % 2 : i % 2);
      g.add(new THREE.Mesh(strip(THREE, route, N, hw, S * 0.0007 * lift, (s) => [s / SP, (seed + i * 0.11) % 1, 1, 1], rev, grow(li)), M.copper));
      pads.push(route[0], route[route.length - 1]);
    });
  });

  // cables are physical: one that only carries the other view's flow is still there, unlit and unlabelled
  const here = new Set(links.filter((l) => l[3]?.kind === "cable").map((l) => `${l[0]}>${l[1]}>${l[3].harness}`));
  (flows[mode === "power" ? "data" : "power"] || []).forEach(([a, b, , opt = {}]) => {
    if (opt.kind !== "cable" || here.has(`${a}>${b}>${opt.harness}`)) return;
    here.add(`${a}>${b}>${opt.harness}`);
    buildCable(a, b, point(a, true).p, point(b, true).p, { ...opt, label: "" }, 0, true);
  });

  // gold-finished pads where traces land, and rounded ends on the pours
  if (pads.length) addDiscs(pads.map((p) => [p, S * 0.0029]), M.pad, S * 0.0009);
  if (caps.length) addDiscs(caps, M.pour, S * 0.0005);
  return g;

  function addDiscs(list, mat, h) {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 18);
    flowAttr(geo, () => [0, 0, 0, 1]);
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    const q = new THREE.Quaternion().setFromUnitVectors(new V(0, 1, 0), N), mtx = new THREE.Matrix4();
    list.forEach(([p, r], i) => inst.setMatrixAt(i, mtx.compose(p.clone().addScaledVector(N, h / 2), q, new V(r, h, r))));
    g.add(inst);
  }

  // an insulated harness: conductors laid side by side in the connector's rows, drawn through smooth control points
  function buildCable(a, b, A, Bp, opt, li, rest = false) {
    const H = HARNESS[opt.harness];
    const od = H.od * mm, hh = (H.housing || 0) * mm, lift = S * 0.04;
    const plugA = opt.plug === "from" || opt.plug === "both", plugB = opt.plug === "to" || opt.plug === "both";
    const O = opt.out ? new V(opt.out[0], k * opt.out[1], k * (opt.out[2] || 0)).normalize() : N;   // the way the plug faces
    const ctrl = [];
    if (plugA) ctrl.push(A.clone().addScaledVector(O, hh), A.clone().addScaledVector(O, hh + lift)); else ctrl.push(A.clone());
    for (const v of opt.via || []) { const p = frac(v); if (v[2] == null) p.z = front; ctrl.push(v[2] == null ? p.addScaledVector(N, lift) : p); }
    if (plugB) ctrl.push(Bp.clone().addScaledVector(O, hh + lift), Bp.clone().addScaledVector(O, hh)); else ctrl.push(Bp.clone());
    const curve = new THREE.CatmullRomCurve3(ctrl, false, "centripetal");
    const SEG = 96, pts = curve.getSpacedPoints(SEG), len = curve.getLength();
    busLabel(a, b, opt.label, curve.getPointAt(0.5));
    // parallel-transported frame, starting with the connector's long side
    const axis = { x: new V(1, 0, 0), y: new V(0, 1, 0), z: new V(0, 0, 1) }[opt.axis || "x"];
    const T = pts.map((p, i) => pts[Math.min(i + 1, SEG)].clone().sub(pts[Math.max(i - 1, 0)]).normalize());
    let n = axis.clone().addScaledVector(T[0], -axis.dot(T[0]));
    if (n.lengthSq() < 1e-6) n = new V(0, 0, 1).cross(T[0]);
    n.normalize();
    const frames = T.map((t) => { n = n.addScaledVector(t, -n.dot(t)).normalize(); return [n.clone(), new V().crossVectors(t, n)]; });
    const cols = Math.ceil(H.pins.length / H.rows), pitch = od * 1.06;
    H.pins.forEach((pin, idx) => pin && conductor(pin, idx, 0, 1));
    // a second wire crimped into the same pin (e.g. the 24-pin's 3.3 V sense lead), tucked beside the first
    for (const [idx, pin, scale] of H.extras || []) conductor(pin, idx, od * (0.5 + scale / 2), scale);
    function conductor(pin, idx, nudge, scale) {
      const [, col, role, dir] = pin;
      const cx = (idx % cols - (cols - 1) / 2) * pitch + nudge, cy = (Math.floor(idx / cols) - (H.rows - 1) / 2) * pitch + nudge * 0.6;
      const route = pts.map((p, j) => {
        const tw = H.twist ? (j / SEG) * len / S * H.twist : 0, c = Math.cos(tw), s = Math.sin(tw);
        const [fn, fb] = frames[j];
        return p.clone().addScaledVector(fn, cx * c - cy * s).addScaledVector(fb, cx * s + cy * c);
      });
      const live = mode === "power" ? (role === "p" ? 1 : role === "g" ? 0.45 : 0) : role === "d" ? 1 : 0;
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(route), SEG, od / 2 * scale, H.jacket ? 14 : 9, false);
      const uv = geo.attributes.uv, [g0, gd] = grow(li);
      flowAttr(geo, (i) => {
        const u = uv.getX(i), d = dir < 0 ? 1 - u : u;
        return [d * len / SP, (li * 0.29 + idx * 0.07) % 1, rest ? 0 : live, opt.fade ? smooth(0, 0.22, opt.fade === "from" ? u : 1 - u) : 1];
      }, (i) => g0 + uv.getX(i) * gd * 1.3);
      g.add(new THREE.Mesh(geo, M.insulation(col === "jacket" ? INSULATION.jacket : INSULATION[col])));
    }
    // connector housings at the plugged ends
    const w = H.jacket ? od * 2.4 : cols * H.pitch * mm + 1.8 * mm, d = H.jacket ? od * 1.5 : H.rows * H.pitch * mm + 1.8 * mm;
    const [g0, gd] = grow(li);
    for (const [on, at, when] of [[plugA, A, g0], [plugB, Bp, g0 + gd * 1.3]]) {
      if (!on) continue;
      const geo = new THREE.BoxGeometry(w, d, hh);
      flowAttr(geo, () => [0, 0, 0, 1], () => when);
      const box = new THREE.Mesh(geo, M.housing(H.color));
      const x = axis.clone().addScaledVector(O, -axis.dot(O)).normalize(), y = new V().crossVectors(O, x);
      box.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, O));
      box.position.copy(at).addScaledVector(O, hh / 2);
      g.add(box);
    }
  }
}

// ---------- materials: physically based, with the flow as light travelling inside ----------
function materials(THREE, color, uniforms, mode) {
  const flow = new THREE.Color(color), one = { value: 1 }, never = { value: 1e4 };
  // packets: power swells slowly like DC, data runs in short crisp packets (spacing set where aFlow is written)
  const speed = { value: mode === "data" ? 2.75 : 0.73 }, width = { value: mode === "data" ? 0.07 : 0.16 };
  const make = (params) => {
    const m = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, transparent: true, ...params });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uTime: uniforms.uTime, uFade: uniforms.uOpacity || one, uGrow: uniforms.uGrow || never, uFlow: { value: flow }, uSpeed: speed, uWidth: width });
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec4 aFlow;\nattribute float aGrow;\nvarying vec4 vFlow;\nvarying float vGrow;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFlow = aFlow;\nvGrow = aGrow;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uTime, uFade, uGrow, uSpeed, uWidth;\nuniform vec3 uFlow;\nvarying vec4 vFlow;\nvarying float vGrow;")
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
          float px = fract(vFlow.x - uTime * uSpeed + vFlow.y) - 0.5;
          float pulse = exp(-px * px / (uWidth * uWidth));
          float shown = smoothstep(vGrow - 0.04, vGrow + 0.02, uGrow);
          float head = shown * (1.0 - smoothstep(0.0, 0.35, uGrow - vGrow));
          totalEmissiveRadiance += uFlow * ((pulse * 2.6 + 0.06) * vFlow.z + head * 2.2);`)
        .replace("#include <dithering_fragment>", "#include <dithering_fragment>\ngl_FragColor.a *= uFade * vFlow.w * shown;");
    };
    m.customProgramCacheKey = () => "aoc-wire";
    return m;
  };
  const cache = new Map();
  const once = (key, params) => cache.get(key) || cache.set(key, make(params)).get(key);
  return {
    // copper dimmed against the studio environment so it reads as copper, not as a white highlight
    copper: make({ color: "#b0653a", metalness: 1, roughness: 0.42, envMapIntensity: 0.42 }),
    pour: make({ color: "#9b5830", metalness: 1, roughness: 0.5, envMapIntensity: 0.38 }),
    pad: make({ color: "#d4a752", metalness: 1, roughness: 0.3, envMapIntensity: 0.6 }),   // ENIG gold finish
    mask: make({ color: "#0a2c1c", metalness: 0, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.35, envMapIntensity: 0.35, opacity: 0.82 }),
    insulation: (c) => once(`pvc${c}`, { color: c, metalness: 0, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.35, envMapIntensity: 0.8 }),
    housing: (c) => once(`nylon${c}`, { color: c, metalness: 0, roughness: 0.58, envMapIntensity: 0.6 }),
  };
}

// every wire mesh carries aFlow = (distance in pulse lengths, phase seed, glow strength, fade) and aGrow = when it appears
function flowAttr(geo, fn, growFn = () => 0) {
  const n = geo.attributes.position.count, a = new Float32Array(n * 4), gr = new Float32Array(n);
  for (let i = 0; i < n; i++) { a.set(fn(i), i * 4); gr[i] = growFn(i); }
  geo.setAttribute("aFlow", new geo.attributes.position.constructor(a, 4));
  geo.setAttribute("aGrow", new geo.attributes.position.constructor(gr, 1));
}
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// a flat copper strip along a polyline: top face plus two edges, mitred at the corners
function strip(THREE, pts, N, hw, h, flowAt, reverse, [g0, gd] = [0, 0]) {
  const n = pts.length;
  const along = [0];
  for (let i = 1; i < n; i++) along.push(along[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = along[n - 1];
  const mit = miters(THREE.Vector3, pts, N);
  const pos = [], nor = [], flw = [], grw = [], idx = [];
  const up = N.clone().multiplyScalar(h);
  const face = (va, vb, na, nb) => {
    const base = pos.length / 3;
    for (let i = 0; i < n; i++) {
      const f = flowAt(reverse ? total - along[i] : along[i]);
      const gt = g0 + (along[i] / total) * gd;
      for (const [v, nn] of [[va(i), na(i)], [vb(i), nb(i)]]) { pos.push(v.x, v.y, v.z); nor.push(nn.x, nn.y, nn.z); flw.push(...f); grw.push(gt); }
      if (i < n - 1) idx.push(base + 2 * i, base + 2 * i + 1, base + 2 * i + 2, base + 2 * i + 1, base + 2 * i + 3, base + 2 * i + 2);
    }
  };
  const L = (i) => pts[i].clone().addScaledVector(mit[i], hw), R = (i) => pts[i].clone().addScaledVector(mit[i], -hw);
  const side = (i) => mit[i].clone().normalize();
  face((i) => L(i).add(up), (i) => R(i).add(up), () => N, () => N);
  face((i) => L(i), (i) => L(i).add(up), side, side);
  face((i) => R(i).add(up), (i) => R(i), (i) => side(i).negate(), (i) => side(i).negate());
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("aFlow", new THREE.Float32BufferAttribute(flw, 4));
  geo.setAttribute("aGrow", new THREE.Float32BufferAttribute(grw, 1));
  geo.setIndex(idx);
  return geo;
}

// in-plane perpendicular at each vertex, lengthened at corners so offset copies stay parallel
function miters(V, pts, N) {
  const n = pts.length;
  return pts.map((p, i) => {
    const s0 = i > 0 ? new V().crossVectors(N, p.clone().sub(pts[i - 1])).normalize() : null;
    const s1 = i < n - 1 ? new V().crossVectors(N, pts[i + 1].clone().sub(p)).normalize() : null;
    if (!s0 || s0.lengthSq() < 1e-6) return s1 && s1.lengthSq() > 1e-6 ? s1 : new V(1, 0, 0);
    if (!s1 || s1.lengthSq() < 1e-6) return s0;
    const m = s0.clone().add(s1);
    if (m.lengthSq() < 1e-6) return s1;
    m.normalize();
    return m.multiplyScalar(1 / Math.max(0.5, m.dot(s1)));
  });
}
function offset(pts, N, d) {
  const mit = miters(pts[0].constructor, pts, N);
  return pts.map((p, i) => p.clone().addScaledVector(mit[i], d));
}

// right-angle route, longest leg first, like traces on a circuit board
function manhattan(a, b) {
  const d = b.clone().sub(a);
  const axes = ["x", "y", "z"].sort((p, q) => Math.abs(d[q]) - Math.abs(d[p]));
  const pts = [a.clone()];
  const cur = a.clone();
  for (const ax of axes) {
    if (Math.abs(d[ax]) < 1e-4) continue;
    cur[ax] = b[ax];
    pts.push(cur.clone());
  }
  return pts;
}
// cut every corner at 45°, the way boards are routed
function chamfer(pts, c) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], p = pts[i], b = pts[i + 1];
    const l0 = a.distanceTo(p), l1 = p.distanceTo(b), cc = Math.min(c, l0 * 0.45, l1 * 0.45);
    out.push(p.clone().lerp(a, cc / l0), p.clone().lerp(b, cc / l1));
  }
  out.push(pts[pts.length - 1]);
  return out;
}
// trapezoid meanders on the middle of the longest leg (length matching)
function meander(pts, N, amp) {
  let best = 0, L = 0;
  for (let i = 0; i < pts.length - 1; i++) { const l = pts[i].distanceTo(pts[i + 1]); if (l > L) { L = l; best = i; } }
  const a = pts[best], d = pts[best + 1].clone().sub(a).normalize(), s = N.clone().cross(d).normalize();
  const q = amp, period = 8 * q, start = L * 0.3, count = Math.floor((L * 0.4) / period);
  if (count < 1) return pts;
  const at = (x, y) => a.clone().addScaledVector(d, x).addScaledVector(s, y);
  const mid = [];
  for (let j = 0; j < count; j++) {
    const x = start + j * period;
    mid.push(at(x, 0), at(x + q, amp), at(x + 3 * q, amp), at(x + 5 * q, -amp), at(x + 7 * q, -amp));
  }
  mid.push(at(start + count * period, 0));
  return [...pts.slice(0, best + 1), ...mid, ...pts.slice(best + 1)];
}
// cut a polyline into dashes: [{ pts, at (distance from the start) }]
function dashes(pts, on, off) {
  const out = [];
  let acc = 0, cur = null, phase = 0, drawing = true;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = a.distanceTo(b);
    let t = 0;
    while (t < L) {
      const left = (drawing ? on : off) - phase, step = Math.min(left, L - t);
      const p0 = a.clone().lerp(b, t / L), p1 = a.clone().lerp(b, (t + step) / L);
      if (drawing) { if (!cur) { cur = { pts: [p0], at: acc + t }; out.push(cur); } cur.pts.push(p1); }
      t += step; phase += step;
      if (phase >= (drawing ? on : off) - 1e-6) { phase = 0; drawing = !drawing; if (!drawing) cur = null; }
    }
    acc += L;
  }
  return out.filter((d) => d.pts.length > 1);
}
function longestMid(pts) {
  let best = 0, mid = pts[0];
  for (let s = 0; s < pts.length - 1; s++) {
    const d = pts[s].distanceTo(pts[s + 1]);
    if (d > best) { best = d; mid = pts[s].clone().lerp(pts[s + 1], 0.5); }
  }
  return mid;
}

/* Component labels for a part's current graph: project each node, then push overlapping labels apart.
   simple: plain names only (no notes or bus names), matching the site's plain-language setting.
   avoid: on-screen circles [{ x, y, r }] the labels must not cover, such as hotspot rings. */
export function placeFlowLabels(THREE, layer, graph, inner, camera, w, h, simple = false, avoid = []) {
  const shown = (graph?.userData.nodes || []).filter((n) => (simple ? !n.bus && n.simple : n.label));
  const key = graph && `${graph.uuid}${simple}`;
  if (layer._key !== key) {
    layer._key = key;
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    layer.innerHTML = shown.map((n) => n.bus
      ? `<span class="flowlabel flowlabel--bus">${esc(n.label)}</span>`
      : `<span class="flowlabel"><b>${esc(simple ? n.simple : n.label)}</b>${!simple && n.note ? `<em>${esc(n.note)}</em>` : ""}</span>`).join("");
    layer._size = null;
  }
  if (!shown.length) return;
  // measure once per label set (offsetWidth forces layout)
  layer._size ||= [...layer.children].map((el) => [el.offsetWidth, el.offsetHeight]);
  const v = new THREE.Vector3();
  const pos = shown.map((n, i) => {
    v.copy(n.p); inner.localToWorld(v).project(camera);
    const [lw, lh] = layer._size[i];
    // components: label sits above its point; bus names sit centred on their route
    return { el: layer.children[i], x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h - (n.bus ? 0 : lh / 2 + 9), w: lw + 6, h: lh + 2 };
  });
  for (let pass = 0; pass < 10; pass++) {
    let moved = false;
    // rings stay put: a label overlapping one moves all the way off it, along the shorter way out
    for (const A of pos) for (const o of avoid) {
      const ox = A.w / 2 + o.r - Math.abs(A.x - o.x), oy = A.h / 2 + o.r - Math.abs(A.y - o.y);
      if (ox <= 0 || oy <= 0) continue;
      moved = true;
      if (oy < ox) A.y += (A.y >= o.y ? 1 : -1) * oy; else A.x += (A.x >= o.x ? 1 : -1) * ox;
    }
    for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
      const A = pos[i], C = pos[j];
      const ox = (A.w + C.w) / 2 - Math.abs(A.x - C.x), oy = (A.h + C.h) / 2 - Math.abs(A.y - C.y);
      if (ox <= 0 || oy <= 0) continue;
      moved = true;
      // separate along the cheaper axis
      if (oy < ox) { const s = (C.y >= A.y ? 1 : -1) * oy / 2; A.y -= s; C.y += s; }
      else { const s = (C.x >= A.x ? 1 : -1) * ox / 2; A.x -= s; C.x += s; }
    }
    if (!moved) break;
  }
  for (const p of pos) p.el.style.transform = `translate(${(p.x - p.w / 2 + 3).toFixed(1)}px, ${(p.y - p.h / 2 + 1).toFixed(1)}px)`;
}
