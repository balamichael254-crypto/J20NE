/* Track previews and artwork, from Apple's public search endpoint.

   The songs screen was a stack of Spotify embeds. A Spotify embed will not
   play a song to somebody who is not signed in to Spotify on that device -
   it shows the artwork and a thirty second teaser behind a login, and on a
   phone that has the app installed it tries to hand off instead. So the
   playlist looked like a playlist and could not be played, which is the one
   thing a playlist has to do.

   Apple's iTunes Search API is keyless, needs no account, and returns a
   thirty second preview MP3 plus album art for almost anything. It does not
   send CORS headers, which is why this proxy exists rather than the page
   calling it directly.

   Nothing here is stored. It is a lookup by title and artist, cached at the
   edge for a day, because the answer for "Best Part by Daniel Caesar" does
   not change. */

const json = (response, status, body, cacheSeconds = 0) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader(
    "Cache-Control",
    cacheSeconds
      ? `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}, stale-while-revalidate=604800`
      : "no-store"
  );
  response.end(JSON.stringify(body));
};

const clean = value => String(value || "").slice(0, 120).trim();

// "Daniel Caesar feat. H.E.R." finds nothing; "Daniel Caesar" finds the track.
// Featured-artist credits are the single most common reason a lookup misses.
const primaryArtist = artist =>
  clean(artist).split(/\s+(?:feat\.?|ft\.?|with|&|,|x)\s+/i)[0].trim();

module.exports = async function handler(request, response) {
  const title = clean(request.query?.title);
  const artist = clean(request.query?.artist);
  if (!title) return json(response, 400, { error: "missing title" });

  // most specific first, then loosen: a miss on the full credit should still
  // find the song rather than returning nothing
  const attempts = [
    `${title} ${artist}`,
    `${title} ${primaryArtist(artist)}`,
    title,
  ].filter((term, index, all) => term.trim() && all.indexOf(term) === index);

  try {
    for (const term of attempts) {
      const url =
        "https://itunes.apple.com/search?" +
        new URLSearchParams({ term, entity: "song", limit: "8", media: "music" });
      const result = await fetch(url, {
        headers: { "User-Agent": "MoonpieApp/1.0 (private gift project)" },
      });
      if (!result.ok) continue;
      const payload = await result.json();
      const wanted = title.toLowerCase();

      // Prefer an exact-ish title match with a preview over whatever ranked
      // first: searching a common title otherwise returns a cover or a live
      // version before the record we actually mean.
      const scored = (payload.results || [])
        .filter(row => row.previewUrl)
        .map(row => {
          const name = String(row.trackName || "").toLowerCase();
          let score = 0;
          if (name === wanted) score += 4;
          else if (name.startsWith(wanted)) score += 2;
          else if (name.includes(wanted)) score += 1;
          if (artist && String(row.artistName || "").toLowerCase()
              .includes(primaryArtist(artist).toLowerCase())) score += 3;
          return { row, score };
        })
        .sort((a, b) => b.score - a.score);

      const best = scored[0];
      if (!best || best.score < 2) continue;
      const row = best.row;
      return json(response, 200, {
        title: row.trackName,
        artist: row.artistName,
        album: row.collectionName || "",
        // the default artwork is 100px, which is a thumbnail; the same URL
        // serves any size if you ask for one
        artwork: String(row.artworkUrl100 || "").replace("100x100bb", "600x600bb"),
        preview: row.previewUrl,
        durationMs: Number(row.trackTimeMillis || 0),
        link: row.trackViewUrl || "",
      }, 86400);
    }
    return json(response, 404, { error: "no preview found" }, 3600);
  } catch (error) {
    console.error("music lookup failed", error);
    return json(response, 502, { error: "music lookup failed" });
  }
};
