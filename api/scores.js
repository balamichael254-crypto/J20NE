const crypto = require("crypto");

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

const storageFailureCode = error => {
  const message = String(error?.message || error).toLowerCase();
  if (/401|403|invalid api key|invalid jwt|jwt expired/.test(message)) return "supabase_auth_rejected";
  if (/pgrst205|42p01|relation .* does not exist|404/.test(message)) return "supabase_table_missing";
  if (/42501|permission denied|row-level security/.test(message)) return "supabase_permission_denied";
  if (/fetch failed|enotfound|econnrefused|timeout/.test(message)) return "supabase_unreachable";
  if (/400|pgrst100|failed to parse/.test(message)) return "supabase_query_rejected";
  return "supabase_request_failed";
};

module.exports = async function handler(request, response) {
  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return json(response, 503, { error: "scoreboard storage is not connected" });

  const room = String(request.query?.room || "moonpie-score-v1").slice(0, 80);
  const roomHash = crypto.createHash("sha256").update(room).digest("hex").slice(0, 24);
  const endpoint = `${supabaseUrl}/rest/v1/moonpie_widgets`;
  const requestSupabase = async (url, options = {}) => {
    const result = await fetch(url, {
      ...options,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        ...options.headers
      }
    });
    if (!result.ok) throw new Error(`scoreboard request failed: ${result.status} ${(await result.text()).slice(0, 180)}`);
    return result.status === 204 ? null : result.json();
  };

  try {
    const baseQuery = new URLSearchParams({ room_hash: `eq.${roomHash}`, select: "id,value,sender,created_at", order: "created_at.desc" });
    if (request.method === "GET") {
      const rows = await requestSupabase(`${endpoint}?${baseQuery}`);
      const scores = rows.map(row => {
        try { return { ...JSON.parse(row.value), profile: row.sender, playedAt: Number(row.created_at) }; }
        catch { return null; }
      }).filter(Boolean);
      return json(response, 200, { scores });
    }

    if (request.method === "POST") {
      const input = bodyOf(request);
      const profile = ["Michelle", "Michael"].includes(input.profile) ? input.profile : null;
      const score = Math.max(0, Math.min(9999, Number(input.score) || 0));
      if (!profile) return json(response, 400, { error: "invalid player" });

      const id = `bubble-score:${profile.toLowerCase()}`;
      const exactQuery = new URLSearchParams({ room_hash: `eq.${roomHash}`, id: `eq.${id}`, select: "value" });
      const existingRows = await requestSupabase(`${endpoint}?${exactQuery}`);
      let existing = {};
      try { existing = JSON.parse(existingRows[0]?.value || "{}"); } catch { existing = {}; }
      const best = score >= Number(existing.score || 0) ? {
        score,
        accuracy: Math.max(0, Math.min(100, Number(input.accuracy) || 0)),
        maxCombo: Math.max(0, Math.min(999, Number(input.maxCombo) || 0)),
        playedAt: Date.now()
      } : existing;

      const row = { room_hash: roomHash, id, type: "text", value: JSON.stringify(best), sender: profile, created_at: Number(best.playedAt || Date.now()) };
      const upsertQuery = new URLSearchParams({ on_conflict: "room_hash,id" });
      await requestSupabase(`${endpoint}?${upsertQuery}`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(row)
      });
      return json(response, 201, { score: { ...best, profile } });
    }

    response.setHeader("Allow", "GET, POST");
    return json(response, 405, { error: "method not allowed" });
  } catch (error) {
    console.error("bubble scoreboard failed", error);
    return json(response, 503, { error: "scoreboard unavailable", reason: storageFailureCode(error) });
  }
};
