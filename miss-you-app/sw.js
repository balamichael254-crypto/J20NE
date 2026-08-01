const CACHE_NAME = "moonpie-miss-you-v46";
const ASSETS = [
  "./",
  "./index.html",
  "./?v=43",
  "./styles.css?v=43",
  "./content.js?v=43",
  "./app.js?v=43",
  "./poo.css?v=3",
  "./poo.js?v=6",
  "./presence.js?v=2",
  "./manifest.webmanifest",
  "./icon.svg",
  "./assets/fonts/lora-400.woff2",
  "./assets/fonts/lora-600.woff2",
  "./assets/fonts/cormorant-600.woff2",
  "./assets/fonts/cormorant-italic-400.woff2",
  "./assets/fonts/dancing-600.woff2",
  "./assets/fonts/italiana-400.woff2"
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
