# -*- coding: utf-8 -*-
"""
Cut real flowers out of their backgrounds for the bouquet builder.

The builder's tray mixed photographic lily cut-outs with flat clipart SVGs
for the rose, tulip, sunflower and so on. Two different drawing styles in one
tray, which is why the arrangement never looked like a bouquet.

These are all photographs now, cut out the same way: pick stock shots taken
on a plain pale background, flood fill inwards from the border so the
background goes transparent while white petals in the middle of the flower
survive (a plain brightness threshold erases them), feather the edge, and
trim to the flower.

    UNSPLASH_ACCESS_KEY=... python tools/build_flower_cutouts.py
"""
import io, json, os, urllib.request
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLOWERS = os.path.join(ROOT, "miss-you-app", "assets", "flowers")
CREDITS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "flower_credits.json")
UA = {"User-Agent": "MoonpieApp/1.0 (private gift project)"}

# name -> (unsplash id, flood tolerance). Each is a single stem or bloom shot
# on a plain pale background, which is what makes a clean matte possible.
# name -> (unsplash id, flood tolerance, clear enclosed pockets?)
# Pocket clearing removes background trapped between leaves and stem, which
# the border flood cannot reach. It keys off colour distance to the sampled
# background, so it is only safe on flowers that are not themselves pale -
# on the daisy it would eat the petals.
PICKS = {
    "rose":       ("3rDPHZ7_gCA", 45, True),
    "tulip":      ("4DcNlb77Ln0", 45, True),
    "tulip-pink": ("x4pYSbKPtzA", 45, True),
    "daisy":      ("kFK54FCIB3U", 32, False),  # white on white: flood only
}

MAX_EDGE = 900


def fetch(photo_id):
    key = os.environ.get("UNSPLASH_ACCESS_KEY", "").strip()
    if not key:
        raise SystemExit("set UNSPLASH_ACCESS_KEY")
    auth = {**UA, "Authorization": f"Client-ID {key}", "Accept-Version": "v1"}
    with urllib.request.urlopen(urllib.request.Request(
            f"https://api.unsplash.com/photos/{photo_id}", headers=auth), timeout=40) as r:
        meta = json.load(r)
    with urllib.request.urlopen(urllib.request.Request(meta["urls"]["regular"], headers=UA), timeout=60) as r:
        im = Image.open(io.BytesIO(r.read())).convert("RGB")
    try:   # Unsplash asks for this whenever an image is actually used
        urllib.request.urlopen(urllib.request.Request(
            meta["links"]["download_location"], headers=auth), timeout=20).read(1)
    except Exception:
        pass
    return im, meta


MARKER = (255, 0, 255)


def _border_colour(im):
    """Average colour around the frame: the background, near enough."""
    w, h = im.size
    px = im.load()
    samples = []
    for x in range(0, w, 7):
        samples += [px[x, 0], px[x, h - 1]]
    for y in range(0, h, 7):
        samples += [px[0, y], px[w - 1, y]]
    n = len(samples)
    return tuple(sum(c[i] for c in samples) // n for i in range(3))


def cut_out(im, tol, clear_pockets=False):
    """Background to transparent, by flooding inwards from the edges.

    Flooding rather than thresholding on brightness is the whole point: a
    white daisy on a white background loses its petals to a threshold, but
    survives a flood because its petals are not connected to the border.

    The seeds have to sit ON the photo's own edge pixels. An earlier version
    pasted the photo inside a magenta frame and seeded from the frame, which
    just filled magenta with magenta and cut nothing out at all."""
    im = im.copy()
    im.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
    w, h = im.size

    work = im.copy()
    px = work.load()
    seeds = []
    step = 5
    for x in range(0, w, step):
        seeds += [(x, 0), (x, h - 1)]
    for y in range(0, h, step):
        seeds += [(0, y), (w - 1, y)]
    for sx, sy in seeds:
        if px[sx, sy] != MARKER:
            ImageDraw.floodfill(work, (sx, sy), MARKER, thresh=tol)

    alpha = Image.new("L", (w, h), 255)
    apx, fpx = alpha.load(), work.load()
    for y in range(h):
        for x in range(w):
            if fpx[x, y] == MARKER:
                apx[x, y] = 0

    if clear_pockets:
        # background trapped inside the silhouette (between a leaf and the
        # stem, say) is never reached from the border, so clear it by colour
        bg = _border_colour(im)
        ipx = im.load()
        for y in range(h):
            for x in range(w):
                if apx[x, y] == 0:
                    continue
                r, g, b = ipx[x, y]
                if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) < 46:
                    apx[x, y] = 0

    alpha = alpha.filter(ImageFilter.GaussianBlur(0.8))     # feather the edge
    out = im.convert("RGBA")
    out.putalpha(alpha)

    box = out.getbbox()
    return out.crop(box) if box else out


def main():
    credits = {}
    if os.path.exists(CREDITS):
        credits = json.load(open(CREDITS, encoding="utf-8"))

    for name, (pid, tol, pockets) in PICKS.items():
        dest = os.path.join(FLOWERS, f"cut-{name}.webp")
        print(f"{name} <- {pid}")
        im, meta = fetch(pid)
        cut = cut_out(im, tol, pockets)
        cut.save(dest, "WEBP", quality=90, method=6)
        credits[name] = {
            "file": f"cut-{name}.webp", "unsplash_id": pid,
            "creator": meta["user"]["name"], "page": meta["links"]["html"],
            "licence": "Unsplash Licence",
        }
        print(f"   -> {cut.size} {os.path.getsize(dest)//1024}kb")

    json.dump(credits, open(CREDITS, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"credits -> {CREDITS}")


if __name__ == "__main__":
    main()
