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

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification;
  self.registration.showNotification("🍪 Cookie-Care-Joy", {
    body: title + "\n" + body,
    icon: "/Cookie-Care-Joy/cookie-icon.png",
    badge: "/Cookie-Care-Joy/cookie-icon.png",
    tag: "ccj-reminder",
    vibrate: [200, 100, 200],
    data: { url: "https://alexandradigital.github.io/Cookie-Care-Joy" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow("https://alexandradigital.github.io/Cookie-Care-Joy")
  );
});
