const express = require('express');
const webpush = require('web-push');
const path = require('path');
const fs = require('fs');
const https = require('https');
const DatabaseService = require('./database');
const { getLocalIPs } = require('./ip');

const app = express();
const host = getLocalIPs();
const dbService = new DatabaseService();

// Middleware
app.use(express.static(path.join(__dirname, '../client/build')));
app.use(express.json({ limit: '10mb' }));

// VAPID ключи
const VAPID_PUBLIC_KEY = "BHBjxuWrOU0dXE_HRaL0N7QITNfspQbKNsdJ-LWqBHaFYqVyE0c3yttX-QJ1jEj0X38sn2ZByek1FTyGgRG41J8";
const VAPID_PRIVATE_KEY = "SJZMFiZRdnQIvn2Gn5wDxS32TlrVYkoBQjMjJyRr-04";

webpush.setVapidDetails(
    'mailto:your-email@example.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

// Хранилище подписок для уведомлений
const pushSubscriptions = {};

// Функция для санитизации имени БД
function sanitizeDeviceName(deviceName) {
    return deviceName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

// Новый endpoint для обработки Bluetooth-подключения с клиента
app.post('/api/bluetooth/connect', async (req, res) => {
    try {
        const { deviceName, deviceId, rssi, timestamp } = req.body;

        if (!deviceName || !deviceId) {
            return res.status(400).json({ error: 'Не указаны deviceName или deviceId' });
        }

        const sanitizedName = sanitizeDeviceName(deviceName);
        console.log(`Создание БД для устройства: ${deviceName} (${sanitizedName})`);

        // Создаём БД, если ещё не существует
        const dbName = await dbService.ensureDatabaseExists(sanitizedName);

        // Тестовые данные для сохранения
        const sensorData = {
            timestamp: timestamp || new Date().toISOString(),
            deviceName,
            deviceId,
            rssi: rssi || null, // Уровень сигнала, если передан
            status: 'connected',
            unit: rssi ? 'dBm' : null
        };

        // Сохраняем данные
        const savedData = await dbService.saveSensorData(sanitizedName, sensorData);

        // Отправляем push-уведомление
        await sendPushNotification(sanitizedName, {
            title: `Новое устройство: ${deviceName}`,
            body: `Подключено и данные сохранены в БД`,
            icon: '/icon.png'
        });

        res.json({
            success: true,
            message: `БД для ${deviceName} создана, данные сохранены`,
            database: dbName,
            data: savedData
        });
    } catch (error) {
        console.error('Ошибка обработки Bluetooth-подключения:', error.stack);
        res.status(500).json({ success: false, error: `Ошибка создания БД: ${error.message}` });
    }
});

// Endpoint для получения данных устройства
app.get('/api/bluetooth/:deviceName/data', async (req, res) => {
    try {
        const { deviceName } = req.params;
        const sanitizedName = sanitizeDeviceName(deviceName);
        const limit = parseInt(req.query.limit) || 10;

        const data = await dbService.getDeviceData(sanitizedName, limit);

        res.json({
            success: true,
            device: deviceName,
            database: sanitizedName,
            data: data,
            count: data.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Ошибка получения Bluetooth-данных:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Информация о БД устройства
app.get('/api/device/:deviceName/info', async (req, res) => {
    try {
        const { deviceName } = req.params;
        const data = await dbService.getDeviceData(deviceName, 1);
        
        res.json({
            success: true,
            device: deviceName,
            hasData: data.length > 0,
            lastRecord: data[0] || null,
            database: dbService.sanitizeDBName(deviceName)
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== PUSH УВЕДОМЛЕНИЯ ====================

// Проверка подписки
app.post('/check-subscription', (req, res) => {
    const { deviceId } = req.body;

    if (!deviceId) {
        return res.status(400).json({ error: 'Отсутствует deviceId' });
    }

    try {
        const exists = !!pushSubscriptions[deviceId];
        res.json({ exists });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Сохранение подписки
app.post('/web-push', (req, res) => {
    const { subscription, deviceId, browserInfo, timestamp } = req.body;

    if (!deviceId || !subscription) {
        return res.status(400).json({ error: 'Неверные данные подписки' });
    }

    try {
        // Очищаем старые подписки с тем же endpoint
        for (const [existingDeviceId, existingSubscription] of Object.entries(pushSubscriptions)) {
            if (existingSubscription.endpoint === subscription.endpoint && existingDeviceId !== deviceId) {
                delete pushSubscriptions[existingDeviceId];
            }
        }

        pushSubscriptions[deviceId] = { ...subscription, browserInfo, timestamp };
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Удаление подписки
app.delete('/web-push', (req, res) => {
    const { deviceId } = req.body;

    if (!deviceId) {
        return res.status(400).json({ error: 'Отсутствует deviceId' });
    }

    try {
        delete pushSubscriptions[deviceId];
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Функция отправки уведомления
async function sendPushNotification(deviceId, notification) {
    const subscription = pushSubscriptions[deviceId];
    
    if (!subscription) {
        console.log('Подписка не найдена для устройства:', deviceId);
        return;
    }

    const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        icon: notification.icon,
        data: { url: '/', deviceId }
    });

    try {
        await webpush.sendNotification(subscription, payload);
        console.log('📨 Уведомление отправлено для:', deviceId);
    } catch (error) {
        console.error('Ошибка отправки уведомления:', error);
        if (error.statusCode === 410) {
            delete pushSubscriptions[deviceId];
        }
    }
}

// Отправка тестового уведомления
app.post('/send-notification', async (req, res) => {
    const { deviceId, title, body, icon } = req.body;

    if (!deviceId) {
        return res.status(400).json({ error: 'Отсутствует deviceId' });
    }

    try {
        await sendPushNotification(deviceId, { 
            title: title || 'Тестовое уведомление',
            body: body || `Уведомление для устройства ${deviceId}`,
            icon: icon || '/icon.png'
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Просмотр всех подписок (отладка)
app.get('/subscriptions', (req, res) => {
    res.json({
        count: Object.keys(pushSubscriptions).length,
        subscriptions: pushSubscriptions
    });
});

// Маршрут для React приложения
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

// Запуск HTTPS сервера
const options = {
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.crt')
};

https.createServer(options, app).listen(3000, '192.168.99.14', () => {
    console.log('https://' + host + ':3000');
});

