const crypto = require("crypto");

const TABLE = "moonpie_push_subs";
const PROFILES = ["Michelle", "Michael"];

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

module.exports = async function handler(request, response) {
  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return json(response, 503, { error: "shared storage is not connected" });
  }
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return json(response, 405, { error: "method not allowed" });
  }

  const { profile, subscription } = readBody(request);
  // two valid shapes: a browser's PushSubscription ({type:"web", endpoint,
  // keys}) or a native Expo push token ({type:"expo", token}) handed over by
  // the Android wrapper's bridge (see mobile/App.js and push.js)
  const validWeb = subscription?.type === "web" && subscription.endpoint;
  const validExpo = subscription?.type === "expo" && subscription.token;
  if (!PROFILES.includes(profile) || !(validWeb || validExpo)) {
    return json(response, 400, { error: "missing profile or subscription" });
  }

  const room = String(request.query?.room || "moonpie-push-2504").slice(0, 80);
  const roomHash = crypto.createHash("sha256").update(room).digest("hex").slice(0, 24);
  const endpoint = `${supabaseUrl}/rest/v1/${TABLE}`;

  try {
    const res = await fetch(`${endpoint}?on_conflict=room_hash,profile`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        room_hash: roomHash, profile,
        subscription: JSON.stringify(subscription),
        updated_at: Date.now(),
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return json(response, 201, { ok: true });
  } catch (error) {
    console.error("push subscribe failed", error);
    return json(response, 503, { error: "could not save subscription" });
  }
};
