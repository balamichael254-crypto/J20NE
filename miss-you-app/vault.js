/*
 * Our Eyes Only + Collective Memories - one passphrase-locked private area,
 * two different sharing shapes behind it.
 *
 * BE HONEST ABOUT WHAT THIS DOES AND DOES NOT DO.
 *
 * What it genuinely does:
 *   - Photos are encrypted IN THE BROWSER with AES-GCM 256 before they ever
 *     leave the device. The key is derived from a shared passphrase via
 *     PBKDF2-SHA256 at 600k iterations. The server (api/vault.js, Supabase)
 *     only ever stores ciphertext - it cannot read a single photo.
 *   - "Our Eyes Only" is a ONE-WAY send, not a shared gallery: an item is
 *     addressed to a name (`to`), and a GET for your own name never returns
 *     items you sent to the other person - you don't get to see your own
 *     send again, and they never see what's in your outbox, only what
 *     arrives. That's enforced by the server query filtering on `to`.
 *   - "Collective Memories" is the opposite shape: both of you add to one
 *     shared collection (`to: "shared"`) and both see everything in it.
 *   - The PIN is a convenience lock for THIS device, wrapping the derived
 *     key in local storage. It is not what protects the photos - the
 *     passphrase is, and it's the same passphrase for both features.
 *   - Decrypted images are drawn to a <canvas>, held-to-view, never an
 *     <img>, never a blob: URL. Blanks itself on app-switch and reacts to
 *     the PrintScreen key.
 *
 * The honest limit, unchanged from before: both of you hold the SAME
 * derived key. The one-way and shared-vs-private behaviour above is
 * enforced by what the app asks the server for, not by separate encryption
 * keys per person - anyone who went looking at raw requests instead of
 * using the app could see past it. For two people who trust each other and
 * just want the right shape by default, that's a reasonable trade; it is
 * not the same guarantee real per-recipient encryption would give.
 *
 * And still true regardless of any of this: no website can block a
 * screenshot, on any phone. See the PrintScreen reaction below for what
 * "reacting instantly" instead of "preventing" actually looks like.
 */
(function () {
  "use strict";

  const STORE_KEY = "moonpie-miss-you-v9";     // same key app.js uses for state.profile
  const WRAP_KEY = "moonpie-vault-wrapped";
  const SALT_KEY = "moonpie-vault-salt";
  const FAIL_KEY = "moonpie-vault-fails";
  const API = "../api/vault?room=moonpie-vault-2504";

  const PBKDF2_ROUNDS = 600000;
  const MAX_FAILS = 8;
  const IDLE_LOCK_MS = 90000;
  const MAX_DIMENSION = 1600;                   // photos are resized to this before encrypting
  const JPEG_QUALITY = 0.82;

  const PROFILES = ["Michelle", "Michael"];
  const NICK = { Michelle: "Moonpie", Michael: "Sunstone" };

  const enc = new TextEncoder();
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  function myProfile() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return PROFILES.includes(s.profile) ? s.profile : "Michelle";
    } catch { return "Michelle"; }
  }
  const otherProfile = me => (me === "Michelle" ? "Michael" : "Michelle");

  /* ------------------------------------------------------------- crypto */

  async function deriveKey(passphrase, salt) {
    const base = await crypto.subtle.importKey(
      "raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: PBKDF2_ROUNDS, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  }

  async function encryptBlob(key, bytes) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
    return { iv: b64(iv), ct: b64(ct) };
  }
  async function decryptBlob(key, ivB64, ctB64) {
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(ivB64) }, key, unb64(ctB64));
  }

  async function wrapWithPin(key, pin, salt) {
    const raw = await crypto.subtle.exportKey("raw", key);
    const pinKey = await deriveKey("pin:" + pin, salt);
    const { iv, ct } = await encryptBlob(pinKey, raw);
    return JSON.stringify({ iv, ct });
  }
  async function unwrapWithPin(wrapped, pin, salt) {
    const { iv, ct } = JSON.parse(wrapped);
    const pinKey = await deriveKey("pin:" + pin, salt);
    const raw = await decryptBlob(pinKey, iv, ct);   // throws on a wrong PIN
    return crypto.subtle.importKey("raw", raw, "AES-GCM", true, ["encrypt", "decrypt"]);
  }

  function getSalt() {
    let s = localStorage.getItem(SALT_KEY);
    if (!s) { s = b64(crypto.getRandomValues(new Uint8Array(16))); localStorage.setItem(SALT_KEY, s); }
    return unb64(s);
  }

  // Downscale + re-encode before encrypting - a full-resolution phone photo
  // (8-15MB) would blow past what a serverless function accepts as a request
  // body once base64-encoded. A 1600px-long-edge JPEG covers this screen's
  // hold-to-view viewer with room to spare, at a fraction of the size.
  async function prepareImage(file) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    cv.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise(r => cv.toBlob(r, "image/jpeg", JPEG_QUALITY));
    return { bytes: await blob.arrayBuffer(), type: "image/jpeg" };
  }

  /* --------------------------------------------------------------- fetch */

  async function api(method, body) {
    const res = await fetch(API + (method === "GET" ? "&to=" + encodeURIComponent(body.to) : ""), {
      method,
      headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.error || `${method} failed (${res.status})`);
    }
    return res.json();
  }

  /* ---------------------------------------------------------------- ui */

  let KEY = null, idleTimer = null, viewing = null;
  const $ = sel => document.querySelector(sel);
  const screen = () => $("#screen-vault");

  function setPhase(name) {
    const root = screen();
    if (!root) return;
    root.querySelectorAll("[data-phase]").forEach(el =>
      el.classList.toggle("hidden", el.dataset.phase !== name));
  }

  function lock(reason) {
    KEY = null;
    clearTimeout(idleTimer);
    closeViewer();
    setPhase(localStorage.getItem(WRAP_KEY) ? "locked" : "setup");
    const n = $("#vault-lock-note");
    if (n && reason) n.textContent = reason;
  }
  function touchIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => lock("Locked itself after a quiet minute."), IDLE_LOCK_MS);
  }
  function fails() { return parseInt(localStorage.getItem(FAIL_KEY) || "0", 10) || 0; }
  function bumpFails(n) { localStorage.setItem(FAIL_KEY, String(n)); }

  function toast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3200);
  }

  /* ------------------------------------------------------------- viewer */

  async function openViewer(item, onDeleted) {
    const wrap = $("#vault-viewer");
    const cv = $("#vault-canvas");
    if (!wrap || !cv || !KEY) return;

    let bmp;
    try {
      const buf = await decryptBlob(KEY, item.iv, item.ct);
      bmp = await createImageBitmap(new Blob([buf], { type: item.type || "image/jpeg" }));
    } catch {
      toast("That one wouldn't open.");
      return;
    }

    viewing = { bmp, item, held: false, onDeleted };
    wrap.hidden = false;
    setTimeout(() => wrap.classList.add("show"), 16);
    fitViewer();
    paint();
    touchIdle();
  }

  function fitViewer() {
    const cv = $("#vault-canvas");
    if (!cv || !viewing) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(cv.clientWidth * dpr);
    cv.height = Math.round(cv.clientHeight * dpr);
  }

  function paint() {
    const cv = $("#vault-canvas");
    if (!cv || !viewing) return;
    const ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);

    if (!viewing.held) {
      ctx.fillStyle = "rgba(111,72,176,.14)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(111,72,176,.72)";
      ctx.font = `600 ${Math.round(W * 0.042)}px Quicksand, system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("hold to look", W / 2, H / 2);
      return;
    }
    const b = viewing.bmp;
    const scale = Math.min(W / b.width, H / b.height);
    const dw = b.width * scale, dh = b.height * scale;
    ctx.drawImage(b, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  function closeViewer() {
    const wrap = $("#vault-viewer");
    if (!wrap) return;
    const cv = $("#vault-canvas");
    if (cv) cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
    if (viewing?.bmp?.close) viewing.bmp.close();
    viewing = null;
    wrap.classList.remove("show");
    setTimeout(() => { wrap.hidden = true; }, 240);
  }

  /* ------------------------------------------------------------- inbox */

  async function renderInbox() {
    const grid = $("#vault-inbox-grid");
    if (!grid) return;
    const me = myProfile();
    grid.innerHTML = `<p class="vault-loading">checking…</p>`;
    try {
      const { items } = await api("GET", { to: me });
      if (!items.length) {
        grid.innerHTML = `<p class="vault-empty">Nothing waiting yet. When ${NICK[otherProfile(me)]} sends something, it shows up here - and only here.</p>`;
        return;
      }
      grid.innerHTML = items.map(it => `
        <div class="vault-cell">
          <button class="vault-open" data-id="${it.id}" type="button">
            <span class="vault-lockmark" aria-hidden="true">🔒</span>
            <small>${new Date(it.createdAt).toLocaleDateString()}</small>
            <b>from ${NICK[it.from] || it.from}</b>
          </button>
          <button class="vault-del" data-del="${it.id}" data-to="${it.to}" type="button" aria-label="delete">×</button>
        </div>`).join("");
      grid.dataset.items = JSON.stringify(items);
    } catch (e) {
      grid.innerHTML = `<p class="vault-empty">Couldn't reach the shared vault. ${e.message}</p>`;
    }
  }

  /* ---------------------------------------------------------- memories */

  async function renderMemories() {
    const grid = $("#memories-grid");
    if (!grid) return;
    grid.innerHTML = `<p class="vault-loading">checking…</p>`;
    try {
      const { items } = await api("GET", { to: "shared" });
      if (!items.length) {
        grid.innerHTML = `<p class="vault-empty">Empty so far. Add the first thing worth keeping.</p>`;
        return;
      }
      grid.innerHTML = items.map(it => `
        <div class="vault-cell">
          <button class="vault-open memory-open" data-id="${it.id}" type="button">
            <span class="vault-lockmark" aria-hidden="true">🪷</span>
            <small>${new Date(it.createdAt).toLocaleDateString()}</small>
            <b>${NICK[it.from] || it.from} added this</b>
          </button>
          <button class="vault-del" data-del="${it.id}" data-to="shared" type="button" aria-label="delete">×</button>
        </div>`).join("");
      grid.dataset.items = JSON.stringify(items);
    } catch (e) {
      grid.innerHTML = `<p class="vault-empty">Couldn't reach the shared vault. ${e.message}</p>`;
    }
  }

  /* ------------------------------------------------------------- wiring */

  function init() {
    const root = screen();
    if (!root) return;

    setPhase(localStorage.getItem(WRAP_KEY) ? "locked" : "setup");

    $("#vault-setup-form")?.addEventListener("submit", async e => {
      e.preventDefault();
      const pass = $("#vault-pass").value.trim();
      const pin = $("#vault-new-pin").value.trim();
      if (pass.length < 8) return toast("Make the passphrase at least 8 characters.");
      if (!/^\d{4,8}$/.test(pin)) return toast("PIN should be 4 to 8 digits.");
      const salt = getSalt();
      KEY = await deriveKey(pass, salt);
      localStorage.setItem(WRAP_KEY, await wrapWithPin(KEY, pin, salt));
      bumpFails(0);
      onUnlocked();
      toast("Locked and ready. Same passphrase on both phones.");
    });

    /* Press and hold, rather than a tap.

       There is already a combination padlock elsewhere in the app, so this
       one had to be a different object. A hold is also the right gesture for
       what is behind it: deliberate, a second of intent, not something your
       thumb can do by accident in a pocket. The PIN is still what actually
       unlocks it; the hold is the ritual around it. */
    (function setupHoldLock() {
      const button = $("#vault-holdlock");
      const form = $("#vault-unlock-form");
      if (!button || !form) return;
      const HOLD_MS = 1000;
      let raf = null, start = 0;

      const setProgress = v => button.querySelector(".holdlock-ring")?.style.setProperty("--hold", String(v));

      const stop = () => {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        button.classList.remove("is-holding");
        setProgress(0);
      };

      const tick = now => {
        const progress = Math.min(1, (now - start) / HOLD_MS);
        setProgress(progress);
        if (progress >= 1) {
          stop();
          button.classList.add("is-open");
          setTimeout(() => button.classList.remove("is-open"), 600);
          form.requestSubmit();
          return;
        }
        raf = requestAnimationFrame(tick);
      };

      const begin = event => {
        event.preventDefault();
        if (raf) return;
        if (!$("#vault-pin").value.trim()) { toast("PIN first, then hold."); return; }
        button.classList.add("is-holding");
        start = performance.now();
        raf = requestAnimationFrame(tick);
      };

      button.addEventListener("pointerdown", begin);
      button.addEventListener("pointerup", stop);
      button.addEventListener("pointercancel", stop);
      button.addEventListener("pointerleave", stop);
      // keyboard: space/enter holds for as long as the key is held
      button.addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") begin(e); });
      button.addEventListener("keyup", stop);
    })();

    $("#vault-unlock-form")?.addEventListener("submit", async e => {
      e.preventDefault();
      const pin = $("#vault-pin").value.trim();
      const n = fails();
      if (n >= MAX_FAILS) return toast("Too many tries. Reset it from setup.");
      if (n > 2) await new Promise(r => setTimeout(r, (n - 2) * 700));
      try {
        KEY = await unwrapWithPin(localStorage.getItem(WRAP_KEY), pin, getSalt());
        bumpFails(0);
        $("#vault-pin").value = "";
        onUnlocked();
      } catch {
        bumpFails(n + 1);
        toast(`Not that one. ${MAX_FAILS - n - 1} tries left.`);
      }
    });

    function onUnlocked() {
      const me = myProfile(), other = otherProfile(me);
      const sendBtn = $("#vault-send-label");
      if (sendBtn) sendBtn.textContent = `send to ${NICK[other]}`;
      setPhase("open");
      renderInbox();
      renderMemories();
      touchIdle();
    }

    // --- send a private photo to the other person ---------------------------
    $("#vault-send-file")?.addEventListener("change", async e => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !KEY) return;
      if (!file.type.startsWith("image/")) return toast("Photos only, for now.");
      const me = myProfile(), other = otherProfile(me);
      try {
        const { bytes, type } = await prepareImage(file);
        const { iv, ct } = await encryptBlob(KEY, bytes);
        await api("POST", { item: { id: crypto.randomUUID(), to: other, from: me, type, iv, ct, createdAt: Date.now() } });
        toast(`Sent to ${NICK[other]}. You won't see this one again - that's the point.`);
      } catch (err) {
        toast("Couldn't send that. " + err.message);
      }
      touchIdle();
    });

    // --- add to the shared collection ---------------------------------------
    $("#memories-file")?.addEventListener("change", async e => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !KEY) return;
      if (!file.type.startsWith("image/")) return toast("Photos only, for now.");
      const me = myProfile();
      try {
        const { bytes, type } = await prepareImage(file);
        const { iv, ct } = await encryptBlob(KEY, bytes);
        await api("POST", { item: { id: crypto.randomUUID(), to: "shared", from: me, type, iv, ct, createdAt: Date.now() } });
        toast("Added to our memories.");
        renderMemories();
      } catch (err) {
        toast("Couldn't add that. " + err.message);
      }
      touchIdle();
    });

    // --- open / delete, for both grids --------------------------------------
    async function handleGridClick(e, itemsAttrEl, onAfterDelete) {
      const del = e.target.closest("[data-del]");
      if (del) {
        try {
          await api("DELETE", { id: del.dataset.del, to: del.dataset.to });
          onAfterDelete();
        } catch (err) { toast("Couldn't delete that. " + err.message); }
        return;
      }
      const open = e.target.closest("[data-id]");
      if (!open) return;
      const items = JSON.parse(itemsAttrEl.dataset.items || "[]");
      const item = items.find(i => i.id === open.dataset.id);
      if (item) openViewer(item);
    }
    $("#vault-inbox-grid")?.addEventListener("click", e =>
      handleGridClick(e, $("#vault-inbox-grid"), renderInbox));
    $("#memories-grid")?.addEventListener("click", e =>
      handleGridClick(e, $("#memories-grid"), renderMemories));

    $("#vault-lock-now")?.addEventListener("click", () => lock("Locked."));
    $("#vault-close-viewer")?.addEventListener("click", closeViewer);

    const cv = $("#vault-canvas");
    if (cv) {
      const down = e => { if (viewing) { viewing.held = true; paint(); e.preventDefault(); } };
      const up = () => { if (viewing) { viewing.held = false; paint(); } };
      cv.addEventListener("pointerdown", down, { passive: false });
      addEventListener("pointerup", up);
      addEventListener("pointercancel", up);
      addEventListener("resize", () => { fitViewer(); paint(); });
    }

    const panic = () => { if (viewing) { viewing.held = false; paint(); } };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") { panic(); lock("Locked when you switched away."); }
    });
    addEventListener("blur", panic);
    addEventListener("pagehide", () => lock());
    addEventListener("keyup", e => {
      if (e.key === "PrintScreen" && viewing) { panic(); lock("Locked - that key doesn't work here."); }
    });

    root.addEventListener("contextmenu", e => e.preventDefault());
    root.addEventListener("dragstart", e => e.preventDefault());
    ["pointerdown", "keydown"].forEach(ev =>
      root.addEventListener(ev, () => { if (KEY) touchIdle(); }));

    window.Vault = { lock, isOpen: () => !!KEY };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
