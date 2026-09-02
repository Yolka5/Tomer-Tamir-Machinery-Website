/* Web-ready GLBs for the landing-page stage.

   MP7 is a fresh Onshape export. T-90M has thousands of unique face
   materials, so palette+join is required or the stage spends its budget
   on 4000 draw calls. GPU instancing is turned off — Onshape's "shared
   mesh" instances are one-offs and explode into thousands of
   InstancedMesh objects in Three.js.

   SPEAR's product-page GLB is Draco. The stage loader only has Meshopt,
   so we recompress a simplified copy to models/sigspear-stage.glb.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'tools', 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js');
const tmp = join(root, 'tools', '.model-build');

function run(args) {
  const res = spawnSync(process.execPath, [cli, ...args], {
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=14336' }
  });
  if (res.status !== 0) throw new Error(`gltf-transform ${args[0]} failed`);
}

function meshopt(src, out, pos = '14', nrm = '10') {
  run(['meshopt', src, out,
    '--level', 'high',
    '--quantize-position', pos,
    '--quantize-normal', nrm
  ]);
}

mkdirSync(tmp, { recursive: true });
mkdirSync(join(root, 'models'), { recursive: true });

{
  const src = join(root, 'TTM MP7.gltf');
  const staged = join(tmp, 'mp7-staged.glb');
  const out = join(root, 'models', 'mp7.glb');
  console.log(`\n=== ${src} ===`);
  run(['optimize', src, staged,
    '--compress', 'false',
    '--instance', 'false',
    '--palette', 'false',
    '--texture-compress', 'false',
    '--simplify', 'true',
    '--simplify-error', '0.0002'
  ]);
  meshopt(staged, out, '16', '12');
  console.log(`${out} — ${(statSync(out).size / 1e6).toFixed(2)} MB`);
}

{
  const src = join(root, 'T90M Turret.gltf');
  const staged = join(tmp, 't90m-staged.glb');
  const out = join(root, 'models', 't90m-stage.glb');
  console.log(`\n=== ${src} ===`);
  run(['optimize', src, staged,
    '--compress', 'false',
    '--instance', 'false',
    '--palette', 'true',
    '--texture-compress', 'false',
    '--simplify', 'true',
    '--simplify-error', '0.0004'
  ]);
  meshopt(staged, out);
  console.log(`${out} — ${(statSync(out).size / 1e6).toFixed(2)} MB`);
}

{
  const src = join(root, 'models', 'sigspear.glb');
  const staged = join(tmp, 'spear-staged.glb');
  const out = join(root, 'models', 'sigspear-stage.glb');
  console.log(`\n=== ${src} ===`);
  run(['optimize', src, staged,
    '--compress', 'false',
    '--instance', 'false',
    '--palette', 'false',
    '--texture-compress', 'false',
    '--simplify', 'true',
    '--simplify-error', '0.0008'
  ]);
  meshopt(staged, out);
  console.log(`${out} — ${(statSync(out).size / 1e6).toFixed(2)} MB`);
}

rmSync(tmp, { recursive: true, force: true });
