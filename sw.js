const CACHE_NAME = 'rme-cache-v1';
const urlsToCache = [
  'https://rezaariandes.github.io/rme/',
  'https://rezaariandes.github.io/rme/index.html',
  'https://rezaariandes.github.io/rme/icd10.js',
  'https://rezaariandes.github.io/rme/manifest.json',
  'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Serif+Display&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  // Hanya simpan request tampilan (GET), abaikan pengiriman data (POST)
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});