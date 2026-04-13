// ════════════════════════════════════════════════════════════════════
// 🍪 SERVICE WORKER - Cookie Care Joy
// Handles push notifications, caching, and offline functionality
// ════════════════════════════════════════════════════════════════════

const CACHE_NAME = 'cookiecarejoy-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/sw.js'
];

// ════════════════════════════════════════════════════════════════════
// INSTALL - Cache assets
// ════════════════════════════════════════════════════════════════════
self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// ════════════════════════════════════════════════════════════════════
// ACTIVATE - Clean up old caches
// ════════════════════════════════════════════════════════════════════
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

// ════════════════════════════════════════════════════════════════════
// FETCH - Network first, fall back to cache
// ════════════════════════════════════════════════════════════════════
self.addEventListener('fetch', event => {
    // Only handle GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Cache successful responses
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseClone);
                        });
                }
                return response;
            })
            .catch(() => {
                // Fall back to cache on network error
                return caches.match(event.request)
                    .then(response => {
                        return response || new Response(
                            'Offline - Content not available',
                            { status: 503, statusText: 'Service Unavailable' }
                        );
                    });
            })
    );
});

// ════════════════════════════════════════════════════════════════════
// PUSH - Handle push notifications
// ════════════════════════════════════════════════════════════════════
self.addEventListener('push', event => {
    console.log('Push notification received:', event);

    let notificationData = {
        title: '🍪 Cookie Care Joy',
        body: 'Check your notifications!',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><rect fill="%23fff5f8" width="180" height="180"/><text x="90" y="120" font-size="100" text-anchor="middle" dominant-baseline="middle">🍪</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><rect fill="%23f9a8d4" width="180" height="180"/><text x="90" y="120" font-size="100" text-anchor="middle" dominant-baseline="middle">🍪</text></svg>',
        tag: 'cookie-care-joy',
        requireInteraction: false
    };

    // Parse custom data if available
    if (event.data) {
        try {
            const data = event.data.json();
            notificationData = { ...notificationData, ...data };
        } catch (e) {
            notificationData.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(notificationData.title, {
            body: notificationData.body,
            icon: notificationData.icon,
            badge: notificationData.badge,
            tag: notificationData.tag,
            requireInteraction: notificationData.requireInteraction
        })
    );
});

// ════════════════════════════════════════════════════════════════════
// NOTIFICATION CLICK - Open app when notification is clicked
// ════════════════════════════════════════════════════════════════════
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked:', event);
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window' })
            .then(clientList => {
                // Check if app is already open
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].url === '/' && 'focus' in clientList[i]) {
                        return clientList[i].focus();
                    }
                }
                // If not open, open new window
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});

// ════════════════════════════════════════════════════════════════════
// NOTIFICATION CLOSE - Optional: log when notification is closed
// ════════════════════════════════════════════════════════════════════
self.addEventListener('notificationclose', event => {
    console.log('Notification closed:', event.notification.tag);
});

console.log('🍪 Service Worker loaded and ready!');
