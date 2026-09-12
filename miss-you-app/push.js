/*
 * Real cross-device nudges.
 *
 * The app already had a "test nudge" button, but it only ever called
 * `Notification.requestPermission()` and showed a notification on the SAME
 * device - useful as a demo, not as a way to actually tell the other person
 * anything. This is the missing half: a Web Push subscription per profile,
 * stored server-side (api/push-subscribe.js), and a send path
 * (api/push-send.js) that delivers to the OTHER phone's subscription via
 * VAPID-signed Web Push. sw.js's new `push` handler is what turns a
 * delivered push into something she actually sees.
 *
 * Needs VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT set server-side
 * (see README). Without them, api/push-send.js fails honestly with
 * "push is not configured" rather than pretending to work.
 *
 * When this page is running inside the Android wrapper (mobile/App.js)
 * instead of a browser, Web Push doesn't work at all - Android WebViews
 * don't run Service Worker push - so the wrapper hands this file a native
 * Expo push token via `window.__MOONPIE_NATIVE_PUSH__` instead. subscribe()
 * checks for that first and, if present, sends the native token rather than
 * calling the browser's PushManager. api/push-send.js sends through Expo's
 * push service for a native token and through web-push for a browser one -
 * same endpoint, same UI, the server just branches on subscription shape.
 */
(function () {
  "use strict";

  const STORE_KEY = "moonpie-miss-you-v9";
  const API_SUB = "../api/push-subscribe?room=moonpie-push-2504";
  const API_SEND = "../api/push-send?room=moonpie-push-2504";

  // Public by design - a VAPID public key identifies the sender, it isn't a
  // secret. The private key that actually signs pushes never leaves the
  // server (api/push-send.js reads it from an environment variable).
  const VAPID_PUBLIC_KEY = "BOjC31Fvag8_gVVXHJeRLKCEPl8gNZeu5BCqeEaDheyXdoSIe9p84e21SHiHTB4lJ7Q3ynlwxTQ92TfTnHgzJOk";

  const PROFILES = ["Michelle", "Michael"];
  function myProfile() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return PROFILES.includes(s.profile) ? s.profile : "Michelle";
    } catch { return "Michelle"; }
  }
  const otherProfile = me => (me === "Michelle" ? "Michael" : "Michelle");

  function urlBase64ToUint8Array(base64) {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(b64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  // Waits briefly for the native bridge, since App.js's injectJavaScript on
  // onLoadEnd can land a beat after this script has already run - without a
  // short wait here, a fast "allow nudges" tap could lose the race and fall
  // through to a browser PushManager call that WebViews silently swallow.
  function waitForNativeBridge(timeoutMs) {
    if (window.__MOONPIE_NATIVE_PUSH__) return Promise.resolve(window.__MOONPIE_NATIVE_PUSH__);
    return new Promise(resolve => {
      const done = () => { clearTimeout(timer); resolve(window.__MOONPIE_NATIVE_PUSH__ || null); };
      window.addEventListener("moonpie-native-push", done, { once: true });
      const timer = setTimeout(done, timeoutMs);
    });
  }

  async function subscribe() {
    const native = await waitForNativeBridge(600);
    if (native?.token) {
      try {
        const res = await fetch(API_SUB, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile: myProfile(), subscription: { type: "expo", token: native.token } }),
        });
        return res.ok;
      } catch (err) {
        console.error("native push subscribe failed", err);
        return false;
      }
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const res = await fetch(API_SUB, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: myProfile(), subscription: { type: "web", ...sub.toJSON() } }),
      });
      return res.ok;
    } catch (err) {
      console.error("push subscribe failed", err);
      return false;
    }
  }

  // Fire-and-forget by design: the person tapping "I miss you badly" is
  // already mid-feeling, not waiting on a network round-trip. Failures are
  // swallowed here; nothing about the local comfort response depends on
  // whether the nudge actually reached the other phone.
  function send(title, body) {
    const to = otherProfile(myProfile());
    fetch(API_SEND, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, title, body }),
    }).catch(() => {});
  }

  window.MoonpiePush = { subscribe, send, myProfile, otherProfile };
})();
