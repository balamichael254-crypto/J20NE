const crypto = require("crypto");

const TABLE = "moonpie_widgets";

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

const normalizeWidget = widget => {
  if (!widget || !widget.id || !["text", "doodle"].includes(widget.type)) return null;
  const normalized = {
    id: String(widget.id).slice(0, 120),
    type: widget.type,
    value: String(widget.value || "").slice(0, widget.type === "doodle" ? 750000 : 500),
    sender: String(widget.sender || "one of us").slice(0, 40),
    createdAt: Number(widget.createdAt || Date.now())
  };
  return normalized.value ? normalized : null;
};

module.exports = async function handler(request, response) {
  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return json(response, 503, { error: "shared widget storage is not connected" });
  }

  const room = String(request.query?.room || "moonpie-2504").slice(0, 80);
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
      const query = new URLSearchParams({
        room_hash: `eq.${roomHash}`,
        select: "id,type,value,sender,created_at",
        order: "created_at.desc",
        limit: "80"
      });
      const rows = await supabaseFetch(`${endpoint}?${query}`);
      const widgets = rows.reverse().map(row => ({
        id: row.id,
        type: row.type,
        value: row.value,
        sender: row.sender,
        createdAt: Number(row.created_at)
      }));
      return json(response, 200, { widgets });
    }

    if (request.method === "POST") {
      const widget = normalizeWidget(readBody(request).widget);
      if (!widget) return json(response, 400, { error: "invalid or empty widget" });
      const row = {
        room_hash: roomHash,
        id: widget.id,
        type: widget.type,
        value: widget.value,
        sender: widget.sender,
        created_at: widget.createdAt
      };
      const query = new URLSearchParams({ on_conflict: "room_hash,id" });
      await supabaseFetch(`${endpoint}?${query}`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(row)
      });
      return json(response, 201, { widget });
    }

    if (request.method === "DELETE") {
      const id = String(readBody(request).id || "").slice(0, 120);
      if (!id) return json(response, 400, { error: "missing widget id" });
      const query = new URLSearchParams({ room_hash: `eq.${roomHash}`, id: `eq.${id}` });
      await supabaseFetch(`${endpoint}?${query}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return json(response, 200, { deleted: id });
    }

    response.setHeader("Allow", "GET, POST, DELETE");
    return json(response, 405, { error: "method not allowed" });
  } catch (error) {
    console.error("widget sync failed", error);
    return json(response, 500, { error: "widget sync failed" });
  }
};
