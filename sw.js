const CACHE_NAME = "osrs-tracker-v3";
const APP_SHELL = [
  "index.html",
  "style.css",
  "app.js",
  "quests.js",
  "manifest.json",
  "icons/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only manage the app's own static shell. Third-party API calls (Wise Old Man,
  // the OSRS Wiki, ...) always go straight to the network, untouched by this worker.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Network-first: always prefer a fresh copy of the app shell so updates show up
  // immediately. Only fall back to the cache when there's no connection.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
