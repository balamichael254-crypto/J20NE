# World image sources

The destination gallery uses locally optimized copies so the mobile experience is stable and fast. Unsplash photographs are used under the Unsplash License. Additional Creative Commons photographs:

- Airport reunion photographs: Flickr `25470314767` and `7507829342`.
- Kyoto ryokan: "Serene Hiiragiya Bekkan ryokan" by paularps, CC BY 2.0.
- Zanzibar: "Stone Town Sunset" by Eric Kilby, CC BY-SA 2.0.
- Bali: "Jeda Villa Massage-service" by Jeda Villa Bali, CC BY 2.0.
- Cappadocia: photographs by Feridun F. Alkaya (CC0) and halbag (CC BY 2.0).
- Kenya: "Aberdare Country Club" by hktang and "WaterLovers Loungers" by www.hickey-fry.com, CC BY 2.0.
- Northern lights cabins: "Village Lights" by orkomedix, CC BY-NC-SA 2.0.
- Amalfi: photograph by moonjazz (Public Domain Mark) and "Lemons!" by EdFladung, CC BY-ND 2.0.
- Bedroom fort: "Pillow Fort" by dsprankle, CC BY 2.0.

## Per-stop photography (tools/fetch_world_images.py)

Each world's stops live in `assets/worlds/<slug>/NN.webp`, fetched by
`tools/fetch_world_images.py` and credited in `tools/world_credits.json`,
which records the source page, creator and licence for every file.

Only cc0 / public-domain / by / by-sa are requested. NC is excluded because
this is a real deployed app, and ND is excluded because these images are
cropped to 16:10, which is precisely the derivative work an ND licence
forbids.

Unsplash is the preferred source (set `UNSPLASH_ACCESS_KEY`); Openverse is
the keyless fallback. Openverse indexes amateur and archival uploads, so its
keyword matches are much weaker for this purpose: a search for "Paris cafe"
returned a watercolour, and "Paris street" returned a church in Paris,
Victoria, Australia.
