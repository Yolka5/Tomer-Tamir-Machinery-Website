/* Streams an Onshape .gltf into a small .gltf plus binary sidecars.
 *
 * Onshape embeds every buffer as a base64 data URI, which inflates the file by
 * a third and — more importantly — puts the whole thing inside one JSON string.
 * The SIG Spear export lands at 910 MB, and V8 refuses to create a string over
 * roughly 536 million characters, so any tool that reads the file whole fails
 * before it can even parse it.
 *
 * This pass never holds more than a chunk: it copies the JSON through verbatim,
 * and whenever it meets a data URI it decodes that base64 straight to a .bin on
 * disk and leaves a relative reference behind. The result is a few kilobytes of
 * JSON next to the raw buffers, which gltf-transform reads as Buffers rather
 * than strings.
 *
 * Usage:  node scripts/deembed-gltf.mjs <input.gltf> <output.gltf>
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MARKER = '"data:';
const B64 = ';base64,';

export async function deembed(src, dest) {
  const outDir = path.dirname(dest);
  const stem = path.basename(dest, '.gltf');
  fs.mkdirSync(outDir, { recursive: true });

  const out = fs.createWriteStream(dest, { encoding: 'latin1' });
  const write = (s) => {
    if (!out.write(s)) return new Promise((res) => out.once('drain', res));
  };

  let buffers = 0;
  let bytes = 0;

  /* Payload state, live only while inside a data URI. `pending` holds base64
     characters that did not divide into a whole group of four, since decoding a
     partial group would corrupt the stream. */
  let inPayload = false;
  let sawB64 = false;
  let pending = '';
  let sink = null;

  /* Everything outside a payload is copied as-is. The tail is the only part
     that cannot be flushed yet: a marker may straddle two chunks. */
  let tail = '';

  const stream = fs.createReadStream(src, { encoding: 'latin1', highWaterMark: 1 << 22 });

  for await (const chunk of stream) {
    let buf = tail + chunk;
    tail = '';

    while (buf.length) {
      if (!inPayload) {
        const at = buf.indexOf(MARKER);
        if (at === -1) {
          /* Hold back enough to recognise a marker split across the boundary. */
          const keep = Math.max(0, buf.length - MARKER.length);
          await write(buf.slice(0, keep));
          tail = buf.slice(keep);
          break;
        }

        await write(buf.slice(0, at));
        const name = `${stem}-${buffers}.bin`;
        await write(JSON.stringify(name));
        sink = fs.createWriteStream(path.join(outDir, name));
        buffers++;
        inPayload = true;
        sawB64 = false;
        pending = '';
        buf = buf.slice(at + MARKER.length);
        continue;
      }

      /* Skip the mime prefix that sits between `data:` and the payload. */
      if (!sawB64) {
        const at = buf.indexOf(B64);
        if (at === -1) {
          tail = buf.slice(-B64.length);
          break;
        }
        sawB64 = true;
        buf = buf.slice(at + B64.length);
      }

      const end = buf.indexOf('"');
      const body = end === -1 ? buf : buf.slice(0, end);
      const group = pending + body;
      const whole = group.length - (group.length % 4);

      if (whole) {
        const bin = Buffer.from(group.slice(0, whole), 'base64');
        bytes += bin.length;
        if (!sink.write(bin)) await new Promise((res) => sink.once('drain', res));
      }
      pending = group.slice(whole);

      if (end === -1) break;

      /* Onshape pads correctly, so anything left here is a truncated export. */
      if (pending.length) throw new Error(`${src}: buffer ${buffers - 1} has a partial base64 group`);
      await new Promise((res) => sink.end(res));
      sink = null;
      inPayload = false;
      /* Past the closing quote, not up to it: the replacement written above is
         a complete JSON string, so copying this quote too would double it. */
      buf = buf.slice(end + 1);
    }
  }

  if (inPayload) throw new Error(`${src}: file ended inside a data URI`);
  await write(tail);
  await new Promise((res) => out.end(res));

  return { buffers, bytes };
}

/* Only run the CLI when invoked directly, not when imported by the build. The
   comparison goes through pathToFileURL because a Windows path needs both its
   separators flipped and its spaces escaped before it matches import.meta. */
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [src, dest] = process.argv.slice(2);
  if (!src || !dest) {
    console.error('usage: node scripts/deembed-gltf.mjs <input.gltf> <output.gltf>');
    process.exit(1);
  }
  const { buffers, bytes } = await deembed(src, dest);
  console.log(`${src} -> ${dest}  (${buffers} buffers, ${(bytes / 1e6).toFixed(1)} MB binary)`);
}
