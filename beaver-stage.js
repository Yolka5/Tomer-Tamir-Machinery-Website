/* ===== TTM Beaver product stage =====
   A single scroll timeline drives two acts. One WebGL canvas is pinned to the
   viewport for the whole run; the models are wiped in and out of it and the
   page theme flips between them, so the reader is only ever looking at a
   centred product with type behind it while the copy in the corners changes.

   Act 1 — the Beaver upper, black on white.
   Act 2 — the 6.8 TVCM cartridge, white on black.
   Act 3 — normal page flow, which starts once the stage scrolls away.

   The DOM contract is data attributes only, so the markup keeps working
   without this file: the stage stays unpinned, the headings and the beat
   copy read top to bottom as an ordinary editorial section. `data-bvr-mode`
   on the stage element is the switch — CSS only pins and stacks the layers
   once it reads "live".

   Everything scroll-linked reads window.scrollY directly. script.js already
   eases the real scroll position, so the value arriving here is smooth and
   this module deliberately adds no second layer of scroll smoothing. */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/* ---------------------------------------------------------------- timeline */

/* Scroll budget per phase, in viewport heights. Tuned against the global
   wheel easing in script.js: much longer and the acts start to feel like a
   hostage situation, much shorter and the beats trip over each other. */
const PHASES = [
  { kind: 'act', act: 0, vh: 210 },
  { kind: 'swap', vh: 76 },
  { kind: 'act', act: 1, vh: 210 },
  /* The pin still needs a viewport of travel to scroll away after the outro
     finishes, so the outro itself stays short and runs right to its end —
     otherwise the reader sits through an empty pin twice over. */
  { kind: 'outro', vh: 44 }
];

const TRACK_VH = PHASES.reduce((sum, ph) => sum + ph.vh, 0);
const TAU = Math.PI * 2;

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

/* Absolute progress boundaries for each phase, as fractions of the track. */
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

/* One frame of the whole story, derived from scroll progress alone.

   `clock` is a per-model monotonic spin counter: it runs 0→1 across the
   model's own act and then keeps climbing while the model leaves, so a model
   accelerates on its way out instead of freezing mid-turn.

   `wipe` is how much of the model is uncovered by its clipping plane, 0→1.

   `arrive` is the settle of the product itself — depth and scale.

   `type` is the headline behind it, kept separate from `arrive` so the word can
   lead the product in and trail it out. It also has to reach zero before the
   theme flips, or the swap catches the headline mid-inversion and leaves a
   grey word sitting on a grey ground. */
function frameAt(p, introT) {
  const ph = phaseAt(p);
  const q = ph.local;

  const f = {
    dark: 0,
    /* Curtain position: 0 above the pin, 1 covering it, 2 below it. */
    slide: 0,
    beatAct: -1,
    beatQ: 0,
    models: [
      { wipe: 0, clock: 0, arrive: 0, type: 0 },
      { wipe: 0, clock: 0, arrive: 0, type: 0 }
    ]
  };

  if (ph.kind === 'act' && ph.act === 0) {
    /* The first act has to be on screen before any scrolling happens, so its
       arrival is the load-time intro rather than a scroll range. */
    f.models[0] = { wipe: outExpo(introT), clock: q, arrive: introT, type: introT };
    f.beatAct = 0;
    f.beatQ = q;
  } else if (ph.kind === 'swap') {
    f.dark = smooth(q, 0.3, 0.72);
    f.slide = f.dark;
    f.models[0] = {
      wipe: 1 - outCubic(span(q, 0, 0.42)),
      clock: 1 + q * 0.6,
      arrive: 1,
      type: 1 - inCubic(span(q, 0.04, 0.34))
    };
    f.models[1] = {
      wipe: outCubic(span(q, 0.56, 1)),
      clock: -0.42 + q * 0.42,
      arrive: span(q, 0.56, 1),
      type: span(q, 0.62, 1)
    };
  } else if (ph.kind === 'act' && ph.act === 1) {
    f.dark = 1;
    f.slide = 1;
    f.models[1] = { wipe: 1, clock: q, arrive: 1, type: 1 };
    f.beatAct = 1;
    f.beatQ = q;
  } else if (ph.kind === 'outro') {
    f.dark = 1 - smooth(q, 0.2, 0.94);
    f.slide = 2 - f.dark;
    f.models[1] = {
      wipe: 1 - outCubic(span(q, 0, 0.42)),
      clock: 1 + q * 0.6,
      arrive: 1,
      type: 1 - inCubic(span(q, 0.02, 0.26))
    };
  }

  return f;
}

/* Beats share the act evenly, with the in and out ramps overlapping slightly
   so one line of copy dissolves into the next rather than blinking out. */
function beatPhase(q, i, count) {
  const pad = 0.055;
  const size = (1 - pad * 2) / count;
  const at = pad + i * size;
  const ramp = Math.min(0.1, size * 0.36);
  return smooth(q, at, at + ramp) * (1 - smooth(q, at + size - ramp * 0.5, at + size + ramp * 0.5));
}

/* ------------------------------------------------------------------- models */

const MODEL_SPECS = [
  {
    url: 'models/beaver-upper.glb',
    turns: 1.35,
    idle: 0.9,
    /* Onshape stands the receiver on end with the bore down -Y. Laying it on
       world X reads as a rifle upper and, more usefully, lets it roll about
       its own bore: the silhouette stays wide and constant, so the type behind
       it never gets chewed up by the spin. */
    view: {
      orient: [0, 0, -Math.PI / 2],
      axis: 'x',
      /* Slight yaw and pitch — a dead-flat side elevation reads as a drawing,
         not a product. */
      pose: [0.11, -0.3, 0.05],
      fit: { wide: 0.8, narrow: 0.92 },
      /* Room left for the corner copy on the cross axis. */
      cap: 0.74,
      /* Sits below the optical centre so the receiver crosses the lower half of
         the headline instead of erasing it, and so the contact shadow has
         somewhere to fall. Fractions of the half-viewport, positive is up. */
      bias: -0.11
    },
    /* Held upright, a phone has no width to lend a 400 mm part: laid on its
       side the receiver is a five-pixel sliver. Stood on end it spends the
       screen's long dimension instead and crosses the headline the other way,
       which is the stronger shot regardless. */
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
    url: 'models/tvcm-68.glb',
    turns: 1.55,
    idle: 1.4,
    /* This one is a polymer-cased round, not a machined part. */
    polymer: true,
    /* The cartridge stands bullet-up — a standing round is the shot everyone
       recognises — and turns on its own axis. The CAD has it nose-down. */
    view: {
      orient: [0, 0, Math.PI],
      axis: 'y',
      pose: [0.08, 0, 0.1],
      fit: { wide: 0.66, narrow: 0.54 },
      cap: 0.9,
      bias: 0
    },
    /* Already standing. A cartridge is a small object, so it keeps a margin
       inside the band the copy leaves rather than filling it — blown up to the
       same height as a 400 mm receiver it stops reading as ammunition. */
    portrait: { fit: 0.5, fill: 0.82 }
  }
];

/* Which framing a model uses depends on the shape of the window, not only its
   width — a tablet on its side wants the landscape composition at a smaller
   size, a phone upright wants a different one entirely.

   In portrait the copy stacks above and below the part rather than beside it,
   so `band` (measured from that copy) overrides the spec's own guess at how
   much room there is. */
function viewFor(spec, portrait, narrow, band) {
  const base = spec.view;
  const view = portrait && spec.portrait ? { ...base, ...spec.portrait } : base;
  const fit = typeof view.fit === 'number' ? view.fit : narrow ? view.fit.narrow : view.fit.wide;
  if (!band) return { ...view, fit };
  return { ...view, fit: band.fit * (view.fill ?? 1), bias: band.bias };
}

/* Onshape writes plain diffuse colours with no metalness, roughness or maps,
   which renders as matte plastic. The parts are nearly all machined metal or
   anodised aluminium, so re-derive a plausible PBR response from the colour
   itself: saturation picks the family, luminance picks the polish.

   `polymer` opts a model into a dielectric reading for its pale blue parts —
   the tint Onshape gives composites. Only the cartridge asks for it; on the
   receiver the same tint is bead-blasted aluminium. */
function retuneMaterial(material, polymer) {
  const c = material.color;
  const maxc = Math.max(c.r, c.g, c.b);
  const minc = Math.min(c.r, c.g, c.b);
  const sat = maxc - minc;
  const luma = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

  material.side = THREE.FrontSide;
  material.envMapIntensity = 1;
  material.flatShading = false;

  if (polymer && c.b - c.r > 0.08 && luma > 0.55) {
    /* Polymer case: a dielectric, so it keeps its own colour instead of
       mirroring the room, and needs a tighter highlight than any metal here. */
    material.metalness = 0.06;
    material.roughness = 0.24;
    material.envMapIntensity = 1.05;
    material.color.multiplyScalar(0.93);
    material.needsUpdate = true;
    return;
  }

  if (sat > 0.22 && c.r > c.b) {
    /* Brass and copper hardware. */
    material.metalness = 1;
    material.roughness = 0.3;
    material.envMapIntensity = 1.15;
  } else if (luma < 0.28) {
    /* Anodising is a dielectric skin over metal — never a clean mirror. */
    material.metalness = 0.72;
    material.roughness = 0.44;
    material.envMapIntensity = 0.85;
  } else {
    material.metalness = 1;
    /* Bright greys came off the mill or out of the polisher; darker greys are
       phosphate or bead-blasted. */
    material.roughness = mix(0.42, 0.15, clamp01((luma - 0.28) / 0.64));
  }

  /* A base colour on a metal is its reflectance, not its albedo, and Onshape's
       values sit well above anything real — left raw, every part blows out into
       a flat white smear under the key light. */
  material.color.multiplyScalar(0.84);
  material.needsUpdate = true;
}

/* --------------------------------------------------------------- environment */

/* A dark gradient dome plus a rig of softboxes, baked to a PMREM cube. This is
   what sells the metal: the long specular streaks down the receiver are
   literally reflections of the panels, so the parts read as photographed
   rather than shaded.

   The dome is deliberately dark. A bright, even surround is the mistake that
   turns polished aluminium into flat white plastic — a mirror with nothing
   dark to reflect has no shape. Nearly all the light here comes from a few
   small, very bright panels instead. */
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

  /* Two long strip lights are doing most of the work. On a part this
     elongated they lay a continuous highlight down the full length of the
     receiver and the rail, which is what makes it read as one machined
     surface rather than a row of separate faces. */
  softbox(22, 1.15, [0, 4.1, 1.7], [17, 17, 17.5]);       /* top strip */
  softbox(16, 0.7, [-1.2, -3.0, 2.8], [3.6, 3.9, 4.6]);   /* underside kicker */

  softbox(7, 5, [5.0, 2.8, 4.2], [5.6, 5.6, 5.7]);        /* key, front right */
  softbox(6.5, 5.5, [-6.4, 0.6, 2.2], [1.5, 1.7, 2.2]);   /* cool fill, camera left */
  softbox(7, 4, [-3.4, 1.8, -5.2], [4.6, 3.9, 2.9]);      /* warm rim from behind */
  softbox(12, 12, [0, -7.5, 0.5], [0.14, 0.14, 0.18]);    /* floor bounce */

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

/* -------------------------------------------------------------------- boot */

function boot(root) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = root.querySelector('[data-bvr-gl]');
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
  /* Khronos PBR Neutral: built for product viewers, and unlike ACES it holds
     the greys of bare aluminium instead of dragging them warm. */
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.environment = buildEnvironment(renderer);
  scene.environmentIntensity = 1;

  /* Long lens. Wide angles bend a 600 mm receiver into a banana. Dead-on and
     centred, so world origin lands exactly at the middle of the pin — every
     bit of art direction happens on the model's own pose instead. */
  const CAM_FOV = 26;
  const CAM_DIST = 3.4;
  const camera = new THREE.PerspectiveCamera(CAM_FOV, 1, 0.1, 40);
  camera.position.set(0, 0, CAM_DIST);
  camera.lookAt(0, 0, 0);

  /* Direct lights on a metal contribute specular only, so these exist purely
     to put a hard glint on the machined edges that the blurred environment
     can't produce on its own. */
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(2.4, 3.4, 2.8);
  scene.add(key);

  const edge = new THREE.DirectionalLight(0xbfd2ec, 0.55);
  edge.position.set(-3.2, 0.6, 1.4);
  scene.add(edge);

  const back = new THREE.DirectionalLight(0xffd9ac, 0.75);
  back.position.set(-1.4, 1.2, -3.4);
  scene.add(back);

  /* ---- model rigs ---- */

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
      /* Parked far outside the geometry until a wipe needs it, so the
         clipping branch stays compiled into the shader and switching it on
         never costs a recompile mid-scroll. */
      plane: new THREE.Plane(new THREE.Vector3(1, 0, 0), 1e4),
      axis: new THREE.Vector3(),
      /* Where the framing pass decided this model has to sit for its posed
         silhouette to land dead centre. */
      center: new THREE.Vector3(),
      /* The part's own tight box, in the frame the scale is applied in. */
      localBox: new THREE.Box3(),
      /* Resolved on the first layout, and again whenever the window changes
         shape enough to want the other composition. */
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

  /* Flatten everything above the geometry. Both measurement passes below read
     world matrices, so they need a known frame rather than whatever the last
     drawn frame left behind. */
  function rest(rig) {
    rig.root.position.set(0, 0, 0);
    rig.root.rotation.set(0, 0, 0);
    rig.root.scale.setScalar(1);
    rig.pose.rotation.set(0, 0, 0);
    rig.spin.rotation.set(0, 0, 0);
    rig.scaler.scale.setScalar(1);
  }

  /* Pose the part for the current view and re-measure it. Both the tight box
     and the long-axis length feed the framing pass, and both change when the
     view swaps the part from lying down to standing up. */
  function reorient(rig) {
    const view = rig.view;
    rest(rig);

    /* Keep the box in the frame the scale is applied in — the scaler's. Being
       tight to the part, its corners are close to the real silhouette even
       after the pose swings one end toward the lens. A world-space box could
       not do that job: axis-aligned, it always reports a symmetric span, and so
       hides the very lopsidedness the framing pass exists to cancel. */
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

    /* Centre on the geometry, not on whatever origin the CAD package chose.
       `shift` sits below `orient` so the offset is measured and applied in the
       model's own unrotated frame — subtracting a world-space centre from a
       local position would drag the part off to one side. */
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
        retuneMaterial(m, rig.spec.polymer === true);
        m.clippingPlanes = [rig.plane];
      }
    });

    rig.loaded = true;
    /* Layout resolves the view for the current window shape, which is what
       poses, measures and frames the part. */
    layout();
  }

  let loadState = 0;
  function loadOne(index) {
    const rig = rigs[index];
    loader.load(
      rig.spec.url,
      (gltf) => {
        adopt(rig, gltf);
        loadState++;
        if (index === 0) {
          root.dataset.bvrLoaded = '1';
          startIntro();
          loadOne(1);
        }
      },
      undefined,
      () => {
        /* A missing model must not leave the reader staring at an empty pin. */
        root.dataset.bvrMode = 'static';
        stop();
      }
    );
  }

  /* ---- responsive framing ----
     The camera never moves, so both models can share it through the swap.
     Instead each model is scaled and offset until its *projected* bounds hit a
     fixed fraction of the viewport.

     Measuring in screen space rather than from the raw bounding box matters
     here: the aesthetic yaw swings one end of a 600 mm receiver toward the
     lens, and perspective then magnifies that end enough to both overflow the
     frame and shift the optical centre sideways. A couple of iterations of
     measure-and-correct converge on a composition that is genuinely centred at
     any window size. */
  let narrow = false;
  const corners = Array.from({ length: 8 }, () => new THREE.Vector3());

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

    /* Seed from the bounding box. CAD units are metres or millimetres by
       accident of export, so at scale 1 a 600 mm receiver may well be 600 units
       long with most of it behind the camera — and projecting a point behind
       the lens returns nonsense, which would poison the first refinement. */
    rig.scaler.scale.setScalar((2 * (onX ? visHalfW : visHalfH) * frac) / rig.rawLen);

    for (let pass = 0; pass < 3; pass++) {
      rig.root.updateMatrixWorld(true);
      const b = projectedBounds(rig);
      const halfX = (b.maxX - b.minX) / 2;
      const halfY = (b.maxY - b.minY) / 2;
      if (!(halfX > 0) || !(halfY > 0) || !isFinite(halfX) || !isFinite(halfY)) break;

      const k = Math.min(frac / (onX ? halfX : halfY), cap / (onX ? halfY : halfX));
      rig.scaler.scale.multiplyScalar(k);
      /* The offset from the rig origin to the silhouette centre scales with the
         model, so the correction has to be scaled too or the pass overshoots. */
      rig.root.position.x -= ((b.minX + b.maxX) / 2) * k * visHalfW;
      rig.root.position.y -= ((b.minY + b.maxY) / 2 - view.bias) * k * visHalfH;
    }

    rig.center.copy(rig.root.position);
    rig.halfLen = (rig.rawLen * rig.scaler.scale.x) / 2;
  }

  /* How much of a portrait screen is left for the product once the stacked copy
     has taken its bands. Worth measuring rather than guessing: the same
     paragraph is three lines on one handset and six on another, and a fraction
     tuned against one of them prints the other straight over the model.

     Layout positions, not bounding rectangles — the copy spends most of the
     scroll part-way through a transform, and a rect would report wherever it
     happens to have slid to. */
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

    /* Clear air between the copy and the part, and a floor under the whole
       thing in case the copy ever grows enough to close the gap entirely. */
    const pad = h * 0.03;
    top = Math.min(top + pad, h * 0.42);
    bottom = Math.max(bottom - pad, h * 0.58);

    /* Into the projection's units: the frame is two high, centred on zero. */
    return { fit: (bottom - top) / h, bias: 1 - (top + bottom) / h };
  }

  function layout() {
    const w = root.clientWidth || window.innerWidth;
    const h = window.innerHeight;
    if (!w || !h) return;

    narrow = w < 860;
    /* Not a width test: a phone on its side is narrow but still landscape, and
       it wants the landscape composition. */
    const portrait = w / h < 0.88;
    /* Set before the band is measured: the stylesheet stacks the copy off this
       attribute, and the measurement has to read the stacked positions. */
    root.dataset.bvrPortrait = portrait ? '1' : '0';

    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    /* Framing projects points by hand, and Vector3.project reads the camera's
       inverse world matrix — which only the renderer normally maintains. On the
       first layout, before any frame has been drawn, it is still the identity. */
    camera.updateMatrixWorld(true);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

    const band = portrait ? portraitBand() : null;

    for (const rig of rigs) {
      if (!rig.loaded) continue;
      rig.view = viewFor(rig.spec, portrait, narrow, band);
      /* Only re-measure when the composition itself changed; a plain resize
         keeps the pose and only needs the scale and offset solved again. */
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
    /* Supersampling on top of MSAA. A CAD part is nothing but hard edges, and
       at 1x they crawl the moment the model turns. */
    return Math.max(1, Math.min(device * 1.5, ceiling) * dprScale);
  }

  /* ---- DOM layers ---- */

  const voidEl = root.querySelector('[data-bvr-void]');
  const shadowEl = root.querySelector('[data-bvr-shadow]');
  const types = [...root.querySelectorAll('[data-bvr-type]')];
  const beats = [...root.querySelectorAll('[data-bvr-beat]')];
  const chromeEl = root.querySelector('[data-bvr-chrome]');
  /* Which band each piece of copy takes when the stage goes portrait. Kept in
     step with the stylesheet, which stacks it the same way. */
  const bandTop = [...root.querySelectorAll('.bvr-beat--stat, .bvr-type__label')];
  const bandBottom = [
    ...root.querySelectorAll('[data-bvr-beat]:not(.bvr-beat--stat), .bvr-type__sub')
  ];
  const railFill = root.querySelector('[data-bvr-rail-fill]');
  const railSteps = [...root.querySelectorAll('[data-bvr-rail-step]')];
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  const beatGroups = [0, 1].map((act) =>
    beats.filter((el) => Number(el.dataset.bvrAct) === act)
  );
  const beatCount = beatGroups.map((group) => {
    const steps = new Set(group.map((el) => el.dataset.bvrStep));
    return Math.max(1, steps.size);
  });

  /* Split each headline into per-letter spans for the reveal. The original
     text stays available to screen readers, which would otherwise spell the
     word out one transformed letter at a time. */
  for (const word of root.querySelectorAll('[data-bvr-word]')) {
    const text = word.textContent.trim();
    const sr = document.createElement('span');
    sr.className = 'bvr-sr';
    sr.textContent = text;

    const frag = document.createDocumentFragment();
    frag.appendChild(sr);

    const line = document.createElement('span');
    line.className = 'bvr-word__line';
    line.setAttribute('aria-hidden', 'true');
    [...text].forEach((ch, i) => {
      const cell = document.createElement('span');
      cell.className = 'bvr-word__ch';
      cell.style.setProperty('--i', String(i));
      cell.textContent = ch === ' ' ? '\u00A0' : ch;
      line.appendChild(cell);
    });
    frag.appendChild(line);

    word.textContent = '';
    word.appendChild(frag);
    word.style.setProperty('--n', String(text.length));
  }

  /* ---- intro ---- */

  let introT = 0;
  let introStart = 0;
  const INTRO_MS = 1700;

  function startIntro() {
    /* A reload restored deep into the page shouldn't replay the arrival of a
       model that is already meant to be gone. */
    if (progress() > BOUNDS[0].to * 0.5) {
      introT = 1;
      root.dataset.bvrIntro = 'done';
      return;
    }
    introStart = performance.now();
    root.dataset.bvrIntro = 'run';
  }

  /* ---- pointer parallax ---- */

  let pointerX = 0;
  let pointerY = 0;
  let parX = 0;
  let parY = 0;

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    pointerX = (e.clientX / window.innerWidth) * 2 - 1;
    pointerY = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  /* ---- scroll ---- */

  let pinned = false;

  function progress() {
    const rect = root.getBoundingClientRect();
    const vh = window.innerHeight;

    /* Flagged for CSS: while the pin owns the viewport, page chrome that lives
       at the same edges as the stage's own furniture gets out of the way. */
    const covers = Math.min(rect.bottom, vh) - Math.max(rect.top, 0) > vh * 0.6;
    if (covers !== pinned) {
      pinned = covers;
      root.dataset.bvrPinned = covers ? '1' : '0';
    }

    const travel = root.offsetHeight - vh;
    if (travel <= 0) return 0;
    return clamp01(-rect.top / travel);
  }

  let dark = 0;
  let wasDark = false;
  let hinted = false;

  function paintDom(f) {
    if (voidEl) voidEl.style.setProperty('--slide', f.slide.toFixed(4));

    /* The theme flips when the curtain covers the top of the pin, not when it
       is half way down it. Everything this class restyles — the header, the
       scroll bar — lives up there, and inverting it while it still sits on the
       old background is the one moment of the transition a reader would
       notice. The curtain occupies slide-1 … slide of the pin's height. */
    const isDark = f.slide > 0.05 && f.slide < 1.03;
    if (isDark !== wasDark) {
      wasDark = isDark;
      document.body.classList.toggle('bvr-dark', isDark);
      if (themeMeta) themeMeta.setAttribute('content', isDark ? '#08080a' : '#f8f8f9');
    }

    for (let a = 0; a < 2; a++) {
      const m = f.models[a];
      const type = types[a];
      if (!type) continue;
      const reveal = outExpo(m.type);
      type.style.setProperty('--reveal', reveal.toFixed(4));
      type.style.setProperty('--drift', (a === f.beatAct ? f.beatQ : m.clock).toFixed(4));
      type.dataset.bvrOn = reveal > 0.02 ? '1' : '0';
    }

    for (const el of beats) {
      const act = Number(el.dataset.bvrAct);
      const step = Number(el.dataset.bvrStep);
      const t = act === f.beatAct ? beatPhase(f.beatQ, step, beatCount[act]) : 0;
      el.style.setProperty('--t', t.toFixed(4));
      el.dataset.bvrOn = t > 0.015 ? '1' : '0';
    }

    /* The rail indexes the acts, so it belongs to the headline: it rides in and
       out with the type rather than hanging over the transitions, where it
       would be the only thing left straddling the curtain edge. */
    if (chromeEl) {
      chromeEl.style.opacity = Math.max(f.models[0].type, f.models[1].type).toFixed(3);
    }
    if (railFill) railFill.style.setProperty('--fill', (f.beatAct < 0 ? 0 : f.beatQ).toFixed(4));
    for (const s of railSteps) {
      s.dataset.bvrOn = Number(s.dataset.bvrRailStep) === f.beatAct ? '1' : '0';
    }

    const shadowStrength = (1 - f.dark) * Math.max(f.models[0].wipe, f.models[1].wipe);
    if (shadowEl) shadowEl.style.opacity = shadowStrength.toFixed(3);

    if (!hinted && progress() > 0.02) {
      hinted = true;
      root.dataset.bvrHint = 'gone';
    }
  }

  function paintModel(rig, m, dt, now) {
    const live = m.wipe > 0.001;
    rig.root.visible = live;
    if (!live) return;

    const spec = rig.spec;
    const localAxis = axisVec[rig.view.axis];

    /* Scroll owns the turn; the idle drift only exists so a reader who stops
       mid-act isn't looking at a frozen render. */
    const angle = m.clock * spec.turns * TAU + (now / 1000) * spec.idle * (Math.PI / 180) * 12;
    rig.spin.rotation.set(0, 0, 0);
    if (rig.view.axis === 'x') rig.spin.rotation.x = angle;
    else rig.spin.rotation.y = angle;

    /* Arrival pushes the part in from behind the type and settles it, around
       the centre the framing pass solved for. */
    const arrive = outExpo(m.arrive);
    rig.root.position.set(
      rig.center.x + parX * 0.055,
      rig.center.y + parY * -0.035,
      rig.center.z + mix(-1.15, 0, arrive)
    );
    rig.root.scale.setScalar(mix(0.86, 1, arrive));
    rig.root.rotation.set(parY * -0.05, parX * 0.075, 0);

    rig.root.updateMatrixWorld(true);

    /* A world-space plane sweeps along the model's own long axis, so the part
       is uncovered end to end while it turns. The axis survives the spin
       because the spin is about that same axis. */
    rig.spin.getWorldQuaternion(tmpQuat);
    rig.axis.copy(localAxis).applyQuaternion(tmpQuat).normalize();

    const reach = rig.halfLen * 1.06;
    const centre = rig.root.position.dot(rig.axis);
    const w = 1 - m.wipe;
    rig.plane.normal.copy(rig.axis);
    rig.plane.constant = -(centre + mix(-reach, reach, w));
  }

  /* ---- loop ---- */

  let running = false;
  let onScreen = false;
  let last = 0;
  let slowFrames = 0;

  function tick(now) {
    if (!running) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;

    if (introT < 1 && introStart) {
      introT = clamp01((now - introStart) / INTRO_MS);
      if (introT >= 1) root.dataset.bvrIntro = 'done';
    }

    /* Critically damped pointer follow — instant tracking reads as jitter. */
    const k = 1 - Math.exp(-dt * 4.5);
    parX += (pointerX - parX) * k;
    parY += (pointerY - parY) * k;

    const f = frameAt(progress(), introT);
    dark = f.dark;
    paintDom(f);
    for (let i = 0; i < rigs.length; i++) {
      if (rigs[i].loaded) paintModel(rigs[i], f.models[i], dt, now);
      else rigs[i].root.visible = false;
    }

    /* Metal on black wants a touch more punch than metal on white. */
    scene.environmentIntensity = mix(1, 1.16, dark);
    back.intensity = mix(0.75, 1.35, dark);
    renderer.toneMappingExposure = mix(1.05, 1.14, dark);

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

  function stop() {
    running = false;
  }

  /* Visibility is deliberately not part of this: the browser already parks
     requestAnimationFrame on a hidden tab, and some embedded contexts report
     `document.hidden` while very much on screen. */
  function evaluate() {
    if (root.dataset.bvrMode !== 'live') { stop(); return; }
    if (onScreen) play();
    else stop();
  }

  /* ---- wiring ---- */

  root.style.setProperty('--bvr-track', TRACK_VH + 'vh');
  root.dataset.bvrMode = 'live';

  new IntersectionObserver((entries) => {
    onScreen = entries[0].isIntersecting;
    evaluate();
  }, { rootMargin: '15% 0px' }).observe(root);

  window.addEventListener('resize', layout, { passive: true });
  window.addEventListener('orientationchange', layout, { passive: true });
  reduceMotion.addEventListener('change', () => {
    if (reduceMotion.matches) {
      root.dataset.bvrMode = 'static';
      document.body.classList.remove('bvr-dark');
      stop();
    }
  });

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    root.dataset.bvrMode = 'static';
    document.body.classList.remove('bvr-dark');
    stop();
  });

  layout();
  loadOne(0);
}

const stage = document.querySelector('[data-bvr-stage]');
if (stage) boot(stage);
