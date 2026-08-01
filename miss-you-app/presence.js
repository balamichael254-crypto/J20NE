/*
 * A quiet "I was here" signal between the two phones - the thing long
 * distance actually lacks: knowing the other person recently looked at the
 * same small world you did. Reuses the existing widget-sync serverless
 * function on its own room, so no new backend work, and fails silently if
 * Supabase isn't configured (same as the rest of the app).
 */
(function () {
  "use strict";

  const API = "../api/widgets?room=moonpie-presence-v1";
  const STORE_KEY = "moonpie-miss-you-v9";
  const HEARTBEAT_MS = 90000;

  function myProfile() {
    try {
      const state = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return state.profile === "Michael" ? "Michael" : "Michelle";
    } catch { return "Michelle"; }
  }
  function otherProfile(p) { return p === "Michael" ? "Michelle" : "Michael"; }

  async function ping(profile) {
    try {
      await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widget: { id: "presence-" + profile, type: "text", value: String(Date.now()), sender: profile }
        }),
      });
    } catch { /* offline or not configured - fine, this is a nicety */ }
  }

  function relativeTime(ms) {
    const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 60) return "moments ago";
    const m = Math.round(s / 60);
    if (m < 60) return m + (m === 1 ? " minute ago" : " minutes ago");
    const h = Math.round(m / 60);
    if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
    const d = Math.round(h / 24);
    return d + (d === 1 ? " day ago" : " days ago");
  }

  async function refresh(profile) {
    const el = document.getElementById("presence-line");
    if (!el) return;
    try {
      const res = await fetch(API, { cache: "no-store" });
      if (!res.ok) return;
      const { widgets } = await res.json();
      const other = otherProfile(profile);
      const row = (widgets || []).find(w => w.id === "presence-" + other);
      if (!row) return;
      const ts = Number(row.value);
      if (!Number.isFinite(ts)) return;
      el.textContent = other + " was here " + relativeTime(ts);
      el.hidden = false;
    } catch { /* quiet failure - the line just stays hidden */ }
  }

  function start() {
    const profile = myProfile();
    ping(profile);
    refresh(profile);
    setInterval(() => ping(myProfile()), HEARTBEAT_MS);
    setInterval(() => refresh(myProfile()), HEARTBEAT_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        ping(myProfile());
        refresh(myProfile());
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
