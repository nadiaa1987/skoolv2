importScripts('https://www.gstatic.com/firebasejs/9.1.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.1.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyDEp7sRXCiuZsUK7l7FiAZlKNc9r-DHs1M",
    authDomain: "skool-6de0b.firebaseapp.com",
    projectId: "skool-6de0b",
    storageBucket: "skool-6de0b.firebasestorage.app",
    messagingSenderId: "7055405832",
    appId: "1:7055405832:web:954058558bba61deff32bd",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: payload.notification.image || '/pwa-192x192.png',
        data: {
            url: payload.data?.link || '/'
        }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data.url;
    event.waitUntil(
        clients.openWindow(url)
    );
});
