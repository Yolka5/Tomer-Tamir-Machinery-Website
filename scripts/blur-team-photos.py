"""One-off: bake blur into team photos and move originals out of the web root."""
from pathlib import Path
from shutil import move

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT.parent / "TTM-team-photos-private"
PUBLIC = ROOT / "team"

PHOTOS = [
    ("yoni.JPG", "yoni.jpg"),
    ("micah.png", "micah.jpg"),
    ("ItamarTold.jpeg", "itamar.jpg"),
    ("tamir.jpeg", "tamir.jpg"),
]

BLUR_RADIUS = 28
OUTPUT_SIZE = 420


def bake_blur(src: Path, dst: Path) -> None:
    img = Image.open(src).convert("RGB")
    for _ in range(4):
        img = img.filter(ImageFilter.GaussianBlur(radius=BLUR_RADIUS))
    w, h = img.size
    small = img.resize((max(64, w // 6), max(64, h // 6)), Image.Resampling.LANCZOS)
    img = small.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.Resampling.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, format="JPEG", quality=82, optimize=True)


def main() -> None:
    PRIVATE.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)

    for src_name, dst_name in PHOTOS:
        src = ROOT / src_name
        if not src.exists():
            private_src = PRIVATE / src_name
            if private_src.exists():
                src = private_src
            else:
                print(f"skip missing: {src_name}")
                continue

        private_dst = PRIVATE / src_name
        if src.parent == ROOT:
            if not private_dst.exists():
                move(str(src), str(private_dst))
            src = private_dst

        bake_blur(src, PUBLIC / dst_name)
        print(f"ok {dst_name}")


if __name__ == "__main__":
    main()
