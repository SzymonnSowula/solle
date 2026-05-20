#!/usr/bin/env python3
"""Generate Tauri-compatible icon set from a source PNG/SVG.

Requirements: pip install pillow cairosvg (optional for SVG input)

Usage:
    python scripts/generate-icons.py assets/icon.svg
    python scripts/generate-icons.py assets/icon.png

Outputs to apps/client-desktop/src-tauri/icons/:
    icon.png      (512x512, fallback)
    32x32.png, 128x128.png, 256x256.png, 512x512.png
    icon.ico      (multi-resolution Windows icon)
"""

import sys
import os
from pathlib import Path
from PIL import Image

OUT_DIR = Path("apps/client-desktop/src-tauri/icons")
SIZES = [32, 128, 256, 512]


def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <source.png|source.svg>")
        sys.exit(1)

    src = Path(sys.argv[1])
    if not src.exists():
        print(f"Source not found: {src}")
        sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load source
    if src.suffix.lower() == ".svg":
        try:
            import cairosvg
        except ImportError:
            print("Install cairosvg for SVG support: pip install cairosvg")
            sys.exit(1)
        png_bytes = cairosvg.svg2png(url=str(src), output_width=512, output_height=512)
        img = Image.open(BytesIO(png_bytes))
    else:
        img = Image.open(src).convert("RGBA")

    # Ensure base is 512x512
    if img.size != (512, 512):
        img = img.resize((512, 512), Image.LANCZOS)

    # Write size-specific PNGs
    for size in SIZES:
        resized = img.resize((size, size), Image.LANCZOS)
        out_path = OUT_DIR / f"{size}x{size}.png"
        resized.save(out_path)
        print(f"  {out_path}")

    # Write generic icon.png (512)
    icon_path = OUT_DIR / "icon.png"
    img.save(icon_path)
    print(f"  {icon_path}")

    # Write multi-resolution ICO
    ico_path = OUT_DIR / "icon.ico"
    ico_images = [img.resize((s, s), Image.LANCZOS) for s in (16, 32, 48, 64, 128, 256)]
    ico_images[0].save(ico_path, format="ICO", sizes=[(i.width, i.height) for i in ico_images])
    print(f"  {ico_path}")

    print("Done.")


if __name__ == "__main__":
    main()
