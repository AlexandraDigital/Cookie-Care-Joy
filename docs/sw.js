// OneSignal SDK is loaded by OneSignalSDKWorker.js

// Cookie-Care-Joy Service Worker
// Handles push events, SW-side scheduled notifications, and app focus on click.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

const ICON = 'https://alexandradigital.github.io/Cookie-Care-Joy/icon-192.png';

// ── Web Push (server-sent, e.g. OneSignal / Firebase) ────────────────────────
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
// The page posts messages here so notifications can fire even when the tab is
// backgrounded. _swTimers holds all live setTimeout handles keyed by fireAt ms.
const _swTimers = new Map();

function _scheduleOne(fireAt, title, body, tag) {
  if (!fireAt || !title) return;
  // content-based dedup key — same title+body reuses same SW timer slot
  const dedup = tag || ('ccj-' + (title + body).replace(/[^a-z0-9]/gi,'').substring(0,24).toLowerCase());
  if (_swTimers.has(dedup)) clearTimeout(_swTimers.get(dedup));
  const delay = Math.max(0, fireAt - Date.now());
  const tid = setTimeout(() => {
    _swTimers.delete(dedup);
    self.registration.showNotification(title, {
      body: body || '',
      icon: ICON,
      badge: ICON,
      tag: dedup,
      requireInteraction: false,
    });
  }, delay);
  _swTimers.set(dedup, tid);
}

self.addEventListener('message', e => {
  if (!e.data) return;

  switch (e.data.type) {

    // Schedule a single notification
    case 'SCHEDULE':
      _scheduleOne(e.data.fireAt, e.data.title, e.data.body, e.data.tag);
      break;

    // Full re-sync: clear everything and rebuild from the page's localStorage queue.
    // Called on page load, after SW restart, and on visibilitychange.
    // This is the main defence against SW timer loss on SW termination.
    case 'SYNC_ALL': {
      for (const tid of _swTimers.values()) clearTimeout(tid);
      _swTimers.clear();
      const items = e.data.items || [];
      for (const { fireAt, title, body, tag } of items) {
        _scheduleOne(fireAt, title, body, tag);
      }
      break;
    }

    // Cancel a single notification
    case 'CANCEL':
      if (_swTimers.has(e.data.fireAt)) {
        clearTimeout(_swTimers.get(e.data.fireAt));
        _swTimers.delete(e.data.fireAt);
      }
      break;

    // Cancel everything (called when user disables notifications)
    case 'CANCEL_ALL':
      for (const tid of _swTimers.values()) clearTimeout(tid);
      _swTimers.clear();
      break;

    // Keepalive ping from the page — receiving this resets the SW idle timer.
    // The page sends this every 20 s while visible, every 25 s while hidden.
    case 'PING':
      break;
  }
});

// ── Periodic Background Sync ─────────────────────────────────────────────────
// Fires even when the PWA is fully closed (Chrome Android, installed PWA only).
// Asks any open window clients to re-sync the queue. If no clients are open,
// broadcasts a 'REQUEST_SYNC' to all windows on next open via postMessage.
self.addEventListener('periodicsync', e => {
  if (e.tag === 'ccj-notif-sync') {
    e.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        for (const client of clients) {
          // Ask the page to send us SYNC_ALL with its localStorage queue
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
