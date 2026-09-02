import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../.cursor/projects/c-Users-yonik-Desktop-TTM-Website/agent-tools/6b98d452-68aa-4a29-98f9-720672b92335.txt'
);
const alt = resolve(dirname(fileURLToPath(import.meta.url)), '../maps/land-110m.json');

let raw;
try {
  raw = readFileSync(src, 'utf8');
} catch {
  raw = readFileSync(alt, 'utf8');
}

const topo = JSON.parse(raw);
const { scale, translate } = topo.transform;

function arc(i) {
  const rev = i < 0;
  const a = topo.arcs[rev ? ~i : i];
  let x = 0;
  let y = 0;
  const pts = a.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
  return rev ? pts.reverse() : pts;
}

function ring(ids) {
  let pts = [];
  for (const id of ids) {
    const p = arc(id);
    if (pts.length) p.shift();
    pts = pts.concat(p);
  }
  return pts;
}

function d(pts) {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${(-p[1]).toFixed(2)}`).join('') + 'Z';
}

const paths = [];
for (const g of topo.objects.land.geometries) {
  const polys = g.type === 'MultiPolygon' ? g.arcs : [g.arcs];
  for (const poly of polys) paths.push(d(ring(poly[0])));
}

const ukraine = 'M22.14,-48.32L22.64,-49.43L23.51,-50.06L23.99,-50.87L24.55,-51.75L25.21,-51.94L25.77,-51.73L26.55,-51.89L27.53,-51.59L28.76,-51.58L29.55,-50.70L30.09,-50.50L30.56,-50.71L31.29,-50.28L31.79,-52.10L32.76,-52.34L33.74,-52.28L34.39,-51.70L35.18,-51.14L36.65,-51.96L37.39,-50.59L38.22,-49.72L39.16,-49.96L40.08,-49.31L40.08,-47.81L38.27,-47.11L37.67,-46.65L37.00,-46.49L36.59,-45.48L35.36,-45.33L35.09,-45.65L33.88,-44.36L32.81,-45.33L32.24,-46.05L31.54,-46.50L30.87,-46.50L30.17,-45.60L29.55,-45.47L28.91,-45.27L28.24,-45.41L27.53,-45.81L26.62,-45.45L25.77,-45.81L25.21,-46.32L24.62,-46.81L23.51,-46.64L22.77,-47.10L22.38,-47.86Z';

const grid = [];
for (let lon = -180; lon <= 180; lon += 30) {
  grid.push(`<path d="M${lon},-85L${lon},85"/>`);
}
for (let lat = -75; lat <= 75; lat += 15) {
  grid.push(`<path d="M-180,${-lat}L180,${-lat}"/>`);
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-180 -90 360 180" preserveAspectRatio="xMidYMid meet">
  <g class="grid" fill="none">${grid.join('')}</g>
  <g class="land">${paths.map((p) => `<path d="${p}"/>`).join('')}</g>
  <path class="ua" d="${ukraine}"/>
</svg>
`;

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../maps/world.svg');
mkdirSync(resolve(dirname(fileURLToPath(import.meta.url)), '../maps'), { recursive: true });
writeFileSync(out, svg);
console.log(out, paths.length, 'paths', (svg.length / 1024).toFixed(1), 'KB');
