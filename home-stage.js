/* ===== TTM landing stage =====
   Four acts on one pinned canvas. Scroll turns the product; the corners do
   the talking; each handoff is a different move so the page never repeats
   the same swap three times.

   Act 0 — Beaver, black on white. Brand lockup.
   Swap 0 — class change: rifle shears out, turret grows in, curtain down.
   Act 1 — T-90M, white on black. Rangefinder HUD.
   Swap 1 — collapse: turret recedes, MP7 punches through.
   Act 2 — MP7, still dark. Length bar + rate.
   Swap 2 — bench swap: a vertical clip plane hands MP7 to SPEAR, curtain up.
   Act 3 — SIG Spear, black on white. Pressure gauge.
   Outro — Spear holds; the rest of the site slides in from the right.

   Without this module the markup reads as four stacked editorials. */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const PHASES = [
  { kind: 'act', act: 0, vh: 62 },
  { kind: 'swap', swap: 0, vh: 32 },
  { kind: 'act', act: 1, vh: 70 },
  { kind: 'swap', swap: 1, vh: 26 },
  { kind: 'act', act: 2, vh: 66 },
  { kind: 'swap', swap: 2, vh: 32 },
  { kind: 'act', act: 3, vh: 56 },
  { kind: 'outro', vh: 80 }
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
    split: 0
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
    splitLine: -1,
    rest: 0,
    uaScan: 0,
    cadScan: 0,
    introGate: 0,
    models: [mdl(), mdl(), mdl(), mdl()]
  };

  if (ph.kind === 'act' && ph.act === 0) {
    const scrollGate = outQuart(smooth(span(p, 0.05, 0.32)));
    const typePop = typeIntroT > 0 ? outCubic(typeIntroT) : 0;
    const popped = scrollGate * typePop;
    f.introGate = scrollGate;
    f.models[0] = mdl({ wipe: outCubic(introT), clock: q, arrive: introT, type: popped });
    f.beatAct = 0;
    f.beatQ = q;
  } else if (ph.kind === 'swap' && ph.swap === 0) {
    /* Class change: curtain + bore wipe, turret grows from a silhouette. */
    f.dark = smooth(q, 0.2, 0.62);
    f.slide = f.dark;
    f.models[0] = mdl({
      wipe: 1 - outCubic(span(q, 0, 0.58)),
      clock: 1 + q * 0.55,
      arrive: 1,
      type: 1 - inCubic(span(q, 0.03, 0.3))
    });
    f.models[1] = mdl({
      wipe: outCubic(span(q, 0.22, 0.78)),
      clock: -0.15 + q * 0.4,
      arrive: 1,
      type: span(q, 0.36, 1),
      grow: mix(0.16, 1, outExpo(span(q, 0.22, 0.88)))
    });
  } else if (ph.kind === 'act' && ph.act === 1) {
    f.dark = 1;
    f.slide = 1;
    const promo = beatPhaseWide(q, 1, 2);
    f.beatAct = 1;
    f.beatQ = q;
    f.uaScan = smooth(q, 0.22, 0.94);
    f.models[1] = mdl({
      wipe: mix(1, 0.12, outCubic(promo)),
      clock: q,
      arrive: 1,
      type: mix(1, 0.06, promo),
      grow: mix(1, 0.38, outCubic(promo)),
      x: mix(0, 0.42, outCubic(promo))
    });
  } else if (ph.kind === 'swap' && ph.swap === 1) {
    /* Collapse: turret shrinks away, MP7 punches in oversized. Theme stays dark. */
    f.dark = 1;
    f.slide = 1;
    f.models[1] = mdl({
      wipe: 1 - outCubic(span(q, 0, 0.62)),
      clock: 1 + q * 0.5,
      arrive: 1,
      type: 1 - inCubic(span(q, 0.02, 0.28)),
      grow: mix(1, 0.18, outCubic(span(q, 0, 0.58)))
    });
    f.models[2] = mdl({
      wipe: outCubic(span(q, 0.22, 0.72)),
      clock: -0.2 + q * 0.45,
      arrive: span(q, 0.22, 1),
      type: span(q, 0.34, 1),
      punch: mix(1.38, 1, outCubic(span(q, 0.48, 1)))
    });
  } else if (ph.kind === 'act' && ph.act === 2) {
    f.dark = 1;
    f.slide = 1;
    const promo = beatPhaseWide(q, 1, 2);
    const mp7Return = outBack(clamp01(1 - promo * 1.15));
    f.beatAct = 2;
    f.beatQ = q;
    f.cadScan = smooth(q, 0.34, 0.9);
    f.models[2] = mdl({
      wipe: mix(1, 0.16, outCubic(promo)),
      clock: q,
      arrive: 1,
      type: mix(1, 0.08, promo),
      grow: mix(1 + mp7Return * 0.05, 0.44, outCubic(promo)),
      x: mix(0, -0.3, outCubic(promo)),
      punch: mix(1, 1 + mp7Return * 0.04, outCubic(promo))
    });
  } else if (ph.kind === 'swap' && ph.swap === 2) {
    /* Bench swap: both on screen, a world-X plane travels left to right.
       Curtain leaves with the plane so SPEAR is born on white. */
    f.dark = 1 - smooth(q, 0.28, 0.82);
    f.slide = 2 - f.dark;
    const split = span(q, 0.08, 0.92);
    f.splitLine = split;
    f.models[2] = mdl({
      wipe: 1,
      clock: 1 + q * 0.4,
      arrive: 1,
      type: 1 - inCubic(span(q, 0.02, 0.28)),
      x: mix(0, -0.28, outCubic(q)),
      clip: 'splitL',
      split
    });
    f.models[3] = mdl({
      wipe: 1,
      clock: -0.15 + q * 0.4,
      arrive: span(q, 0.12, 0.7),
      type: span(q, 0.38, 1),
      x: mix(0.32, 0, outCubic(span(q, 0.2, 1))),
      clip: 'splitR',
      split
    });
  } else if (ph.kind === 'act' && ph.act === 3) {
    f.models[3] = mdl({ wipe: 1, clock: q, arrive: 1, type: 1 });
    f.beatAct = 3;
    f.beatQ = q;
    f.slide = 2;
  } else if (ph.kind === 'outro') {
    f.slide = 2;
    f.rest = outCubic(span(q, 0.06, 0.92));
    f.models[3] = mdl({
      wipe: 1,
      clock: 1 + q * 0.35,
      arrive: 1,
      type: 1 - inCubic(span(q, 0.0, 0.22)),
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

function beatT(act, step, q, counts, gate = 1) {
  const wide = (act === 1 || act === 2) && step === 1;
  let localQ = q;
  if (act === 0) {
    localQ = Math.max(0, (q - 0.14) / 0.86) * gate;
  }
  return wide ? beatPhaseWide(localQ, step, counts[act]) : beatPhase(localQ, step, counts[act]);
}

const MODEL_SPECS = [
  {
    url: 'models/beaver-upper.glb',
    turns: 1.35,
    idle: 0.9,
    view: {
      orient: [0, 0, -Math.PI / 2],
      axis: 'x',
      pose: [0.11, -0.3, 0.05],
      fit: { wide: 0.8, narrow: 0.92 },
      cap: 0.74,
      bias: -0.11
    },
    portrait: {
      orient: [0, 0, Math.PI],
      axis: 'y',
      pose: [0.07, 0, -0.025],
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
      pose: [0.1, 0.45, 0.04],
      fit: { wide: 0.84, narrow: 0.74 },
      cap: 0.94,
      bias: -0.02
    },
    portrait: { fit: 0.62, fill: 0.92 }
  },
  {
    url: 'models/mp7.glb',
    turns: 1.4,
    idle: 1.05,
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
  material.side = THREE.FrontSide;
  material.flatShading = false;

  /* Palette atlases already carry the CAD colors. Treating them as bare
     metal with a darkened multiplier makes a turret vanish on black. */
  if (material.map) {
    material.metalness = 0.38;
    material.roughness = 0.5;
    material.envMapIntensity = 1.08;
    material.color.setRGB(1, 1, 1);
    material.needsUpdate = true;
    return;
  }

  const c = material.color;
  const maxc = Math.max(c.r, c.g, c.b);
  const minc = Math.min(c.r, c.g, c.b);
  const sat = maxc - minc;
  let luma = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

  material.envMapIntensity = 1;

  /* Near-black CAD fills read as holes in the environment once they are
     treated as metal — give them a dark phosphate albedo instead. */
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
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.environment = buildEnvironment(renderer);
  scene.environmentIntensity = 1;

  const camera = new THREE.PerspectiveCamera(CAM_FOV, 1, 0.1, 40);
  camera.position.set(0, 0, CAM_DIST);
  camera.lookAt(0, 0, 0);

  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(2.4, 3.4, 2.8);
  scene.add(key);

  const edge = new THREE.DirectionalLight(0xbfd2ec, 0.55);
  edge.position.set(-3.2, 0.6, 1.4);
  scene.add(edge);

  const back = new THREE.DirectionalLight(0xffd9ac, 0.75);
  back.position.set(-1.4, 1.2, -3.4);
  scene.add(back);

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
    rig.orient.rotation.fromArray(view.orient);
    rig.root.updateMatrixWorld(true);
    rig.localBox.setFromObject(rig.orient);
    rig.localBox.getSize(tmpVec);
    rig.rawLen = view.axis === 'x' ? tmpVec.x : tmpVec.y;
    rig.pose.rotation.fromArray(view.pose);
  }

  function adopt(rig, gltf) {
    const model = gltf.scene;
    rig.shift.add(model);

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

    rig.loaded = true;
    layout();
  }

  const LOAD_ORDER = [0, 2, 3, 1];
  function loadOne(pos) {
    const index = LOAD_ORDER[pos];
    const rig = rigs[index];
    loader.load(
      rig.spec.url,
      (gltf) => {
        try {
          adopt(rig, gltf);
        } catch (err) {
          console.error('[home-stage] adopt failed', rig.spec.url, err);
          if (index === 0) {
            root.dataset.hmMode = 'static';
            stop();
            return;
          }
        }
        if (index === 0) {
          root.dataset.hmLoaded = '1';
          startModelIntro();
        }
        if (pos + 1 < LOAD_ORDER.length) loadOne(pos + 1);
      },
      undefined,
      (err) => {
        console.error('[home-stage] load failed', rig.spec.url, err);
        if (index === 0) {
          root.dataset.hmMode = 'static';
          stop();
          return;
        }
        if (pos + 1 < LOAD_ORDER.length) loadOne(pos + 1);
      }
    );
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

    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(w, h, false);
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
  const types = [...root.querySelectorAll('[data-hm-type]')];
  const beats = [...root.querySelectorAll('[data-hm-beat]')];
  const chromeEl = root.querySelector('[data-hm-chrome]');
  const bandTop = [...root.querySelectorAll('[data-hm-band="top"], .hm-type__label')];
  const bandBottom = [...root.querySelectorAll('[data-hm-band="bottom"], .hm-type__sub')];
  const railFills = [...root.querySelectorAll('[data-hm-rail-fill]')];
  const railSteps = [...root.querySelectorAll('[data-hm-rail-step]')];
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const counts = [...root.querySelectorAll('[data-hm-count]')];
  const giants = [...root.querySelectorAll('.hm-giant')];
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

  const beatGroups = [0, 1, 2, 3].map((act) =>
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
  const TYPE_INTRO_SCROLL = 0.022;

  function startModelIntro() {
    if (progress() > BOUNDS[0].to * 0.5) {
      introT = 1;
      return;
    }
    introStart = performance.now();
  }

  function startTypeIntro() {
    if (typeIntroQueued) return;
    typeIntroQueued = true;
    typeIntroStart = performance.now();
    root.dataset.hmIntro = 'run';
  }

  function maybeStartTypeIntro() {
    if (typeIntroQueued) return;
    if (progress() > TYPE_INTRO_SCROLL) startTypeIntro();
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
    if (splitEl) {
      const on = f.splitLine >= 0 ? 1 : 0;
      splitEl.style.opacity = String(on);
      if (on) splitEl.style.setProperty('--split', f.splitLine.toFixed(4));
    }

    const isDark = f.slide > 0.05 && f.slide < 1.03;
    if (isDark !== wasDark) {
      wasDark = isDark;
      document.body.classList.toggle('hm-dark', isDark);
      if (themeMeta) themeMeta.setAttribute('content', isDark ? '#08080a' : '#f8f8f9');
    }

    for (let a = 0; a < 4; a++) {
      const m = f.models[a];
      const type = types[a];
      if (!type) continue;
      let reveal = a === 0 ? outCubic(m.type) : outExpo(m.type);
      if (a === 1) reveal *= 1 - beatPhaseWide(f.beatQ, 1, beatCount[1]) * 0.98;
      if (a === 2) reveal *= 1 - beatPhaseWide(f.beatQ, 1, beatCount[2]) * 0.98;
      type.style.setProperty('--reveal', reveal.toFixed(4));
      type.style.setProperty('--drift', (a === f.beatAct ? f.beatQ : m.clock).toFixed(4));
      type.dataset.hmOn = reveal > 0.02 ? '1' : '0';
    }

    const beatGate = f.beatAct === 0 ? (f.introGate || 0) : 1;
    for (const el of beats) {
      const act = Number(el.dataset.hmAct);
      const step = Number(el.dataset.hmStep);
      const t = act === f.beatAct ? beatT(act, step, f.beatQ, beatCount, beatGate) : 0;
      el.style.setProperty('--t', t.toFixed(4));
      el.dataset.hmOn = t > 0.015 ? '1' : '0';
    }

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
    for (const fill of railFills) fill.style.setProperty('--fill', (f.beatAct < 0 ? 0 : f.beatQ).toFixed(4));
    for (const s of railSteps) {
      const on = Number(s.dataset.hmRailStep) === f.beatAct;
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
    }

    const lightWipe = Math.max(f.models[0].wipe, f.models[3].wipe);
    if (shadowEl) shadowEl.style.opacity = ((1 - f.dark) * lightWipe).toFixed(3);

    if (uaPromo) {
      uaPromo.style.setProperty('--scan', f.uaScan.toFixed(4));
      uaPromo.dataset.lock = f.uaScan > 0.38 ? '1' : '0';
    }
    if (cadPromo) {
      cadPromo.style.setProperty('--scan', f.cadScan.toFixed(4));
    }

    if (!hinted && progress() > 0.055) {
      hinted = true;
      root.dataset.hmHint = 'gone';
    }
  }

  function paintModel(rig, m) {
    const live = m.wipe > 0.001 && (m.grow > 0.02 || m.clip !== 'axis');
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

    const arrive = outExpo(m.arrive);
    rig.root.position.set(
      rig.center.x + parX * 0.055 + m.x,
      rig.center.y + parY * -0.035,
      rig.center.z + mix(-1.15, 0, arrive)
    );
    rig.root.scale.setScalar(mix(0.86, 1, arrive) * m.grow * m.punch);
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

  function tick(now) {
    if (!running) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;

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
      softBeatQ += (ph.local - softBeatQ) * (1 - Math.exp(-dt * 2.4));
    } else if (ph && ph.kind === 'act') {
      softBeatQ = ph.local;
    }

    const f = frameAt(p, introT, typeIntroT);
    if (f.beatAct === 0) f.beatQ = softBeatQ;
    if (!typeIntroQueued && p > TYPE_INTRO_SCROLL) startTypeIntro();
    dark = f.dark;
    paintDom(f);
    for (let i = 0; i < rigs.length; i++) {
      if (rigs[i].loaded) paintModel(rigs[i], f.models[i]);
      else rigs[i].root.visible = false;
    }

    scene.environmentIntensity = mix(1, 1.32, dark);
    key.intensity = mix(1.5, 2.15, dark);
    back.intensity = mix(0.75, 1.55, dark);
    renderer.toneMappingExposure = mix(1.05, 1.26, dark);
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
    if (onScreen) play();
    else stop();
  }

  root.style.setProperty('--hm-track', TRACK_VH + 'vh');
  root.dataset.hmMode = 'live';

  new IntersectionObserver((entries) => {
    onScreen = entries[0].isIntersecting;
    evaluate();
  }, { rootMargin: '15% 0px' }).observe(root);

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
    scrollToProgress(bound.from + (bound.to - bound.from) * 0.32);
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

  layout();
  loadOne(0);
}

const stage = document.querySelector('[data-hm-stage]');
if (stage) boot(stage);
bootSheets();

function bootSheets() {
  const turn = document.querySelector('[data-hm-turn]');
  if (!turn) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const track = turn.querySelector('.hm-turn__track') || turn;

  function sheetProgress() {
    const rect = track.getBoundingClientRect();
    const vh = window.innerHeight;
    const travel = Math.max(1, track.offsetHeight - vh);
    return clamp01(-rect.top / travel);
  }

  function paintSheet() {
    if (reduce.matches) {
      turn.style.setProperty('--sheet', '1');
      turn.dataset.hmOn = '1';
      return;
    }
    const t = outCubic(span(sheetProgress(), 0.08, 0.82));
    turn.style.setProperty('--sheet', t.toFixed(4));
    turn.dataset.hmOn = t > 0.55 ? '1' : '0';
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
  paintSheet();

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
    'Forge OS',
    'Library',
    'Custom',
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
    const forgeTop = chapters[0].getBoundingClientRect().top;
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
