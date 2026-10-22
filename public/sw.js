// Public app shell only. Clinical API responses and media never enter this cache.
const CACHE = 'ras-shell-v2';
self.addEventListener('install', (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const response = await fetch('/', { cache: 'reload' });
      if (!response.ok) throw new Error('App shell is unavailable');
      const html = await response.clone().text();
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"\s]+)"/g)].map((m) => m[1]);
      await cache.put('/', response);
      await cache.addAll(['/icon.svg', '/manifest.webmanifest', '/sample-document.svg', ...assets]);
    })(),
  ),
);
self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  ),
);
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.origin !== location.origin ||
    url.pathname.startsWith('/api')
  )
    return;
  if (event.request.mode === 'navigate')
    event.respondWith(fetch(event.request).catch(() => caches.match('/')));
  else if (
    url.pathname.startsWith('/assets/') ||
    ['/icon.svg', '/manifest.webmanifest', '/sample-document.svg'].includes(url.pathname)
  )
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const old = await cache.match(event.request);
        if (old) return old;
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      }),
    );
});
