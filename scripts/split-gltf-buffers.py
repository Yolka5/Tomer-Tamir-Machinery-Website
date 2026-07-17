"""Split embedded base64 buffers out of a huge .gltf so Node tools can parse it.

Usage: python split-gltf-buffers.py <input.gltf> <output-dir>
Writes <output-dir>/model.gltf plus buffer_N.bin files next to it.
"""
import base64
import json
import sys
from pathlib import Path

DATA_URI_PREFIX = "data:application/octet-stream;base64,"


def main() -> None:
    src = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"loading {src.name} ...", flush=True)
    with open(src, "r", encoding="utf-8") as f:
        gltf = json.load(f)

    buffers = gltf.get("buffers", [])
    print(f"buffers: {len(buffers)}", flush=True)

    for i, buf in enumerate(buffers):
        uri = buf.get("uri", "")
        if uri.startswith("data:"):
            comma = uri.index(",")
            raw = base64.b64decode(uri[comma + 1:])
            bin_name = f"buffer_{i}.bin"
            (out_dir / bin_name).write_bytes(raw)
            buf["uri"] = bin_name
            print(f"  buffer {i}: {len(raw) / 1e6:.1f} MB -> {bin_name}", flush=True)

    out_file = out_dir / "model.gltf"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(gltf, f, separators=(",", ":"))
    print(f"wrote {out_file} ({out_file.stat().st_size / 1e6:.1f} MB JSON)", flush=True)


if __name__ == "__main__":
    main()
