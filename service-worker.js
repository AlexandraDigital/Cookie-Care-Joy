// ============================================================================
// Cookie-Care-Joy Service Worker
// Handles: offline support, notification queue, background notifications
// ============================================================================

const CCJ_ICON = "https://alexandradigital.github.io/Cookie-Care-Joy/icon-192.png";
const QUEUE_KEY = "ccj_notif_queue";
const QUEUE_CHECK_INTERVAL = 15000; // Check queue every 15 seconds

// ────────────────────────────────────────────────────────────────────────────
// 1. NOTIFICATION QUEUE MANAGEMENT
// ────────────────────────────────────────────────────────────────────────────

async function getQueue() {
  try {
    const data = await self.clients.matchAll().then(clients => {
      if (clients.length === 0) return "[]";
      // Try to get from any client's localStorage
      return clients[0];
    });
    return [];
  } catch {
    return [];
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 2. SHOW NOTIFICATION
// ────────────────────────────────────────────────────────────────────────────

async function showNotification(title, body, tag = "ccj-default") {
  try {
    await self.registration.showNotification(title, {
      body,
      icon: CCJ_ICON,
      badge: CCJ_ICON,
      tag, // Group by tag so duplicate reminders replace old ones
      requireInteraction: false,
      actions: [
        { action: "open", title: "Open App" },
        { action: "close", title: "Dismiss" }
      ]
    });
  } catch (e) {
    console.error("Failed to show notification:", e);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 3. PROCESS NOTIFICATION QUEUE
// Called when: page loads, SYNC_ALL message, periodic timer
// ────────────────────────────────────────────────────────────────────────────

async function processQueue(items) {
  const now = Date.now();
  
  if (!Array.isArray(items)) return;

  for (const item of items) {
    if (item.fireAt <= now) {
      // Time to show this notification!
      await showNotification(item.title, item.body, item.tag);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 4. PERIODIC QUEUE CHECK (runs every 15 seconds)
// Fires notifications even when app isn't active
// ────────────────────────────────────────────────────────────────────────────

let queueCheckTimer = null;

function startQueueCheck() {
  if (queueCheckTimer) return; // Already running

  queueCheckTimer = setInterval(async () => {
    try {
      // Get clients and ask them for the queue
      const clients = await self.clients.matchAll({ type: "window" });
      
      if (clients.length > 0) {
        // Ask first client to send us the queue
        clients[0].postMessage({ type: "REQUEST_SYNC" });
      }
    } catch (e) {
      console.error("Queue check error:", e);
    }
  }, QUEUE_CHECK_INTERVAL);
}

function stopQueueCheck() {
  if (queueCheckTimer) {
    clearInterval(queueCheckTimer);
    queueCheckTimer = null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 5. SERVICE WORKER LIFECYCLE
// ────────────────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  console.log("SW: install");
  self.skipWaiting(); // Activate immediately
});

self.addEventListener("activate", (event) => {
  console.log("SW: activate");
  event.waitUntil(self.clients.claim());
  startQueueCheck(); // Start periodic queue checks
});

// ────────────────────────────────────────────────────────────────────────────
// 6. MESSAGE HANDLING (from main app thread)
// ────────────────────────────────────────────────────────────────────────────

self.addEventListener("message", async (event) => {
  const { type, items } = event.data;

  if (type === "SYNC_ALL") {
    // Main app is sending us the full queue
    console.log("SW: SYNC_ALL received, items:", items?.length);
    await processQueue(items);
  } 
  else if (type === "SCHEDULE") {
    // Single item to schedule
    const { fireAt, title, body, tag } = event.data;
    const delay = Math.max(0, fireAt - Date.now());
    console.log("SW: SCHEDULE item, delay:", delay, "ms");
    
    // Schedule to show after delay
    setTimeout(() => {
      showNotification(title, body, tag);
    }, delay);
  }
  else if (type === "REQUEST_SYNC") {
    // Main app is asking us to sync - shouldn't normally happen from SW side
    console.log("SW: REQUEST_SYNC (from app)");
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 7. PUSH EVENT (if Web Push ever works)
// ────────────────────────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  console.log("SW: push event received");
  
  if (!event.data) {
    console.log("SW: push event with no data");
    return;
  }

  try {
    const data = event.data.json();
    event.waitUntil(
      showNotification(data.title || "Cookie-Care-Joy 🍪", data.body || "You have a sweet reminder!")
    );
  } catch (e) {
    // Not JSON, treat as plain text
    event.waitUntil(
      showNotification("Cookie-Care-Joy 🍪", event.data.text())
    );
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 8. NOTIFICATION CLICK HANDLING
// ────────────────────────────────────────────────────────────────────────────

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "close") {
    return;
  }

  // Open or focus the app window
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      // Check if app is already open
      for (let i = 0; i < clients.length; i++) {
        if (clients[i].url === "/" || clients[i].url.includes("index.html")) {
          return clients[i].focus();
        }
      }
      // Not open, open it
      if (self.clients.openWindow) {
        return self.clients.openWindow("/");
      }
    })
  );
});

// ────────────────────────────────────────────────────────────────────────────
// 9. FETCH EVENT (for offline support)
// ────────────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  // Just let all requests go through normally
  // (not implementing full offline caching in this version)
});

console.log("Cookie-Care-Joy Service Worker loaded ✨");
