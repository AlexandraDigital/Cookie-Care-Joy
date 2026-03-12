// firebase-messaging-sw.js
// Place this file in the ROOT of your GitHub repo (same level as index.html)

importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCyNUyas2hfRAt4nr2tFbDdq-a71ZELcBo",
  authDomain: "cookie-care-joy.firebaseapp.com",
  projectId: "cookie-care-joy",
  storageBucket: "cookie-care-joy.firebasestorage.app",
  messagingSenderId: "129750731438",
  appId: "1:129750731438:web:b7e32262250d42e9c8fb3f",
});

const messaging = firebase.messaging();

// Handle background messages (app closed or backgrounded)
messaging.onBackgroundMessage((payload) => {
  console.log("📩 Background message received:", payload);
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: "/Cookie-Care-Joy/cookie-icon.png",
    badge: "/Cookie-Care-Joy/cookie-icon.png",
    vibrate: [200, 100, 200],
    data: { url: "https://alexandradigital.github.io/Cookie-Care-Joy" },
  });
});

// Open app when notification is clicked
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(
      event.notification.data?.url ||
        "https://alexandradigital.github.io/Cookie-Care-Joy"
    )
  );
});
