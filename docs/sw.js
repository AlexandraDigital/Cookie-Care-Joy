// Cookie-Care-Joy Service Worker
// Handles push events, SW-side scheduled notifications, app focus on click,
// and full offline caching so the installed PWA works without internet.

const CACHE_VERSION = 'ccj-v1';
const BASE = '/Cookie-Care-Joy';

// All local assets to pre-cache on install
const PRECACHE_URLS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/sw.js',
  BASE + '/icon-48.png',
  BASE + '/icon-96.png',
  BASE + '/icon-144.png',
  BASE + '/icon-192.png',
  BASE + '/icon-512.png',
  BASE + '/favicon.ico',
];

// CDN scripts — cache on first fetch so they work offline after first visit
const CDN_CACHE = 'ccj-cdn-v1';
const CDN_ORIGINS = [
  'cdnjs.cloudflare.com',
];

// ── Install: pre-cache all local assets ──────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('[SW] Pre-cache partial failure:', err);
        return Promise.allSettled(
          PRECACHE_URLS.map(url => cache.add(url).catch(() => {}))
        );
      })
    ).then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION && k !== CDN_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: serve from cache when offline ─────────────────────────────────────
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip non-http(s) requests (chrome-extension:// etc.)
  if (!url.protocol.startsWith('http')) return;

  // ── CDN resources: cache-first ───────────────────────────────────────────
  if (CDN_ORIGINS.some(origin => url.hostname.includes(origin))) {
    e.respondWith(
      caches.open(CDN_CACHE).then(async cache => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          return cached || new Response('// offline', { headers: { 'Content-Type': 'application/javascript' } });
        }
      })
    );
    return;
  }

  // ── App navigation (HTML pages): network-first, fallback to cached index ──
  if (request.destination === 'document' || (request.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            caches.open(CACHE_VERSION).then(cache => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || await caches.match(BASE + '/index.html') || await caches.match(BASE + '/');
        })
    );
    return;
  }

  // ── All other local assets: cache-first, fallback to network ─────────────
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            caches.open(CACHE_VERSION).then(cache => cache.put(request, response.clone()));
          }
          return response;
        });
      })
    );
  }
});

const ICON = 'https://alexandradigital.github.io/Cookie-Care-Joy/icon-192.png';

// ── Web Push (server-sent) ───────────────────────────────────────────────────
self.addEventListener('push', e => {
  let data = { title: 'Cookie-Care-Joy 🍪', body: 'Time to take care of yourself ✨' };
  if (e.data) {
    try { data = e.data.json(); } catch { data.body = e.data.text(); }
  }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Cookie-Care-Joy 🍪', {
      body: data.body || '',
      icon: ICON,
      badge: ICON,
      tag: 'ccj-push-' + Date.now(),
      requireInteraction: false,
    })
  );
});

// ── SW-side notification scheduling ─────────────────────────────────────────
const _swTimers = new Map();

function _scheduleOne(fireAt, title, body, tag) {
  if (!fireAt || !title) return;
  const schedKey = tag || ('ccj-t' + fireAt);
  if (_swTimers.has(schedKey)) clearTimeout(_swTimers.get(schedKey));
  const delay = Math.max(0, fireAt - Date.now());
  const notifTag = 'ccj-' + (title + body).replace(/[^a-z0-9]/gi,'').substring(0,24).toLowerCase();
  const tid = setTimeout(() => {
    _swTimers.delete(schedKey);
    self.registration.showNotification(title, {
      body: body || '',
      icon: ICON,
      badge: ICON,
      tag: notifTag,
      requireInteraction: false,
    });
  }, delay);
  _swTimers.set(schedKey, tid);
}

self.addEventListener('message', e => {
  if (!e.data) return;

  switch (e.data.type) {
    case 'SCHEDULE':
      _scheduleOne(e.data.fireAt, e.data.title, e.data.body, e.data.tag);
      break;

    case 'SYNC_ALL': {
      for (const tid of _swTimers.values()) clearTimeout(tid);
      _swTimers.clear();
      const items = e.data.items || [];
      for (const { fireAt, title, body, tag } of items) {
        _scheduleOne(fireAt, title, body, tag);
      }
      break;
    }

    case 'CANCEL':
      if (_swTimers.has(e.data.fireAt)) {
        clearTimeout(_swTimers.get(e.data.fireAt));
        _swTimers.delete(e.data.fireAt);
      }
      break;

    case 'CANCEL_ALL':
      for (const tid of _swTimers.values()) clearTimeout(tid);
      _swTimers.clear();
      break;

    case 'PING':
      break;
  }
});

// ── Periodic Background Sync ─────────────────────────────────────────────────
self.addEventListener('periodicsync', e => {
  if (e.tag === 'ccj-notif-sync') {
    e.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        for (const client of clients) {
          client.postMessage({ type: 'REQUEST_SYNC' });
        }
      })
    );
  }
});

// ── Open the app when user taps a notification ───────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('Cookie-Care-Joy') && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/Cookie-Care-Joy/');
      }
    })
  );
});
