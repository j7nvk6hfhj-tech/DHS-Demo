// DHS Logistics: lets the dashboard install like an app and open even on a weak connection.
// Your own files: always fetched fresh when online (so updates show at once), saved copy used when offline.
// Firebase and library files (fixed versions): saved copy used first.
const CACHE = "dhs-v3";
const SHELL = ["./", "index.html", "app.js", "help.html", "firebase-config.js", "manifest.json", "icons/logo.svg", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then(r => r || caches.match("index.html"))));
    return;
  }
  const lib = url.host === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/") || url.host === "cdnjs.cloudflare.com" || url.host.endsWith("fonts.googleapis.com") || url.host.endsWith("fonts.gstatic.com");
  if (lib) e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })));
  // everything else (Firebase database and login traffic) goes straight to the network
});
