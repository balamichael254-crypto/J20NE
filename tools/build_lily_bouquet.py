# -*- coding: utf-8 -*-
"""
Build the arrival bouquet: real photograph, lilies set into it.

Two earlier attempts were wrong. The first used bouquet-cutout.webp, which is
a mixed arrangement with roses in it, and her flower is the stargazer lily.
The second composed lily heads into a dome over a drawn paper cone, which
read as a clump of flower heads rather than a bouquet: no greenery, no buds,
no varied depth, and a flat vector wrap next to photographic blooms.

Unsplash has plenty of lily photographs and essentially no wrapped lily
bouquet, so this takes the hard part from a real photograph - an actual
florist's bouquet with its paper wrap, ribbon, baby's breath and lighting -
and sets stargazer lily heads into the bloom area where the roses were. The
wrap, the greenery and the light are real; the flowers are her flower.

Source photo: Unsplash 3h5kKCsa9us by Amelia Cui (Unsplash Licence).

Writes:
  assets/flowers/bouquet-lilies-wrapped.webp   (the sealed, tap-to-untie one)
  assets/flowers/bouquet-lilies-open.webp      (the reveal, blooms only)
"""
import io, os, urllib.request
from PIL import Image, ImageEnhance, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLOWERS = os.path.join(ROOT, "miss-you-app", "assets", "flowers")
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_bouquet_base.jpg")

PHOTO_ID = "3h5kKCsa9us"
UA = {"User-Agent": "MoonpieApp/1.0 (private gift project)"}

# Where the roses sit in the source photo, and how the lilies are laid over
# them: (centre x, centre y, size on the long edge, rotation), in pixels of
# the 1080x1620 original. Sizes vary and a few sit lower and dimmer so the
# arrangement has a front and a back instead of being one flat layer.
LILY_PLACEMENT = [
    (300, 520, 250, -18, 0.20),
    (470, 462, 272,  14, 0.10),
    (652, 505, 250,  28, 0.16),
    (790, 585, 226, -24, 0.26),
    (248, 676, 240,  34, 0.22),
    (424, 640, 286,  -8, 0.00),
    (612, 658, 262,  20, 0.06),
    (762, 730, 228, -30, 0.20),
    (352, 812, 244,  10, 0.08),
    (566, 820, 252, -14, 0.04),
]


def base_photo():
    if os.path.exists(CACHE):
        return Image.open(CACHE).convert("RGB")
    key = os.environ.get("UNSPLASH_ACCESS_KEY", "").strip()
    if not key:
        raise SystemExit("set UNSPLASH_ACCESS_KEY to fetch the base photograph")
    import json
    meta_req = urllib.request.Request(
        f"https://api.unsplash.com/photos/{PHOTO_ID}",
        headers={**UA, "Authorization": f"Client-ID {key}", "Accept-Version": "v1"})
    with urllib.request.urlopen(meta_req, timeout=40) as r:
        meta = json.load(r)
    with urllib.request.urlopen(urllib.request.Request(meta["urls"]["regular"], headers=UA), timeout=60) as r:
        im = Image.open(io.BytesIO(r.read())).convert("RGB")
    im.save(CACHE, quality=94)
    # Unsplash asks for a download ping whenever an image is actually used
    try:
        urllib.request.urlopen(urllib.request.Request(
            meta["links"]["download_location"],
            headers={**UA, "Authorization": f"Client-ID {key}", "Accept-Version": "v1"}), timeout=20).read(1)
    except Exception:
        pass
    return im


def lilies():
    return [Image.open(os.path.join(FLOWERS, f"lily-{i}.webp")).convert("RGBA") for i in range(1, 7)]


def place(canvas, bloom, cx, cy, size, rot, darken):
    scale = size / max(bloom.size)
    w, h = max(1, int(bloom.width * scale)), max(1, int(bloom.height * scale))
    piece = bloom.resize((w, h), Image.LANCZOS).rotate(rot, resample=Image.BICUBIC, expand=True)
    if darken > 0:                     # blooms further back catch less light
        shade = Image.new("RGBA", piece.size, (40, 12, 34, 0))
        shade.putalpha(piece.getchannel("A").point(lambda v: int(v * darken)))
        piece = Image.alpha_composite(piece, shade)
    canvas.alpha_composite(piece, (int(cx - piece.width / 2), int(cy - piece.height / 2)))


def main():
    photo = base_photo()
    if photo.size != (1080, 1620):
        photo = photo.resize((1080, 1620), Image.LANCZOS)

    lil = lilies()
    layer = Image.new("RGBA", photo.size, (0, 0, 0, 0))
    for i, (cx, cy, size, rot, darken) in enumerate(LILY_PLACEMENT):
        place(layer, lil[i % len(lil)], cx, cy, size, rot, darken)

    # match the photograph's soft, cool window light rather than dropping in
    # hard-lit cut-outs
    layer = ImageEnhance.Brightness(layer).enhance(1.04)
    layer = ImageEnhance.Color(layer).enhance(0.94)
    layer = layer.filter(ImageFilter.GaussianBlur(0.4))

    wrapped = photo.convert("RGBA")
    wrapped.alpha_composite(layer)
    wrapped.convert("RGB").save(
        os.path.join(FLOWERS, "bouquet-lilies-wrapped.webp"), "WEBP", quality=88, method=6)

    # the reveal: the bloom half of the same bouquet, closer in
    open_bq = wrapped.crop((120, 330, 980, 1000)).convert("RGB")
    open_bq.save(os.path.join(FLOWERS, "bouquet-lilies-open.webp"), "WEBP", quality=90, method=6)

    for name in ("bouquet-lilies-wrapped.webp", "bouquet-lilies-open.webp"):
        path = os.path.join(FLOWERS, name)
        print(f"{name}: {Image.open(path).size} {os.path.getsize(path)//1024}kb")


if __name__ == "__main__":
    main()
