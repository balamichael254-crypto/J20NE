const crypto = require("crypto");

const json = (response, status, body) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
};

module.exports = async function handler(request, response) {
  const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) {
    return json(response, 503, { error: "shared widget storage is not connected" });
  }

  const room = String(request.query?.room || "moonpie-2504").slice(0, 80);
  const roomHash = crypto.createHash("sha256").update(room).digest("hex").slice(0, 24);
  const key = `moonpie:widgets:${roomHash}`;
  const command = async args => {
    const result = await fetch(redisUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(args)
    });
    if (!result.ok) throw new Error(`redis command failed: ${result.status}`);
    return result.json();
  };

  try {
    if (request.method === "GET") {
      const data = await command(["HVALS", key]);
      const widgets = (Array.isArray(data.result) ? data.result : []).map(value => {
        try { return JSON.parse(value); } catch { return null; }
      }).filter(Boolean).sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0)).slice(-80);
      return json(response, 200, { widgets });
    }

    if (request.method === "POST") {
      const widget = request.body?.widget;
      if (!widget || !widget.id || !["text", "doodle"].includes(widget.type)) return json(response, 400, { error: "invalid widget" });
      const normalized = {
        id: String(widget.id).slice(0, 120),
        type: widget.type,
        value: String(widget.value || "").slice(0, widget.type === "doodle" ? 750000 : 500),
        sender: String(widget.sender || "one of us").slice(0, 40),
        createdAt: Number(widget.createdAt || Date.now())
      };
      if (!normalized.value) return json(response, 400, { error: "empty widget" });
      await command(["HSET", key, normalized.id, JSON.stringify(normalized)]);
      return json(response, 201, { widget: normalized });
    }

    if (request.method === "DELETE") {
      const id = String(request.body?.id || "").slice(0, 120);
      if (!id) return json(response, 400, { error: "missing widget id" });
      await command(["HDEL", key, id]);
      return json(response, 200, { deleted: id });
    }

    response.setHeader("Allow", "GET, POST, DELETE");
    return json(response, 405, { error: "method not allowed" });
  } catch (error) {
    console.error("widget sync failed", error);
    return json(response, 500, { error: "widget sync failed" });
  }
};
