# -*- coding: utf-8 -*-
"""
Real stationery for the letters: paper that was photographed, and stamps cut
from the app's own travel photography.

The envelopes and the letter sheet were built entirely out of CSS: a
turbulence filter standing in for paper grain, a gradient standing in for
paper, and an emoji in a rounded box standing in for a postage stamp. It all
reads as shapes arranged to suggest a letter rather than as a letter.

Two fixes here, both of them imports rather than drawings.

PAPER. One photographed sheet of handmade paper, with real fibre, real
flecks and real unevenness, duotoned into the six stationery colours.
Duotone rather than a hue shift, so every fibre survives and midnight blue
paper is paper rather than cream paper behind a blue filter.

STAMPS. Every stamp is a real photograph of one of the twenty places in Our
Worlds, set in a perforated frame with the place printed under it. So the
stamp on a letter about the airport is the airport, and the one on the
letter about Paris is Paris. These photos are already in the app and already
credited in assets/worlds/ATTRIBUTION.md.

    UNSPLASH_ACCESS_KEY=... python tools/build_stationery.py

The key is only needed the first time, to fetch the paper photograph; the
stamps are built from files already on disk.
"""
import io, json, os, urllib.request
from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "miss-you-app")
WORLDS = os.path.join(APP, "assets", "worlds")
FLOWERS = os.path.join(APP, "assets", "flowers")
OUT = os.path.join(APP, "assets", "paper")
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_paper_base.jpg")
UA = {"User-Agent": "MoonpieApp/1.0 (private gift project)"}

# Unsplash ESF8ZQlSo2o: a sheet of handmade paper, lit flat, with the flecks
# and fibres still visible. Flat light is what makes it usable as a tile.
PAPER_PHOTO = "ESF8ZQlSo2o"

# name -> (shadow, highlight). The midtone is the colour the chip promises.
SHEETS = {
    "cream":    ((156, 132,  92), (255, 252, 242)),
    "blush":    ((196, 126, 152), (255, 246, 249)),
    "lilac":    ((142, 118, 186), (250, 246, 255)),
    "sage":     ((118, 148, 116), (247, 252, 245)),
    "sand":     ((168, 128,  78), (253, 244, 228)),
    "midnight": (( 28,  20,  58), (126, 110, 178)),
}

# theme -> (photo file, what to print under it)
STAMPS = {
    "lilies":    (os.path.join(FLOWERS, "hero-lily.webp"), "STARGAZER"),
    "airport":   (os.path.join(WORLDS, "airport-hug-1.webp"), "ARRIVALS"),
    "birthday":  (os.path.join(WORLDS, "cappadocia-1.webp"), "CAPPADOCIA"),
    "kitchen":   (os.path.join(WORLDS, "kitchen-1.webp"), "OUR KITCHEN"),
    "moon":      (os.path.join(WORLDS, "aurora-1.webp"), "NIGHT POST"),
    "safe":      (os.path.join(WORLDS, "bedroom-fort-1.webp"), "THE FORT"),
    "stars":     (os.path.join(WORLDS, "aurora-2.webp"), "AURORA"),
    "voice":     (os.path.join(WORLDS, "paris-1.webp"), "PARIS"),
    # the ones she can choose from in the composer
    "kyoto":     (os.path.join(WORLDS, "kyoto-1.webp"), "KYOTO"),
    "santorini": (os.path.join(WORLDS, "santorini-1.webp"), "SANTORINI"),
    "venice":    (os.path.join(WORLDS, "venice-1.webp"), "VENICE"),
    "maldives":  (os.path.join(WORLDS, "maldives-1.webp"), "MALDIVES"),
    "kenya":     (os.path.join(WORLDS, "kenya-1.webp"), "HOME"),
    "zanzibar":  (os.path.join(WORLDS, "zanzibar-1.webp"), "ZANZIBAR"),
}

SERIF = "C:/Windows/Fonts/constan.ttf"
SERIF_BOLD = "C:/Windows/Fonts/constanb.ttf"

W, H = 240, 296          # a stamp is taller than it is wide
BORDER = 16              # the white margin the perforations bite into
PERF_R = 7               # radius of one perforation
PERF_STEP = 24           # centre-to-centre spacing


def paper_photo():
    if os.path.exists(CACHE):
        return Image.open(CACHE).convert("RGB")
    key = os.environ.get("UNSPLASH_ACCESS_KEY", "").strip()
    if not key:
        raise SystemExit("set UNSPLASH_ACCESS_KEY once, to fetch the paper photograph")
    auth = {**UA, "Authorization": f"Client-ID {key}", "Accept-Version": "v1"}
    with urllib.request.urlopen(urllib.request.Request(
            f"https://api.unsplash.com/photos/{PAPER_PHOTO}", headers=auth), timeout=40) as r:
        meta = json.load(r)
    with urllib.request.urlopen(urllib.request.Request(meta["urls"]["regular"], headers=UA), timeout=60) as r:
        im = Image.open(io.BytesIO(r.read())).convert("RGB")
    im.save(CACHE, quality=94)
    try:   # Unsplash asks for this whenever an image is actually used
        urllib.request.urlopen(urllib.request.Request(
            meta["links"]["download_location"], headers=auth), timeout=20).read(1)
    except Exception:
        pass
    print(f"paper photo: {meta['user']['name']} - {meta['links']['html']}")
    return im


def build_sheets():
    os.makedirs(OUT, exist_ok=True)
    photo = paper_photo()
    # a square crop from the middle, small enough to ship and big enough that
    # it never visibly repeats behind a letter
    side = min(photo.size)
    photo = photo.crop(((photo.width - side) // 2, (photo.height - side) // 2,
                        (photo.width + side) // 2, (photo.height + side) // 2))
    photo = photo.resize((640, 640), Image.LANCZOS)
    gray = ImageOps.autocontrast(photo.convert("L"), cutoff=(1, 1))
    # paper is nearly uniform: squash the range so the fibres read as texture
    # rather than as stains
    gray = gray.point(lambda v: int(118 + v * 0.53))
    for name, (dark, light) in SHEETS.items():
        sheet = ImageOps.colorize(gray, black=dark, white=light)
        dest = os.path.join(OUT, f"sheet-{name}.webp")
        sheet.save(dest, "WEBP", quality=84, method=6)
        print(f"sheet-{name}.webp  {sheet.size}  {os.path.getsize(dest)//1024}kb")


def perforate(card):
    """Bite the perforations out of all four edges."""
    alpha = card.getchannel("A")
    cut = ImageDraw.Draw(alpha)
    for x in range(PERF_STEP // 2, W, PERF_STEP):
        cut.ellipse((x - PERF_R, -PERF_R, x + PERF_R, PERF_R), fill=0)
        cut.ellipse((x - PERF_R, H - PERF_R, x + PERF_R, H + PERF_R), fill=0)
    for y in range(PERF_STEP // 2, H, PERF_STEP):
        cut.ellipse((-PERF_R, y - PERF_R, PERF_R, y + PERF_R), fill=0)
        cut.ellipse((W - PERF_R, y - PERF_R, W + PERF_R, y + PERF_R), fill=0)
    card.putalpha(alpha)
    return card


def build_stamp(photo_path, caption):
    card = Image.new("RGBA", (W, H), (253, 251, 244, 255))
    draw = ImageDraw.Draw(card)

    inner = (BORDER, BORDER, W - BORDER, H - BORDER - 42)
    box_w, box_h = inner[2] - inner[0], inner[3] - inner[1]

    photo = Image.open(photo_path).convert("RGB")
    photo = ImageOps.fit(photo, (box_w, box_h), Image.LANCZOS, centering=(0.5, 0.45))
    # stamps are printed, not screened: slightly flatter and warmer than the
    # photograph they came from
    photo = ImageEnhance.Color(photo).enhance(0.86)
    photo = ImageEnhance.Contrast(photo).enhance(0.94)
    card.paste(photo, (inner[0], inner[1]))
    draw.rectangle(inner, outline=(60, 44, 30, 90), width=1)

    try:
        name_font = ImageFont.truetype(SERIF_BOLD, 19)
        value_font = ImageFont.truetype(SERIF, 16)
    except OSError:
        name_font = value_font = ImageFont.load_default()

    label = caption[:14]
    width = draw.textlength(label, font=name_font)
    draw.text(((W - width) / 2, H - BORDER - 36), label, font=name_font, fill=(52, 38, 64))

    # the denomination every stamp carries, in the only currency that applies
    value = "1 KISS"
    width = draw.textlength(value, font=value_font)
    draw.text(((W - width) / 2, H - BORDER - 15), value, font=value_font, fill=(150, 62, 104))

    return perforate(card)


def build_stamps():
    os.makedirs(OUT, exist_ok=True)
    for name, (path, caption) in STAMPS.items():
        if not os.path.exists(path):
            print(f"  skip {name}: no {os.path.basename(path)} yet")
            continue
        stamp = build_stamp(path, caption)
        dest = os.path.join(OUT, f"stamp-{name}.webp")
        stamp.save(dest, "WEBP", quality=90, method=6)
        print(f"stamp-{name}.webp  {stamp.size}  {os.path.getsize(dest)//1024}kb")


if __name__ == "__main__":
    build_sheets()
    build_stamps()
