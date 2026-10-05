#!/usr/bin/env node
/**
 * Derives orientation, part geometry and exploded-view offsets from the
 * shipped GLB, so nothing about how the model is laid out is eyeballed.
 *
 *   node scripts/derive-beaver-cad.mjs [models/beaver-meshopt.glb] [beaver-cad.json]
 *
 * Run by scripts/build-beaver-full.mjs whenever the CAD changes.
 *
 * Output is in the RIFLE FRAME, millimetres, as [forward, up, right]:
 *   forward  toward the muzzle
 *   up       toward the top rail
 *   right    forward x up, so the frame is never mirrored
 */
import { readFileSync, writeFileSync } from "node:fs";

/* The upper receiver group. Anything else in the file (lower, stock, their
   pins and springs) is an "extra": it explodes with the rest
   on the first scroll, flies out and does not return. Repeated fasteners share
   one name across many nodes. */
const UPPER = new Set([
  "Charging Handle","Barrel Nut","Gas Tube","Valve Detent Pin","Gas Block","Gas Block Nut","Piston Sleeve",
  "Valve Detent Spring","Piston Spring","Seal Bump","Piston Spring Socket","Gas Block Bottom Screw","Gas Piston",
  "Gas Valve","Gas Lock Pin","Valve Detent Pin Lock",'13.7" Barrel',"Recoil Spring","Bolt Carrier #1",
  "Recoil Buffer Pin","Bolt Carrier #2","Recoil Balls","Recoil Buffer","Bolt","Gun Powder - TVCM 6.8mm",
  "Insert - TVCM 6.8mm","Primer Outer - TVCM 6.8mm","Primer Inner - TVCM 6.8mm","Casing - TVCM 6.8mm",
  "Bullet - TVCM 6.8mm","Firing Pin","Firing Pin Lock Plate","Upper Reciever","Handguard Top Screw",
  "Charging Handle Buffer","Bottom Handguard Screw","Bottom Side Insert Scew","Picatinny Top Rail","Handguard",
  "Charging Handle Insert","M5 Insert","Handguard Side Insert","Top Rail Screw","Cam",
  "Barrel Connection Indexer","Barrel Extention","Barrel Liner",
]);
const isUpper = (n) => UPPER.has(n);

const input = process.argv[2] ?? "models/beaver-meshopt.glb";
const output = process.argv[3] ?? "beaver-cad.json";

const glb = readFileSync(input);
const jsonLen = glb.readUInt32LE(12);
const gltf = JSON.parse(glb.subarray(20, 20 + jsonLen).toString("utf8"));
const binOffset = 20 + jsonLen + 8;

/* 4x4 column-major math -------------------------------------------------- */

const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function multiply(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
}

function compose(t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]) {
  const [x, y, z, w] = q;
  return [
    (1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + w * z) * s[0], 2 * (x * z - w * y) * s[0], 0,
    2 * (x * y - w * z) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + w * x) * s[1], 0,
    2 * (x * z + w * y) * s[2], 2 * (y * z - w * x) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}

const apply = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];

const localMatrix = (n) => n.matrix ?? compose(n.translation, n.rotation, n.scale);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const round = (v) => Math.round(v);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const avg = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;

/* Boxes ------------------------------------------------------------------- */

const emptyBox = () => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
const isEmpty = (b) => b.min[0] === Infinity;
const centerOf = (b) => b.min.map((v, i) => (v + b.max[i]) / 2);

function expand(box, p) {
  for (let i = 0; i < 3; i++) {
    box.min[i] = Math.min(box.min[i], p[i]);
    box.max[i] = Math.max(box.max[i], p[i]);
  }
}

function expandCorners(box, m, min, max) {
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]])
      for (const z of [min[2], max[2]]) expand(box, apply(m, [x, y, z]));
}

function readVec3(accessorIndex) {
  const acc = gltf.accessors[accessorIndex];
  if (acc.sparse || acc.componentType !== 5126 || acc.type !== "VEC3") return null;
  const view = gltf.bufferViews[acc.bufferView];
  const stride = view.byteStride ?? 12;
  const base = binOffset + (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const out = [];
  for (let i = 0; i < acc.count; i++) {
    const o = base + i * stride;
    out.push([glb.readFloatLE(o), glb.readFloatLE(o + 4), glb.readFloatLE(o + 8)]);
  }
  return out;
}

/* World transforms -------------------------------------------------------- */

const parentOf = new Map();
gltf.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parentOf.set(c, i)));

const world = new Map();
(function walk(indices, parentM) {
  for (const i of indices) {
    const m = multiply(parentM, localMatrix(gltf.nodes[i]));
    world.set(i, m);
    walk(gltf.nodes[i].children ?? [], m);
  }
})(gltf.scenes[gltf.scene ?? 0].nodes, identity());

function nodeBox(i) {
  const node = gltf.nodes[i];
  const box = emptyBox();
  if (node.mesh === undefined) return box;
  const local = emptyBox();
  for (const prim of gltf.meshes[node.mesh].primitives) {
    const acc = gltf.accessors[prim.attributes.POSITION];
    expand(local, acc.min);
    expand(local, acc.max);
  }
  const inst = node.extensions?.EXT_mesh_gpu_instancing?.attributes?.TRANSLATION;
  const offsets = inst !== undefined ? readVec3(inst) : null;
  for (const t of offsets ?? [[0, 0, 0]]) {
    expandCorners(box, multiply(world.get(i), compose(t)), local.min, local.max);
  }
  return box;
}

function namedAncestor(i) {
  for (let n = i; n !== undefined; n = parentOf.get(n)) {
    if (gltf.nodes[n].name) return gltf.nodes[n].name;
  }
  return null;
}

const cadParts = {};
// The frame and every camera shot are measured against the upper alone, so
// adding parts to the file never moves the shots. `everything` is the full box.
const overall = emptyBox();
const everything = emptyBox();
const instanced = [];

gltf.nodes.forEach((n, i) => {
  const b = nodeBox(i);
  if (isEmpty(b)) return;
  expand(everything, b.min);
  expand(everything, b.max);
  let name = namedAncestor(i);
  if (!name) {
    // join() collapses repeated fasteners into one unnamed instanced node.
    // GLTFLoader names that object after its mesh, so key it the same way.
    name = gltf.meshes[n.mesh]?.name || `node_${i}`;
    instanced.push(name);
  }
  if (isUpper(name)) {
    expand(overall, b.min);
    expand(overall, b.max);
  }
  cadParts[name] ??= emptyBox();
  expand(cadParts[name], b.min);
  expand(cadParts[name], b.max);
});

/* Orientation, from geometry ---------------------------------------------- */

const BARREL = '13.7" Barrel';
const RECEIVER = "Upper Reciever";
const RAIL = "Picatinny Top Rail";
const need = (name) => {
  if (!cadParts[name]) throw new Error(`Part not found in GLB: ${name}`);
  return cadParts[name];
};

const AXES = ["X", "Y", "Z"];
const extent = overall.max.map((v, i) => v - overall.min[i]);
const bore = extent.indexOf(Math.max(...extent));

const cBarrel = centerOf(need(BARREL));
const cReceiver = centerOf(need(RECEIVER));
const cRail = centerOf(need(RAIL));

// The barrel's centre sits forward of the receiver's centre, so that
// direction along the bore is toward the muzzle.
const forwardSign = Math.sign(cBarrel[bore] - cReceiver[bore]);

// The rail sits on top. Of the two remaining axes, up is the one the rail
// is displaced along from the barrel centreline.
const perp = [0, 1, 2].filter((a) => a !== bore);
const railDelta = cRail.map((v, i) => v - cBarrel[i]);
const upAxis =
  Math.abs(railDelta[perp[0]]) >= Math.abs(railDelta[perp[1]]) ? perp[0] : perp[1];
const upSign = Math.sign(railDelta[upAxis]);

const unit = (axis, sign) => [0, 1, 2].map((i) => (i === axis ? sign : 0));
const F = unit(bore, forwardSign);
const U = unit(upAxis, upSign);
const R = [F[1] * U[2] - F[2] * U[1], F[2] * U[0] - F[0] * U[2], F[0] * U[1] - F[1] * U[0]];
const origin = centerOf(overall);

const toRifle = (p) => {
  const q = p.map((v, i) => v - origin[i]);
  return [dot(q, F) * 1000, dot(q, U) * 1000, dot(q, R) * 1000];
};

function rifleBox(b) {
  const r = emptyBox();
  for (const x of [b.min[0], b.max[0]])
    for (const y of [b.min[1], b.max[1]])
      for (const z of [b.min[2], b.max[2]]) expand(r, toRifle([x, y, z]));
  return r;
}

const parts = {};
for (const [name, b] of Object.entries(cadParts)) {
  const r = rifleBox(b);
  parts[name] = {
    center: centerOf(r).map(round),
    size: r.max.map((v, i) => round(v - r.min[i])),
    min: r.min.map(round),
    max: r.max.map(round),
  };
}

const P = (name) => parts[name];
const sign = (v) => (v >= 0 ? "+" : "-");
const mm = (v) => `${Math.abs(round(v))} mm`;

const evidence = [
  `Bore axis is glTF ${AXES[bore]} (longest extent, ${mm(extent[bore] * 1000)}).`,
  `Muzzle points toward glTF ${sign(forwardSign)}${AXES[bore]}: barrel centre is ${mm((cBarrel[bore] - cReceiver[bore]) * 1000 * forwardSign)} forward of receiver centre.`,
  `Up is glTF ${sign(upSign)}${AXES[upAxis]}: rail centre is ${mm(railDelta[upAxis] * 1000 * upSign)} above barrel centreline.`,
  `Right is glTF ${R.map((v, i) => (v ? sign(v) + AXES[i] : "")).join("")} (forward x up, proper rotation, never mirrored).`,
];

const crossCheck = (name, axis, expect) => {
  if (!P(name)) return;
  const v = P(name).center[axis] - P(BARREL).center[axis];
  const behind = P(name).center[0] < P(RECEIVER).center[0];
  const ok = expect === "above" ? v > 0 : behind;
  const where =
    axis === 1
      ? `${mm(v)} ${v > 0 ? "above" : "below"} bore`
      : `${mm(P(name).center[0] - P(RECEIVER).center[0])} ${behind ? "behind" : "ahead of"} receiver centre`;
  evidence.push(`Cross-check ${name}: ${where} (${ok ? "consistent" : "INCONSISTENT"} with ${expect}).`);
};
crossCheck("Gas Block", 1, "above");
crossCheck("Charging Handle", 1, "above");
crossCheck("Recoil Spring", 0, "behind");

/* Groups ------------------------------------------------------------------ */

const BCG = [
  "Bolt", "Bolt Carrier #1", "Bolt Carrier #2", "Recoil Spring", "Recoil Buffer",
  "Recoil Buffer Pin", "Recoil Balls", "Firing Pin", "Firing Pin Lock Plate", "Cam",
].filter((n) => P(n));
const CARTRIDGE = Object.keys(parts).filter((n) => n.includes("TVCM"));
const GAS = Object.keys(parts).filter((n) => isUpper(n) && /Gas|Piston|Valve|Seal Bump/.test(n));

// Parts that ride on the rail: centred at or above the rail's underside and
// within its length. Picks up the rail screws, which lost their names in join().
const railBox = P(RAIL);
const RAIL_GROUP = Object.entries(parts)
  .filter(
    ([n, p]) =>
      isUpper(n) &&
      (n === RAIL ||
      (p.center[1] >= railBox.min[1] - 4 &&
        p.center[0] >= railBox.min[0] &&
        p.center[0] <= railBox.max[0] &&
        !BCG.includes(n) &&
        !GAS.includes(n) &&
        !CARTRIDGE.includes(n) &&
        // Sits high at the rear but belongs to the charging handle, not the rail.
        !n.startsWith("Charging Handle"))),
  )
  .map(([n]) => n);

/* Exploded view ----------------------------------------------------------- */

const boreU = P(BARREL).center[1];
const boreR = P(BARREL).center[2];
const pivotF = P(RECEIVER).center[0];

const bcgCenterF = avg(BCG.map((n) => P(n).center[0]));
const cartCenterF = avg(CARTRIDGE.map((n) => P(n).center[0]));
const gasCenterF = avg(GAS.map((n) => P(n).center[0]));

const bcgFront = Math.max(...BCG.map((n) => P(n).max[0]));
const receiverRear = P(RECEIVER).min[0];
const travel = {
  // Far enough rearward that the front of the carrier group clears the
  // back of the receiver.
  carrierRearward: round(bcgFront - receiverRear + 25),
  railLift: 70,
  // The bullet's tail clears the muzzle after this much travel, and it keeps
  // flying a further 500 mm so the camera can follow it out.
  bulletMuzzle: round(P(BARREL).max[0] - P("Bullet - TVCM 6.8mm").min[0]),
  bulletForward: round(P(BARREL).max[0] - P("Bullet - TVCM 6.8mm").min[0]) + 500,
};

const explode = {};
const extras = {};
// Fasteners that sit in another part travel with it, nudged clear of it.
const RIDES = {
  "Handguard Side Insert": ["Handguard", [0, -10, 0]],
  "Top Rail Screw": [RAIL, [0, 12, 0]],
};
for (const [name, p] of Object.entries(parts)) {
  if (!isUpper(name)) continue;
  if (RIDES[name]) continue; // resolved below, once its host has an offset
  const [cf, cu, cr] = p.center;
  const du = cu - boreU;
  const dr = cr - boreR;
  const radial = Math.hypot(du, dr);
  const cross = Math.max(p.size[1], p.size[2]);
  const enclosesBore =
    p.min[1] < boreU && p.max[1] > boreU && p.min[2] < boreR && p.max[2] > boreR &&
    cross > 30 && p.size[0] > 100;

  let off;
  if (name === RECEIVER) {
    off = [0, 0, 0]; // the anchor everything else leaves
  } else if (CARTRIDGE.includes(name)) {
    off = [(cf - cartCenterF) * 3, 25, 0];
  } else if (BCG.includes(name)) {
    off = [-travel.carrierRearward * 0.6 + (cf - bcgCenterF) * 0.6, 0, 0];
  } else if (GAS.includes(name)) {
    off = [(cf - gasCenterF) * 0.6, 40 + Math.max(0, du) * 1.5, dr * 1.5];
  } else if (enclosesBore) {
    off = [0, -(60 + Math.abs(du) * 1.5), 0]; // drops clear of the rail above
  } else if (radial < 12) {
    const a = (cf - pivotF) * 0.5;
    off = [Math.sign(a || 1) * Math.max(15, Math.abs(a)), 0, 0];
  } else {
    const mag = clamp(radial * 2.2, 35, 140);
    off = [(cf - pivotF) * 0.15, (du / radial) * mag, (dr / radial) * mag];
  }
  explode[name] = off.map(round);
}
for (const [name, [host, nudge]] of Object.entries(RIDES)) {
  if (parts[name] && explode[host]) explode[name] = explode[host].map((v, i) => round(v + nudge[i]));
}

/* Extras fly well past the exploded upper, so they read as leaving the frame.
   They start from where they sit and spread by their distance from their own
   group's centre, so a group fans out rather than sliding away as one lump.
   The 6.8 TVCM export has no magazine; the mag group stays for one that does. */
const STOCK_RE = /^Stock|STOCK|Buffer Tube/;
const MAG_RE = /MAGAZ|SPRING_MAG|^PRT_/;
const group = (n) => (STOCK_RE.test(n) ? "stock" : MAG_RE.test(n) ? "mag" : "lower");
const extraNames = Object.keys(parts).filter((n) => !isUpper(n));
const centre = {};
for (const g of ["stock", "mag", "lower"]) {
  const list = extraNames.filter((n) => group(n) === g);
  centre[g] = list.length ? [0, 1, 2].map((i) => avg(list.map((n) => parts[n].center[i]))) : [0, 0, 0];
}
for (const name of extraNames) {
  const [cf, cu, cr] = parts[name].center;
  const g = group(name);
  const [gf, gu, gr] = centre[g];
  let off;
  if (g === "stock") off = [-430 + (cf - gf) * 0.9, 240 + (cu - gu) * 1.4, (cr - gr) * 2];
  else if (g === "mag") off = [(cf - gf) * 0.8, -440 + (cu - gu) * 1.6, (cr - gr) * 2];
  else off = [(cf - gf) * 1.3, -300 + (cu - gu) * 1.2, (cr - gr) * 3.5 + Math.sign(cr - gr || 1) * 30];
  extras[name] = off.map(round);
}

/* Write ------------------------------------------------------------------- */

const overallRifle = rifleBox(overall);
const everythingRifle = rifleBox(everything);

const result = {
  source: input,
  units: "millimetres, rifle frame [forward, up, right]",
  frame: { forward: F, up: U, right: R, originMetres: origin },
  evidence,
  overall: { min: overallRifle.min.map(round), max: overallRifle.max.map(round) },
  everything: { min: everythingRifle.min.map(round), max: everythingRifle.max.map(round) },
  travel,
  groups: { bcg: BCG, cartridge: CARTRIDGE, gas: GAS, rail: RAIL_GROUP, instanced },
  parts,
  explode,
  extras,
};

writeFileSync(output, JSON.stringify(result, null, 2) + "\n");

console.log(evidence.join("\n"));
console.log(`\nOverall rifle-frame extent: ${result.overall.min} -> ${result.overall.max} mm`);
console.log(`Travel: ${JSON.stringify(travel)}`);
console.log(`Rail group: ${RAIL_GROUP.join(", ")}`);
console.log(`Instanced (unnamed after join): ${instanced.join(", ") || "none"}`);
console.log(`\nWrote ${output} (${Object.keys(parts).length} parts)`);
