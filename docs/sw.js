// Cookie-Care-Joy Service Worker
// Handles push events, SW-side scheduled notifications, and app focus on click.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

const ICON = 'https://alexandradigital.github.io/Cookie-Care-Joy/icon-192.png';

// ── Web Push (server-sent) ───────────────────────────────────────────────────
// Fires when a push message arrives from a push service (e.g. OneSignal, Web Push server).
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
// The page posts { type: 'SCHEDULE', fireAt, title, body } messages here so
// notifications can fire even when the active tab loses focus.
// Note: browsers may suspend idle service workers; for very long delays the
// localStorage catchUpNotifs() on next open is the final safety net.
const _swTimers = new Map();

self.addEventListener('message', e => {
  if (!e.data) return;

  if (e.data.type === 'SCHEDULE') {
    const { fireAt, title, body } = e.data;
    if (!fireAt || !title) return;
    const delay = Math.max(0, fireAt - Date.now());
    if (_swTimers.has(fireAt)) clearTimeout(_swTimers.get(fireAt));
    const tid = setTimeout(() => {
      _swTimers.delete(fireAt);
      self.registration.showNotification(title, {
        body: body || '',
        icon: ICON,
        badge: ICON,
        tag: 'ccj-sw-' + fireAt,
        requireInteraction: false,
      });
    }, delay);
    _swTimers.set(fireAt, tid);
  }

  if (e.data.type === 'CANCEL') {
    const { fireAt } = e.data;
    if (_swTimers.has(fireAt)) { clearTimeout(_swTimers.get(fireAt)); _swTimers.delete(fireAt); }
  }

  if (e.data.type === 'CANCEL_ALL') {
    for (const [, tid] of _swTimers) clearTimeout(tid);
    _swTimers.clear();
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
