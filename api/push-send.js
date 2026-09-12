const crypto = require("crypto");
const webpush = require("web-push");

const TABLE = "moonpie_push_subs";
const PROFILES = ["Michelle", "Michael"];
const MAX_LEN = 160;

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

// Sends through whichever service the stored subscription actually needs -
// Expo's push relay for a native token from the Android wrapper, VAPID-signed
// Web Push for a browser subscription. Same caller, same UI, the branch is
// entirely about how the message reaches the phone.
async function deliver(subscription, title, body) {
  if (subscription.type === "expo") {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to: subscription.token, title, body, sound: "default", priority: "high" }),
    });
    const data = await res.json().catch(() => ({}));
    const ticket = data?.data;
    if (!res.ok || ticket?.status === "error") {
      const err = new Error(ticket?.message || "expo push failed");
      // DeviceNotRegistered is Expo's equivalent of web-push's 404/410 -
      // the token is dead and the subscription should be dropped
      err.expired = ticket?.details?.error === "DeviceNotRegistered";
      throw err;
    }
    return;
  }

  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) {
    const err = new Error("push is not configured");
    err.notConfigured = true;
    throw err;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:moonpie@example.com", vapidPublic, vapidPrivate);
  try {
    await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
  } catch (err) {
    err.expired = err.statusCode === 404 || err.statusCode === 410;
    throw err;
  }
}

module.exports = async function handler(request, response) {
  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return json(response, 503, { error: "shared storage is not connected" });
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return json(response, 405, { error: "method not allowed" });
  }

  const { to, title, body } = readBody(request);
  if (!PROFILES.includes(to) || !title) return json(response, 400, { error: "missing 'to' or 'title'" });

  const room = String(request.query?.room || "moonpie-push-2504").slice(0, 80);
  const roomHash = crypto.createHash("sha256").update(room).digest("hex").slice(0, 24);
  const endpoint = `${supabaseUrl}/rest/v1/${TABLE}`;
  const supabaseFetch = async (url, options = {}) => {
    const result = await fetch(url, {
      ...options,
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", ...options.headers },
    });
    if (!result.ok) throw new Error(`supabase request failed: ${result.status} ${(await result.text()).slice(0, 200)}`);
    return result.status === 204 ? null : result.json();
  };

  try {
    const query = new URLSearchParams({ room_hash: `eq.${roomHash}`, profile: `eq.${to}`, select: "subscription", limit: "1" });
    const rows = await supabaseFetch(`${endpoint}?${query}`);
    if (!rows?.length) return json(response, 404, { error: "that person hasn't turned nudges on yet" });

    const subscription = JSON.parse(rows[0].subscription);
    const cleanTitle = String(title).slice(0, MAX_LEN);
    const cleanBody = String(body || "").slice(0, MAX_LEN);

    try {
      await deliver(subscription, cleanTitle, cleanBody);
    } catch (err) {
      if (err.expired) {
        // the subscription expired or was revoked - clean it up so future
        // sends fail fast with the honest "hasn't turned nudges on" message
        const del = new URLSearchParams({ room_hash: `eq.${roomHash}`, profile: `eq.${to}` });
        await supabaseFetch(`${endpoint}?${del}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {});
        return json(response, 404, { error: "that person's notifications expired - they'll need to turn nudges on again" });
      }
      if (err.notConfigured) return json(response, 503, { error: "push is not configured" });
      throw err;
    }
    return json(response, 200, { sent: true });
  } catch (error) {
    console.error("push send failed", error);
    return json(response, 503, { error: "couldn't send that nudge" });
  }
};
