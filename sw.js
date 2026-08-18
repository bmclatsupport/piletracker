/* Optional service worker for Pile Tracker.
   Only needed if you HOST PileTracker.html on a web address (SharePoint page, intranet, any https URL)
   and want it to open offline after the first visit. Put this file next to PileTracker.html.
   If crews just open the HTML file straight off the device, this file is not needed at all. */

const CACHE = "bm-pile-tracker-v2";
const SHELL = ["./", "./PileTracker.html", "./index.html",
  "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];

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

  // Map tiles are cached by the app itself in IndexedDB — let them pass through.
  if (/arcgisonline|openstreetmap/.test(url.hostname)) return;

  // App shell: serve from cache first so it opens with no signal.
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(req, { ignoreSearch: true });
      if (hit) {
        fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); }).catch(() => { });
        return hit;
      }
      try {
        const r = await fetch(req);
        if (r && r.ok) c.put(req, r.clone());
        return r;
      } catch (err) {
        return (await c.match("./PileTracker.html")) || new Response("Offline", { status: 503 });
      }
    })());
  }
});
