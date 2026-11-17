const CACHE = "quran-handsfree-v4";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/quran/content.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith("quran-handsfree-") && key !== CACHE)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Pages: network first, so a new deploy (new hashed JS/CSS names) is picked up at once; the cached copy is only
// the offline fallback. Assets: cache first, but never store an HTML answer for a non-page request (the host answers
// unknown paths with index.html and status 200, which used to poison the cache after a deploy).
async function pageRequest(request) {
  try {
    const response = await fetch(request);
    if (response.ok && new URL(request.url).origin === self.location.origin) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true })
      || await caches.match("/index.html")
      || await caches.match("/");
    if (cached) return cached;
    throw error;
  }
}

async function assetRequest(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  const isHtml = (response.headers.get("content-type") || "").includes("text/html");
  if (response.ok && !isHtml && new URL(request.url).origin === self.location.origin) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const { pathname } = new URL(event.request.url);
  // Self-hosted Tilawa 1.0 files (large model, wasm) are never stored in the service worker cache.
  if (pathname.includes("/tilawa-v1/")) return;
  if (pathname.startsWith("/@") || pathname.startsWith("/src/") ||
      pathname.startsWith("/node_modules/") || pathname.includes("/.vite/")) return;
  event.respondWith(event.request.mode === "navigate" ? pageRequest(event.request) : assetRequest(event.request));
});
