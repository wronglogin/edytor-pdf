// Edytor PDF – pamięć podręczna, żeby aplikacja działała też bez internetu.
const CACHE = 'edytor-pdf-v37';
const APP = ['./edytor-pdf.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './spell-worker.js', './lib/nspell.js', './lib/pdf-decrypt.js'];
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  'https://unpkg.com/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled([...APP.map(u => new Request(u, { cache: 'reload' })), ...CDN].map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  // czcionki i słownik przenosimy do nowej pamięci (nie zmieniają się), resztę starej wersji usuwamy
  e.waitUntil((async () => {
    const keep = await caches.open(CACHE);
    for (const k of await caches.keys()) {
      if (k === CACHE) continue;
      const old = await caches.open(k);
      for (const r of await old.keys()) if (/\/(fonts|dict)\//.test(r.url)) { const res = await old.match(r); if (res) await keep.put(r, res); }
      await caches.delete(k);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const own = url.origin === location.origin;
  const lib = /cdnjs\.cloudflare\.com|unpkg\.com|cdn\.jsdelivr\.net/.test(url.hostname);
  if (!own && !lib) return;
  const heavy = own && /\/(fonts|dict)\//.test(url.pathname);
  if (own && !heavy) {
    // aplikacja: zawsze najnowsza wersja z serwera (z pominięciem pamięci przeglądarki), bez internetu – kopia
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch: true })));
  } else {
    // czcionki, słownik, biblioteki: najpierw kopia (duże pliki, nie zmieniają się)
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; })));
  }
});
