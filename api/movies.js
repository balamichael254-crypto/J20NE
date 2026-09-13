/* ============================================================================
   TMDB proxy for the watchlist screen.

   The client never sees the TMDB key - it lives only in process.env on
   Vercel and this function is the only thing that reads it. That also means
   the browsable catalogue is not a list we wrote and have to keep extending
   by hand: it is TMDB's whole database, tens of thousands of titles, always
   current, always with a real poster and a real trailer.

   ?op=genres                          the real TMDB genre list
   ?op=discover&genre=<id>&page=<n>&sort=<popularity.desc|vote_average.desc>
                                        a page of movies for a genre (or all)
   ?op=search&q=<text>&page=<n>        title search
   ?op=detail&id=<tmdb id>             overview, runtime, poster, trailer key

   `genre` also accepts two curated ids that are not real TMDB genres:
     "comfort" -> family + comedy, sorted gentle (vote_average, min votes)
     "korean"  -> any genre, original_language=ko
   ========================================================================= */

const json = (response, status, body) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "public, max-age=1800"); // TMDB data barely changes minute to minute
  response.end(JSON.stringify(body));
};

const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

function authHeaders(key) {
  // v4 read access tokens are long JWT-looking strings; v3 keys are short
  // hex. Support whichever the user pasted into TMDB_API_KEY.
  return key.length > 40 ? { Authorization: `Bearer ${key}` } : {};
}
function withKey(url, key) {
  if (key.length > 40) return url; // v4 token goes in the header instead
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}api_key=${encodeURIComponent(key)}`;
}

async function tmdb(path, key) {
  const url = withKey(`${TMDB}${path}`, key);
  const result = await fetch(url, { headers: { accept: "application/json", ...authHeaders(key) } });
  if (!result.ok) {
    const text = await result.text().catch(() => "");
    throw new Error(`TMDB ${result.status}: ${text.slice(0, 200)}`);
  }
  return result.json();
}

function posterUrl(path, size = "w342") {
  return path ? `${IMG}/${size}${path}` : null;
}

function slimMovie(m) {
  return {
    id: m.id,
    title: m.title || m.name,
    year: (m.release_date || m.first_air_date || "").slice(0, 4) || null,
    overview: m.overview || "",
    poster: posterUrl(m.poster_path, "w500"),
    backdrop: posterUrl(m.backdrop_path, "w780"),
    rating: typeof m.vote_average === "number" ? Math.round(m.vote_average * 10) / 10 : null,
    genreIds: m.genre_ids || (m.genres ? m.genres.map(g => g.id) : [])
  };
}

module.exports = async function handler(request, response) {
  const key = process.env.TMDB_API_KEY;
  if (!key) return json(response, 503, { error: "movie catalogue is not connected yet" });

  const op = String(request.query?.op || "");
  const page = Math.max(1, Math.min(500, Number(request.query?.page) || 1));

  try {
    if (op === "genres") {
      const data = await tmdb("/genre/movie/list?language=en-US", key);
      return json(response, 200, { genres: data.genres || [] });
    }

    if (op === "discover") {
      const genre = String(request.query?.genre || "all");
      const sort = ["popularity.desc", "vote_average.desc", "release_date.desc"].includes(request.query?.sort)
        ? request.query.sort : "popularity.desc";
      // Browsing should surface what's actually current, not the same handful
      // of vote-count-heavy 1990s/2000s classics popularity sorting tends to
      // resurface - so every discover query (whatever the genre) is scoped to
      // roughly the last decade unless a specific sort asks for the classics.
      const recentYearsBack = 10;
      const cutoffYear = new Date().getUTCFullYear() - recentYearsBack;
      const params = new URLSearchParams({
        language: "en-US",
        page: String(page),
        sort_by: sort,
        "vote_count.gte": sort === "vote_average.desc" ? "150" : "40",
        "primary_release_date.gte": `${cutoffYear}-01-01`,
        include_adult: "false"
      });
      if (genre === "korean") {
        params.set("with_original_language", "ko");
      } else if (genre === "comfort") {
        params.set("with_genres", "10751,35"); // family, comedy
        params.set("sort_by", "vote_average.desc");
        params.set("vote_count.gte", "80");
      } else if (genre !== "all") {
        params.set("with_genres", genre);
      }
      const data = await tmdb(`/discover/movie?${params.toString()}`, key);
      return json(response, 200, {
        page: data.page, totalPages: data.total_pages,
        results: (data.results || []).map(slimMovie)
      });
    }

    if (op === "search") {
      const q = String(request.query?.q || "").trim().slice(0, 100);
      if (!q) return json(response, 200, { page: 1, totalPages: 0, results: [] });
      const params = new URLSearchParams({ language: "en-US", page: String(page), query: q, include_adult: "false" });
      const data = await tmdb(`/search/movie?${params.toString()}`, key);
      return json(response, 200, {
        page: data.page, totalPages: data.total_pages,
        results: (data.results || []).map(slimMovie)
      });
    }

    if (op === "detail") {
      const id = Number(request.query?.id);
      if (!Number.isInteger(id) || id <= 0) return json(response, 400, { error: "bad id" });
      const data = await tmdb(`/movie/${id}?language=en-US&append_to_response=videos`, key);
      const trailer = (data.videos?.results || [])
        .filter(v => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"))
        .sort((a, b) => (b.official === a.official ? 0 : b.official ? 1 : -1))[0];
      return json(response, 200, {
        ...slimMovie(data),
        runtime: data.runtime || null,
        genres: (data.genres || []).map(g => g.name),
        trailerKey: trailer ? trailer.key : null
      });
    }

    return json(response, 400, { error: "unknown op" });
  } catch (error) {
    return json(response, 502, { error: "could not reach the movie catalogue", detail: String(error.message || error).slice(0, 200) });
  }
};
