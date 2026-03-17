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

// Notify all open page clients so in-app toast fires too
async function _notifyClients(title, body) {
  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clients) c.postMessage({ type: 'CCJ_NOTIFY', title, body });
  } catch(e) {}
}

function _scheduleOne(fireAt, title, body, tag) {
  if (!fireAt || !title) return;
  const delay = Math.max(0, fireAt - Date.now());
  // content-based dedup key
  const dedup = tag || ('ccj-' + (title + body).replace(/[^a-z0-9]/gi,'').substring(0,24).toLowerCase());

  // ── Path A: Notification Triggers API (Chrome 80+) ──────────────────────────
  // Schedules at OS level — survives SW termination, tab switching, device sleep.
  if (typeof TimestampTrigger !== 'undefined') {
    // Cancel any existing scheduled notification with same tag first
    self.registration.getNotifications({ tag: dedup }).then(existing => {
      existing.forEach(n => n.close());
    }).catch(() => {});
    self.registration.showNotification(title, {
      body: body || '',
      icon: ICON,
      badge: ICON,
      tag: dedup,
      requireInteraction: false,
      showTrigger: new TimestampTrigger(fireAt),
    }).then(() => {
      // Also schedule in-app toast via setTimeout (page may still be open)
      if (_swTimers.has(dedup)) clearTimeout(_swTimers.get(dedup));
      const tid = setTimeout(() => { _swTimers.delete(dedup); _notifyClients(title, body); }, delay);
      _swTimers.set(dedup, tid);
    }).catch(() => {
      // Fallback to setTimeout if trigger API fails
      _scheduleOneTimeout(dedup, fireAt, title, body, delay);
    });
    return;
  }

  // ── Path B: setTimeout fallback (Firefox, Safari, older Chrome) ─────────────
  _scheduleOneTimeout(dedup, fireAt, title, body, delay);
}

function _scheduleOneTimeout(dedup, fireAt, title, body, delay) {
  if (_swTimers.has(dedup)) clearTimeout(_swTimers.get(dedup));
  const tid = setTimeout(async () => {
    _swTimers.delete(dedup);
    await _notifyClients(title, body);
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

  // CRITICAL: e.waitUntil keeps the SW alive for the duration of the promise.
  // Without this the SW can be terminated immediately after receiving the message,
  // killing any setTimeout timers we just registered.
  e.waitUntil((async () => {
    switch (e.data.type) {

      // Schedule a single notification
      case 'SCHEDULE':
        _scheduleOne(e.data.fireAt, e.data.title, e.data.body, e.data.tag);
        break;

      // Full re-sync: clear everything and rebuild from the page's localStorage queue.
      // Called on page load, after SW restart, and on visibilitychange.
      case 'SYNC_ALL': {
        // Cancel existing setTimeout timers
        for (const tid of _swTimers.values()) clearTimeout(tid);
        _swTimers.clear();
        // Also cancel any OS-level trigger notifications (TimestampTrigger)
        try {
          const pending = await self.registration.getNotifications();
          for (const n of pending) n.close();
        } catch(err) {}
        const items = e.data.items || [];
        for (const { fireAt, title, body, tag } of items) {
          _scheduleOne(fireAt, title, body, tag);
        }
        break;
      }

      // Cancel a single notification by tag
      case 'CANCEL': {
        const ctag = e.data.tag;
        if (ctag) {
          if (_swTimers.has(ctag)) { clearTimeout(_swTimers.get(ctag)); _swTimers.delete(ctag); }
          try {
            const ns = await self.registration.getNotifications({ tag: ctag });
            ns.forEach(n => n.close());
          } catch(err) {}
        }
        break;
      }

      // Cancel everything (called when user disables notifications)
      case 'CANCEL_ALL':
        for (const tid of _swTimers.values()) clearTimeout(tid);
        _swTimers.clear();
        try {
          const all = await self.registration.getNotifications();
          all.forEach(n => n.close());
        } catch(err) {}
        break;

      // Keepalive ping — just receiving this message resets the SW idle timer.
      // Page pings every 10s so SW isn't killed between scheduled notifications.
      case 'PING':
        break;
    }
  })());
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
