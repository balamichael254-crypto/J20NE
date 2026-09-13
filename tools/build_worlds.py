# -*- coding: utf-8 -*-
"""
Regenerate the `worlds` array inside miss-you-app/content.js from world_data.py.

world_data.py is the source of truth for the stops; this only rewrites the
block between `const worlds = [` and its closing `];`, leaving the rest of
content.js (poems, letters, notices, reasons and the rest) untouched.

Each world gains a `slug`, which is what the app uses to build the per-stop
image path (assets/worlds/<slug>/NN.webp). Missing images are not a problem:
the markup carries an onerror that removes the element, the same way the rest
of this app already handles photography that has not been fetched yet.

    python tools/build_worlds.py
"""
import io, os, re

from world_data import WORLDS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "miss-you-app", "content.js")


def js(s):
    """Single-quoted JS string literal."""
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


IMG_DIR = os.path.join(ROOT, "miss-you-app", "assets", "worlds")


def build_block():
    """Third element of a stop is 1 when its photograph has actually been
    fetched. The renderer only emits an <img> for those - a lazy <img> whose
    file does not exist would sit there reserving space until it scrolled into
    view, errored and vanished, which is a layout jump for every missing
    photo. Better to know at build time."""
    lines = ["  const worlds = ["]
    have = 0
    for slug, (name, eyebrow, intro, moments) in WORLDS.items():
        lines.append(f"    world({js(name)}, {js(eyebrow)},")
        lines.append(f"      {js(intro)},")
        lines.append(f"      {js(slug)}, gallery({js(slug)}), [")
        for i, (title, text, _query) in enumerate(moments):
            exists = os.path.exists(os.path.join(IMG_DIR, slug, f"{i:02d}.webp"))
            have += 1 if exists else 0
            suffix = ", 1" if exists else ""
            lines.append(f"      [{js(title)}, {js(text)}{suffix}],")
        lines.append("    ]),")
    lines.append("  ];")
    total = sum(len(w[3]) for w in WORLDS.values())
    print(f"stop photographs present: {have}/{total}")
    return "\n".join(lines)


def main():
    src = io.open(CONTENT, encoding="utf-8").read()

    start = src.index("  const worlds = [")
    # the array's own closing bracket: first "\n  ];" at the base indent level
    end = src.index("\n  ];", start) + len("\n  ];")
    src = src[:start] + build_block() + src[end:]

    # the world() factory needs to accept and carry the slug through
    old_factory = re.search(r"  const world = \([^)]*\) => \(\{.*?\}\);", src, re.S)
    new_factory = (
        "  const world = (name, eyebrow, intro, slug, gallery, moments, palette) => ({\n"
        "    name, eyebrow, intro, palette, slug,\n"
        "    photos: gallery,\n"
        "    moments\n"
        "  });"
    )
    if old_factory:
        src = src[:old_factory.start()] + new_factory + src[old_factory.end():]

    io.open(CONTENT, "w", encoding="utf-8").write(src)
    total = sum(len(w[3]) for w in WORLDS.values())
    print(f"wrote {len(WORLDS)} worlds, {total} stops -> {CONTENT}")


if __name__ == "__main__":
    main()
