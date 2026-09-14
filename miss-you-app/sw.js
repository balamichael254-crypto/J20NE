const CACHE_NAME = "moonpie-miss-you-v123";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=120",
  "./poo.css?v=6",
  "./content.js?v=48",
  "./movies.js?v=1",
  "./games/duel.js?v=2",
  "./games/sudoku.js?v=3",
  "./games/memory.js?v=3",
  "./games/jigsaw.js?v=3",
  "./games/sudoku.css?v=1",
  "./games/memory.css?v=1",
  "./games/jigsaw.css?v=2",
  "./push.js?v=2",
  "./app.js?v=78",
  "./bloom.js?v=5",
  "./galaxy.js?v=1",
  "./vault.js?v=3",
  "./poo.js?v=17",
  "./presence.js?v=2",
  "./manifest.webmanifest",
  "./icon.svg",
  "./assets/fonts/lora-400.woff2",
  "./assets/fonts/cormorant-600.woff2",
  "./assets/fonts/cormorant-italic-400.woff2",
  "./assets/fonts/dancing-600.woff2",
  "./assets/fonts/baloo2-var.woff2",
  "./assets/fonts/quicksand-var.woff2",
  "./assets/fonts/caveat.woff2",
  "./assets/fonts/indie-flower.woff2",
  "./assets/fonts/gloria-hallelujah.woff2",
  "./assets/fonts/shadows-into-light.woff2"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin === self.location.origin && requestUrl.pathname.includes("/assets/worlds/")) {
    event.respondWith(caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    }));
    return;
  }
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
      return response;
    }).catch(() => caches.match("./index.html")));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).catch(() => caches.match("./index.html")))
  );
});

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || "Moonpie";
  const options = {
    body: data.body || "",
    icon: "./icon.svg",
    badge: "./icon.svg",
    tag: "moonpie-nudge",
    renotify: true,
    data: { url: "./?open=care" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data?.url || "./";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      const existing = clients.find(client => client.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
