/* Rebuilds the web-ready GLBs used by the TTM Beaver product stage.
 *
 * Onshape exports one primitive per face, embeds every buffer as base64, and
 * writes 32-bit floats — the Beaver upper lands at 55 MB with ~4000 draw calls.
 * Two passes fix that: `optimize` welds/joins/simplifies the geometry, then
 * `meshopt` quantizes and compresses it.
 *
 * Quantization is deliberately finer than the CLI defaults. The stage lights
 * these parts as bare machined metal, so 8-bit normals band visibly across the
 * specular falloff on the receiver's cylindrical bore.
 *
 * Usage (from the repo root):  node scripts/build-beaver-models.mjs
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'tools', 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js');
const tmp = join(root, 'tools', '.model-build');

const MODELS = [
  { src: join(root, 'TTM Beaver', 'TTM Beaver Upper.gltf'), out: join(root, 'models', 'beaver-upper.glb') },
  { src: join(root, 'TTM Beaver', 'TVCM 6.8mm.gltf'), out: join(root, 'models', 'tvcm-68.glb') }
];

/* Below ~0.12 mm on these parts the simplifier starts rounding off chamfers
   and thread crests, which reads as mush under a specular highlight. */
const SIMPLIFY_ERROR = '0.0002';

function run(args) {
  const res = spawnSync(process.execPath, [cli, ...args], {
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=14336' }
  });
  if (res.status !== 0) throw new Error(`gltf-transform ${args[0]} failed`);
}

mkdirSync(tmp, { recursive: true });
mkdirSync(join(root, 'models'), { recursive: true });

for (const { src, out } of MODELS) {
  const staged = join(tmp, 'staged.glb');
  console.log(`\n=== ${src} ===`);

  run(['optimize', src, staged,
    '--compress', 'false',
    '--palette', 'false',        /* palette textures would collapse the 17 part colors into one material */
    '--texture-compress', 'false',
    '--simplify', 'true',
    '--simplify-error', SIMPLIFY_ERROR
  ]);

  run(['meshopt', staged, out,
    '--level', 'high',
    '--quantize-position', '16',
    '--quantize-normal', '12'
  ]);

  console.log(`${out} — ${(statSync(out).size / 1e6).toFixed(2)} MB`);
}

rmSync(tmp, { recursive: true, force: true });
