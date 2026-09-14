# -*- coding: utf-8 -*-
"""
Build the arrival bouquet out of lilies only.

The "Flowers arrived" screen was showing bouquet-cutout.webp, which is a
mixed bouquet with roses in it. Her flower is the stargazer lily, so this
composes a big lily-only bouquet from the six transparent lily cut-outs:
a wrapped one for the tap-to-untie, and an open one for the reveal.

Writes:
  assets/flowers/bouquet-lilies-wrapped.webp
  assets/flowers/bouquet-lilies-open.webp
"""
import math, os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLOWERS = os.path.join(ROOT, "miss-you-app", "assets", "flowers")

W, H = 1100, 1340


def load_lilies():
    out = []
    for i in range(1, 7):
        path = os.path.join(FLOWERS, f"lily-{i}.webp")
        out.append(Image.open(path).convert("RGBA"))
    return out


def place(canvas, im, cx, cy, size, rot, alpha=1.0, darken=0.0):
    """Drop one bloom at (cx, cy), scaled to `size` on its long edge."""
    scale = size / max(im.size)
    w, h = max(1, int(im.width * scale)), max(1, int(im.height * scale))
    piece = im.resize((w, h), Image.LANCZOS).rotate(rot, resample=Image.BICUBIC, expand=True)

    if darken > 0:                      # blooms set further back catch less light
        shade = Image.new("RGBA", piece.size, (40, 10, 30, 0))
        shade.putalpha(piece.getchannel("A").point(lambda v: int(v * darken)))
        piece = Image.alpha_composite(piece, shade)

    if alpha < 1.0:
        piece.putalpha(piece.getchannel("A").point(lambda v: int(v * alpha)))

    canvas.alpha_composite(piece, (int(cx - piece.width / 2), int(cy - piece.height / 2)))


def build_blooms():
    """A dome of lilies: a dim back row, a middle row, then big front blooms."""
    lil = load_lilies()
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    # back row - smaller, pushed back, slightly shaded so the dome has depth
    back = [(230, 300), (400, 232), (560, 210), (720, 236), (884, 306)]
    for i, (x, y) in enumerate(back):
        place(canvas, lil[(i + 2) % 6], x, y, 330, (i * 37) % 60 - 30, 0.96, darken=0.22)

    # middle row
    mid = [(300, 430), (470, 378), (640, 380), (810, 436)]
    for i, (x, y) in enumerate(mid):
        place(canvas, lil[(i + 4) % 6], x, y, 380, (i * 53) % 70 - 35, 1.0, darken=0.08)

    # front row - the biggest, fully lit
    front = [(390, 560), (560, 528), (730, 562)]
    for i, (x, y) in enumerate(front):
        place(canvas, lil[i % 6], x, y, 430, (i * 41) % 56 - 28)

    # a couple tucked low at the sides so the silhouette is not a flat arc
    place(canvas, lil[5], 250, 585, 300, 38, 0.97, darken=0.12)
    place(canvas, lil[1], 866, 590, 300, -34, 0.97, darken=0.12)
    return canvas


def draw_wrap(canvas):
    """Kraft paper cone with a ribbon, drawn under the blooms."""
    wrap = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(wrap)

    top_l, top_r = (232, 620), (868, 620)
    bot_l, bot_r = (438, 1268), (662, 1268)

    # the cone, banded so it reads as folded paper rather than a flat shape
    steps = 150
    for s in range(steps):
        t0, t1 = s / steps, (s + 1) / steps
        lx0 = top_l[0] + (bot_l[0] - top_l[0]) * t0
        rx0 = top_r[0] + (bot_r[0] - top_r[0]) * t0
        y0 = top_l[1] + (bot_l[1] - top_l[1]) * t0
        y1 = top_l[1] + (bot_l[1] - top_l[1]) * t1
        lx1 = top_l[0] + (bot_l[0] - top_l[0]) * t1
        rx1 = top_r[0] + (bot_r[0] - top_r[0]) * t1
        shade = 1 - t0 * 0.30
        col = (int(226 * shade), int(206 * shade), int(176 * shade), 255)
        d.polygon([(lx0, y0), (rx0, y0), (rx1, y1), (lx1, y1)], fill=col)

    # two creases down the cone
    for frac in (0.36, 0.66):
        x_top = top_l[0] + (top_r[0] - top_l[0]) * frac
        x_bot = bot_l[0] + (bot_r[0] - bot_l[0]) * frac
        d.line([(x_top, top_l[1]), (x_bot, bot_l[1])], fill=(150, 120, 70, 90), width=3)

    # ribbon
    d.rounded_rectangle([300, 880, 800, 966], radius=22, fill=(226, 74, 128, 255))
    d.rounded_rectangle([300, 880, 800, 906], radius=14, fill=(245, 130, 175, 190))
    # the knot and two loops
    d.ellipse([505, 884, 595, 962], fill=(198, 52, 104, 255))
    d.polygon([(505, 900), (410, 852), (430, 950), (512, 940)], fill=(226, 74, 128, 255))
    d.polygon([(595, 900), (690, 852), (670, 950), (588, 940)], fill=(226, 74, 128, 255))

    # grain, so the paper is stock rather than a flat fill
    import random
    random.seed(7)
    grain = Image.new("L", wrap.size, 0)
    gd = ImageDraw.Draw(grain)
    for _ in range(26000):
        x = random.randint(0, wrap.width - 1)
        y = random.randint(620, wrap.height - 1)
        gd.point((x, y), fill=random.randint(0, 26))
    wrap_rgba = wrap.split()
    darkened = Image.composite(
        Image.new("RGBA", wrap.size, (120, 96, 60, 255)), wrap,
        grain.point(lambda v: min(255, v * 4)))
    darkened.putalpha(wrap_rgba[3])
    canvas.alpha_composite(darkened)
    return canvas


def soft_shadow(im):
    """A shadow under the whole thing so it sits on something."""
    shadow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(shadow)
    d.ellipse([330, 1240, 770, 1330], fill=(70, 30, 60, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(26))
    shadow.alpha_composite(im)
    return shadow


def main():
    # open: just the flowers, for the reveal
    blooms = build_blooms()
    box = blooms.getbbox()          # crop to what was actually drawn
    pad = 18
    open_bq = blooms.crop((max(0, box[0] - pad), max(0, box[1] - pad),
                           min(W, box[2] + pad), min(H, box[3] + pad)))
    open_bq.save(os.path.join(FLOWERS, "bouquet-lilies-open.webp"), "WEBP", quality=90, method=6)

    # wrapped: cone and ribbon first, blooms on top
    wrapped = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_wrap(wrapped)
    wrapped.alpha_composite(blooms)
    wrapped = soft_shadow(wrapped)
    wbox = wrapped.getbbox()
    wrapped = wrapped.crop((max(0, wbox[0] - pad), max(0, wbox[1] - pad),
                            min(W, wbox[2] + pad), min(H, wbox[3] + pad)))
    wrapped.save(os.path.join(FLOWERS, "bouquet-lilies-wrapped.webp"), "WEBP", quality=90, method=6)

    for name in ("bouquet-lilies-open.webp", "bouquet-lilies-wrapped.webp"):
        im = Image.open(os.path.join(FLOWERS, name))
        print(f"{name}: {im.size} {im.mode} "
              f"{os.path.getsize(os.path.join(FLOWERS, name)) // 1024}kb")


if __name__ == "__main__":
    main()
