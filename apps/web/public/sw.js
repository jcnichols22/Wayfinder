const CACHE_PREFIX = "wayfinder-";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => !key.startsWith(CACHE_PREFIX)).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(event.request, "wayfinder-api"));
  } else if (
    event.request.destination === "script" ||
    event.request.destination === "style" ||
    event.request.destination === "document"
  ) {
    event.respondWith(networkFirst(event.request, "wayfinder-static"));
  } else if (event.request.destination === "image") {
    event.respondWith(cacheFirst(event.request, "wayfinder-images"));
  } else if (/\.(?:woff2|woff|ttf|otf)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(event.request, "wayfinder-fonts"));
  }
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.status === 200) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("Network error and no cache");
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.status === 200) cache.put(request, response.clone()).catch(() => {});
  return response;
}
