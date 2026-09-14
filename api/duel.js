/* ============================================================================
   Shared game sessions, so a game can be played "together" as well as alone.

   There are no websockets here and there do not need to be. Together mode
   means: both phones generate the SAME puzzle from a shared seed, each person
   plays it on their own device, and progress is posted and read back so each
   sees how far the other has got and who finished first. That works fine over
   plain polling and survives either phone being offline for a while.

   Storage reuses moonpie_widgets (a generic room/id/value store) exactly the
   way api/scores.js does, so this needs no new table and no migration.

     GET  ?game=sudoku&level=medium         -> { seed, day, players: {...} }
     POST { game, level, profile, progress, elapsed, done }

   The seed is derived from game + level + the UTC day, so both phones land on
   the same puzzle without having to negotiate one, and it rolls over daily.
   ========================================================================= */
const crypto = require("crypto");

const PROFILES = ["Michelle", "Michael"];
const GAMES = ["sudoku", "memory", "jigsaw"];

const json = (response, status, body) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
};

const bodyOf = request => {
  if (typeof request.body !== "string") return request.body || {};
  try { return JSON.parse(request.body); } catch { return {}; }
};

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));

// UTC day, same convention as the daily question - both phones must agree on
// which day it is without asking each other.
const dayNumber = () => Math.floor(Date.now() / 86400000);

function seedFor(game, level, day) {
  const h = crypto.createHash("sha256").update(`${game}:${level}:${day}`).digest();
  return h.readUInt32BE(0);
}

module.exports = async function handler(request, response) {
  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return json(response, 503, { error: "shared storage is not connected" });

  const room = String(request.query?.room || "moonpie-duel-v1").slice(0, 80);
  const roomHash = crypto.createHash("sha256").update(room).digest("hex").slice(0, 24);
  const endpoint = `${supabaseUrl}/rest/v1/moonpie_widgets`;

  const supabase = async (url, options = {}) => {
    const result = await fetch(url, {
      ...options,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    if (!result.ok) throw new Error(`duel request failed: ${result.status} ${(await result.text()).slice(0, 180)}`);
    return result.status === 204 ? null : result.json();
  };

  const query = request.method === "GET" ? request.query || {} : bodyOf(request);
  const game = GAMES.includes(query.game) ? query.game : null;
  if (!game) return json(response, 400, { error: "unknown game" });
  const level = String(query.level || "default").slice(0, 24).replace(/[^a-z0-9-]/gi, "");
  const day = dayNumber();
  const prefix = `duel:${game}:${level}:${day}:`;

  try {
    if (request.method === "GET") {
      const params = new URLSearchParams({
        room_hash: `eq.${roomHash}`,
        id: `like.${prefix}*`,
        select: "id,value,sender",
      });
      const rows = await supabase(`${endpoint}?${params}`);
      const players = {};
      for (const row of rows || []) {
        const profile = row.sender;
        if (!PROFILES.includes(profile)) continue;
        try { players[profile] = JSON.parse(row.value); } catch { /* skip a corrupt row */ }
      }
      return json(response, 200, { game, level, day, seed: seedFor(game, level, day), players });
    }

    if (request.method === "POST") {
      const input = query;
      const profile = PROFILES.includes(input.profile) ? input.profile : null;
      if (!profile) return json(response, 400, { error: "invalid player" });

      const entry = {
        progress: clampInt(input.progress, 0, 100),
        elapsed: clampInt(input.elapsed, 0, 86400),
        done: Boolean(input.done),
        at: Date.now(),
      };

      const id = `${prefix}${profile.toLowerCase()}`;
      const exact = new URLSearchParams({ room_hash: `eq.${roomHash}`, id: `eq.${id}`, select: "id" });
      const existing = await supabase(`${endpoint}?${exact}`);
      const payload = {
        room_hash: roomHash, id, sender: profile,
        value: JSON.stringify(entry), created_at: Date.now(),
      };

      if (existing && existing.length) {
        await supabase(`${endpoint}?${exact}`, {
          method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(payload),
        });
      } else {
        await supabase(endpoint, {
          method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(payload),
        });
      }

      const params = new URLSearchParams({
        room_hash: `eq.${roomHash}`, id: `like.${prefix}*`, select: "id,value,sender",
      });
      const rows = await supabase(`${endpoint}?${params}`);
      const players = {};
      for (const row of rows || []) {
        if (!PROFILES.includes(row.sender)) continue;
        try { players[row.sender] = JSON.parse(row.value); } catch { /* skip */ }
      }
      return json(response, 200, { game, level, day, seed: seedFor(game, level, day), players });
    }

    return json(response, 405, { error: "method not allowed" });
  } catch (error) {
    return json(response, 502, { error: "could not reach the shared board", detail: String(error.message || error).slice(0, 180) });
  }
};
