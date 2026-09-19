/* ===== TTM landing stage =====
   Four acts on one pinned canvas. Scroll turns the product; the corners do
   the talking; each handoff is a different move so the page never repeats
   the same swap three times.

   Act 0 - Beaver, black on white. Guided 3D tour of how the rifle works.
   Swap 0 - class change: assembled upper shears out, turret grows in, curtain down.
   Act 1 - T-90M, white on black. Rangefinder HUD.
   Swap 1 - collapse: turret recedes, MP7 punches through.
   Act 2 - MP7, still dark. Length bar + rate.
   Swap 2 - bench swap: a vertical clip plane hands MP7 to SPEAR, curtain up.
   Act 3 - SIG Spear, black on white. Pressure gauge.
   Outro - Spear holds; the rest of the site slides in from the right.

   Without this module the markup reads as four stacked editorials. */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import {
  CAD_OFFSET,
  CAD_TO_WORLD,
  SEQ_HOLD,
  SEQ_PANELS,
  SEQ_T_MAX,
  VFOV_DEG,
  attachClipPlane,
  createSeqRuntime,
  ensureCad,
  fillSeqCopy,
  heroOpacity,
  measureUpperBox,
  panelOpacity,
  prepare,
  resetSeqCamera,
  seqTimeFromQ,
  spinGain,
  stateAt,
  tickSeq
} from './beaver-seq.js?v=13';

/* The running order the page actually tells:
     Beaver tour → T-90M → Ukraine → MP7 → CAD library → SPEAR.

   Each full-frame panel (Ukraine, CAD library) now HOLDS to the end of its act
   and is carried into the following handoff by `f.tail`, instead of fading out
   and handing the frame back to the model for a few hundred milliseconds
   before the swap started. That flash-back was the model briefly reappearing
   between the panel and the transition. */
const PHASES = [
  { kind: 'act', act: 0, vh: 1700 },
  { kind: 'swap', swap: 0, vh: 44 },
  { kind: 'act', act: 1, vh: 62 },
  { kind: 'swap', swap: 1, vh: 38 },
  { kind: 'act', act: 2, vh: 58 },
  { kind: 'swap', swap: 2, vh: 40 },
  { kind: 'act', act: 3, vh: 50 },
  { kind: 'outro', vh: 70 }
];

const TRACK_VH = PHASES.reduce((sum, ph) => sum + ph.vh, 0);
const TAU = Math.PI * 2;
const CAM_FOV = 26;
const CAM_DIST = 3.4;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;
function span(v, a, b) {
  return b === a ? (v < a ? 0 : 1) : clamp01((v - a) / (b - a));
}
function smooth(v, a, b) {
  const t = span(v, a, b);
  return t * t * (3 - 2 * t);
}
const outCubic = (t) => 1 - Math.pow(1 - t, 3);
const outExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -9 * t));
const inCubic = (t) => t * t * t;
const outBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const outQuart = (t) => 1 - Math.pow(1 - clamp01(t), 4);

const MAP_WORLD = [-180, -90, 360, 180];
const MAP_UKRAINE = [21.6, -53.4, 19.4, 9.6];
function mixBox(a, b, t) {
  return a.map((v, i) => v + (b[i] - v) * t);
}

const BOUNDS = (() => {
  const out = [];
  let at = 0;
  for (const ph of PHASES) {
    const size = ph.vh / TRACK_VH;
    out.push({ ...ph, from: at, to: at + size });
    at += size;
  }
  return out;
})();

function phaseAt(p) {
  for (const b of BOUNDS) {
    if (p < b.to || b === BOUNDS[BOUNDS.length - 1]) {
      return { ...b, local: span(p, b.from, b.to) };
    }
  }
  return null;
}

function mdl(partial) {
  return Object.assign({
    wipe: 0,
    clock: 0,
    arrive: 0,
    type: 0,
    grow: 1,
    punch: 1,
    x: 0,
    clip: 'axis',
    split: 0,
    /* 0 = assembled, 1 = every part pushed out along its own assembly vector.
       On a rig that cannot be taken apart this drives a recede-and-shrink
       instead, so both kinds of exit run on one curve. */
    explode: 0,
    /* 0 = the whole assembly, 1 = everything except the parts named in the
       spec's `isolateKeep` has been thrown clear of the frame. */
    isolate: 0,
    /* Which end of the part spread leads the move (1 = muzzle first). */
    lead: 1
  }, partial);
}

function frameAt(p, introT, typeIntroT) {
  const ph = phaseAt(p);
  const q = ph.local;
  const f = {
    dark: 0,
    slide: 0,
    beatAct: -1,
    beatQ: 0,
    railAct: -1,
    railQ: 0,
    splitLine: -1,
    rest: 0,
    uaScan: 0,
    cadScan: 0,
    introGate: 0,
    teardown: 0,
    /* Headline reveal per act. */
    types: [0, 0, 0, 0, 0],
    /* Keeps one act's beat alive through the following handoff. */
    tail: null,
    models: [mdl(), mdl(), mdl(), mdl()],
    beaverQ: 0,
    seqT: 0,
    seqPanels: null,
    seqLift: 0
  };

  if (ph.kind === 'act' && ph.act === 0) {
    const q0 = q / SEQ_HOLD;
    const typePop = typeIntroT > 0 ? outCubic(typeIntroT) : 0;
    const tSeq = seqTimeFromQ(q);
    f.introGate = 1;
    f.beaverQ = q;
    f.seqT = tSeq;
    f.seqPanels = {};
    for (const pan of SEQ_PANELS) f.seqPanels[pan.step] = panelOpacity(tSeq, pan.step);
    f.types[0] = heroOpacity(tSeq) * typePop;
    f.models[0] = mdl({
      wipe: outCubic(introT),
      clock: 0,
      arrive: introT,
      type: outCubic(introT)
    });
    f.beatAct = 0;
    f.beatQ = q;
    f.railAct = 0;
    f.railQ = q;
  } else if (ph.kind === 'swap' && ph.swap === 0) {
    /* Settle into the site product camera on the light stage, close extras,
       then shear the upper out as the turret grows in on the dark curtain. */
    f.dark = smooth(q, 0.4, 0.7);
    f.slide = f.dark;
    f.slide = f.dark;
    f.railAct = q < 0.5 ? 0 : 1;
    f.railQ = q < 0.5 ? 1 : 0;
    f.seqT = SEQ_T_MAX;
    f.beaverQ = 1;
    f.models[0] = mdl({
      wipe: 1 - smooth(q, 0.38, 0.64),
      clock: 0,
      arrive: 1 - inCubic(span(q, 0.4, 0.68)),
      type: 1 - inCubic(span(q, 0.02, 0.22)),
      explode: 0,
      isolate: 0,
      grow: 1
    });
    f.models[1] = mdl({
      wipe: 1,
      /* Lands on 0 so it meets act 1's `clock: q` without a rotation snap. */
      clock: -0.3 + q * 0.3,
      arrive: outCubic(span(q, 0.6, 0.95)),
      type: span(q, 0.68, 1),
      explode: 1 - outQuart(span(q, 0.6, 1)),
      grow: mix(0.8, 1, outExpo(span(q, 0.6, 0.96)))
    });
  } else if (ph.kind === 'act' && ph.act === 1) {
    f.dark = 1;
    f.slide = 1;
    const promo = beatHold(q, 1, 2);
    f.beatAct = 1;
    f.beatQ = q;
    f.railAct = 1;
    f.railQ = q;
    f.uaScan = smooth(q, 0.22, 0.94);
    f.types[1] = mix(1, 0.02, promo);
    f.models[1] = mdl({
      wipe: mix(1, 0.1, outCubic(promo)),
      clock: q,
      arrive: 1,
      type: mix(1, 0.06, promo),
      grow: mix(1, 0.34, outCubic(promo)),
      x: mix(0, 0.45, outCubic(promo))
    });
  } else if (ph.kind === 'swap' && ph.swap === 1) {
    /* The Ukraine panel is still up when this starts and fades out over the
       first third, so the turret never comes back to be seen. */
    f.dark = 1;
    f.slide = 1;
    f.tail = { act: 1, step: 1, t: 1 - smooth(q, 0.0, 0.34) };
    f.railAct = q < 0.5 ? 1 : 2;
    f.railQ = q < 0.5 ? 1 : 0;
    f.models[1] = mdl({
      wipe: mix(0.1, 0, smooth(q, 0.04, 0.4)),
      clock: 1 + q * 0.3,
      arrive: 1,
      grow: 0.34,
      x: mix(0.45, 0.56, q)
    });
    f.models[2] = mdl({
      wipe: 1,
      clock: -0.4 + q * 0.4,
      arrive: outCubic(span(q, 0.3, 0.9)),
      type: span(q, 0.55, 1),
      explode: 1 - outQuart(span(q, 0.3, 0.96)),
      grow: mix(0.86, 1, outExpo(span(q, 0.3, 0.95))),
      punch: mix(1.12, 1, outBack(clamp01(span(q, 0.6, 1))))
    });
  } else if (ph.kind === 'act' && ph.act === 2) {
    f.dark = 1;
    f.slide = 1;
    const promo = beatHold(q, 1, 2);
    f.beatAct = 2;
    f.beatQ = q;
    f.railAct = 2;
    f.railQ = q;
    f.cadScan = smooth(q, 0.34, 0.9);
    f.types[2] = mix(1, 0.02, promo);
    f.models[2] = mdl({
      wipe: mix(1, 0.14, outCubic(promo)),
      clock: q,
      arrive: 1,
      type: mix(1, 0.08, promo),
      grow: mix(1, 0.4, outCubic(promo)),
      x: mix(0, -0.32, outCubic(promo))
    });
  } else if (ph.kind === 'swap' && ph.swap === 2) {
    /* Bench swap. The library panel is held and cut away by the same seam
       that carries the curtain, and the SPEAR builds on the light side. */
    f.dark = 1 - smooth(q, 0.3, 0.84);
    f.slide = 2 - f.dark;
    const split = smooth(q, 0.12, 0.9);
    f.splitLine = split;
    f.tail = { act: 2, step: 1, t: 1 };
    f.railAct = q < 0.5 ? 2 : 3;
    f.railQ = q < 0.5 ? 1 : 0;
    f.models[2] = mdl({
      wipe: mix(0.14, 0, smooth(q, 0.02, 0.32)),
      clock: 1 + q * 0.3,
      arrive: 1,
      grow: 0.4,
      x: -0.32
    });
    f.models[3] = mdl({
      wipe: 1,
      clock: -0.36 + q * 0.36,
      arrive: outCubic(span(q, 0.2, 0.9)),
      type: span(q, 0.55, 1),
      explode: (1 - outQuart(span(q, 0.2, 0.96))) * 0.7,
      lead: -1,
      x: mix(0.24, 0, outCubic(span(q, 0.2, 1))),
      clip: 'splitR',
      split
    });
  } else if (ph.kind === 'act' && ph.act === 3) {
    f.types[3] = 1;
    f.models[3] = mdl({ wipe: 1, clock: q, arrive: 1, type: 1 });
    f.beatAct = 3;
    f.beatQ = q;
    f.railAct = 3;
    f.railQ = q;
    f.slide = 2;
  } else if (ph.kind === 'outro') {
    f.slide = 2;
    f.railAct = 3;
    f.railQ = 1;
    f.rest = outCubic(span(q, 0.06, 0.92));
    f.types[3] = 1 - inCubic(span(q, 0.0, 0.22));
    f.models[3] = mdl({
      wipe: 1,
      clock: 1 + q * 0.35,
      arrive: 1,
      type: 1 - inCubic(span(q, 0.0, 0.22)),
      explode: outCubic(span(q, 0.1, 0.7)) * 0.55,
      x: mix(0, -0.42, outCubic(span(q, 0.08, 0.85)))
    });
  }

  return f;
}

function beatPhase(q, i, count) {
  const pad = 0.04;
  const size = (1 - pad * 2) / count;
  const at = pad + i * size;
  const ramp = Math.min(0.14, size * 0.42);
  return smooth(q, at, at + ramp) * (1 - smooth(q, at + size - ramp * 0.45, at + size + ramp * 0.45));
}

function beatPhaseWide(q, i, count) {
  const pad = 0.02;
  const size = (1 - pad * 2) / count;
  const at = pad + i * size;
  const ramp = Math.min(0.24, size * 0.58);
  const fade = Math.min(0.22, size * 0.48);
  return smooth(q, at, at + ramp) * (1 - smooth(q, at + size - fade, at + size + fade));
}

/* Ramps up and then stays up. The full-frame panels use this so they own the
   frame until the next phase takes it from them. */
function beatHold(q, i, count) {
  const pad = 0.02;
  const size = (1 - pad * 2) / count;
  const at = pad + i * size;
  const ramp = Math.min(0.24, size * 0.58);
  return smooth(q, at, at + ramp);
}

function beatT(act, step, q, counts, gate = 1) {
  const held = (act === 1 || act === 2) && step === 1;
  let localQ = q;
  if (act === 0) {
    localQ = Math.max(0, (q - SEQ_HOLD) / (1 - SEQ_HOLD)) * gate;
  }
  return held ? beatHold(localQ, step, counts[act]) : beatPhase(localQ, step, counts[act]);
}

const MODEL_SPECS = [
  {
    url: 'models/beaver-meshopt.glb',
    turns: 1.35,
    idle: 0.9,
    sequence: true,
    view: {
      orient: [0, 0, 0],
      axis: 'x',
      pose: [0, 0, 0],
      fit: { wide: 0.8, narrow: 0.92 },
      cap: 0.74,
      bias: -0.11
    },
    portrait: {
      axis: 'x',
      pose: [0, 0, 0],
      fit: 0.52,
      cap: 0.66,
      bias: -0.01,
      fill: 1
    }
  },
  {
    url: 'models/t90m-stage.glb?v=3',
    turns: 0.85,
    idle: 0.55,
    view: {
      orient: [0, 0, 0],
      axis: 'y',
      /* Pitched further over so the camera looks down onto the roof instead of
         up into the open underside of the shell, and framed smaller so a tall
         subject stops swallowing the headline the way the long ones don't. */
      pose: [0.22, 0.45, 0.04],
      fit: { wide: 0.7, narrow: 0.64 },
      cap: 0.8,
      bias: -0.12
    },
    portrait: { fit: 0.54, fill: 0.92 }
  },
  {
    url: 'models/mp7.glb',
    turns: 1.4,
    idle: 1.05,
    /* No teardown on this one - it arrives and leaves on depth alone. */
    noExplode: true,
    view: {
      orient: [0, 0, -Math.PI / 2],
      axis: 'x',
      pose: [0.1, -0.26, 0.05],
      fit: { wide: 0.7, narrow: 0.82 },
      cap: 0.7,
      bias: -0.08
    },
    portrait: {
      orient: [0, 0, Math.PI],
      axis: 'y',
      pose: [0.06, 0, 0],
      fit: 0.5,
      cap: 0.64,
      fill: 1
    }
  },
  {
    url: 'models/sigspear-stage.glb',
    turns: 1.3,
    idle: 0.85,
    view: {
      orient: [0, 0, -Math.PI / 2],
      axis: 'x',
      pose: [0.1, -0.28, 0.05],
      fit: { wide: 0.78, narrow: 0.9 },
      cap: 0.72,
      bias: -0.1
    },
    portrait: {
      orient: [0, 0, Math.PI],
      axis: 'y',
      pose: [0.07, 0, -0.02],
      fit: 0.5,
      cap: 0.64,
      fill: 1
    }
  }
];

function viewFor(spec, portrait, narrow, band) {
  const base = spec.view;
  const view = portrait && spec.portrait ? { ...base, ...spec.portrait } : base;
  const fit = typeof view.fit === 'number' ? view.fit : narrow ? view.fit.narrow : view.fit.wide;
  if (!band) return { ...view, fit };
  return { ...view, fit: band.fit * (view.fill ?? 1), bias: band.bias };
}

function retuneMaterial(material) {
  material.flatShading = false;

  /* Palette atlases already carry the CAD colors. Treating them as bare
     metal with a darkened multiplier makes a turret vanish on black. */
  if (material.map) {
    /* These two ship as open shells out of CAD, so single-sided faces let the
       camera look straight through the hull. Rendering both sides closes the
       turret up without touching its colour. */
    material.side = THREE.DoubleSide;
    material.metalness = 0.38;
    material.roughness = 0.5;
    material.envMapIntensity = 1.08;
    material.color.setRGB(1, 1, 1);
    material.needsUpdate = true;
    return;
  }

  material.side = THREE.FrontSide;

  const c = material.color;
  const maxc = Math.max(c.r, c.g, c.b);
  const minc = Math.min(c.r, c.g, c.b);
  const sat = maxc - minc;
  let luma = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

  material.envMapIntensity = 1;

  /* Near-black CAD fills read as holes in the environment once they are
     treated as metal - give them a dark phosphate albedo instead. */
  if (luma < 0.05) {
    material.color.setRGB(0.2, 0.205, 0.22);
    luma = 0.205;
  }

  if (sat > 0.22 && c.r > c.b) {
    material.metalness = 1;
    material.roughness = 0.3;
    material.envMapIntensity = 1.15;
  } else if (luma < 0.28) {
    material.metalness = 0.72;
    material.roughness = 0.44;
    material.envMapIntensity = 0.85;
  } else {
    material.metalness = 1;
    material.roughness = mix(0.42, 0.15, clamp01((luma - 0.28) / 0.64));
  }

  material.color.multiplyScalar(0.84);
  material.needsUpdate = true;
}

/* ===== Shell splitting =====
   The Beaver's receiver exports as a single mesh with the full-length top rail
   welded into it as a second, disconnected shell - so "keep only the upper
   receiver" kept the rail too, and there was no second node to exclude.

   Connected components over the triangle graph separates them exactly: the
   receiver body comes out as one island (7.1k tris, 0.15 x 0.86 x 0.24) and
   the rail as another (5.6k tris, 0.08 x 2.0 x 0.03). Vertices are welded by
   quantised position first, because a CAD tessellation duplicates vertices
   along shared edges and would otherwise shatter one solid into many islands.

   The split geometries share the original's attribute buffers - only the index
   is rebuilt - so this costs an index array, not a copy of the mesh. */
function splitShells(mesh) {
  const geo = mesh.geometry;
  const pos = geo && geo.attributes && geo.attributes.position;
  const idx = geo && geo.index;
  if (!pos || !idx) return null;

  const n = pos.count;
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (a) => {
    while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; }
    return a;
  };
  const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };

  const seen = new Map();
  const K = 1e5;
  for (let i = 0; i < n; i++) {
    const key = Math.round(pos.getX(i) * K) + '_' +
                Math.round(pos.getY(i) * K) + '_' +
                Math.round(pos.getZ(i) * K);
    const prev = seen.get(key);
    if (prev === undefined) seen.set(key, i); else uni(prev, i);
  }

  const ia = idx.array;
  const tris = ia.length / 3;
  for (let t = 0; t < tris; t++) {
    uni(ia[t * 3], ia[t * 3 + 1]);
    uni(ia[t * 3 + 1], ia[t * 3 + 2]);
  }

  const buckets = new Map();
  for (let t = 0; t < tris; t++) {
    const r = find(ia[t * 3]);
    let b = buckets.get(r);
    if (!b) { b = []; buckets.set(r, b); }
    b.push(t);
  }
  if (buckets.size < 2 || buckets.size > 64) return null;

  const v = new THREE.Vector3();
  const out = [];
  for (const list of buckets.values()) {
    const arr = new ia.constructor(list.length * 3);
    const box = new THREE.Box3();
    let w = 0;
    for (const t of list) {
      for (let k = 0; k < 3; k++) {
        const vi = ia[t * 3 + k];
        arr[w++] = vi;
        box.expandByPoint(v.fromBufferAttribute(pos, vi));
      }
    }
    const g = new THREE.BufferGeometry();
    for (const key in geo.attributes) g.setAttribute(key, geo.attributes[key]);
    g.setIndex(new THREE.BufferAttribute(arr, 1));
    /* Set explicitly - computeBoundingBox would measure the shared position
       buffer and hand every island the whole mesh's bounds. */
    g.boundingBox = box;
    g.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    out.push({ geometry: g, box, tris: list.length });
  }
  return out;
}

function buildEnvironment(renderer) {
  const scene = new THREE.Scene();

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(16, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 floorC = vec3(0.012, 0.012, 0.016);
          vec3 horizC = vec3(0.085, 0.088, 0.105);
          vec3 skyC   = vec3(0.34, 0.35, 0.40);
          vec3 col = h < 0.5
            ? mix(floorC, horizC, smoothstep(0.0, 0.5, h))
            : mix(horizC, skyC, pow(smoothstep(0.5, 1.0, h), 0.8));
          gl_FragColor = vec4(col, 1.0);
        }`
    })
  );
  scene.add(dome);

  const panel = new THREE.PlaneGeometry(1, 1);
  const softbox = (w, h, pos, rgb) => {
    const m = new THREE.Mesh(
      panel,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(rgb[0], rgb[1], rgb[2]), side: THREE.DoubleSide })
    );
    m.scale.set(w, h, 1);
    m.position.set(pos[0], pos[1], pos[2]);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };

  softbox(22, 1.15, [0, 4.1, 1.7], [17, 17, 17.5]);
  softbox(16, 0.7, [-1.2, -3.0, 2.8], [3.6, 3.9, 4.6]);
  softbox(7, 5, [5.0, 2.8, 4.2], [5.6, 5.6, 5.7]);
  softbox(6.5, 5.5, [-6.4, 0.6, 2.2], [1.5, 1.7, 2.2]);
  softbox(7, 4, [-3.4, 1.8, -5.2], [4.6, 3.9, 2.9]);
  softbox(12, 12, [0, -7.5, 0.5], [0.14, 0.14, 0.18]);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const target = pmrem.fromScene(scene, 0.012);
  pmrem.dispose();

  dome.geometry.dispose();
  dome.material.dispose();
  scene.traverse((o) => { if (o.isMesh && o.material.dispose) o.material.dispose(); });
  panel.dispose();

  return target.texture;
}

function boot(root) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = root.querySelector('[data-hm-gl]');
  if (!canvas) return;
  if (reduceMotion.matches) return;
  /* Mobile skips the whole cinematic hero and opens straight to "Our
     systems" (see the matching display:none in home-stage.css) - no
     point paying for four GLTF loads and a live WebGL loop for acts
     nobody scrolls through. */
  if (window.matchMedia('(max-width: 900px)').matches) return;

  bootLive(root, canvas, reduceMotion);
}

async function bootLive(root, canvas, reduceMotion) {
  try {
    await ensureCad();
  } catch (err) {
    console.error('[home-stage] beaver cad failed', err);
    return;
  }
  fillSeqCopy(root);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
  } catch (err) {
    return;
  }
  if (!renderer.capabilities.isWebGL2) {
    renderer.dispose();
    return;
  }

  renderer.setClearAlpha(0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  const darkEnv = buildEnvironment(renderer);
  scene.environment = darkEnv;
  scene.environmentIntensity = 1;

  const camera = new THREE.PerspectiveCamera(VFOV_DEG, 1, 0.005, 20);
  camera.position.set(0, 0, CAM_DIST);
  camera.lookAt(0, 0, 0);
  const siteCamPos = new THREE.Vector3(0, 0, CAM_DIST);

  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(2.4, 3.4, 2.8);
  scene.add(key);

  const edge = new THREE.DirectionalLight(0xbfd2ec, 0.55);
  edge.position.set(-3.2, 0.6, 1.4);
  scene.add(edge);

  const back = new THREE.DirectionalLight(0xffd9ac, 0.75);
  back.position.set(-1.4, 1.2, -3.4);
  scene.add(back);

  let beaverLook = true;
  function markMaterials() {
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mat of mats) {
        if (mat) mat.needsUpdate = true;
      }
    });
  }
  function applyBeaverLook(on) {
    if (on === beaverLook) return;
    beaverLook = on;
    renderer.toneMapping = THREE.NeutralToneMapping;
    markMaterials();
  }

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  const rigs = MODEL_SPECS.map((spec) => {
    const root3 = new THREE.Group();
    const pose = new THREE.Group();
    const spin = new THREE.Group();
    const scaler = new THREE.Group();
    const orient = new THREE.Group();
    const shift = new THREE.Group();

    root3.add(pose);
    pose.add(spin);
    spin.add(scaler);
    scaler.add(orient);
    orient.add(shift);
    root3.visible = false;
    scene.add(root3);

    return {
      spec,
      root: root3, pose, spin, scaler, orient, shift,
      plane: new THREE.Plane(new THREE.Vector3(1, 0, 0), 1e4),
      axis: new THREE.Vector3(),
      center: new THREE.Vector3(),
      localBox: new THREE.Box3(),
      view: null,
      portrait: null,
      halfLen: 1,
      rawLen: 1,
      loaded: false
    };
  });

  const axisVec = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0) };
  const tmpBox = new THREE.Box3();
  const tmpVec = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const corners = Array.from({ length: 8 }, () => new THREE.Vector3());

  function rest(rig) {
    rig.root.position.set(0, 0, 0);
    rig.root.rotation.set(0, 0, 0);
    rig.root.scale.setScalar(1);
    rig.pose.rotation.set(0, 0, 0);
    rig.spin.rotation.set(0, 0, 0);
    rig.scaler.scale.setScalar(1);
  }

  function reorient(rig) {
    const view = rig.view;
    rest(rig);
    if (rig.spec.sequence) {
      rig.orient.quaternion.copy(CAD_TO_WORLD);
      rig.shift.position.copy(CAD_OFFSET);
      rig.root.updateMatrixWorld(true);
      if (rig.upperBox && !rig.upperBox.isEmpty()) rig.localBox.copy(rig.upperBox);
      else if (rig.seqParts) rig.localBox.copy(measureUpperBox(rig.seqParts));
      rig.localBox.getSize(tmpVec);
      rig.rawLen = view.axis === 'x' ? tmpVec.x : tmpVec.y;
      rig.pose.rotation.fromArray(view.pose);
      return;
    }
    rig.orient.quaternion.identity();
    rig.orient.rotation.fromArray(view.orient);
    rig.root.updateMatrixWorld(true);
    rig.localBox.setFromObject(rig.orient);
    rig.localBox.getSize(tmpVec);
    rig.rawLen = view.axis === 'x' ? tmpVec.x : tmpVec.y;
    rig.pose.rotation.fromArray(view.pose);
  }

  /* A real exploded view separates every part along its own assembly vector -
     the line from the centre of the assembly out through the part. Offsetting
     along one shared axis instead only spreads a rifle lengthwise and leaves
     anything stacked above or beside the bore sitting inside its neighbours.

     So each part stores the full 3-D delta from the assembly centroid to its
     own centroid, measured in its parent's space. Scaling that delta pushes
     every component straight out of where it was fitted and pulls it back to
     exactly the same seat, and because the vector is parent-local the whole
     scattered assembly still turns as one rigid object. */
  const partBox = new THREE.Box3();
  const partCentre = new THREE.Vector3();
  const partAnchor = new THREE.Vector3();
  const partInv = new THREE.Matrix4();

  function prepExplode(rig, model) {
    rig.root.updateMatrixWorld(true);
    partBox.setFromObject(model);
    if (partBox.isEmpty()) { rig.parts = []; rig.canExplode = false; return; }
    partBox.getSize(tmpVec);
    const size = tmpVec.clone();
    partBox.getCenter(tmpVec);
    const centre = tmpVec.clone();

    let axis = 'x';
    if (size.y > size.x && size.y > size.z) axis = 'y';
    else if (size.z > size.x && size.z > size.y) axis = 'z';
    const half = Math.max(1e-5, size[axis] / 2);

    const parts = [];
    model.traverse((node) => {
      if (!node.isMesh || !node.geometry) return;
      if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
      const bb = node.geometry.boundingBox;
      if (!bb) return;

      bb.getCenter(partCentre);
      node.localToWorld(partCentre);

      /* Where the part sits along the long axis, used only to stagger the
         order things come apart so the assembly peels from one end. */
      const t = Math.max(-1, Math.min(1, (partCentre[axis] - centre[axis]) / half));

      /* Both points into the parent's space, then subtract - transformDirection
         would normalise and throw away the distance we need. */
      partAnchor.copy(centre);
      if (node.parent) {
        partInv.copy(node.parent.matrixWorld).invert();
        partCentre.applyMatrix4(partInv);
        partAnchor.applyMatrix4(partInv);
      }
      const delta = partCentre.clone().sub(partAnchor);

      /* Walk up for a name - GLTFLoader splits a multi-primitive mesh into
         child meshes that inherit nothing but their parent's name. */
      let named = node;
      let label = '';
      while (named && !label) {
        label = named.name || '';
        named = named.parent;
      }
      /* GLTFLoader runs names through PropertyBinding.sanitizeNodeName, which
         turns every space into an underscore - "Upper Reciever" arrives as
         "Upper_Reciever". Normalise separators before matching. */
      const clean = label.replace(/[\s_.\-]+/g, ' ').trim();
      const keep = !!(rig.spec.isolateKeep && rig.spec.isolateKeep.test(clean));

      /* Parts sitting on the centroid have no delta to normalise, so they get
         a stable pseudo-random bearing to be thrown along instead. */
      const fling = delta.clone();
      if (fling.lengthSq() < 1e-9) {
        const a = parts.length * 2.399963;
        fling.set(Math.cos(a), Math.sin(a * 0.7), Math.sin(a));
      }
      fling.normalize();

      parts.push({ node, base: node.position.clone(), delta, fling, t, keep });
    });

    rig.parts = parts;
    rig.spread = size[axis];
    rig.keeps = parts.filter((x) => x.keep).length;
    rig.canExplode = parts.length >= 8 && !rig.spec.noExplode;
  }

  /* Replace any mesh the spec marks as welded with one mesh per shell, so the
     isolation can address the parts independently. */
  function applyShellSplit(rig, model) {
    const rule = rig.spec.splitShells;
    if (!rule) return;
    const targets = [];
    model.traverse((node) => {
      if (!node.isMesh) return;
      const clean = (node.name || '').replace(/[\s_.\-]+/g, ' ').trim();
      if (rule.match.test(clean)) targets.push(node);
    });

    for (const node of targets) {
      const shells = splitShells(node);
      if (!shells || shells.length < 2) continue;
      const parent = node.parent;
      if (!parent) continue;

      for (const shell of shells) {
        const size = shell.box.getSize(new THREE.Vector3()).toArray().sort((a, b) => b - a);
        const slender = size[1] > 1e-6 && size[0] / size[1] >= rule.slender;
        const piece = new THREE.Mesh(shell.geometry, node.material);
        piece.name = slender ? rule.slenderName : node.name;
        piece.position.copy(node.position);
        piece.quaternion.copy(node.quaternion);
        piece.scale.copy(node.scale);
        parent.add(piece);
      }
      parent.remove(node);
    }
  }

  function adopt(rig, gltf) {
    const model = gltf.scene;
    rig.shift.add(model);

    if (rig.spec.sequence) {
      rest(rig);
      rig.orient.rotation.set(0, 0, 0);
      rig.orient.quaternion.copy(CAD_TO_WORLD);
      rig.shift.position.copy(CAD_OFFSET);
      rig.seqParts = prepare(model, rig.plane);
      attachClipPlane(rig.seqParts, rig.plane);
      rig.seqRt = createSeqRuntime();
      rig.root.updateMatrixWorld(true);
      rig.upperBox = measureUpperBox(rig.seqParts);
      rig.localBox.copy(rig.upperBox);
      rig.canExplode = false;
      rig.loaded = true;
      layout();
      return;
    }

    applyShellSplit(rig, model);

    rest(rig);
    rig.orient.rotation.set(0, 0, 0);
    rig.shift.position.set(0, 0, 0);
    rig.root.updateMatrixWorld(true);
    tmpBox.setFromObject(model);
    tmpBox.getCenter(tmpVec);
    rig.shift.position.copy(tmpVec).negate();

    model.traverse((node) => {
      if (!node.isMesh) return;
      node.frustumCulled = false;
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      for (const m of mats) {
        if (m.color) retuneMaterial(m);
        m.clippingPlanes = [rig.plane];
      }
    });

    prepExplode(rig, model);

    rig.loaded = true;
    layout();
  }

  /* A single-mesh export (the T-90M and SPEAR ship as one or two primitives)
     has nothing to take apart, so those rigs lean on scale and depth instead
     and this is a no-op for them. */
  function paintExplode(rig, m) {
    const parts = rig.parts;
    if (!rig.canExplode || !parts || !parts.length) return;
    const e = clamp01(m.explode);
    const iso = rig.keeps ? clamp01(m.isolate) : 0;
    if (e < 0.0005 && iso < 0.0005 && !rig.exploded) return;
    rig.exploded = e >= 0.0005 || iso >= 0.0005;

    /* Each part travels this multiple of its own distance from the assembly
       centroid, so the whole thing opens up in proportion rather than smearing
       along one axis. */
    const GAIN = 1.9;
    /* Far enough that nothing thrown clear is still on screen. */
    const FLING = rig.spread * 5.5;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (e < 0.0005 && iso < 0.0005) {
        p.node.position.copy(p.base);
        continue;
      }
      /* Stagger by position so the assembly peels from one end rather than
         everything blooming at once. */
      const s = m.lead >= 0 ? (p.t + 1) * 0.5 : 1 - (p.t + 1) * 0.5;
      const local = clamp01((e * 1.42) - s * 0.42);
      const spread = outCubic(local) * GAIN;

      if (p.keep) {
        /* The part being isolated retreats back into its own seat as the
           others leave, so it ends the beat exactly where it was fitted. */
        p.node.position.copy(p.base).addScaledVector(p.delta, spread * (1 - iso));
      } else {
        const gone = inCubic(iso) * FLING * (0.75 + (i % 7) * 0.07);
        p.node.position.copy(p.base)
          .addScaledVector(p.delta, spread)
          .addScaledVector(p.fling, gone);
      }
    }
  }

  /* The four assemblies are 11 MB together and only the first one is on screen
     when the page opens, so each is gated on the scroll position that needs
     it. A visitor who never scrolls pays for one. The gates sit well ahead of
     the act that consumes them, and each act's still image covers the rig
     until its geometry lands. */
  const NEED_AT = [0, 0.02, 0.14, 0.3];
  const bootPct = root.querySelector('[data-hm-boot-pct]');
  const bootBar = root.querySelector('[data-hm-boot-bar]');
  let loadingIndex = -1;

  function showBoot(frac) {
    const pct = Math.round(clamp01(frac) * 100);
    if (bootPct) bootPct.textContent = pct + '%';
    if (bootBar) bootBar.style.transform = 'scaleX(' + clamp01(frac).toFixed(3) + ')';
  }

  function startLoad(index) {
    const rig = rigs[index];
    loadingIndex = index;
    loader.load(
      rig.spec.url,
      (gltf) => {
        loadingIndex = -1;
        try {
          adopt(rig, gltf);
        } catch (err) {
          console.error('[home-stage] adopt failed', rig.spec.url, err);
          rig.failed = true;
          if (index === 0) {
            root.dataset.hmMode = 'static';
            stop();
            return;
          }
        }
        if (index === 0) {
          showBoot(1);
          root.dataset.hmLoaded = '1';
          startModelIntro();
        }
        pumpLoads(progress());
      },
      index === 0
        ? (e) => { if (e.lengthComputable && e.total) showBoot(e.loaded / e.total); }
        : undefined,
      (err) => {
        console.error('[home-stage] load failed', rig.spec.url, err);
        loadingIndex = -1;
        rig.failed = true;
        if (index === 0) {
          root.dataset.hmMode = 'static';
          stop();
          return;
        }
        pumpLoads(progress());
      }
    );
  }

  let idleKick = false;
  function pumpLoads(p) {
    if (loadingIndex >= 0) return;
    for (let i = 0; i < rigs.length; i++) {
      if (rigs[i].loaded || rigs[i].failed) continue;
      /* Strictly in order - a later act is never fetched ahead of an earlier
         one, so bandwidth always goes to whatever the viewer meets next. */
      if (p >= NEED_AT[i] || (i <= 1 && idleKick)) startLoad(i);
      return;
    }
  }

  let narrow = false;

  function projectedBounds(rig) {
    const lo = rig.localBox.min;
    const hi = rig.localBox.max;
    const m = rig.scaler.matrixWorld;
    let i = 0;
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 2; z++) {
          corners[i++]
            .set(x ? hi.x : lo.x, y ? hi.y : lo.y, z ? hi.z : lo.z)
            .applyMatrix4(m)
            .project(camera);
        }
      }
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const c of corners) {
      if (c.x < minX) minX = c.x;
      if (c.x > maxX) maxX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.y > maxY) maxY = c.y;
    }
    return { minX, maxX, minY, maxY };
  }

  function frameRig(rig) {
    const view = rig.view;
    const frac = view.fit;
    const onX = view.axis === 'x';
    const cap = view.cap;
    const visHalfH = Math.tan((CAM_FOV * Math.PI) / 360) * CAM_DIST;
    const visHalfW = visHalfH * camera.aspect;

    rig.root.position.set(0, 0, 0);
    rig.root.rotation.set(0, 0, 0);
    rig.root.scale.setScalar(1);
    rig.spin.rotation.set(0, 0, 0);
    rig.scaler.scale.setScalar((2 * (onX ? visHalfW : visHalfH) * frac) / rig.rawLen);

    for (let pass = 0; pass < 3; pass++) {
      rig.root.updateMatrixWorld(true);
      const b = projectedBounds(rig);
      const halfX = (b.maxX - b.minX) / 2;
      const halfY = (b.maxY - b.minY) / 2;
      if (!(halfX > 0) || !(halfY > 0) || !isFinite(halfX) || !isFinite(halfY)) break;

      const k = Math.min(frac / (onX ? halfX : halfY), cap / (onX ? halfY : halfX));
      rig.scaler.scale.multiplyScalar(k);
      rig.root.position.x -= ((b.minX + b.maxX) / 2) * k * visHalfW;
      rig.root.position.y -= ((b.minY + b.maxY) / 2 - view.bias) * k * visHalfH;
    }

    rig.center.copy(rig.root.position);
    rig.halfLen = (rig.rawLen * rig.scaler.scale.x) / 2;
    rig.fitScale = rig.scaler.scale.x;
  }

  function portraitBand() {
    const h = window.innerHeight;
    let top = 0;
    let bottom = h;
    for (const el of bandTop) {
      if (el.offsetHeight) top = Math.max(top, el.offsetTop + el.offsetHeight);
    }
    for (const el of bandBottom) {
      if (el.offsetHeight) bottom = Math.min(bottom, el.offsetTop);
    }
    const pad = h * 0.03;
    top = Math.min(top + pad, h * 0.42);
    bottom = Math.max(bottom - pad, h * 0.58);
    return { fit: (bottom - top) / h, bias: 1 - (top + bottom) / h };
  }

  function layout() {
    const w = root.clientWidth || window.innerWidth;
    const h = window.innerHeight;
    if (!w || !h) return;

    narrow = w < 860;
    const portrait = w / h < 0.88;
    root.dataset.hmPortrait = portrait ? '1' : '0';

    camera.aspect = w / h;
    /* Fit boxes are measured through the site camera, not the sequence rig. */
    const holdFov = camera.fov;
    const holdNear = camera.near;
    const holdFar = camera.far;
    const holdPos = camera.position.clone();
    camera.fov = CAM_FOV;
    camera.near = 0.1;
    camera.far = 40;
    camera.position.copy(siteCamPos);
    camera.lookAt(0, 0, 0);
    resetSeqCamera(camera);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

    const band = portrait ? portraitBand() : null;
    for (const rig of rigs) {
      if (!rig.loaded) continue;
      rig.view = viewFor(rig.spec, portrait, narrow, band);
      if (portrait !== rig.portrait) {
        rig.portrait = portrait;
        reorient(rig);
      }
      frameRig(rig);
    }

    camera.fov = holdFov;
    camera.near = holdNear;
    camera.far = holdFar;
    camera.position.copy(holdPos);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(w, h, false);
    measureLeads();
    placePull();
  }

  let dprScale = 1;
  function pixelRatio() {
    const device = window.devicePixelRatio || 1;
    const ceiling = window.matchMedia('(pointer: coarse)').matches ? 1.7 : 2;
    return Math.max(1, Math.min(device * 1.5, ceiling) * dprScale);
  }

  const voidEl = root.querySelector('[data-hm-void]');
  const shadowEl = root.querySelector('[data-hm-shadow]');
  const splitEl = root.querySelector('[data-hm-split]');
  const restEl = document.querySelector('[data-hm-rest]');
  if (restEl) restEl.classList.add('hm-rest--live');
  const typeByAct = new Map(
    [...root.querySelectorAll('[data-hm-type]')].map((el) => [el.dataset.hmType, el])
  );
  const beats = [...root.querySelectorAll('[data-hm-beat]')];
  const chromeEl = root.querySelector('[data-hm-chrome]');
  const bandTop = [...root.querySelectorAll('[data-hm-band="top"], .hm-type__label')];
  const bandBottom = [...root.querySelectorAll('[data-hm-band="bottom"], .hm-type__sub')];
  const railFills = [...root.querySelectorAll('[data-hm-rail-fill]')];
  const railSteps = [...root.querySelectorAll('[data-hm-rail-step]')];
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const counts = [...root.querySelectorAll('[data-hm-count]')];
  const giants = [...root.querySelectorAll('.hm-giant')];
  const plates = [...root.querySelectorAll('[data-hm-plate]')];
  const leadsSvg = root.querySelector('[data-hm-leads]');
  const uaPromo = root.querySelector('[data-hm-promo="ua"]');
  const cadPromo = root.querySelector('[data-hm-promo="cad"]');
  const uaMapHost = root.querySelector('[data-hm-ua-map]');
  let uaMapSvg = null;

  if (uaMapHost) {
    fetch('maps/world.svg')
      .then((res) => (res.ok ? res.text() : Promise.reject()))
      .then((svg) => {
        const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const el = doc.documentElement;
        if (!el || el.tagName.toLowerCase() !== 'svg') return;
        el.classList.add('hm-promo__svg');
        el.setAttribute('viewBox', MAP_WORLD.join(' '));
        el.setAttribute('preserveAspectRatio', 'xMidYMid slice');
        uaMapHost.appendChild(document.importNode(el, true));
        uaMapSvg = uaMapHost.querySelector('svg');
        const grid = uaMapSvg && uaMapSvg.querySelector('.grid');
        if (grid) grid.setAttribute('aria-hidden', 'true');
        if (grid) grid.style.display = 'none';
      })
      .catch(() => { /* slam type still carries the beat */ });
  }

  /* ===== Leader lines =====
     Each plate row names a point on the model. The point is stored in
     normalised bounding-box coordinates, projected through the live camera
     every frame and joined to its row with a drawing-office elbow, so the copy
     stays wired to the geometry while the part turns. */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const leads = [];
  const leadPt = new THREE.Vector3();
  const leadView = new THREE.Vector3();
  const leadCentre = new THREE.Vector3();
  let leadW = 0;
  let leadH = 0;

  if (leadsSvg) {
    for (const row of root.querySelectorAll('[data-hm-pt]')) {
      const nums = row.dataset.hmPt.split(',').map(Number);
      if (nums.length !== 3 || nums.some((n) => !isFinite(n))) continue;
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('class', 'hm-lead__path');
      path.setAttribute('pathLength', '1');
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('class', 'hm-lead__dot');
      dot.setAttribute('r', '3.5');
      leadsSvg.append(path, dot);
      leads.push({
        row,
        act: Number(row.dataset.hmAct),
        p: nums,
        path,
        dot,
        tx: 0,
        ty: 0,
        shown: false
      });
    }
  }

  function measureLeads() {
    if (!leadsSvg) return;
    const box = leadsSvg.getBoundingClientRect();
    leadW = box.width;
    leadH = box.height;
    if (leadW && leadH) leadsSvg.setAttribute('viewBox', '0 0 ' + leadW + ' ' + leadH);
    for (const lead of leads) {
      const plate = lead.row.closest('[data-hm-plate]');
      if (!plate) continue;
      lead.tx = plate.offsetLeft + plate.offsetWidth;
      lead.ty = plate.offsetTop + lead.row.offsetTop + lead.row.offsetHeight / 2;
    }
  }

  function hideLead(lead) {
    if (!lead.shown) return;
    lead.shown = false;
    lead.path.style.opacity = '0';
    lead.dot.style.opacity = '0';
  }

  function paintLeads(f) {
    if (!leads.length || !leadW) return;
    for (const lead of leads) {
      const rig = rigs[lead.act];
      const t = lead.act === f.beatAct ? Number(lead.row.style.getPropertyValue('--t')) || 0 : 0;
      if (t < 0.04 || !rig || !rig.loaded || !rig.root.visible || !rig.view) {
        hideLead(lead);
        continue;
      }

      const b = rig.localBox;
      leadPt.set(
        mix(b.min.x, b.max.x, lead.p[0]),
        mix(b.min.y, b.max.y, lead.p[1]),
        mix(b.min.z, b.max.z, lead.p[2])
      );
      leadPt.applyMatrix4(rig.scaler.matrixWorld);

      /* Anchors on the far side of the object are dimmed rather than hidden,
         so a leader fades as its point rotates away instead of blinking. */
      leadView.copy(leadPt).applyMatrix4(camera.matrixWorldInverse);
      leadCentre.copy(rig.root.position).applyMatrix4(camera.matrixWorldInverse);
      const depth = clamp01((leadView.z - leadCentre.z) / Math.max(0.12, rig.halfLen * 0.9) + 0.5);

      leadPt.project(camera);
      if (!isFinite(leadPt.x) || !isFinite(leadPt.y)) { hideLead(lead); continue; }
      const ax = (leadPt.x * 0.5 + 0.5) * leadW;
      const ay = (-leadPt.y * 0.5 + 0.5) * leadH;
      if (ax < lead.tx + 40 || ax > leadW - 8 || ay < 8 || ay > leadH - 8) {
        hideLead(lead);
        continue;
      }

      const draw = outCubic(clamp01((t - 0.12) / 0.55));
      const alpha = (0.12 + depth * 0.3) * t;
      lead.path.setAttribute('d',
        'M' + lead.tx.toFixed(1) + ',' + lead.ty.toFixed(1) +
        'L' + (lead.tx + 26).toFixed(1) + ',' + lead.ty.toFixed(1) +
        'L' + ax.toFixed(1) + ',' + ay.toFixed(1));
      lead.path.style.strokeDashoffset = (1 - draw).toFixed(4);
      lead.path.style.opacity = alpha.toFixed(3);
      lead.dot.setAttribute('cx', ax.toFixed(1));
      lead.dot.setAttribute('cy', ay.toFixed(1));
      lead.dot.style.opacity = (alpha * draw).toFixed(3);
      lead.shown = true;
    }
  }

  const beatGroups = [0, 1, 2, 3, 4].map((act) =>
    beats.filter((el) => Number(el.dataset.hmAct) === act)
  );
  const beatCount = beatGroups.map((group) => {
    const steps = new Set(group.map((el) => el.dataset.hmStep));
    return Math.max(1, steps.size);
  });

  for (const word of root.querySelectorAll('[data-hm-word]')) {
    const text = word.textContent.trim();
    const sr = document.createElement('span');
    sr.className = 'hm-sr';
    sr.textContent = text;

    const frag = document.createDocumentFragment();
    frag.appendChild(sr);

    const line = document.createElement('span');
    line.className = 'hm-word__line';
    line.setAttribute('aria-hidden', 'true');
    [...text].forEach((ch, i) => {
      const cell = document.createElement('span');
      cell.className = 'hm-word__ch';
      cell.style.setProperty('--i', String(i));
      cell.textContent = ch === ' ' ? '\u00A0' : ch;
      line.appendChild(cell);
    });
    frag.appendChild(line);

    word.textContent = '';
    word.appendChild(frag);
    word.style.setProperty('--n', String(text.length));
  }

  for (const stamp of root.querySelectorAll('[data-hm-stamp]')) {
    const text = stamp.textContent.trim();
    const sr = document.createElement('span');
    sr.className = 'hm-sr';
    sr.textContent = text;
    const line = document.createElement('span');
    line.className = 'hm-stamp__line';
    line.setAttribute('aria-hidden', 'true');
    [...text].forEach((ch, i) => {
      const cell = document.createElement('span');
      cell.className = 'hm-stamp__ch';
      cell.style.setProperty('--i', String(i));
      cell.textContent = ch === ' ' ? '\u00A0' : ch;
      line.appendChild(cell);
    });
    stamp.textContent = '';
    stamp.append(sr, line);
    stamp.style.setProperty('--n', String(Math.max(1, text.length)));
  }

  let introT = 0;
  let introStart = 0;
  let typeIntroT = 0;
  let typeIntroStart = 0;
  let typeIntroQueued = false;
  const INTRO_MS = 2100;
  const TYPE_INTRO_MS = 2600;

  function startModelIntro() {
    if (progress() > BOUNDS[0].from + (BOUNDS[0].to - BOUNDS[0].from) * 0.06) {
      introT = 1;
      startTypeIntro();
      return;
    }
    introStart = performance.now();
    window.setTimeout(() => startTypeIntro(), 280);
  }

  function startTypeIntro() {
    if (typeIntroQueued) return;
    typeIntroQueued = true;
    typeIntroStart = performance.now();
    root.dataset.hmIntro = 'run';
  }

  function maybeStartTypeIntro() {
    if (typeIntroQueued) return;
    if (progress() * TRACK_VH > 8) startTypeIntro();
  }

  let pointerX = 0;
  let pointerY = 0;
  let parX = 0;
  let parY = 0;

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    pointerX = (e.clientX / window.innerWidth) * 2 - 1;
    pointerY = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  let pinned = false;

  function progress() {
    const rect = root.getBoundingClientRect();
    const vh = window.innerHeight;
    const covers = Math.min(rect.bottom, vh) - Math.max(rect.top, 0) > vh * 0.6;
    if (covers !== pinned) {
      pinned = covers;
      root.dataset.hmPinned = covers ? '1' : '0';
    }
    const travel = root.offsetHeight - vh;
    if (travel <= 0) return 0;
    return clamp01(-rect.top / travel);
  }

  let dark = 0;
  let wasDark = false;
  let hinted = false;

  function formatCount(el, t) {
    const target = Number(el.dataset.hmCount);
    if (!isFinite(target)) return;
    const v = Math.round(outExpo(clamp01(t)) * target);
    const pad = Number(el.dataset.hmPad || 0);
    let s = el.dataset.hmComma === '1' ? v.toLocaleString('en-US') : String(v);
    if (pad) s = String(v).padStart(pad, '0');
    el.textContent = s;
  }

  function overshoot(t) {
    const u = outExpo(clamp01(t));
    if (u < 0.76) return (u / 0.76) * 1.14;
    return mix(1.14, 1, (u - 0.76) / 0.24);
  }

  function paintDom(f) {
    if (voidEl) voidEl.style.setProperty('--slide', f.slide.toFixed(4));
    const splitOn = f.splitLine >= 0;
    if (splitEl) {
      splitEl.style.opacity = splitOn ? '1' : '0';
      if (splitOn) splitEl.style.setProperty('--split', f.splitLine.toFixed(4));
    }
    /* Hand the curtain the same edge the seam is riding. */
    if (splitOn) {
      root.dataset.hmCurtain = 'x';
      if (voidEl) voidEl.style.setProperty('--split', f.splitLine.toFixed(4));
    } else if (root.dataset.hmCurtain) {
      delete root.dataset.hmCurtain;
    }

    const isDark = f.slide > 0.05 && f.slide < 1.03;
    if (isDark !== wasDark) {
      wasDark = isDark;
      document.body.classList.toggle('hm-dark', isDark);
      if (themeMeta) themeMeta.setAttribute('content', isDark ? '#08080a' : '#f8f8f9');
    }

    /* Headlines are keyed by act now, not by model. */
    for (const [key, type] of typeByAct) {
      const a = Number(key);
      const reveal = clamp01(a === 0 ? outCubic(f.types[a]) : outExpo(f.types[a]));
      type.style.setProperty('--reveal', reveal.toFixed(4));
      type.style.setProperty('--drift', (a === f.beatAct ? f.beatQ : 0).toFixed(4));
      type.dataset.hmOn = reveal > 0.02 ? '1' : '0';
    }

    const beatGate = f.beatAct === 0 ? (f.introGate || 0) : 1;
    const tail = f.tail;
    for (const el of beats) {
      const act = Number(el.dataset.hmAct);
      const step = Number(el.dataset.hmStep);
      let t = 0;
      if (act === 0) {
        if (f.beatAct !== 0) t = 0;
        else if (step === 0) t = f.types[0] || 0;
        else t = (f.seqPanels && f.seqPanels[step]) || 0;
      } else {
        t = act === f.beatAct ? beatT(act, step, f.beatQ, beatCount, beatGate) : 0;
      }
      /* A panel carried into the following handoff keeps its own value so the
         model underneath is never uncovered between the two. */
      if (tail && tail.act === act && tail.step === step) t = tail.t;
      el.style.setProperty('--t', t.toFixed(4));
      el.dataset.hmOn = t > 0.015 ? '1' : '0';
    }

    /* The plate frame outlives its rows: it fades up once at the head of the
       act and holds until the act hands over, so there is always one fixed
       thing on screen to read against. */
    for (const plate of plates) {
      const on = Number(plate.dataset.hmAct) === f.beatAct;
      const gate = f.beatAct === 0 ? (f.introGate || 0) : 1;
      const v = on
        ? clamp01(Math.min(f.beatQ / 0.1, (1 - f.beatQ) / 0.08, 1)) * gate
        : 0;
      plate.style.setProperty('--plate', v.toFixed(4));
      plate.dataset.hmOn = v > 0.015 ? '1' : '0';
    }

    paintLeads(f);

    for (const el of counts) {
      const beat = el.closest('[data-hm-beat]');
      const t = beat ? Number(beat.style.getPropertyValue('--t')) : 0;
      formatCount(el, t);
    }
    for (const el of giants) {
      const beat = el.closest('[data-hm-beat]');
      const t = beat ? Number(beat.style.getPropertyValue('--t')) : 0;
      el.style.setProperty('--over', (f.beatAct === 0 ? outCubic(t) : overshoot(t)).toFixed(4));
    }

    if (chromeEl) {
      let mx = 0;
      for (const m of f.models) mx = Math.max(mx, m.type);
      chromeEl.style.opacity = (mx * (1 - f.rest * 0.9)).toFixed(3);
    }
    for (const fill of railFills) fill.style.setProperty('--fill', (f.railAct < 0 ? 0 : f.railQ).toFixed(4));
    for (const s of railSteps) {
      const on = Number(s.dataset.hmRailStep) === f.railAct;
      s.dataset.hmOn = on ? '1' : '0';
      if (s.tagName === 'BUTTON') s.setAttribute('aria-selected', on ? 'true' : 'false');
    }

    root.style.setProperty('--rest', f.rest.toFixed(4));
    if (restEl) {
      restEl.style.setProperty('--rest', f.rest.toFixed(4));
      restEl.dataset.hmOn = f.rest > 0.58 ? '1' : '0';
      let lift = 0;
      if (f.rest > 0.001) {
        const travel = Math.max(0, root.offsetHeight - window.innerHeight);
        const scrolled = Math.max(0, -root.getBoundingClientRect().top);
        lift = Math.min(0, scrolled - travel);
      }
      restEl.style.setProperty('--lift', lift.toFixed(1) + 'px');
      if (f.rest >= 0.985) restEl.classList.add('hm-rest--settled');
    }

    const lightWipe = Math.max(f.models[0].wipe, f.models[3].wipe);
    if (shadowEl) {
      /* Close-ups have no gun in the middle of the stage; the oval would float. */
      const closeUp = f.seqT > 1.35 && f.seqT < 8.15 ? 0 : 1;
      shadowEl.style.opacity = ((1 - f.dark) * lightWipe * closeUp).toFixed(3);
    }

    if (uaPromo) {
      uaPromo.style.setProperty('--scan', f.uaScan.toFixed(4));
      uaPromo.dataset.lock = f.uaScan > 0.38 ? '1' : '0';
    }
    if (cadPromo) {
      cadPromo.style.setProperty('--scan', f.cadScan.toFixed(4));
      cadPromo.style.setProperty('--cut', splitOn ? f.splitLine.toFixed(4) : '0');
    }

    if (pullEl) {
      /* Up from the moment the page opens - it is the shortcut past the
         stage, so it cannot arrive after the visitor has started scrolling. */
      const pullUntil = Math.max(SEQ_HOLD, 0.038);
      const show = f.beatAct === 0 ? clamp01((pullUntil - f.beatQ) / 0.022) : 0;
      pullEl.style.setProperty('--pull-in', show.toFixed(3));
      pullEl.style.setProperty('--pull-hit', show > 0.5 ? 'auto' : 'none');
      pullEl.setAttribute('aria-hidden', show > 0.5 ? 'false' : 'true');
      pullEl.tabIndex = show > 0.5 ? 0 : -1;
    }

    if (!hinted && f.beatAct === 0 && f.beatQ > 0.03) {
      hinted = true;
      root.dataset.hmHint = 'gone';
    }
  }

  let seqBlend = 0;
  let seqTarget = null;
  let lastF = null;
  let seqDt = 1 / 60;
  const siteLook = new THREE.Vector3();
  const blendLook = new THREE.Vector3();
  const seqCamHold = {
    pos: new THREE.Vector3(),
    look: new THREE.Vector3(),
    fov: VFOV_DEG,
    near: 0.005,
    far: 20,
    armed: false
  };

  function applyBeaverSpin(rig, q, now) {
    const spec = rig.spec;
    const gain = spinGain(q);
    if (gain <= 1e-5) {
      rig.spin.rotation.set(0, 0, 0);
      rig.seqSpin = 0;
      rig.spinIdle0 = 0;
      rig.spinDownFrom = null;
      return;
    }
    if (!rig.spinIdle0) rig.spinIdle0 = now;
    /* Same slow idle the other acts use. No extra scroll-driven turns on the hold. */
    const idle = ((now - rig.spinIdle0) / 1000) * spec.idle * (Math.PI / 180) * 12;
    let angle;
    if (q < SEQ_HOLD) {
      if (gain >= 0.999) {
        angle = idle;
        rig.spinDownFrom = null;
      } else {
        if (rig.spinDownFrom == null) {
          const cur = rig.seqSpin != null ? rig.seqSpin : idle;
          rig.spinDownFrom = Math.atan2(Math.sin(cur), Math.cos(cur));
        }
        angle = rig.spinDownFrom * gain;
      }
    } else {
      angle = gain * idle;
    }
    rig.spin.rotation.set(0, 0, 0);
    if (rig.view && rig.view.axis === 'x') rig.spin.rotation.x = angle;
    else rig.spin.rotation.y = angle;
    rig.seqSpin = angle;
  }

  function applyAxisClip(rig, m) {
    if (!rig.view) return;
    const localAxis = axisVec[rig.view.axis];
    rig.spin.getWorldQuaternion(tmpQuat);
    rig.axis.copy(localAxis).applyQuaternion(tmpQuat).normalize();
    const reach = rig.rawLen * (rig.scaler.scale.x || 1) * 1.12;
    const centre = rig.root.position.dot(rig.axis);
    const w = 1 - m.wipe;
    rig.plane.normal.copy(rig.axis);
    rig.plane.constant = -(centre + mix(-reach, reach, w));
  }

  function paintBeaverRig(rig, m) {
    const f = lastF;
    const live = m.wipe > 0.04 && (m.grow > 0.02 || m.clip !== 'axis');
    rig.root.visible = live;
    if (!live || !rig.view || !rig.seqParts || !rig.seqRt) return;

    const target = seqTarget || stateAt(f && f.seqT ? f.seqT : 0);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const fullSeq = seqBlend > 0.97;
    const lift = tickSeq(rig.seqRt, rig.seqParts, target, seqDt, camera, w, h, fullSeq);
    if (f) f.seqLift = Math.max(lift.explode, lift.extras);

    applyBeaverSpin(rig, (f && f.beaverQ) || 0, performance.now());

    const u = clamp01(1 - seqBlend);
    const fitted = rig.fitScale || 1;
    const introScale = u < 0.15 ? mix(0.86, 1, outExpo(m.arrive)) : 1;
    const siteZ = mix(-1.15, 0, m.arrive);
    rig.pose.rotation.set(0, 0, 0);
    rig.scaler.scale.setScalar(mix(1, fitted, u));
    rig.root.position.set(
      mix(0, rig.center.x + parX * 0.055 + m.x, u),
      mix(0, rig.center.y + parY * -0.035, u),
      mix(0, rig.center.z + siteZ, u)
    );
    rig.root.scale.setScalar(introScale);
    rig.root.rotation.set(parY * -0.05 * u, parX * 0.075 * u, 0);
    rig.root.updateMatrixWorld(true);
    applyAxisClip(rig, m);

    if (fullSeq) {
      seqCamHold.pos.copy(camera.position);
      if (rig.seqRt.look) seqCamHold.look.copy(rig.seqRt.look);
      seqCamHold.fov = camera.fov;
      seqCamHold.near = camera.near;
      seqCamHold.far = camera.far;
      seqCamHold.armed = true;
      return;
    }

    resetSeqCamera(camera);
    if (!seqCamHold.armed) {
      seqCamHold.pos.copy(camera.position);
      if (rig.seqRt.look) seqCamHold.look.copy(rig.seqRt.look);
      seqCamHold.fov = camera.fov;
      seqCamHold.near = camera.near;
      seqCamHold.far = camera.far;
      seqCamHold.armed = true;
    }

    if (seqBlend > 0.02) {
      camera.position.lerpVectors(seqCamHold.pos, siteCamPos, u);
      siteLook.set(0, 0, 0);
      blendLook.lerpVectors(seqCamHold.look, siteLook, u);
      camera.lookAt(blendLook);
      camera.fov = mix(seqCamHold.fov, CAM_FOV, u);
      camera.near = mix(seqCamHold.near, 0.1, u);
      camera.far = mix(seqCamHold.far, 40, u);
      camera.updateProjectionMatrix();
    }
  }

  function restoreSiteCamera() {
    camera.fov = CAM_FOV;
    camera.near = 0.1;
    camera.far = 40;
    camera.position.copy(siteCamPos);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    resetSeqCamera(camera);
    camera.updateProjectionMatrix();
  }

  function paintModel(rig, m) {
    if (rig.spec.sequence) {
      paintBeaverRig(rig, m);
      return;
    }
    /* A rig that cannot be taken apart still has to leave. Driving its exit
       off the clip plane meant a solid turret lost chunks of itself and was
       94% gone a third of the way into the swap - it read as vanishing, not
       departing. A single-mesh rig instead recedes and shrinks away along the
       same `explode` value the others scatter on, so both kinds of handoff
       run on one curve and neither ends on a jump. */
    const solid = !rig.canExplode;
    const dissolve = solid ? clamp01(m.explode) : 0;
    /* Squared, not eased. `explode` is already an ease-out curve, so running
       the size through a second one collapsed the turret to 4% of itself a
       third of the way through the swap. Squaring holds the mass while the
       incoming model builds, then lets it fall away quickly at the end. */
    const away = dissolve * dissolve;
    const shrink = solid ? mix(1, 0.02, away) : 1;

    const live = m.wipe > 0.001 && (m.grow > 0.02 || m.clip !== 'axis') && shrink > 0.03;
    const splitLive = (m.clip === 'splitL' || m.clip === 'splitR') && m.split > 0 && m.split < 1;
    rig.root.visible = live || splitLive;
    if (!rig.root.visible || !rig.view) return;

    const spec = rig.spec;
    const localAxis = axisVec[rig.view.axis];
    const now = performance.now();
    const angle = m.clock * spec.turns * TAU + (now / 1000) * spec.idle * (Math.PI / 180) * 12;
    rig.spin.rotation.set(0, 0, 0);
    if (rig.view.axis === 'x') rig.spin.rotation.x = angle;
    else rig.spin.rotation.y = angle;

    paintExplode(rig, m);

    const arrive = outExpo(m.arrive);
    rig.root.position.set(
      rig.center.x + parX * 0.055 + m.x,
      rig.center.y + parY * -0.035,
      rig.center.z + mix(-1.15, 0, arrive) - away * 1.9
    );
    rig.root.scale.setScalar(mix(0.86, 1, arrive) * m.grow * m.punch * shrink);
    rig.root.rotation.set(parY * -0.05, parX * 0.075, 0);
    rig.root.updateMatrixWorld(true);

    const visHalfH = Math.tan((CAM_FOV * Math.PI) / 360) * CAM_DIST;
    const visHalfW = visHalfH * camera.aspect;

    if (m.clip === 'splitL' || m.clip === 'splitR') {
      /* Plane starts on the right so the outgoing model is fully visible, then
         travels left so the incoming model is the one that remains. */
      const x = mix(visHalfW * 1.25, -visHalfW * 1.25, m.split);
      if (m.clip === 'splitL') {
        rig.plane.normal.set(-1, 0, 0);
        rig.plane.constant = x;
      } else {
        rig.plane.normal.set(1, 0, 0);
        rig.plane.constant = -x;
      }
      return;
    }

    rig.spin.getWorldQuaternion(tmpQuat);
    rig.axis.copy(localAxis).applyQuaternion(tmpQuat).normalize();
    const reach = rig.halfLen * 1.06;
    const centre = rig.root.position.dot(rig.axis);
    const w = 1 - m.wipe;
    rig.plane.normal.copy(rig.axis);
    rig.plane.constant = -(centre + mix(-reach, reach, w));
  }

  let running = false;
  let onScreen = false;
  let last = 0;
  let slowFrames = 0;
  let softBeatQ = 0;
  let inBeaverAct = false;

  function tick(now) {
    if (!running) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    seqDt = dt;

    if (introT < 1 && introStart) {
      introT = clamp01((now - introStart) / INTRO_MS);
    }
    if (typeIntroT < 1 && typeIntroStart) {
      typeIntroT = clamp01((now - typeIntroStart) / TYPE_INTRO_MS);
      if (typeIntroT >= 1) root.dataset.hmIntro = 'done';
    }

    const k = 1 - Math.exp(-dt * 4.5);
    parX += (pointerX - parX) * k;
    parY += (pointerY - parY) * k;

    const p = progress();
    const ph = phaseAt(p);
    if (ph && ph.kind === 'act' && ph.act === 0) {
      if (!inBeaverAct) softBeatQ = ph.local;
      else softBeatQ += (ph.local - softBeatQ) * (1 - Math.exp(-dt * 7));
      inBeaverAct = true;
    } else {
      inBeaverAct = false;
      if (ph) softBeatQ = ph.local;
    }

    pumpLoads(p);

    const f = frameAt(p, introT, typeIntroT);
    if (f.beatAct === 0) {
      f.beatQ = softBeatQ;
      f.beaverQ = softBeatQ;
      f.seqT = seqTimeFromQ(softBeatQ);
      f.types[0] = heroOpacity(f.seqT) * (typeIntroT > 0 ? outCubic(typeIntroT) : 0);
      f.seqPanels = {};
      for (const pan of SEQ_PANELS) f.seqPanels[pan.step] = panelOpacity(f.seqT, pan.step);
    }
    if (!typeIntroQueued && p * TRACK_VH > 8) startTypeIntro();
    dark = f.dark;

    seqBlend = 0;
    seqTarget = null;
    if (ph && ph.kind === 'act' && ph.act === 0) {
      seqBlend = 1;
      seqTarget = stateAt(f.seqT);
    } else if (ph && ph.kind === 'swap' && ph.swap === 0) {
      seqBlend = 1 - smooth(ph.local, 0, 0.4);
      const assembled = stateAt(SEQ_T_MAX);
      seqTarget = {
        ...assembled,
        extras: 0,
        explode: 0,
        rail: 0,
        carrier: 0,
        bullet: 0
      };
      f.seqT = SEQ_T_MAX;
      f.beaverQ = 1;
    }

    applyBeaverLook(seqBlend > 0.5);
    lastF = f;
    paintDom(f);
    for (let i = 0; i < rigs.length; i++) {
      if (rigs[i].loaded) paintModel(rigs[i], f.models[i]);
      else rigs[i].root.visible = false;
    }

    if (seqBlend <= 0.02) {
      restoreSiteCamera();
      camera.aspect = (canvas.clientWidth || window.innerWidth) / Math.max(1, canvas.clientHeight || window.innerHeight);
      camera.updateProjectionMatrix();
    }

    scene.environmentIntensity = mix(1, 1.32, dark);
    key.intensity = mix(1.55, 2.15, dark);
    back.intensity = mix(0.85, 1.55, dark);
    edge.intensity = mix(0.62, 0.55, dark);
    renderer.toneMappingExposure = mix(1.08, 1.26, dark);
    key.position.set(2.4 + parX * 2.1, 3.4 - parY * 1.6, 2.8);
    edge.position.set(-3.2 + parX * 1.2, 0.6 - parY * 0.8, 1.4);

    renderer.render(scene, camera);

    if (dt > 0.028) {
      if (++slowFrames > 90 && dprScale > 0.7) {
        slowFrames = 0;
        dprScale = 0.7;
        layout();
      }
    } else if (slowFrames > 0) {
      slowFrames--;
    }

    requestAnimationFrame(tick);
  }

  function play() {
    if (running) return;
    running = true;
    last = 0;
    requestAnimationFrame(tick);
  }
  function stop() { running = false; }

  function evaluate() {
    if (root.dataset.hmMode !== 'live') { stop(); return; }
    const rect = root.getBoundingClientRect();
    if (rect.bottom < window.innerHeight * 0.06) {
      onScreen = false;
      stop();
      return;
    }
    if (onScreen) play();
    else stop();
  }

  root.style.setProperty('--hm-track', TRACK_VH + 'vh');
  root.dataset.hmMode = 'live';

  new IntersectionObserver((entries) => {
    onScreen = entries[0].isIntersecting;
    evaluate();
  }, { rootMargin: '5% 0px' }).observe(root);

  window.addEventListener('scroll', evaluate, { passive: true });

  window.addEventListener('resize', layout, { passive: true });
  window.addEventListener('orientationchange', layout, { passive: true });
  window.addEventListener('scroll', maybeStartTypeIntro, { passive: true });

  function scrollToProgress(p) {
    const vh = window.innerHeight;
    const travel = Math.max(0, root.offsetHeight - vh);
    const target = root.offsetTop + clamp01(p) * travel;
    const smooth = window.__ttmSmoothScroll;
    if (smooth && !reduceMotion.matches) {
      smooth(target);
    } else {
      const prev = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo({ top: target, left: 0, behavior: 'instant' });
      document.documentElement.style.scrollBehavior = prev;
    }
    maybeStartTypeIntro();
  }

  function scrollToAct(act) {
    const bound = BOUNDS.find((b) => b.kind === 'act' && b.act === act);
    if (!bound) return;
    const inner = act === 0 ? 0.04 : 0.32;
    scrollToProgress(bound.from + (bound.to - bound.from) * inner);
  }

  for (const step of railSteps) {
    step.addEventListener('click', () => {
      scrollToAct(Number(step.dataset.hmRailStep));
    });
  }

  document.addEventListener('keydown', (e) => {
    if (root.dataset.hmMode !== 'live' || root.dataset.hmPinned !== '1') return;
    if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const active = railSteps.find((s) => s.dataset.hmOn === '1');
    if (!active) return;
    let act = Number(active.dataset.hmRailStep);
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') act = Math.min(3, act + 1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') act = Math.max(0, act - 1);
    else if (e.key === 'Home') act = 0;
    else if (e.key === 'End') act = 3;
    else return;
    e.preventDefault();
    scrollToAct(act);
  });
  reduceMotion.addEventListener('change', () => {
    if (reduceMotion.matches) {
      root.dataset.hmMode = 'static';
      document.body.classList.remove('hm-dark');
      stop();
    }
  });
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    root.dataset.hmMode = 'static';
    document.body.classList.remove('hm-dark');
    stop();
  });

  /* ===== Pull tab =====
     Drag-only by design: a click does nothing, because pulling the systems
     grid down should take an actual pull. Keyboard activation is kept so the
     control is still reachable without a pointer. */
  const pullEl = document.querySelector('[data-hm-pull]');

  function placePull() {
    if (!pullEl) return;
    /* Below the nav breakpoint the menu is parked off-canvas, so its box says
       nothing about where the gap is - the stylesheet pins the tab instead. */
    if (window.innerWidth <= 900) { pullEl.style.removeProperty('--pull-x'); return; }
    const brand = document.querySelector('.nav__logo');
    const menu = document.querySelector('.nav__menu');
    const host = pullEl.offsetParent;
    if (!brand || !menu || !host) return;
    const hb = host.getBoundingClientRect();
    const bb = brand.getBoundingClientRect();
    const mb = menu.getBoundingClientRect();
    if (!(mb.left > bb.right)) return;
    const mid = (bb.right + mb.left) / 2 - hb.left;
    pullEl.style.setProperty('--pull-x', (mid - pullEl.offsetWidth / 2).toFixed(1) + 'px');
  }

  function scrollToRestTop() {
    const target = root.offsetTop + Math.max(0, root.offsetHeight - window.innerHeight);
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo({ top: target, left: 0, behavior: 'instant' });
    document.documentElement.style.scrollBehavior = prev;
  }

  if (pullEl && restEl) {
    const REACH = 260;
    const COMMIT = 0.34;
    let dragging = false;
    let startY = 0;
    let travelled = 0;
    let busy = false;

    const setP = (v) => restEl.style.setProperty('--pull-p', v.toFixed(4));

    function open() {
      restEl.classList.add('hm-rest--pull');
      restEl.classList.remove('hm-rest--glide');
      setP(0);
    }

    function finish(commit) {
      restEl.classList.add('hm-rest--glide');
      pullEl.style.setProperty('--pull', '0px');
      pullEl.style.setProperty('--pull-stretch', '0px');
      delete pullEl.dataset.drag;
      travelled = 0;

      if (commit) {
        busy = true;
        setP(1);
        window.setTimeout(() => {
          /* Back into flow BEFORE the scroll: while it is fixed the document
             is a viewport shorter, and the target would be clamped. Both in
             one task, so nothing is painted in between. */
          restEl.classList.remove('hm-rest--pull', 'hm-rest--glide');
          restEl.style.removeProperty('--pull-p');
          scrollToRestTop();
          busy = false;
        }, 580);
      } else {
        setP(0);
        window.setTimeout(() => {
          restEl.classList.remove('hm-rest--pull', 'hm-rest--glide');
          restEl.style.removeProperty('--pull-p');
        }, 580);
      }
    }

    pullEl.addEventListener('pointerdown', (e) => {
      if (busy) return;
      dragging = true;
      startY = e.clientY;
      travelled = 0;
      pullEl.dataset.drag = '1';
      open();
      try { pullEl.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
      e.preventDefault();
    });

    pullEl.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      travelled = Math.max(0, e.clientY - startY);
      pullEl.style.setProperty('--pull-stretch', Math.min(travelled * 0.34, 30).toFixed(1) + 'px');
      setP(clamp01(travelled / REACH));
    });

    const stop = () => {
      if (!dragging) return;
      dragging = false;
      finish(travelled / REACH >= COMMIT);
    };
    pullEl.addEventListener('pointerup', stop);
    pullEl.addEventListener('pointercancel', stop);

    /* detail === 0 is a keyboard activation; a real mouse click is ignored. */
    pullEl.addEventListener('click', (e) => {
      if (busy || dragging || e.detail !== 0) return;
      open();
      window.setTimeout(() => finish(true), 30);
    });
  }

  layout();
  pumpLoads(progress());
  /* If the viewer settles without scrolling, bring the second assembly in
     anyway so the first handoff is never waiting on the network. */
  window.setTimeout(() => { idleKick = true; pumpLoads(progress()); }, 2600);
}

const stage = document.querySelector('[data-hm-stage]');
if (stage) boot(stage);
bootSheets();

function bootSheets() {
  const turn = document.querySelector('[data-hm-turn]');
  if (!turn || turn.closest('[hidden], .hm-parked')) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const track = turn.querySelector('.hm-turn__track') || turn;
  let sheetActive = false;

  function sheetProgress() {
    const rect = track.getBoundingClientRect();
    const vh = window.innerHeight;
    const travel = Math.max(1, track.offsetHeight - vh);
    return clamp01(-rect.top / travel);
  }

  function paintSheet() {
    if (!sheetActive) return;
    if (reduce.matches) {
      turn.style.setProperty('--sheet', '1');
      turn.dataset.hmOn = '1';
      return;
    }
    const t = outCubic(span(sheetProgress(), 0.08, 0.82));
    turn.style.setProperty('--sheet', t.toFixed(4));
    turn.dataset.hmOn = t > 0.55 ? '1' : '0';
    if (t >= 0.995) turn.classList.add('hm-turn--settled');
  }

  function scrollToHash(hash) {
    const trackEl = turn.querySelector('.hm-turn__track') || turn;
    const rect = trackEl.getBoundingClientRect();
    const travel = Math.max(0, trackEl.offsetHeight - window.innerHeight);
    let target = window.scrollY;
    if (hash === '#workshop') target += rect.top;
    else if (hash === '#field') target += rect.top + travel;
    const smooth = window.__ttmSmoothScroll;
    if (smooth && !reduce.matches) {
      smooth(target);
    } else {
      const prev = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo({ top: target, left: 0, behavior: 'instant' });
      document.documentElement.style.scrollBehavior = prev;
    }
    requestAnimationFrame(paintSheet);
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      paintSheet();
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', paintSheet, { passive: true });

  if (typeof IntersectionObserver !== 'undefined') {
    new IntersectionObserver((entries) => {
      sheetActive = entries[0].isIntersecting;
      if (sheetActive) paintSheet();
    }, { rootMargin: '30% 0px' }).observe(track);
  } else {
    sheetActive = true;
    paintSheet();
  }

  document.addEventListener('click', (e) => {
    const node = e.target;
    const el = node && node.nodeType === 1 ? node : node && node.parentElement;
    const link = el && el.closest ? el.closest('a[href="#workshop"], a[href="#field"]') : null;
    if (!link) return;
    const hash = link.getAttribute('href');
    if (hash !== '#workshop' && hash !== '#field') return;
    e.preventDefault();
    e.stopPropagation();
    history.replaceState(null, '', hash);
    scrollToHash(hash);
  }, true);

  if (location.hash === '#workshop' || location.hash === '#field') {
    requestAnimationFrame(() => scrollToHash(location.hash));
  }
}

bootChapters();

function bootChapters() {
  const root = document.querySelector('[data-hm-chapters]');
  const restEl = document.querySelector('[data-hm-rest]');
  if (!root) return;

  const chapters = [...root.querySelectorAll('[data-hm-chapter]')];
  if (!chapters.length) return;

  const stageEl = document.querySelector('[data-hm-stage]');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const labels = [
    'Beaver',
    'Library',
    'Work',
    'Process',
    'Team',
    'Careers',
    'FAQ',
    'Contact'
  ];

  const rail = document.createElement('nav');
  rail.className = 'hm-chapter-rail';
  rail.setAttribute('aria-label', 'Site chapters');
  rail.dataset.hmChapterRail = '';

  const steps = chapters.map((ch, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hm-chapter-rail__step';
    btn.dataset.hmChapterStep = String(i);
    btn.dataset.hmOn = '0';
    btn.setAttribute('aria-label', labels[i] || ch.id);
    btn.innerHTML =
      '<span class="hm-chapter-rail__track"><span class="hm-chapter-rail__fill"></span></span>' +
      '<span class="hm-chapter-rail__label">' + (labels[i] || ch.id) + '</span>';
    btn.addEventListener('click', () => scrollToChapter(i));
    rail.appendChild(btn);
    return btn;
  });

  document.body.appendChild(rail);

  function scrollToChapter(index) {
    const ch = chapters[index];
    if (!ch) return;
    const target = ch.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.16;
    const smooth = window.__ttmSmoothScroll;
    if (smooth && !reduce.matches) {
      smooth(Math.max(0, target));
    } else {
      const prev = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo({ top: Math.max(0, target), left: 0, behavior: 'instant' });
      document.documentElement.style.scrollBehavior = prev;
    }
  }

  let active = -1;

  function chapterReveal(ch) {
    const vh = window.innerHeight;
    const rect = ch.getBoundingClientRect();
    const enter = clamp01((vh * 0.78 - rect.top) / (vh * 0.52));
    const exit = clamp01((rect.bottom - vh * 0.12) / (vh * 0.35));
    return Math.min(enter, exit);
  }

  function paintChapters() {
    if (reduce.matches) {
      for (const ch of chapters) {
        ch.style.setProperty('--reveal', '1');
        ch.dataset.hmOn = '1';
      }
      rail.dataset.hmOn = restEl && restEl.dataset.hmOn === '1' ? '1' : '0';
      return;
    }

    const forgeTop = chapters[0].getBoundingClientRect().top;
    const nearChapters = forgeTop < window.innerHeight * 1.35;
    if (!nearChapters) {
      rail.dataset.hmOn = '0';
      return;
    }

    let best = -1;
    let bestScore = 0;

    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      const r = chapterReveal(ch);
      ch.style.setProperty('--reveal', r.toFixed(4));
      ch.dataset.hmOn = r > 0.42 ? '1' : '0';
      const centerDist = Math.abs(ch.getBoundingClientRect().top + ch.offsetHeight * 0.35 - window.innerHeight * 0.42);
      const score = r / (1 + centerDist * 0.002);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }

    if (best !== active) {
      active = best;
      for (let i = 0; i < steps.length; i++) {
        const on = i === active;
        steps[i].dataset.hmOn = on ? '1' : '0';
        steps[i].setAttribute('aria-current', on ? 'true' : 'false');
        const fill = steps[i].querySelector('.hm-chapter-rail__fill');
        if (fill) fill.style.setProperty('--fill', on ? '1' : '0');
      }
    }

    const pastHero = stageEl
      ? window.scrollY > stageEl.offsetTop + stageEl.offsetHeight * 0.82
      : true;
    const restReady = !restEl || restEl.dataset.hmOn === '1';
    rail.dataset.hmOn = (restReady || pastHero) && forgeTop < window.innerHeight * 0.92 ? '1' : '0';
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      paintChapters();
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', paintChapters, { passive: true });
  paintChapters();

  const chapterIds = new Set(chapters.map((ch) => ch.id));
  document.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href').slice(1);
    if (!chapterIds.has(id)) return;
    const idx = chapters.findIndex((ch) => ch.id === id);
    if (idx < 0) return;
    e.preventDefault();
    history.replaceState(null, '', '#' + id);
    scrollToChapter(idx);
    requestAnimationFrame(paintChapters);
  }, true);

  const bootHash = location.hash.slice(1);
  if (chapterIds.has(bootHash)) {
    requestAnimationFrame(() => {
      scrollToChapter(chapters.findIndex((ch) => ch.id === bootHash));
      paintChapters();
    });
  }
}
