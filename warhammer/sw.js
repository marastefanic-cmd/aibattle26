// Service worker for the installed (home screen) copy.
// Network first for everything of our own, so an update shows up the next time
// the app opens; the cache is only the offline fallback for a basement game table.
const VERSION = '2026-10-16.2';
const CACHE = 'waaagh-codex';
const CORE = ['./', 'index.html', 'data.js', 'manifest.webmanifest', 'icon-192.png', 'icon-180.png', 'icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'no-cache' })))).catch(() => {}));
});
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const own = url.origin === self.location.origin;
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!own && !font) return;
  if (own && url.pathname.endsWith('version.json')) return; // always straight to the network
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      // no-cache revalidates with the server, so GitHub Pages' 10-minute cache can't serve old data
      const res = await fetch(own ? new Request(req, { cache: 'no-cache' }) : req);
      if (res && (res.ok || res.type === 'opaque')) cache.put(stripVersion(req), res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(stripVersion(req), { ignoreSearch: own });
      if (hit) return hit;
      if (req.mode === 'navigate') { const page = await cache.match('index.html'); if (page) return page; }
      throw err;
    }
  })());
});

function stripVersion(req) {
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return req;
  u.search = '';
  return new Request(u.toString());
}
