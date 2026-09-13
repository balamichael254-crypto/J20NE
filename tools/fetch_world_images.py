# -*- coding: utf-8 -*-
"""
Give every stop in Our Worlds its own photograph.

Openverse is the primary source: it aggregates the CC-licensed photography on
Flickr, Nappy, Rawpixel and others, needs no API key, and returns actual
travel photography rather than the museum scans and technical documentation
a plain Commons search surfaces (a search for "Paris cafe" there returned a
Degas painting, and "bridge at night" returned a telescope mirror in transit).

Only cc0 / public-domain / by / by-sa are requested. NC is excluded because
this is someone's app, and ND is excluded because these get cropped, which is
exactly the derivative work an ND licence forbids.

Every file's source, author and licence is written to world_credits.json so
ATTRIBUTION.md can be regenerated - for by and by-sa, credit is a condition
of the licence, not a courtesy.

    python tools/fetch_world_images.py            # only missing images
    python tools/fetch_world_images.py --force    # refetch everything
    python tools/fetch_world_images.py kyoto      # one world
"""
import io, json, os, re, sys, time, urllib.parse, urllib.request

from PIL import Image
from world_data import WORLDS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "miss-you-app", "assets", "worlds")
CREDITS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "world_credits.json")
UA = "MoonpieApp/1.0 (private gift project)"

TARGET_W, TARGET_H = 900, 563          # 16:10, still sharp on a retina phone
LICENSES = "cc0,pdm,by,by-sa"
LICENSE_RANK = {"cc0": 0, "pdm": 0, "by": 1, "by-sa": 2}

STOPWORDS = {"a", "an", "the", "of", "in", "on", "at", "and", "with", "to"}

# Openverse's "photograph" category still lets scanned artwork through: a
# search for "Paris cafe" returned a cubist painting, and "streets after rain"
# returned the same Caillebotte twice. These are the archives that serve
# museum scans rather than photography.
BLOCKED_SOURCES = {"rawpixel", "bio_diversity", "smithsonian", "met",
                   "clevelandmuseum", "statensmuseum", "nypl", "brooklynmuseum",
                   "digitaltmuseum", "science_museum", "svgsilh", "thorvaldsensmuseum"}

# ...and the same thing again from the title side, for anything that slips
# through on an allowed source
ARTWORK = re.compile(
    r"(painting|oil on|watercolou?r|engraving|lithograph|etching|woodcut|"
    r"illustration|drawing|sketch|portrait of|still life|\bprint\b|"
    r"museum|gallery of art|\b1[6-9]\d{2}\b|\b(18|19)\d{2}\s*[-,]|"
    r"^[A-Z]{4,}[ ,]|plate \d+|fig\. ?\d+)", re.I)


def http_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.load(r)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(1.5 * (attempt + 1))


def unsplash(query, page_size=12):
    """Preferred source when UNSPLASH_ACCESS_KEY is set.

    Openverse and Commons are keyless, but they index amateur and archival
    uploads, so a keyword search returns whatever happens to carry the word:
    "Paris cafe" produced a watercolour, and "Paris street" produced a church
    in Paris, Victoria, Australia. Unsplash is curated, which is the whole
    difference here, and is where this app's existing photography came from."""
    key = os.environ.get("UNSPLASH_ACCESS_KEY", "").strip()
    if not key:
        return []
    url = "https://api.unsplash.com/search/photos?" + urllib.parse.urlencode({
        "query": query, "per_page": str(page_size), "orientation": "landscape",
        "content_filter": "high",
    })
    req = urllib.request.Request(url, headers={
        "User-Agent": UA, "Accept-Version": "v1", "Authorization": f"Client-ID {key}"})
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            data = json.load(r)
    except Exception as e:
        print(f"      ! unsplash: {e}")
        return []
    out = []
    for p in data.get("results", []) or []:
        urls = p.get("urls") or {}
        user = p.get("user") or {}
        out.append({
            "url": urls.get("regular") or urls.get("full"),
            "download_location": ((p.get("links") or {}).get("download_location")),
            "title": p.get("description") or p.get("alt_description") or "",
            "creator": user.get("name") or user.get("username") or "unknown",
            "license": "Unsplash Licence",
            "source": "unsplash",
            "foreign_landing_url": (p.get("links") or {}).get("html"),
            "width": p.get("width") or 0,
            "height": p.get("height") or 0,
        })
    return out


def unsplash_ping_download(result):
    """Unsplash's API terms require a hit to download_location when an image is
    actually used. Best effort: never let this failing stop the fetch."""
    loc = result.get("download_location")
    key = os.environ.get("UNSPLASH_ACCESS_KEY", "").strip()
    if not loc or not key:
        return
    try:
        req = urllib.request.Request(loc, headers={
            "User-Agent": UA, "Accept-Version": "v1", "Authorization": f"Client-ID {key}"})
        urllib.request.urlopen(req, timeout=20).read(1)
    except Exception:
        pass


def openverse(query, page_size=20):
    url = "https://api.openverse.org/v1/images/?" + urllib.parse.urlencode({
        "q": query, "page_size": str(page_size), "license": LICENSES,
        "category": "photograph", "mature": "false", "aspect_ratio": "wide",
    })
    try:
        return (http_json(url) or {}).get("results", []) or []
    except Exception as e:
        print(f"      ! openverse: {e}")
        return []


# Words that describe the light or the mood rather than the subject. They are
# the first thing to drop when a long query finds nothing, because they are
# also the words that cause drift: trimming "Paris cafe terrace evening" from
# the end leaves "Paris cafe terrace", but a naive two-word trim once left
# "evening peak" and returned a photograph of a bus.
GENERIC = {"evening", "night", "morning", "day", "light", "lights", "lit", "warm",
           "soft", "view", "interior", "exterior", "scene", "empty", "quiet",
           "small", "old", "traditional", "fresh", "clear", "casual", "home",
           "early", "late", "cosy", "cozy", "hour", "golden", "blue", "green",
           "white", "dark", "over", "from", "above", "on", "in", "at", "to", "of"}


def shrinking_queries(query):
    """Full phrase, then the same phrase with the mood words stripped out,
    then just its two most distinctive terms. Order is always preserved, so
    the place name stays in front where it does the most work."""
    words = query.split()
    core = [w for w in words if w.lower() not in GENERIC] or words
    seen, out = set(), []
    for q in (query, " ".join(core[:3]), " ".join(core[:2])):
        q = q.strip()
        if q and q not in seen:
            seen.add(q)
            out.append(q)
    return out


def usable(result):
    """A filter, deliberately not a ranking.

    An earlier version scored candidates by how many query words appeared in
    the title, which sounds sensible and is not: single common words match
    everything, so "Paris cafe terrace evening" promoted a bus photographed in
    "evening peak" over a cc0 photograph literally titled "Paris cafe".
    Openverse already ranks by relevance; the job here is only to throw out
    what is unusable and leave that ranking alone."""
    title = result.get("title") or ""
    if result.get("source") in BLOCKED_SOURCES or ARTWORK.search(title):
        return False
    w = result.get("width") or 0
    h = result.get("height") or 0
    if w < 900 or h < 500:
        return False                     # too small to crop from
    ratio = w / h
    return 1.1 <= ratio <= 2.4


def fetch_bytes(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()


def crop_to_ratio(im, tw, th):
    im = im.convert("RGB")
    target = tw / th
    w, h = im.size
    if w / h > target:                   # too wide: trim the sides evenly
        new_w = int(h * target)
        left = (w - new_w) // 2
        im = im.crop((left, 0, left + new_w, h))
    else:                                # too tall: bias upward, skies and
        new_h = int(w / target)          # faces live above the centre line
        top = int((h - new_h) * 0.35)
        im = im.crop((0, top, w, top + new_h))
    return im.resize((tw, th), Image.LANCZOS)


def candidates_for(query):
    """Unsplash first when a key is present, Openverse as the keyless fallback.
    Search-engine relevance order is preserved; these checks only remove what
    is unusable."""
    pool, seen = [], set()
    for finder in (unsplash, openverse):
        for q in shrinking_queries(query):
            for r in finder(q):
                u = r.get("url")
                if not u or u in seen or not usable(r):
                    continue
                seen.add(u)
                pool.append(r)
            if len(pool) >= 8:
                break
            time.sleep(0.25)
        if pool:
            break          # don't dilute good curated hits with weaker ones
    return pool


def save_stop(slug, idx, cands, used):
    """`used` holds the urls already taken by earlier stops in this same world,
    so a place cannot end up showing one photograph twice under two names."""
    dest_dir = os.path.join(OUT_DIR, slug)
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, f"{idx:02d}.webp")
    for c in cands:
        if c["url"] in used:
            continue
        try:
            im = Image.open(io.BytesIO(fetch_bytes(c["url"])))
            crop_to_ratio(im, TARGET_W, TARGET_H).save(dest, "WEBP", quality=82, method=6)
            used.add(c["url"])
            if c.get("source") == "unsplash":
                unsplash_ping_download(c)
            return c
        except Exception as e:
            print(f"      ! {(c.get('title') or '?')[:50]}: {e}")
    return None


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv
    slugs = args or list(WORLDS.keys())

    credits = {}
    if os.path.exists(CREDITS_PATH):
        with open(CREDITS_PATH, encoding="utf-8") as f:
            credits = json.load(f)

    missing = []
    for slug in slugs:
        name, _eyebrow, _intro, moments = WORLDS[slug]
        print(f"\n=== {slug} ({name})")
        used = set()      # photos already taken by earlier stops in this world
        for i, (title, _text, query) in enumerate(moments):
            dest = os.path.join(OUT_DIR, slug, f"{i:02d}.webp")
            if os.path.exists(dest) and not force:
                print(f"  {i:02d} have  {title}")
                continue
            cands = candidates_for(query)
            if not cands:
                print(f"  {i:02d} MISS  {title}  <- \"{query}\"")
                missing.append(f"{slug}/{i:02d} {query}")
                continue
            got = save_stop(slug, i, cands, used)
            if got:
                credits[f"{slug}/{i:02d}"] = {
                    "world": name, "stop": title, "query": query,
                    "title": got.get("title"), "creator": got.get("creator"),
                    "license": f"{got.get('license')} {got.get('license_version') or ''}".strip(),
                    "source": got.get("source"),
                    "page": got.get("foreign_landing_url"),
                }
                print(f"  {i:02d} ok    {title}  [{got.get('license')}] {(got.get('title') or '')[:44]}")
            else:
                print(f"  {i:02d} FAIL  {title}")
                missing.append(f"{slug}/{i:02d} {query}")

    with open(CREDITS_PATH, "w", encoding="utf-8") as f:
        json.dump(credits, f, indent=1, ensure_ascii=False, sort_keys=True)
    print(f"\ncredits: {len(credits)} entries")
    if missing:
        print(f"missing {len(missing)}:")
        for m in missing:
            print("  ", m)


if __name__ == "__main__":
    main()
