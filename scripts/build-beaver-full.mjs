/* Rebuilds models/beaver-meshopt.glb, the full-rifle Beaver used by the
 * homepage sequence, the Beaver page and the order flow, then regenerates
 * beaver-cad.json from it.
 *
 * Source is the Onshape ASSEMBLY export as one file (Export -> glTF from the
 * assembly tab). A part-by-part export will not do: each part comes out in its
 * own Part Studio coordinates and the rifle falls apart.
 *
 * Same pipeline as handoff-ttm-website/scripts/optimise-glb.mjs, meshopt codec:
 *   dedup, weld, simplify, prune, join --keepNamed (keeps every CAD part name
 *   addressable by beaver-seq.js), meshopt. No `instance` step: it would swap
 *   the CAD names of repeated fasteners for generated mesh names.
 *
 * Usage (from the repo root):
 *   node scripts/build-beaver-full.mjs ["TTM Beaver/TTM Beaver - 6.8 TVCM.gltf"]
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'tools', 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js');
const tmp = join(root, 'tools', '.model-build', 'beaver-full');
const src = resolve(root, process.argv[2] ?? 'TTM Beaver/TTM Beaver - 6.8 TVCM.gltf');
const out = join(root, 'models', 'beaver-meshopt.glb');

function run(args, script = cli) {
  const res = spawnSync(process.execPath, [script, ...args], {
    stdio: 'inherit',
    /* The assembly export is ~470 MB of base64 JSON. */
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=14336' }
  });
  if (res.status !== 0) throw new Error(`${args[0]} failed`);
}

mkdirSync(tmp, { recursive: true });

const steps = [
  ['dedup', []],
  ['weld', []],
  ['simplify', ['--ratio', '0.05', '--error', '0.0005']],
  ['prune', []],
  ['join', ['--keepNamed', 'true']]
];
let cur = src;
steps.forEach(([cmd, flags], i) => {
  const dst = join(tmp, `s${i}.glb`);
  console.log(`\n== ${cmd}`);
  run([cmd, cur, dst, ...flags]);
  cur = dst;
});
/* Measure before meshopt: derive-beaver-cad reads raw accessor bounds, and
   quantized accessors store integers rescaled by the node transform. World
   space is the same either side of meshopt, so the numbers carry over. */
console.log('\n== beaver-cad.json');
run([cur, join(root, 'beaver-cad.json')], join(root, 'scripts', 'derive-beaver-cad.mjs'));

console.log('\n== meshopt');
run(['meshopt', cur, out]);
console.log(`${out} — ${(statSync(out).size / 1e6).toFixed(2)} MB`);

rmSync(tmp, { recursive: true, force: true });
