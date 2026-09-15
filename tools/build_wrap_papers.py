# -*- coding: utf-8 -*-
"""
Real florist's paper for the bouquet builder, in five colours.

The builder's wrap was drawn in CSS: a clip-path triangle filled with a
linear gradient and five straight fold lines. Folded paper does not look like
that. It has creases that catch light unevenly along their length, a grain,
soft bruising where it was crushed at the tie, and none of it survives a
gradient.

Cutting the whole wrap out of the photograph does not work: it was shot
against a bright window, and the lit faces of the paper measure the same as
the table behind it, so a flood fill eats the paper along with the
background. What does work is taking the paper as a TEXTURE - a patch of it
with good crease detail, which needs no matte at all - and filling a shape
with it.

Recolouring is a duotone rather than a hue shift: shadows map to a dark
version of the paper colour and highlights to a pale one, so kraft comes out
as kraft rather than as pink paper wearing a filter.

Source photo: Unsplash 3h5kKCsa9us by Amelia Cui (Unsplash Licence).

    python tools/build_wrap_papers.py
"""
import os
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLOWERS = os.path.join(ROOT, "miss-you-app", "assets", "flowers")
SOURCE = os.path.join(FLOWERS, "bouquet-lilies-wrapped.webp")

# a patch of the cone well below the tie: long vertical creases, a fold
# shadow down the middle, and clear of the ribbon's printed lettering
PAPER_CROP = (350, 1390, 700, 1570)

# name -> (shadow colour, highlight colour)
PAPERS = {
    "kraft": ((118, 84, 40), (250, 240, 216)),
    "blush": ((191, 90, 130), (255, 243, 248)),
    "lilac": ((122, 86, 176), (248, 242, 255)),
    "sage":  ((94, 122, 84), (243, 248, 240)),
    "lace":  ((172, 154, 184), (255, 253, 255)),
}


def paper_texture():
    """One patch, used at cover size rather than tiled.

    An earlier version mirrored the patch into a 2x2 tile so it would repeat
    without a seam, which produced a symmetrical diamond that read as marble.
    The shape it fills is small enough that one patch covers it.
    """
    patch = Image.open(SOURCE).convert("RGB").crop(PAPER_CROP)
    patch = patch.resize((560, 288), Image.LANCZOS)
    gray = ImageOps.autocontrast(patch.convert("L"), cutoff=(2, 4))
    # paper is not marble: pull the range back toward the top so the creases
    # stay legible without turning into black veins
    return gray.point(lambda v: int(96 + v * 0.62))


def main():
    gray = paper_texture()
    for name, (dark, light) in PAPERS.items():
        tinted = ImageOps.colorize(gray, black=dark, white=light)
        dest = os.path.join(FLOWERS, f"paper-{name}.webp")
        tinted.save(dest, "WEBP", quality=88, method=6)
        print(f"paper-{name}.webp  {tinted.size}  {os.path.getsize(dest)//1024}kb")
        for stale in (f"wrap-{name}.webp",):
            path = os.path.join(FLOWERS, stale)
            if os.path.exists(path):
                os.remove(path)


if __name__ == "__main__":
    main()
