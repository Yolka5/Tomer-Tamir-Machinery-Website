/* Beaver scroll sequence: vanilla port of the BeaverDev viewer + timeline.
   Scroll writes targets; the renderer damps toward them. */

import * as THREE from 'three';

export const VFOV_DEG = 35;
export const SEQ_STEPS = 10;
export const SEQ_T_MAX = 9;
export const SEQ_HOLD = 0.012;

export const CAM_LAMBDA = 2.4;
export const PART_LAMBDA = 4.2;
export const CARRIER_LAMBDA = 14;
export const CAM_FOLLOW_LAMBDA = 2.2;
export const FOCUS_LAMBDA = 3.2;
export const EXPLODE_STAGGER = 0.35;
export const KICK_AMPLITUDE = 0.006;

const CAM_KEYS = ['tx', 'ty', 'tz', 'az', 'el', 'dist', 'frame', 'follow', 'chase'];
const PART_KEYS = ['explode', 'extras', 'carrier', 'rail', 'bullet', 'casing'];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));

const _reservedRe = /[[\].:]/g;
export function nodeKey(cadName) {
  return String(cadName).replace(/\s/g, '_').replace(_reservedRe, '');
}

const MATERIALS = {
  'al-7075-anodized': { color: null, metalness: 0.78, roughness: 0.36 },
  'steel-4140-nitride': { color: null, metalness: 0.92, roughness: 0.28 },
  'steel-maraging-nitride': { color: null, metalness: 0.96, roughness: 0.2 },
  'steel-aermet-100': { color: null, metalness: 0.97, roughness: 0.16 },
  'steel-17-4ph': { color: null, metalness: 0.94, roughness: 0.22 },
  'steel-303-stainless': { color: null, metalness: 0.92, roughness: 0.24 },
  'steel-321-stainless': { color: null, metalness: 0.92, roughness: 0.22 },
  'steel-alloy-black-oxide': { color: null, metalness: 0.88, roughness: 0.34 },
  'steel-music-wire': { color: null, metalness: 0.97, roughness: 0.14 },
  tungsten: { color: null, metalness: 1, roughness: 0.36 },
  brass: { color: null, metalness: 1, roughness: 0.3 },
  'copper-jacket': { color: null, metalness: 1, roughness: 0.34 },
  'polymer-white': { color: '#f2f1ee', metalness: 0, roughness: 0.48 },
  polymer: { color: null, metalness: 0, roughness: 0.7 },
  propellant: { color: null, metalness: 0, roughness: 0.95 }
};
const FALLBACK_MATERIAL = { color: null, metalness: 0.88, roughness: 0.38 };

const NODE_MATERIAL = {
  'Bolt Carrier #1': 'steel-maraging-nitride',
  'Bolt Carrier #2': 'steel-maraging-nitride',
  'Recoil Balls': 'tungsten',
  'Recoil Buffer': 'steel-4140-nitride',
  'Recoil Buffer Pin': 'steel-4140-nitride',
  'Recoil Spring': 'steel-music-wire',
  'Firing Pin Lock Plate': 'steel-17-4ph',
  'Firing Pin': 'steel-17-4ph',
  Bolt: 'steel-aermet-100',
  'Gas Block Bottom Screw': 'steel-alloy-black-oxide',
  'Gas Block Nut': 'steel-4140-nitride',
  'Gas Block': 'steel-4140-nitride',
  'Gas Piston': 'steel-17-4ph',
  'Gas Valve': 'steel-17-4ph',
  'Gas Tube': 'steel-321-stainless',
  'Gas Lock Pin': 'steel-17-4ph',
  'Piston Spring Socket': 'steel-17-4ph',
  'Piston Spring': 'steel-music-wire',
  'Piston Sleeve': 'steel-4140-nitride',
  'Valve Detent Pin Lock': 'steel-17-4ph',
  'Valve Detent Spring': 'steel-music-wire',
  'Valve Detent Pin': 'steel-17-4ph',
  'Seal Bump': 'polymer',
  '13.7" Barrel': 'steel-4140-nitride',
  'Barrel Nut': 'al-7075-anodized',
  'Picatinny Top Rail': 'al-7075-anodized',
  'Upper Reciever': 'al-7075-anodized',
  Handguard: 'al-7075-anodized',
  'Charging Handle Buffer': 'polymer',
  'Charging Handle Insert': 'al-7075-anodized',
  'Charging Handle': 'al-7075-anodized',
  'Handguard Side Insert': 'steel-303-stainless',
  'Handguard Top Screw': 'steel-alloy-black-oxide',
  'Bottom Handguard Screw': 'steel-alloy-black-oxide',
  'Bottom Side Insert Scew': 'steel-alloy-black-oxide',
  'Top Rail Screw': 'steel-alloy-black-oxide',
  'M5 Insert': 'steel-303-stainless',
  'Lower Reciever': 'al-7075-anodized',
  'Buffer Tube': 'al-7075-anodized',
  STOCK_KORPUS: 'polymer',
  STOCK_TILNIK: 'polymer',
  STOCK_V: 'polymer',
  '55CA5C4 CMMG Grip': 'polymer',
  KORPUS_MAGAZINA_7_62_X51: 'polymer',
  KRISHKA_MAGAZINA_7_62_X51: 'polymer',
  NAPRAVL_MAGAZ_7_62_51: 'polymer',
  PRT_BUMP_FLOOR_0001_22: 'polymer',
  PRT_CASE_0001_4: 'brass',
  PRT_PRIMER_0001_1: 'brass',
  PRT_BULLET_CORE_0002_4: 'copper-jacket',
  Cam: 'steel-17-4ph',
  'Bullet - TVCM 6.8mm': 'copper-jacket',
  'Casing - TVCM 6.8mm': 'polymer-white',
  'Primer Outer - TVCM 6.8mm': 'brass',
  'Primer Inner - TVCM 6.8mm': 'brass',
  'Insert - TVCM 6.8mm': 'polymer',
  'Gun Powder - TVCM 6.8mm': 'propellant'
};

const materialByKey = new Map(
  Object.entries(NODE_MATERIAL).map(([name, id]) => [nodeKey(name), MATERIALS[id]])
);

const SPECS = {
  'chamber-pressure': 65000,
  'barrel-length': 348,
  'bullet-mass': 135,
  'muzzle-velocity': 2750,
  'velocity-500m': 1900,
  'upper-part-count': 90,
  'twist-rate': '7:1'
};
const fmt = (id) => {
  const v = SPECS[id];
  return typeof v === 'number' ? v.toLocaleString('en-US') : v;
};

export const SEQ_PANELS = [
  {
    id: 'beaver',
    step: 1,
    title: 'Beaver',
    body: `${fmt('upper-part-count')} parts in one upper receiver group, built around the 6.8 mm TVCM cartridge.`
  },
  {
    id: 'gas',
    step: 2,
    title: 'Gas system',
    body: 'A short stroke piston with an adjustable valve. Gas drives the piston rather than the carrier, so the carrier stays cooler under sustained fire.'
  },
  {
    id: 'bcg',
    step: 3,
    title: 'Bolt carrier group',
    body: 'Two pieces. The recoil spring, buffer and tungsten anti-bounce weights ride inside the carrier, which is what removes the buffer tube.'
  },
  {
    id: 'cartridge',
    step: 4,
    title: 'TVCM 6.8 mm',
    body: 'Six parts: bullet, casing, insert, powder and a two piece primer. Most decisions downstream depend on this one.'
  },
  {
    id: 'battery',
    step: 5,
    title: 'Battery',
    body: 'The recoil spring drives the carrier group home. The bolt strips the round forward into the chamber and locks behind it.'
  },
  {
    id: 'bore',
    step: 6,
    title: 'Fired',
    body: `A ${fmt('bullet-mass')} grain bullet, pushed by ${fmt('chamber-pressure')} psi behind it. The rifling turns it down ${fmt('barrel-length')} mm of barrel at a ${fmt('twist-rate')} twist.`
  },
  {
    id: 'flight',
    step: 7,
    title: 'Downrange',
    body: `It leaves the muzzle at ${fmt('muzzle-velocity')} ft/s, the speed the design needs for it to still be doing ${fmt('velocity-500m')} ft/s at 500 m.`
  },
  {
    id: 'rail',
    step: 8,
    title: 'Handguard and rail',
    body: 'The Picatinny top rail runs the length of the handguard, fixed through threaded inserts.'
  }
];

const BARREL = '13.7" Barrel';
const RECEIVER = 'Upper Reciever';
const BULLET = 'Bullet - TVCM 6.8mm';
const BULLET_KEY = nodeKey(BULLET);
const DEG = Math.PI / 180;

let cad = null;
let F = new THREE.Vector3();
let U = new THREE.Vector3();
let R = new THREE.Vector3();
let ORIGIN = new THREE.Vector3();
export const CAD_TO_WORLD = new THREE.Quaternion();
export const CAD_OFFSET = new THREE.Vector3();
let CARRIER_CAD = new THREE.Vector3();
let CARRIER_WORLD = new THREE.Vector3();
let RAIL_CAD = new THREE.Vector3();
let BULLET_WORLD = new THREE.Vector3();
let BULLET_CAD = new THREE.Vector3();
let CASING_CAD = new THREE.Vector3();
const CASING_DROP = 0.09;
let CASING_TUMBLE_AXIS = new THREE.Vector3();
let cadNameByKey = new Map();
let CARRIER_KEYS = new Set();
let RAIL_KEYS = new Set();
let CASING_KEYS = new Set();
let explodeOffsets = {};
let extraOffsets = {};
let shots = [];
let tweens = [];
let focusByStep = [];
let idleCam = null;

const rifleVec = (mm) =>
  new THREE.Vector3()
    .addScaledVector(F, mm[0] / 1000)
    .addScaledVector(U, mm[1] / 1000)
    .addScaledVector(R, mm[2] / 1000);

function boxOf(names, everything) {
  if (everything) return cad.everything;
  const parts = cad.parts;
  const found = names.map((n) => parts[n]).filter(Boolean);
  if (!found.length) return cad.overall;
  return {
    min: [0, 1, 2].map((i) => Math.min(...found.map((p) => p.min[i]))),
    max: [0, 1, 2].map((i) => Math.max(...found.map((p) => p.max[i])))
  };
}

function cameraFromShot(s) {
  return {
    tx: s.target[0],
    ty: s.target[1],
    tz: s.target[2],
    az: s.azimuth,
    el: s.elevation,
    dist: s.distance,
    frame: s.frame,
    follow: s.follow,
    chase: s.chase
  };
}

function shotFor(p) {
  const b = boxOf(p.parts, p.everything);
  const nudge = p.nudge || [0, 0, 0];
  const target = b.min.map((v, i) => ((v + b.max[i]) / 2 + nudge[i]) / 1000);
  const size = b.max.map((v, i) => (v - b.min[i]) / 1000);
  /* Sphere-vs-vertical-FOV backs the camera off a long thin group (the BCG)
     until it is a speck. Fit the box to width and height instead. */
  const halfV = Math.tan((VFOV_DEG * DEG) / 2);
  const halfW = halfV * (16 / 9);
  const distV = size[1] / 2 / halfV;
  const distH = Math.max(size[0], size[2]) / 2 / halfW;
  const distance = Math.max(distV, distH) / p.fill;
  return {
    target,
    azimuth: p.azimuth * DEG,
    elevation: p.elevation * DEG,
    distance: Math.max(0.08, distance),
    frame: p.frame,
    follow: p.follow ? 1 : 0,
    chase: p.chase ? 1 : 0,
    focus: p.focus
  };
}

function presetList() {
  const { bcg: BCG, cartridge: CARTRIDGE, gas: GAS, rail: RAIL_GROUP } = cad.groups;
  return [
    {
      id: 'idle',
      parts: [],
      everything: true,
      azimuth: 0,
      elevation: 5,
      fill: 0.55,
      /* Look at the bore, not the stock/mag-weighted box centre, or the rifle sits high. */
      nudge: [0, 70, 0],
      frame: 0,
      follow: false,
      focus: []
    },
    {
      id: 'full',
      parts: [],
      azimuth: 0,
      elevation: 6,
      fill: 0.72,
      frame: 0,
      follow: false,
      focus: []
    },
    {
      id: 'explode',
      parts: [],
      azimuth: 24,
      elevation: 18,
      fill: 0.55,
      frame: 0.08,
      follow: false,
      focus: []
    },
    {
      id: 'gas',
      /* The full GAS group includes the 265 mm piston, so the look-at sits
         on the barrel. Frame the block itself. */
      parts: ['Gas Block', 'Gas Valve', 'Gas Block Nut', 'Gas Lock Pin'],
      azimuth: 32,
      elevation: 18,
      fill: 0.32,
      nudge: [6, 4, 0],
      frame: 0.08,
      follow: false,
      focus: [...GAS, BARREL]
    },
    {
      id: 'bcg',
      /* Frame the carrier body, not the 340 mm spring/buffer train. */
      parts: ['Bolt', 'Bolt Carrier #1', 'Bolt Carrier #2'],
      azimuth: -34,
      elevation: 14,
      fill: 0.14,
      nudge: [80, 0, 0],
      frame: -0.05,
      follow: true,
      focus: [...BCG, ...CARTRIDGE]
    },
    {
      id: 'cartridge',
      parts: CARTRIDGE,
      azimuth: -55,
      elevation: 10,
      fill: 0.14,
      frame: 0.08,
      follow: true,
      focus: [...CARTRIDGE, 'Bolt', 'Bolt Carrier #1']
    },
    {
      id: 'battery',
      parts: [RECEIVER, 'Handguard'],
      nudge: [-90, 0, 0],
      azimuth: -28,
      elevation: 12,
      fill: 0.72,
      frame: 0.08,
      follow: false,
      focus: [...BCG, ...CARTRIDGE]
    },
    {
      id: 'bore',
      parts: [BULLET],
      azimuth: -38,
      elevation: 9,
      fill: 0.07,
      frame: 0.08,
      follow: false,
      chase: true,
      focus: [BULLET]
    },
    {
      id: 'flight',
      parts: [BULLET],
      azimuth: -72,
      elevation: 14,
      fill: 0.05,
      frame: 0.08,
      follow: false,
      chase: true,
      focus: [BULLET]
    },
    {
      id: 'rail',
      parts: [...RAIL_GROUP, 'Handguard', RECEIVER],
      azimuth: 20,
      elevation: 32,
      fill: 0.72,
      frame: 0.08,
      follow: false,
      focus: [...RAIL_GROUP, 'Handguard', RECEIVER]
    }
  ];
}

const easeLinear = (t) => t;
const easePower2In = (t) => t * t;
const easePower2Out = (t) => 1 - (1 - t) * (1 - t);
const easePower2InOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easePower4In = (t) => t * t * t * t;
const easeSineInOut = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

const EASES = {
  none: easeLinear,
  'power2.in': easePower2In,
  'power2.out': easePower2Out,
  'power2.inOut': easePower2InOut,
  'power4.in': easePower4In,
  'sine.inOut': easeSineInOut
};

const at = (k, p) => Math.max(0, k - 1 + 2 * p);

function makeTween(start, end, from, to, ease) {
  return { start, end, from, to, ease: EASES[ease] || easeLinear };
}

function buildTimeline() {
  const ids = ['idle', 'beaver', 'gas', 'bcg', 'cartridge', 'battery', 'bore', 'flight', 'rail', 'assembled'];
  const k = Object.fromEntries(ids.map((id, i) => [id, i]));
  const cams = shots.map(cameraFromShot);
  const full = cameraFromShot(shotFor(presetList().find((p) => p.id === 'full')));
  idleCam = { ...cams[0] };

  const list = [];
  const fly = (step, a, b, from, to) => {
    list.push(makeTween(at(step, a), at(step, b), from, to, 'sine.inOut'));
  };
  const part = (step, a, b, from, to, ease = 'power2.inOut') => {
    list.push(makeTween(at(step, a), at(step, b), from, to, ease));
  };

  fly(k.beaver, 0, 0.4, cams[k.idle], cams[k.beaver]);
  fly(k.gas, 0.02, 0.5, cams[k.beaver], cams[k.gas]);
  fly(k.bcg, 0.02, 0.5, cams[k.gas], cams[k.bcg]);
  fly(k.cartridge, 0.02, 0.5, cams[k.bcg], cams[k.cartridge]);
  fly(k.battery, 0.02, 0.35, cams[k.cartridge], cams[k.battery]);
  fly(k.bore, 0.05, 0.5, cams[k.battery], cams[k.bore]);
  fly(k.flight, 0.02, 0.5, cams[k.bore], cams[k.flight]);
  fly(k.rail, 0, 0.22, cams[k.flight], full);
  fly(k.rail, 0.22, 0.5, full, cams[k.rail]);
  fly(k.assembled, 0.02, 0.5, cams[k.rail], cams[k.assembled]);

  part(k.beaver, 0.0, 0.4, { explode: 0 }, { explode: 1 });
  part(k.beaver, 0.0, 0.42, { extras: 0 }, { extras: 1 });
  part(k.beaver, 0.6, 0.95, { explode: 1 }, { explode: 0 });
  part(k.bcg, 0.1, 0.48, { carrier: 0 }, { carrier: 1 });
  part(k.battery, 0.42, 0.55, { carrier: 1 }, { carrier: 0 }, 'power4.in');
  part(k.battery, 0.55, 0.56, { kick: 0 }, { kick: 1 }, 'none');
  part(k.battery, 0.56, 0.76, { kick: 1 }, { kick: 0 }, 'power2.out');
  list.push(makeTween(at(k.bore, 0.25), at(k.flight, 0.7), { bullet: 0 }, { bullet: 1 }, 'power2.in'));
  part(k.rail, 0.68, 0.7, { bullet: 1 }, { bullet: 0 });
  part(k.rail, 0.28, 0.55, { rail: 0 }, { rail: 1 });
  part(k.assembled, 0.05, 0.45, { rail: 1 }, { rail: 0 });

  tweens = list;
  focusByStep = shots.map((s) => s.focus);
}

export async function ensureCad() {
  if (cad) return cad;
  const res = await fetch(new URL('beaver-cad.json', import.meta.url));
  if (!res.ok) throw new Error('beaver-cad.json ' + res.status);
  cad = await res.json();
  initCad();
  return cad;
}

function initCad() {
  F.fromArray(cad.frame.forward);
  U.fromArray(cad.frame.up);
  R.fromArray(cad.frame.right);
  ORIGIN.fromArray(cad.frame.originMetres);
  CAD_TO_WORLD.setFromRotationMatrix(new THREE.Matrix4().makeBasis(F, U, R).invert());
  CAD_OFFSET.copy(ORIGIN).applyQuaternion(CAD_TO_WORLD).negate();

  CARRIER_CAD = rifleVec([-cad.travel.carrierRearward, 0, 0]);
  CARRIER_WORLD = new THREE.Vector3(-cad.travel.carrierRearward / 1000, 0, 0);
  RAIL_CAD = rifleVec([0, cad.travel.railLift, 0]);
  BULLET_WORLD = new THREE.Vector3(cad.travel.bulletForward / 1000, 0, 0);
  BULLET_CAD = rifleVec([cad.travel.bulletForward, 0, 0]);
  CASING_CAD = rifleVec([-10, 30, 55]);
  CASING_TUMBLE_AXIS = new THREE.Vector3().addScaledVector(U, 1).addScaledVector(R, 0.4).normalize();

  const parts = cad.parts;
  cadNameByKey = new Map(Object.keys(parts).map((n) => [nodeKey(n), n]));
  const keysOf = (names) => new Set(names.map(nodeKey));
  CARRIER_KEYS = keysOf([...cad.groups.bcg, ...cad.groups.cartridge]);
  RAIL_KEYS = keysOf(cad.groups.rail);
  CASING_KEYS = keysOf(cad.groups.cartridge.filter((n) => n !== BULLET));
  explodeOffsets = cad.explode || {};
  extraOffsets = cad.extras || {};

  const presets = presetList();
  const byId = new Map(presets.map((p) => [p.id, p]));
  const stepIds = ['idle', 'explode', 'gas', 'bcg', 'cartridge', 'battery', 'bore', 'flight', 'rail', 'full'];
  shots = stepIds.map((id) => shotFor(byId.get(id)));
  buildTimeline();
}

export function seqTimeFromQ(q) {
  if (q <= SEQ_HOLD) return 0;
  return ((q - SEQ_HOLD) / (1 - SEQ_HOLD)) * SEQ_T_MAX;
}

/* Spin only on step 0 and step 9. Exactly 0 before step 1's first camera flight. */
export function spinGain(q) {
  const down0 = 0.006;
  const down1 = SEQ_HOLD;
  const up0 = 1 - SEQ_HOLD;
  const up1 = up0 + 0.04;
  if (q <= down0) return 1;
  if (q < down1) return 1 - smoothstep(down0, down1, q);
  if (q < up0) return 0;
  return smoothstep(up0, Math.min(1, up1), q);
}

export function spinLocalClock(q) {
  if (q < SEQ_HOLD) return q / SEQ_HOLD;
  if (q >= 1 - SEQ_HOLD) return (q - (1 - SEQ_HOLD)) / SEQ_HOLD;
  return 0;
}

export function heroOpacity(t) {
  return 1 - smoothstep(0.04, 0.32, t);
}

export function panelOpacity(t, step) {
  return 1 - smoothstep(0.3, 0.52, Math.abs(t - step));
}

export function stateAt(t) {
  const s = t < 0 ? 0 : t > SEQ_T_MAX ? SEQ_T_MAX : t;
  const state = {
    ...idleCam,
    explode: 0,
    extras: 0,
    carrier: 0,
    rail: 0,
    bullet: 0,
    casing: 0,
    kick: 0
  };
  for (let i = 0; i < tweens.length; i++) {
    const tw = tweens[i];
    if (s < tw.start) continue;
    const span = tw.end - tw.start;
    const u = span <= 1e-8 ? 1 : clamp01((s - tw.start) / span);
    const e = tw.ease(u);
    for (const key in tw.to) {
      const a = tw.from[key];
      const b = tw.to[key];
      if (a === undefined || b === undefined) continue;
      state[key] = a + (b - a) * e;
    }
  }
  const idx = Math.min(SEQ_STEPS - 1, Math.max(0, Math.round(s)));
  state.focus = focusByStep[idx] || [];
  state.cam = {
    tx: state.tx,
    ty: state.ty,
    tz: state.tz,
    az: state.az,
    el: state.el,
    dist: state.dist,
    frame: state.frame,
    follow: state.follow,
    chase: state.chase
  };
  return state;
}

function pivotOf(node) {
  if (!node.userData.ttmPivot) {
    node.updateWorldMatrix(true, true);
    const centre = new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3());
    if (node.parent) centre.applyMatrix4(new THREE.Matrix4().copy(node.parent.matrixWorld).invert());
    node.userData.ttmPivot = centre;
  }
  return node.userData.ttmPivot;
}

export function prepare(scene, clipPlane) {
  const rigs = [];

  for (const node of scene.children) {
    const key = cadNameByKey.has(node.name) ? node.name : node.name.replace(/_\d+$/, '');
    const cadName = cadNameByKey.get(key);
    const def = materialByKey.get(key) || FALLBACK_MATERIAL;
    const mats = [];
    const meshes = [];

    node.traverse((o) => {
      if (!o.isMesh) return;
      meshes.push(o);
      o.frustumCulled = false;
      const make = (source) => {
        const cadCol = source.color;
        const color = def.color
          ? new THREE.Color(def.color)
          : new THREE.Color().setRGB(cadCol.r, cadCol.g, cadCol.b, THREE.SRGBColorSpace);
        const metal = def.metalness;
        const env = metal < 0.2 ? 1 : metal > 0.9 ? 1.15 : 1;
        const mat = new THREE.MeshStandardMaterial({
          color,
          metalness: metal,
          roughness: def.roughness,
          envMapIntensity: env
        });
        /* Onshape fills sit too bright for PBR metals — same 0.84 pull the
           other homepage models use, so the key light can rake a highlight. */
        if (metal >= 0.2) mat.color.multiplyScalar(0.84);
        if (clipPlane) mat.clippingPlanes = [clipPlane];
        return mat;
      };
      o.material = Array.isArray(o.material) ? o.material.map(make) : make(o.material);
      const current = Array.isArray(o.material) ? o.material : [o.material];
      mats.push(...current);
    });

    if (!node.userData.ttmRest) {
      node.userData.ttmRest = {
        pos: node.position.clone(),
        quat: node.quaternion.clone()
      };
    }
    const rest = node.userData.ttmRest;
    const offset = cadName ? explodeOffsets[cadName] : undefined;
    const extra = cadName && extraOffsets[cadName] ? extraOffsets[cadName] : null;
    const spin = key === BULLET_KEY ? 'bullet' : CASING_KEYS.has(key) ? 'casing' : null;

    rigs.push({
      node,
      key,
      restPos: rest.pos,
      restQuat: rest.quat,
      explode: offset ? rifleVec(offset) : null,
      extra: extra ? rifleVec(extra) : null,
      delay: 0,
      carrier: CARRIER_KEYS.has(key),
      rail: RAIL_KEYS.has(key),
      spin,
      pivot: spin ? pivotOf(node) : null,
      mats,
      meshes,
      opacity: 1,
      casts: true
    });
  }

  const moving = rigs.filter((r) => r.explode);
  moving
    .sort((a, b) => b.explode.length() - a.explode.length())
    .forEach((r, i) => {
      r.delay = moving.length > 1 ? (EXPLODE_STAGGER * i) / (moving.length - 1) : 0;
    });

  return rigs;
}

export function attachClipPlane(seqRigs, plane) {
  for (const r of seqRigs) {
    for (const m of r.mats) {
      m.clippingPlanes = [plane];
      m.needsUpdate = true;
    }
  }
}

export function measureUpperBox(seqRigs) {
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  for (const r of seqRigs) {
    if (r.extra) continue;
    r.node.updateWorldMatrix(true, true);
    tmp.setFromObject(r.node);
    if (!tmp.isEmpty()) box.union(tmp);
  }
  return box;
}

export function createSeqRuntime() {
  return {
    live: { explode: 0, extras: 0, carrier: 0, rail: 0, bullet: 0, casing: 0 },
    hidden: { bullet: false, casing: false },
    cam: null,
    camCarrier: 0,
    focusList: null,
    focusSet: null,
    pos: new THREE.Vector3(),
    rel: new THREE.Vector3(),
    pivot: new THREE.Vector3(),
    target: new THREE.Vector3(),
    look: new THREE.Vector3(),
    q: new THREE.Quaternion(),
    spinQ: new THREE.Quaternion()
  };
}

export function tickSeq(rt, seqRigs, target, dt, camera, viewW, viewH, applyCamera = true) {
  const L = rt.live;
  for (let i = 0; i < PART_KEYS.length; i++) {
    const k = PART_KEYS[i];
    if ((k === 'bullet' || k === 'casing') && rt.hidden[k] && target[k] < L[k]) L[k] = target[k];
    else L[k] = damp(L[k], target[k], k === 'carrier' ? CARRIER_LAMBDA : PART_LAMBDA, dt);
  }

  if (rt.focusList !== target.focus) {
    rt.focusList = target.focus;
    rt.focusSet = target.focus && target.focus.length ? new Set(target.focus.map(nodeKey)) : null;
  }
  const focus = rt.focusSet;
  const { pos, rel, pivot, q, spinQ } = rt;

  for (let i = 0; i < seqRigs.length; i++) {
    const r = seqRigs[i];
    pos.copy(r.restPos);
    if (r.explode) {
      const e = smooth(clamp01((L.explode - r.delay) / (1 - EXPLODE_STAGGER)));
      pos.addScaledVector(r.explode, e);
    }
    if (r.extra) pos.addScaledVector(r.extra, smooth(L.extras));
    if (r.carrier) pos.addScaledVector(CARRIER_CAD, L.carrier);
    if (r.rail) pos.addScaledVector(RAIL_CAD, L.rail);
    q.copy(r.restQuat);

    if (r.spin && r.pivot) {
      const amount = r.spin === 'bullet' ? L.bullet : L.casing;
      pos.addScaledVector(r.spin === 'bullet' ? BULLET_CAD : CASING_CAD, amount);
      if (r.spin === 'casing') pos.addScaledVector(U, -CASING_DROP * amount * amount);
      spinQ.setFromAxisAngle(
        r.spin === 'bullet' ? F : CASING_TUMBLE_AXIS,
        amount * (r.spin === 'bullet' ? Math.PI * 4 : Math.PI * 2.4)
      );
      pivot.copy(r.pivot).add(rel.copy(pos).sub(r.restPos));
      pos.copy(pivot).add(rel.copy(r.restPos).sub(r.pivot).applyQuaternion(spinQ));
      q.premultiply(spinQ);
    }

    r.node.position.copy(pos);
    r.node.quaternion.copy(q);

    const focused = !focus || focus.has(r.key);
    const flying = r.spin && L[r.spin] > 0.05;
    const gone = r.extra ? 1 - smooth(clamp01((L.extras - 0.5) / 0.4)) : 1;
    const want = Math.min(gone, focused ? 1 : flying ? 0 : 0.1);
    r.opacity = damp(r.opacity, want, FOCUS_LAMBDA, dt);
    if (r.spin) rt.hidden[r.spin] = r.opacity < 0.03;
    if (r.extra) r.node.visible = r.opacity > 0.01;
    const transparent = r.opacity < 0.995;
    for (let m = 0; m < r.mats.length; m++) {
      const mat = r.mats[m];
      if (mat.transparent !== transparent) {
        mat.transparent = transparent;
        mat.depthWrite = !transparent;
        mat.needsUpdate = true;
      }
      mat.opacity = r.opacity;
    }
  }

  if (applyCamera && camera) {
    if (!rt.cam) rt.cam = { ...target.cam };
    const c = rt.cam;
    for (let i = 0; i < CAM_KEYS.length; i++) {
      const k = CAM_KEYS[i];
      const lambda = k === 'frame' ? 3 : k === 'follow' ? 4 : CAM_LAMBDA;
      c[k] = damp(c[k], target.cam[k], lambda, dt);
    }
    rt.camCarrier = damp(rt.camCarrier, L.carrier, CAM_FOLLOW_LAMBDA, dt);
    const look = rt.target
      .set(c.tx, c.ty, c.tz)
      .addScaledVector(CARRIER_WORLD, c.follow * rt.camCarrier)
      .addScaledVector(BULLET_WORLD, c.chase * L.bullet);
    if (target.kick > 0.001) {
      const now = performance.now() * 0.001;
      look.x += Math.sin(now * 83) * KICK_AMPLITUDE * target.kick;
      look.y += Math.sin(now * 97 + 1.3) * KICK_AMPLITUDE * target.kick;
    }
    const cosEl = Math.cos(c.el);
    camera.position.set(
      look.x + c.dist * cosEl * Math.sin(c.az),
      look.y + c.dist * Math.sin(c.el),
      look.z + c.dist * cosEl * Math.cos(c.az)
    );
    camera.lookAt(look);
    rt.look.copy(look);

    const shift = viewW > 900 ? -c.frame * viewW : 0;
    if (Math.abs(shift) > 0.5) {
      camera.setViewOffset(viewW, viewH, shift, 0, viewW, viewH);
    } else if (camera.view) {
      camera.clearViewOffset();
    }
  }

  return { explode: L.explode, extras: L.extras };
}

export function resetSeqCamera(camera) {
  if (camera.view) camera.clearViewOffset();
}

export function buildStudioEnv(renderer) {
  const scene = new THREE.Scene();

  const panel = new THREE.PlaneGeometry(1, 1);
  const add = (w, h, pos, intensity) => {
    const m = new THREE.Mesh(
      panel,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color().setScalar(intensity),
        side: THREE.DoubleSide
      })
    );
    m.scale.set(w, h, 1);
    m.position.set(pos[0], pos[1], pos[2]);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  add(16, 3, [0, 4, 1], 7);
  add(1, 10, [-5, 1, 1], 5);
  add(1, 10, [5, 1, 1], 4);
  add(12, 8, [0, 0, -6], 6);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const target = pmrem.fromScene(scene, 0.04);
  pmrem.dispose();
  scene.traverse((o) => {
    if (o.isMesh) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    }
  });
  panel.dispose();
  return target.texture;
}

export function fillSeqCopy(root) {
  for (const panel of SEQ_PANELS) {
    const el = root.querySelector('[data-hm-seq="' + panel.id + '"]');
    if (!el) continue;
    const title = el.querySelector('[data-hm-seq-title]');
    const body = el.querySelector('[data-hm-seq-body]');
    if (title) title.textContent = panel.title;
    if (body) body.textContent = panel.body;
  }
}

export { clamp01, mix, smoothstep };
