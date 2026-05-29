/**
 * VolleyPal — minimal service worker.
 *
 * Purpose: make the app installable (Chrome / Edge require a SW) and provide
 * basic offline-friendly caching for the shell + static assets. Live data
 * (/api/*) always goes to the network so scores stay fresh.
 *
 * Strategies:
 *   - Same-origin GET navigation:  network-first, fall back to cached "/"
 *   - Static assets (_next/static, /icon, manifest):  cache-first
 *   - /api/*:                       network-only (no SW intervention)
 */

const CACHE = "volleypal-v6";
const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/favicon-32.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/logo.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // always network

  // Static assets — cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon") ||
    url.pathname.startsWith("/favicon") ||
    url.pathname === "/logo.png" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/apple-touch-icon.png"
  ) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // HTML navigation — network-first, fall back to cached "/" shell when offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match("/"))),
    );
  }
});
