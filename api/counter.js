const crypto = require("crypto");

const json = (response, status, body) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
};

const readBody = request => {
  if (!request.body) return {};
  if (typeof request.body === "string") { try { return JSON.parse(request.body); } catch { return {}; } }
  return request.body;
};

// Only ever these two counters exist right now - a fixed allowlist so this
// endpoint can't become a free-form key/value store for anything a client
// decides to send.
const ALLOWED_KEYS = ["thinking-of-you", "distance-signal"];

module.exports = async function handler(request, response) {
  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return json(response, 503, { error: "shared storage is not connected" });

  const room = String(request.query?.room || "moonpie-counters-2504").slice(0, 80);
  const roomHash = crypto.createHash("sha256").update(room).digest("hex").slice(0, 24);
  const supabaseFetch = async (url, options = {}) => {
    const result = await fetch(url, {
      ...options,
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", ...options.headers },
    });
    if (!result.ok) throw new Error(`supabase request failed: ${result.status} ${(await result.text()).slice(0, 200)}`);
    return result.status === 204 ? null : result.json();
  };

  try {
    if (request.method === "GET") {
      const key = String(request.query?.key || "");
      if (!ALLOWED_KEYS.includes(key)) return json(response, 400, { error: "unknown counter" });
      const q = new URLSearchParams({ room_hash: `eq.${roomHash}`, key: `eq.${key}`, select: "value", limit: "1" });
      const rows = await supabaseFetch(`${supabaseUrl}/rest/v1/moonpie_counters?${q}`);
      return json(response, 200, { key, value: Number(rows?.[0]?.value || 0) });
    }

    if (request.method === "POST") {
      const { key } = readBody(request);
      if (!ALLOWED_KEYS.includes(key)) return json(response, 400, { error: "unknown counter" });
      // always exactly 1 per request, deliberately - one tap is one increment,
      // there's no client-supplied amount to spoof a bulk bump with
      const rpc = await supabaseFetch(`${supabaseUrl}/rest/v1/rpc/moonpie_increment_counter`, {
        method: "POST",
        body: JSON.stringify({ p_room_hash: roomHash, p_key: key, p_by: 1 }),
      });
      return json(response, 200, { key, value: Number(rpc) });
    }

    response.setHeader("Allow", "GET, POST");
    return json(response, 405, { error: "method not allowed" });
  } catch (error) {
    console.error("counter failed", error);
    return json(response, 503, { error: "counter unavailable" });
  }
};
