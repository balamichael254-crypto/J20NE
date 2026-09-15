# -*- coding: utf-8 -*-
"""
Local preview server for miss-you-app.

python -m http.server serves the files but not the Vercel functions, so the
watchlist, the song player, the shared shelf and the vault all fail locally
in ways they do not fail in production. That makes local testing lie in both
directions: things look broken that are fine, and a real break hides in the
noise.

This serves the app AND the handful of /api routes that need no secrets, by
calling the same upstreams the deployed functions call. Routes that need
Supabase or a private key return a clear 503 saying so, rather than a 404
that looks like a bug in the page.

    python tools/devserver.py [port]
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "miss-you-app")
UA = {"User-Agent": "MoonpieApp/1.0 (private gift project)"}


def primary_artist(artist):
    for sep in (" feat. ", " feat ", " ft. ", " ft ", " with ", " & ", ", ", " x "):
        if sep in artist.lower():
            index = artist.lower().index(sep)
            return artist[:index].strip()
    return artist.strip()


def itunes_lookup(title, artist):
    """Mirrors api/music.js so local behaviour matches deployed behaviour."""
    wanted = title.lower()
    for term in dict.fromkeys(filter(None, [
            f"{title} {artist}".strip(),
            f"{title} {primary_artist(artist)}".strip(),
            title])):
        url = "https://itunes.apple.com/search?" + urllib.parse.urlencode(
            {"term": term, "entity": "song", "limit": 8, "media": "music"})
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
                payload = json.load(r)
        except Exception:
            continue

        best, best_score = None, 0
        for row in payload.get("results", []):
            if not row.get("previewUrl"):
                continue
            name = str(row.get("trackName", "")).lower()
            score = 4 if name == wanted else 2 if name.startswith(wanted) else 1 if wanted in name else 0
            if artist and primary_artist(artist).lower() in str(row.get("artistName", "")).lower():
                score += 3
            if score > best_score:
                best, best_score = row, score
        if best and best_score >= 2:
            return {
                "title": best.get("trackName"),
                "artist": best.get("artistName"),
                "album": best.get("collectionName", ""),
                "artwork": str(best.get("artworkUrl100", "")).replace("100x100bb", "600x600bb"),
                "preview": best.get("previewUrl"),
                "durationMs": best.get("trackTimeMillis", 0),
                "link": best.get("trackViewUrl", ""),
            }
    return None


NEEDS_SECRETS = {
    "widgets": "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
    "vault": "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
    "scores": "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
    "counter": "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
    "duel": "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
    "daily-question": "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
    "movies": "TMDB_API_KEY",
    "push-send": "push keys",
    "push-subscribe": "push keys",
}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=APP, **kw)

    def log_message(self, fmt, *args):
        if "/api/" in (self.path or ""):
            sys.stderr.write("  api %s\n" % self.path)

    def send_json(self, status, body):
        raw = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        # the app asks for ../api/x from /index.html, which normalises to /api/x
        if parsed.path.startswith("/api/"):
            name = parsed.path[len("/api/"):].strip("/")
            query = urllib.parse.parse_qs(parsed.query)
            if name == "music":
                found = itunes_lookup(
                    (query.get("title") or [""])[0],
                    (query.get("artist") or [""])[0])
                return self.send_json(200 if found else 404,
                                      found or {"error": "no preview found"})
            if name in NEEDS_SECRETS:
                return self.send_json(503, {
                    "error": "not available on the dev server",
                    "reason": f"needs {NEEDS_SECRETS[name]}; this route works on Vercel",
                })
            return self.send_json(404, {"error": f"no dev route for {name}"})
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith("/api/"):
            length = int(self.headers.get("Content-Length") or 0)
            if length:
                self.rfile.read(length)
            name = parsed.path[len("/api/"):].strip("/")
            return self.send_json(503, {
                "error": "not available on the dev server",
                "reason": f"needs {NEEDS_SECRETS.get(name, 'server config')}; this route works on Vercel",
            })
        self.send_error(405)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8791
    print(f"serving {APP} on http://127.0.0.1:{port}")
    print("  /api/music is live; Supabase and TMDB routes answer 503 with a reason")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
