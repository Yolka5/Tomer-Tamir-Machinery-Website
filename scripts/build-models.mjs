/* Rebuilds every web-ready GLB the site's 3D stages load.
 *
 * Onshape exports one primitive per face, embeds all buffers as base64 and
 * writes 32-bit floats, so a single part lands somewhere between 50 MB and
 * 900 MB. Three passes fix that:
 *
 *   1. de-embed  — base64 data URIs out to binary sidecars, so the JSON is
 *                  small enough for a tool to read at all (see deembed-gltf).
 *   2. optimize  — weld, join and simplify the geometry.
 *   3. meshopt   — quantize and compress what is left.
 *
 * Quantization is deliberately finer than the CLI defaults. These parts are lit
 * as bare machined metal with no albedo texture to hide behind, and 8-bit
 * normals band visibly across the specular falloff on any cylindrical surface.
 *
 * Simplification tolerance is per model, because it is a fraction of each
 * mesh's own extent and the two stages show parts at very different sizes: the
 * Beaver product page fills the screen with one receiver, while the landing
 * page turns four platforms at roughly half that.
 *
 * Usage:  node scripts/build-models.mjs            (all models)
 *         node scripts/build-models.mjs spear mp7  (only those whose output
 *                                                   name contains an argument)
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync, existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deembed } from './deembed-gltf.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'tools', 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js');
const tmp = join(root, 'tools', '.model-build');

/* Below roughly 0.02% of a part's extent the simplifier starts rounding off
   chamfers and thread crests, which reads as mush under a specular highlight.
   The product page sits at that floor. The landing page turns four platforms at
   about half that size and has to pay for all four, so it trades a tolerance no
   one can see at that scale for a download everyone feels.

   Position precision is spent the same way. Sixteen bits over a 3.5 m turret
   resolves 0.05 mm, which is far past anything the screen can show; fourteen
   still resolves 0.2 mm. Normals stay fine either way — they are what the
   specular highlight rides on, and coarse normals band across every
   cylindrical surface on these parts. */
const FINE = { simplify: '0.0002', pos: '16', norm: '12' };
const HERO = { simplify: '0.006', pos: '14', norm: '12' };

const MODELS = [
  { src: 'TTM Beaver/TTM Beaver Upper.gltf', out: 'models/beaver-upper.glb', ...FINE },
  { src: 'TTM Beaver/TVCM 6.8mm.gltf', out: 'models/tvcm-68.glb', ...FINE },
  { src: 'T90M Turret.gltf', out: 'models/t90m-turret.glb', ...HERO },
  { src: 'TTM MP7.gltf', out: 'models/mp7.glb', ...HERO },
  { src: 'TTM SIG MCX SPEAR.gltf', out: 'models/sig-spear.glb', ...HERO }
];

function run(args) {
  const res = spawnSync(process.execPath, [cli, ...args], {
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=14336' }
  });
  if (res.status !== 0) throw new Error(`gltf-transform ${args[0]} failed`);
}

const filters = process.argv.slice(2);
const queue = filters.length
  ? MODELS.filter((m) => filters.some((f) => m.out.includes(f)))
  : MODELS;

if (!queue.length) {
  console.error(`nothing matched: ${filters.join(', ')}`);
  process.exit(1);
}

mkdirSync(tmp, { recursive: true });
mkdirSync(join(root, 'models'), { recursive: true });

for (const model of queue) {
  const src = join(root, model.src);
  const out = join(root, model.out);
  const stem = basename(model.out, '.glb');
  console.log(`\n=== ${model.src} ===`);

  /* Reuse a previous de-embed if it is still on disk: it is deterministic, and
     on the 910 MB export it is the difference between a rebuild and a wait. */
  let input = join(tmp, `${stem}.gltf`);
  if (existsSync(input)) {
    console.log('de-embed: reusing staged copy');
  } else {
    const { buffers, bytes } = await deembed(src, input);
    console.log(`de-embed: ${buffers} buffer(s), ${(bytes / 1e6).toFixed(1)} MB binary`);
  }

  const staged = join(tmp, `${stem}.staged.glb`);
  run(['optimize', input, staged,
    '--compress', 'false',
    '--palette', 'false',        /* palette textures would collapse the per-part colours into one material */
    '--texture-compress', 'false',
    '--simplify', 'true',
    '--simplify-error', model.simplify
  ]);

  run(['meshopt', staged, out,
    '--level', 'high',
    '--quantize-position', model.pos,
    '--quantize-normal', model.norm
  ]);

  rmSync(staged, { force: true });
  console.log(`${model.out} — ${(statSync(out).size / 1e6).toFixed(2)} MB`);
}

console.log(`\nStaging kept in ${tmp} — delete it to force a fresh de-embed.`);
