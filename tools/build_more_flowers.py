# -*- coding: utf-8 -*-
"""
More flowers for the bouquet builder, and more than one kind of lily.

The tray had nine flowers and exactly one lily, repeated. Her flower is the
lily, so there is now a lily section of its own - calla, white, tiger, dried
- plus roses in four colours and a proper florist's spread behind them.

Same cutting method as build_flower_cutouts.py: flood inwards from the
border so the background goes transparent while pale petals in the middle of
the bloom survive, feather, trim. It is resumable and tolerant of a spent
API budget, because Unsplash's demo tier allows fifty requests an hour and
this wants more than fifty on a cold run - rerun it later and it picks up
whatever is still missing.

    UNSPLASH_ACCESS_KEY=... python tools/build_more_flowers.py
"""
import io, json, os, sys, urllib.error, urllib.request
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLOWERS = os.path.join(ROOT, "miss-you-app", "assets", "flowers")
CREDITS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "flower_credits.json")
UA = {"User-Agent": "MoonpieApp/1.0 (private gift project)"}

# name -> (unsplash id, flood tolerance, clear enclosed pockets?)
# Pocket clearing keys off colour distance to the sampled background, so it
# is only safe on blooms that are not themselves pale.
PICKS = {
    # --- lilies, because one lily repeated is not a lily section ----------
    "lily-calla":     ("uT8tGvIrXJg", 40, True),
    "lily-calla-2":   ("o6X-jtbu_M8", 40, True),
    "lily-white":     ("KrFvQ0J5TPg", 34, False),
    "lily-tiger":     ("H46PSViFAnw", 46, True),
    "lily-dried":     ("t-Ik01w5FMw", 36, False),

    # --- roses ------------------------------------------------------------
    "rose-red-2":     ("6z-fHEK_zAo", 44, True),
    "rose-pink":      ("guyTcnpRkaw", 42, True),
    "rose-yellow":    ("Fn0zG8EHuC0", 40, False),

    # --- the rest of the florist ------------------------------------------
    "peony":          ("HV3XfirsXp8", 40, True),
    "peony-2":        ("DTpKjgHpHj4", 36, False),
    "ranunculus":     ("8KfbQ04AmjY", 38, True),
    "anemone":        ("U1i8XBkG7Ck", 42, True),
    "dahlia":         ("lV6jNy2K9Sk", 44, True),
    "orchid":         ("kly-z2c54b0", 38, False),
    "orchid-pink":    ("VubRfL7yhwY", 40, True),
    "freesia":        ("nUE7xUd6nGc", 34, False),
    "chrysanthemum":  ("1tGx2d5e2So", 34, False),
    "protea":         ("_AA8IirCYdk", 46, True),
}

MAX_EDGE = 900
MARKER = (255, 0, 255)


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


def _border_colour(im):
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
    im = im.copy()
    im.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
    w, h = im.size

    work = im.copy()
    px = work.load()
    seeds = []
    for x in range(0, w, 5):
        seeds += [(x, 0), (x, h - 1)]
    for y in range(0, h, 5):
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
        bg = _border_colour(im)
        ipx = im.load()
        for y in range(h):
            for x in range(w):
                if apx[x, y] == 0:
                    continue
                r, g, b = ipx[x, y]
                if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) < 46:
                    apx[x, y] = 0

    alpha = alpha.filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert("RGBA")
    out.putalpha(alpha)
    box = out.getbbox()
    return out.crop(box) if box else out


def kept_fraction(cut, original_px):
    """How much of the frame survived. Near 1.0 means the flood found nothing
    and the cut-out is just the photo with its background still attached."""
    return (cut.width * cut.height) / float(original_px) if original_px else 1.0


def main():
    credits = {}
    if os.path.exists(CREDITS):
        credits = json.load(open(CREDITS, encoding="utf-8"))

    done = skipped = failed = 0
    for name, (pid, tol, pockets) in PICKS.items():
        dest = os.path.join(FLOWERS, f"cut-{name}.webp")
        if os.path.exists(dest):
            skipped += 1
            continue
        try:
            im, meta = fetch(pid)
        except urllib.error.HTTPError as e:
            # 403 here is the hourly budget, not a bad id: stop cleanly so a
            # rerun resumes rather than burning the next hour's budget too
            print(f"{name}: HTTP {e.code} - stopping, rerun later to resume")
            failed += 1
            break
        except Exception as e:
            print(f"{name}: {e}")
            failed += 1
            continue

        before = im.copy()
        before.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
        cut = cut_out(im, tol, pockets)
        frac = kept_fraction(cut, before.width * before.height)
        cut.save(dest, "WEBP", quality=90, method=6)
        credits[name] = {
            "file": f"cut-{name}.webp", "unsplash_id": pid,
            "creator": meta["user"]["name"], "page": meta["links"]["html"],
            "licence": "Unsplash Licence",
        }
        flag = "  <- check, barely cut" if frac > 0.92 else ""
        print(f"{name}: {cut.size} {os.path.getsize(dest)//1024}kb kept={frac:.2f}{flag}")
        done += 1

    json.dump(credits, open(CREDITS, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"\nnew {done}, already had {skipped}, failed {failed}")


if __name__ == "__main__":
    main()
