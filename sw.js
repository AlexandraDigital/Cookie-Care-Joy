const CACHE_NAME = 'ccj-v2';
const BASE = '/Cookie-Care-Joy';

// Only essential files (keep SW stable)
const PRECACHE = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/icon-48.png',
  BASE + '/icon-96.png',
  BASE + '/icon-144.png',
  BASE + '/icon-192.png',
  BASE + '/icon-512.png',
  BASE + '/favicon.ico'
];

// ───────────────────────────────
// INSTALL
// ───────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE);
    })
  );
  self.skipWaiting();
});

// ───────────────────────────────
// ACTIVATE
// ───────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ───────────────────────────────
// FETCH (offline support)
// ───────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, copy);
          });
          return res;
        })
        .catch(() => cached);
    })
  );
});

// ───────────────────────────────
// NOTIFICATIONS (optional native SW support)
// ───────────────────────────────
self.addEventListener('push', (event) => {
  let data = {
    title: 'Cookie-Care-Joy 🍪',
    body: 'Time to check your tasks ✨'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: BASE + '/icon-192.png',
      badge: BASE + '/icon-192.png',
      tag: 'ccj-notification'
    })
  );
});

// ───────────────────────────────
// NOTIFICATION CLICK
// ───────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/Cookie-Care-Joy/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/Cookie-Care-Joy/');
      }
    })
  );
});