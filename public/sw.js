const CACHE_NAME = 'kavas-app-v' + new Date().getTime(); // Unique cache name per build
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/KavasAppLogo.svg'
];

self.addEventListener('install', (event) => {
    self.skipWaiting(); // Force the waiting service worker to become active
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    // Clean up old caches
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Take control of all open clients
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
