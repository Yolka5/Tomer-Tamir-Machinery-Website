import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import {
  CAD_OFFSET,
  CAD_TO_WORLD,
  ensureCad,
  prepare
} from './beaver-seq.js';

const MODEL_URL = 'models/beaver-meshopt.glb';
const FOV = 28;
const SPIN = 0.36;

function studioEnv(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(14, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x17181d, side: THREE.BackSide })
  );
  env.add(dome);

  function panel(w, h, color, pos, rot) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
    );
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.rotation.set(rot[0], rot[1], rot[2]);
    env.add(mesh);
  }

  panel(6, 8, 0xffffff, [5, 3.4, 3], [0, -0.7, 0]);
  panel(4, 10, 0x9aabbd, [-6, 2, 1.2], [0, 0.85, 0]);
  panel(10, 10, 0xf2f3f6, [0, 8, 0], [-Math.PI / 2, 0, 0]);
  panel(8, 3, 0xffe6c8, [0, 1.2, -6], [0.18, 0, 0]);

  const map = pmrem.fromScene(env, 0.06).texture;
  pmrem.dispose();
  return map;
}

function mount(host) {
  if (!host || host.dataset.spinReady) return;
  host.dataset.spinReady = '1';

  const fallback = host.querySelector('img');
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'low-power'
    });
  } catch (err) {
    return;
  }

  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer);
  scene.environmentIntensity = 1;

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 24);
  camera.position.set(0, 0.14, 3.15);
  camera.lookAt(0, 0, 0);

  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(2.2, 3.2, 2.6);
  scene.add(key);
  const edge = new THREE.DirectionalLight(0xbfd2ec, 0.5);
  edge.position.set(-3, 0.5, 1.2);
  scene.add(edge);
  const back = new THREE.DirectionalLight(0xffd9ac, 0.6);
  back.position.set(-1.2, 1, -3);
  scene.add(back);

  const root = new THREE.Group();
  root.rotation.x = 0.16;
  const spin = new THREE.Group();
  spin.rotation.y = 0.55;
  const scaler = new THREE.Group();
  const centerer = new THREE.Group();
  const orient = new THREE.Group();
  const shift = new THREE.Group();
  root.add(spin);
  spin.add(scaler);
  scaler.add(centerer);
  centerer.add(orient);
  orient.add(shift);
  scene.add(root);

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const mid = new THREE.Vector3();
  let visible = true;
  let fitted = false;
  let last = 0;
  let raf = 0;

  function layout() {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (fitted) fit();
  }

  function fit() {
    centerer.position.set(0, 0, 0);
    scaler.scale.setScalar(1);
    root.updateMatrixWorld(true);
    box.setFromObject(orient);
    if (box.isEmpty()) return;
    box.getCenter(mid);
    box.getSize(size);
    centerer.position.copy(mid).negate();
    const longest = Math.max(size.x, size.y, size.z) || 1;
    const dist = camera.position.length();
    const half = Math.tan((FOV * Math.PI) / 360);
    const viewH = 2 * half * dist;
    const viewW = viewH * camera.aspect;
    scaler.scale.setScalar((Math.min(viewW, viewH) * 0.92) / longest);
    fitted = true;
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (!visible) {
      last = now;
      return;
    }
    const dt = Math.min(0.05, ((now - last) || 16) / 1000);
    last = now;
    if (!reduce.matches) spin.rotation.y += dt * SPIN;
    renderer.render(scene, camera);
  }

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  Promise.all([ensureCad(), loader.loadAsync(MODEL_URL)])
    .then(function (pair) {
      const model = pair[1].scene;
      prepare(model, null);
      orient.quaternion.copy(CAD_TO_WORLD);
      shift.position.copy(CAD_OFFSET);
      shift.add(model);
      layout();
      fit();
      host.classList.add('is-live');
      if (fallback) fallback.hidden = true;
    })
    .catch(function () { /* keep the still */ });

  new ResizeObserver(layout).observe(host);
  new IntersectionObserver(function (entries) {
    visible = entries.some(function (entry) { return entry.isIntersecting; });
  }, { threshold: 0.04 }).observe(host);

  layout();
  raf = requestAnimationFrame(tick);
}

document.querySelectorAll('[data-beaver-spin]').forEach(mount);
