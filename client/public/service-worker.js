const ignored = self.__WB_MANIFEST;
const CACHE_NAME = 'react-pwa-cache-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.ico',
];

// Install service worker
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Add static URLs to cache
        return Promise.all([
          cache.addAll(urlsToCache),
          // Dynamically cache all JS and CSS files in /static/js/ and /static/css/
          fetch('/asset-manifest.json')
            .then(response => response.json())
            .then(assets => {
              const filesToCache = [];
              // Iterate through asset-manifest.json to find JS and CSS files
              for (let key in assets.files) {
                if (key.endsWith('.js') || key.endsWith('.css')) {
                  filesToCache.push(assets.files[key]);
                }
              }
              return cache.addAll(filesToCache);
            })
            .catch(err => console.error('Error fetching asset-manifest.json:', err))
        ]);
      })
  );
});

// Fetch resources
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached response or fetch from network
        return response || fetch(event.request);
      })
      .catch(() => {
        // Fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      })
  );
});

// Activate and clean old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('push', event => {
    console.log('Push event received:', event);
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
            console.log('Push data:', data);
        } catch (err) {
            console.error('Error parsing push data:', err);
            data = { title: 'Уведомление', body: 'Данные не распознаны' };
        }
    } else {
        console.warn('No push data received');
        data = { title: 'Уведомление', body: 'Пустое уведомление' };
    }
    const title = data.title || 'Новое уведомление';
    const options = {
        body: data.body || 'Это push-уведомление!',
        data: {
            url: data.url || self.location.origin
        }
    };
    console.log('Showing notification:', title, options);
    event.waitUntil(
        self.registration.showNotification(title, options)
            .catch(err => console.error('Error showing notification:', err))
    );
});

self.addEventListener('notificationclick', event => {
    console.log('Notification clicked:', event.notification);
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
