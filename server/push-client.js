// push-client.js

class PushNotifier {
    constructor() {
        this.serviceWorkerRegistration = null;
        this.isSubscribed = false;
        this.pushSubscription = null;
        
        // Проверяем поддержку уведомлений
        this.isSupported = this.checkSupport();
    }
    
    // Проверка поддержки браузером
    checkSupport() {
        return 'serviceWorker' in navigator && 'PushManager' in window;
    }
    
    // Инициализация сервис-воркера
    async init() {
        if (!this.isSupported) {
            console.error('Web Push не поддерживается вашим браузером');
            return false;
        }
        
        try {
            // Регистрация сервис-воркера
            this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker зарегистрирован');
            
            // Подписка на push-сообщения
            await this.subscribe();
            
            return true;
        } catch (error) {
            console.error('Ошибка инициализации:', error);
            return false;
        }
    }
    
    // Запрос разрешения и подписка
    async subscribe() {
        try {
            // Запрос разрешения на показ уведомлений
            const permission = await Notification.requestPermission();
            
            if (permission !== 'granted') {
                throw new Error('Разрешение на уведомления не получено');
            }
            
            // Подписка на push-сообщения
            this.pushSubscription = await this.serviceWorkerRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array('ВАШ_PUBLIC_VAPID_KEY')
            });
            
            this.isSubscribed = true;
            console.log('Подписка успешна:', this.pushSubscription);
            
            // Отправка подписки на сервер
            await this.sendSubscriptionToServer(this.pushSubscription);
            
            return this.pushSubscription;
        } catch (error) {
            console.error('Ошибка подписки:', error);
            throw error;
        }
    }
    
    // Отправка подписки на сервер
    async sendSubscriptionToServer(subscription) {
        try {
            const response = await fetch('/api/save-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(subscription)
            });
            
            if (!response.ok) {
                throw new Error('Ошибка сохранения подписки на сервере');
            }
            
            console.log('Подписка сохранена на сервере');
        } catch (error) {
            console.error('Ошибка отправки подписки:', error);
        }
    }
    
    // Отправка тестового уведомления
    async sendTestNotification() {
        if (!this.isSubscribed) {
            console.error('Не подписан на уведомления');
            return false;
        }
        
        try {
            const response = await fetch('/api/send-notification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: 'Тестовое уведомление',
                    body: 'Это тестовое уведомление с вашего сайта!',
                    icon: '/icon-192.png',
                    badge: '/badge-72.png',
                    vibrate: [200, 100, 200]
                })
            });
            
            if (!response.ok) {
                throw new Error('Ошибка отправки уведомления');
            }
            
            console.log('Тестовое уведомление отправлено');
            return true;
        } catch (error) {
            console.error('Ошибка отправки уведомления:', error);
            return false;
        }
    }
    
    // Вспомогательная функция для преобразования ключа
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        
        return outputArray;
    }
}

// Создание экземпляра и добавление в глобальную область видимости
window.pushNotifier = new PushNotifier();

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    const initResult = await window.pushNotifier.init();
    
    if (initResult) {
        // Создание кнопки для отправки тестового уведомления
        const testButton = document.createElement('button');
        testButton.textContent = 'Отправить тестовое уведомление';
        testButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 15px;
            background: #6C63FF;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            z-index: 10000;
        `;
        
        testButton.addEventListener('click', () => {
            window.pushNotifier.sendTestNotification();
        });
        
        document.body.appendChild(testButton);
    }
});
