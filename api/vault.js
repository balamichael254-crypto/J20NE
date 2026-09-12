const crypto = require("crypto");

const TABLE = "moonpie_vault_items";
const PROFILES = ["Michelle", "Michael"];
const MAX_CT_LEN = 6_500_000; // base64 ciphertext; keeps requests under Vercel's body limit

const json = (response, status, body) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
};

const readBody = request => {
  if (!request.body) return {};
  if (typeof request.body === "string") {
    try { return JSON.parse(request.body); } catch { return {}; }
  }
  return request.body;
};

const validTo = to => to === "shared" || PROFILES.includes(to);
const validFrom = from => PROFILES.includes(from);

// Our Eyes Only sends a real name as `to`; Collective Memories always sends
// the literal string "shared". Nothing else is a valid destination.
const normalizeItem = item => {
  if (!item || !item.id) return null;
  if (!validTo(item.to) || !validFrom(item.from)) return null;
  if (item.to === item.from) return null;          // a "send" can't target yourself
  const ct = String(item.ct || "");
  const iv = String(item.iv || "");
  if (!ct || !iv || ct.length > MAX_CT_LEN) return null;
  return {
    id: String(item.id).slice(0, 120),
    to: item.to,
    from: item.from,
    type: String(item.type || "image/jpeg").slice(0, 40),
    iv, ct,
    createdAt: Number(item.createdAt || Date.now()),
  };
};

const storageFailureCode = error => {
  const message = String(error?.message || error).toLowerCase();
  if (/401|403|invalid api key|invalid jwt|jwt expired/.test(message)) return "supabase_auth_rejected";
  if (/pgrst205|42p01|relation .* does not exist|404/.test(message)) return "supabase_table_missing";
  if (/42501|permission denied|row-level security/.test(message)) return "supabase_permission_denied";
  if (/fetch failed|enotfound|econnrefused|timeout/.test(message)) return "supabase_unreachable";
  if (/400|pgrst100|failed to parse/.test(message)) return "supabase_query_rejected";
  if (/payload too large|413/.test(message)) return "item_too_large";
  return "supabase_request_failed";
};

module.exports = async function handler(request, response) {
  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return json(response, 503, { error: "shared vault storage is not connected" });
  }

  const room = String(request.query?.room || "moonpie-vault-2504").slice(0, 80);
  const roomHash = crypto.createHash("sha256").update(room).digest("hex").slice(0, 24);
  const endpoint = `${supabaseUrl}/rest/v1/${TABLE}`;
  const supabaseFetch = async (url, options = {}) => {
    const result = await fetch(url, {
      ...options,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        ...options.headers
      }
    });
    if (!result.ok) {
      const detail = await result.text();
      throw new Error(`supabase request failed: ${result.status} ${detail.slice(0, 240)}`);
    }
    if (result.status === 204) return null;
    return result.json();
  };

  try {
    if (request.method === "GET") {
      // Whoever you say you are, you only ever get what was addressed to
      // that name (or the shared collection). This is the whole mechanism
      // that makes a "send" one-way: the sender's own `to` never matches
      // their own GET, so a sent item never comes back to the sender.
      const to = String(request.query?.to || "");
      if (!validTo(to)) return json(response, 400, { error: "missing or invalid 'to'" });

      const query = new URLSearchParams({
        room_hash: `eq.${roomHash}`,
        to_profile: `eq.${to}`,
        select: "id,to_profile,from_profile,type,iv,ct,created_at",
        order: "created_at.desc",
        limit: "80"
      });
      const rows = await supabaseFetch(`${endpoint}?${query}`);
      const items = rows.map(row => ({
        id: row.id, to: row.to_profile, from: row.from_profile,
        type: row.type, iv: row.iv, ct: row.ct, createdAt: Number(row.created_at),
      }));
      return json(response, 200, { items });
    }

    if (request.method === "POST") {
      const item = normalizeItem(readBody(request).item);
      if (!item) return json(response, 400, { error: "invalid item" });
      const row = {
        room_hash: roomHash, id: item.id,
        to_profile: item.to, from_profile: item.from,
        type: item.type, iv: item.iv, ct: item.ct,
        created_at: item.createdAt,
      };
      const query = new URLSearchParams({ on_conflict: "room_hash,id" });
      await supabaseFetch(`${endpoint}?${query}`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(row)
      });
      return json(response, 201, { id: item.id });
    }

    if (request.method === "DELETE") {
      const body = readBody(request);
      const id = String(body.id || "").slice(0, 120);
      const to = String(body.to || "");
      if (!id || !validTo(to)) return json(response, 400, { error: "missing id or to" });
      // scoped to `to` as well as `id` - a client can only ever delete an
      // item addressed to the identity it's claiming to be
      const query = new URLSearchParams({ room_hash: `eq.${roomHash}`, id: `eq.${id}`, to_profile: `eq.${to}` });
      await supabaseFetch(`${endpoint}?${query}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return json(response, 200, { deleted: id });
    }

    response.setHeader("Allow", "GET, POST, DELETE");
    return json(response, 405, { error: "method not allowed" });
  } catch (error) {
    console.error("vault sync failed", error);
    return json(response, 503, { error: "vault sync failed", reason: storageFailureCode(error) });
  }
};
