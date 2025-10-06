// push-client.js

// Функция для безопасного обновления статуса
function updateStatus(message, type = 'info') {
    try {
        const statusElement = document.getElementById('pushStatus');
        
        if (!statusElement) {
            console.log(`${type.toUpperCase()}: ${message}`);
            return;
        }
        
        statusElement.textContent = message;
        statusElement.className = `status ${type}`;
        
        console.log(`${type.toUpperCase()}: ${message}`);
    } catch (error) {
        console.log('Status update error:', error, 'Message:', message);
    }
}

// Функция для безопасного управления кнопками
function safeButtonControl(buttonId, disabled) {
    try {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = disabled;
        }
    } catch (error) {
        console.log('Button control error:', error);
    }
}

async function registerPush() {
    try {
        // Проверка поддержки уведомлений
        console.log('Checking browser support...');
        if (!('Notification' in window)) {
            updateStatus('Уведомления не поддерживаются браузером', 'error');
            return;
        }

        // Проверка поддержки Service Worker
        if (!('serviceWorker' in navigator)) {
            updateStatus('Service Worker не поддерживаются', 'error');
            return;
        }

        // Проверка текущего разрешения
        const currentPermission = Notification.permission;
        console.log('Current permission:', currentPermission);
        updateStatus(`Текущее разрешение: ${currentPermission}`, 'info');

        if (currentPermission === 'denied') {
            updateStatus('Уведомления заблокированы. Сбросьте настройки в браузере.', 'error');
            return;
        }

        if (currentPermission === 'granted') {
            updateStatus('Уведомления уже разрешены', 'success');
        } else {
            // Запрос разрешения
            console.log('Requesting notification permission...');
            const permission = await Notification.requestPermission();
            console.log('Permission result:', permission);
            updateStatus(`Результат запроса: ${permission}`, permission === 'granted' ? 'success' : 'error');

            if (permission !== 'granted') {
                updateStatus('Разрешение на уведомления отклонено', 'error');
                return;
            }
        }

        // Регистрация Service Worker
        console.log('Registering Service Worker...');
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('Service Worker registered:', registration);

        // Ожидание готовности Service Worker
        console.log('Waiting for Service Worker to be ready...');
        await navigator.serviceWorker.ready;
        console.log('Service Worker ready');

        // Проверка существующей подписки
        console.log('Checking existing subscription...');
        let subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
            console.log('Existing subscription found:', subscription);
            updateStatus('Найдена существующая подписка', 'info');
        } else {
            // Создание новой подписки
            console.log('Creating new subscription...');
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: 'BHBjxuWrOU0dXE_HRaL0N7QITNfspQbKNsdJ-LWqBHaFYqVyE0c3yttX-QJ1jEj0X38sn2ZByek1FTyGgRG41J8'
            });
            console.log('New subscription created:', subscription);
            updateStatus('Новая подписка создана', 'success');
        }

        // Отправка подписки на сервер
        console.log('Sending subscription to server...');
        const response = await fetch('/web-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription)
        });

        if (response.ok) {
            console.log('Subscription sent successfully');
            updateStatus('Подписка успешно отправлена на сервер', 'success');
            
            // Безопасное обновление кнопок
            safeButtonControl('subscribeBtn', true);
            safeButtonControl('testNotificationBtn', false);
            safeButtonControl('customNotificationBtn', false);
        } else {
            throw new Error('Ошибка при отправке подписки на сервер');
        }
    } catch (err) {
        console.error('Ошибка при регистрации push:', err);
        updateStatus(`Ошибка: ${err.message}`, 'error');
    }
}

async function sendTestNotification() {
    try {
        console.log('Sending test notification to /send-notification...');
        const response = await fetch('/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Тестовое уведомление',
                body: 'Это тестовое push-уведомление!',
            })
        });
        
        console.log('Response status:', response.status);
        if (response.ok) {
            console.log('Test notification request successful');
            updateStatus('Тестовое уведомление отправлено', 'success');
        } else {
            const errorText = await response.text();
            console.error('Server response:', errorText);
            throw new Error(`Ошибка отправки уведомления: ${response.status} ${errorText}`);
        }
    } catch (err) {
        console.error('Ошибка тестового уведомления:', err);
        updateStatus(`Ошибка: ${err.message}`, 'error');
    }
}

// Лог загрузки скрипта
console.log('push-client.js loaded');

// Ожидание полной загрузки DOM
// Ожидание полной загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing push client...');
    
    // Инициализация кнопок
    const subscribeBtn = document.getElementById('subscribeBtn');
    const testNotificationBtn = document.getElementById('testNotificationBtn');
    
    if (subscribeBtn) {
        subscribeBtn.addEventListener('click', registerPush);
    } else {
        console.error('Кнопка subscribeBtn не найдена');
    }
    
    if (testNotificationBtn) {
        testNotificationBtn.addEventListener('click', sendTestNotification);
        testNotificationBtn.disabled = true; // Отключаем до успешной подписки
    } else {
        console.error('Кнопка testNotificationBtn не найдена');
    }
    
    // Автоматически запускаем регистрацию при загрузке
    registerPush();
});

