// sw.js

// Обработка push-событий
self.addEventListener('push', function(event) {
    let data = {};
    
    try {
        data = event.data ? event.data.json() : {};
    } catch (error) {
        console.error('Ошибка парсинга данных уведомления:', error);
        data = {
            title: 'Уведомление',
            body: 'Получено новое уведомление'
        };
    }
    
    const options = {
        body: data.body || 'Получено новое уведомление',
        icon: data.icon || '/icon-192.png',
        badge: data.badge || '/badge-72.png',
        vibrate: data.vibrate || [200, 100, 200],
        data: {
            url: data.url || '/'
        }
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'Уведомление', options)
    );
});

// Обработка кликов по уведомлению
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
