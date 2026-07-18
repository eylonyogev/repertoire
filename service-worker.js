const SHELL_CACHE = "exlib-shell-v1";
const GIF_CACHE = "exlib-gifs-v1";
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./exercises.csv",
  "./manifest.json",
  "./icon.svg",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL_CACHE && k !== GIF_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  const isGif = url.pathname.endsWith(".gif");
  const cacheName = isGif ? GIF_CACHE : SHELL_CACHE;

  event.respondWith(
    caches.open(cacheName).then(async cache => {
      const cached = await cache.match(event.request);
      // GIFs never change once published — serve straight from cache when we have it.
      if (cached && isGif) return cached;
      try {
        const fresh = await fetch(event.request);
        if (fresh.ok) cache.put(event.request, fresh.clone());
        return fresh;
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    })
  );
});
