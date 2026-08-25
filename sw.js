/* Service worker for the crew page.
   Caches the app shell so the page opens with no signal after the first visit.
   Pile data and map tiles are stored by the app itself in IndexedDB — not here.

   The cache name is deliberately different from the coordinator app's. Both pages sit on the
   same origin, so a shared name would have one build serving the other's shell. */
const CACHE = "bm-pile-crew-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest",
  "./icon-180.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(SHELL.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => { })));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // map tiles and the DroneDeploy API are handled by the app; let them pass through
  if (/arcgisonline|openstreetmap|dronedeploy/.test(url.hostname)) return;
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) {
      fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); }).catch(() => { });
      return hit;                                  // instant, works offline
    }
    try {
      const r = await fetch(req);
      if (r && r.ok) c.put(req, r.clone());
      return r;
    } catch (err) {
      return (await c.match("./index.html")) || new Response("Offline", { status: 503 });
    }
  })());
});
