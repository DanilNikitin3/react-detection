// BluetoothInternalsManager.js
export class BluetoothInternalsManager {
    constructor() {
        this.internalsWindow = null;
        this.internalsUrl = 'chrome://bluetooth-internals/';
        this.isSupported = this.checkChromeSupport();
    }

    checkChromeSupport() {
        return /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    }

    async openHiddenInternals() {
        if (!this.isSupported) {
            console.warn('Требуется Chrome браузер');
            return false;
        }

        try {
            const width = 400;
            const height = 300;
            
            this.internalsWindow = window.open(
                this.internalsUrl,
                'bluetoothInternals',
                `width=${width},height=${height},left=${screen.width - width},top=${screen.height - height},menubar=no,toolbar=no,location=no,status=no`
            );

            if (!this.internalsWindow) {
                throw new Error('Блокировка popup. Разрешите всплывающие окна для этого сайта.');
            }

            await this.waitForInternalsLoad();
            console.log('Bluetooth Internals запущен');
            return true;

        } catch (error) {
            console.error('Ошибка открытия Bluetooth Internals:', error);
            this.fallbackKeepAlive();
            return false;
        }
    }

    waitForInternalsLoad() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 10;

            const checkLoaded = () => {
                attempts++;
                try {
                    if (this.internalsWindow && this.internalsWindow.document.readyState === 'complete') {
                        this.minimizeWindow();
                        resolve();
                    } else if (attempts >= maxAttempts) {
                        reject(new Error('Таймаут загрузки Bluetooth Internals'));
                    } else {
                        setTimeout(checkLoaded, 500);
                    }
                } catch (e) {
                    if (attempts >= maxAttempts) {
                        resolve();
                    } else {
                        setTimeout(checkLoaded, 500);
                    }
                }
            };

            checkLoaded();
        });
    }

    minimizeWindow() {
        try {
            this.internalsWindow.blur();
            window.focus();
            this.internalsWindow.moveTo(screen.width, screen.height);
        } catch (e) {
            // Игнорируем ошибки cross-origin
        }
    }

    fallbackKeepAlive() {
        console.log('Запуск фонового поддержания Bluetooth...');
        setInterval(async () => {
            try {
                await navigator.bluetooth.getAvailability();
                await new Promise(resolve => setTimeout(resolve, 100));
                await navigator.bluetooth.getDevices();
            } catch (error) {
                console.log('Фоновый keep-alive error:', error);
            }
        }, 10000);
    }

    closeInternals() {
        if (this.internalsWindow && !this.internalsWindow.closed) {
            this.internalsWindow.close();
            this.internalsWindow = null;
            console.log('Bluetooth Internals закрыт');
        }
    }

    isInternalsOpen() {
        return this.internalsWindow && !this.internalsWindow.closed;
    }
}

// Экспорт по умолчанию
class BluetoothService {
    constructor() {
        this.connectedDevice = null;
        this.server = null;
    }

    async connectToDevice() {
        try {
            if (!navigator.bluetooth) {
                throw new Error('Web Bluetooth не поддерживается вашим браузером. Используйте Chrome/Edge на Desktop.');
            }

            // Проверяем доступность Bluetooth
            const availability = await navigator.bluetooth.getAvailability();
            if (!availability) {
                throw new Error('Bluetooth адаптер недоступен. Проверьте, включен ли Bluetooth на устройстве.');
            }

            console.log('🔍 Поиск Bluetooth устройств...');

            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['battery_service', 'device_information', 'generic_access']
            });

            if (!device) {
                throw new Error('Устройство не выбрано');
            }

            console.log('✅ Устройство выбрано:', device.name);

            // 🔥 СОЗДАЕМ БАЗУ ДАННЫХ ДЛЯ УСТРОЙСТВА
            await this.createDeviceDatabase(device.name);

            // Подключаемся к GATT серверу
            console.log('🔗 Подключаемся к устройству...');
            this.server = await device.gatt.connect();
            
            // Сохраняем обработчик отключения
            device.addEventListener('gattserverdisconnected', this.handleDisconnect.bind(this));

            // Сохраняем в LocalStorage
            this.saveDeviceToStorage(device);
            this.connectedDevice = device;

            return {
                name: device.name || 'Unknown_Device',
                id: device.id,
                connectedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Bluetooth error:', error);
            if (error.name === 'NotFoundError') {
                throw new Error('Устройства Bluetooth не найдены. Убедитесь, что устройство включено и доступно для обнаружения.');
            } else if (error.name === 'SecurityError') {
                throw new Error('Ошибка безопасности. Проверьте разрешения браузера.');
            } else if (error.name === 'NetworkError') {
                throw new Error('Ошибка подключения. Устройство недоступно.');
            }
            throw error;
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Создание БД для устройства
    async createDeviceDatabase(deviceName) {
        try {
            console.log(`🔄 Создание БД для устройства: ${deviceName}`);
            
            const response = await fetch('https://192.168.99.14:3000/api/device/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    deviceName: deviceName
                })
            });

            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                console.log(`✅ БД создана: ${result.database}`);
                return result.database;
            } else {
                throw new Error(result.error || 'Ошибка создания БД');
            }
        } catch (error) {
            console.error('❌ Ошибка создания БД:', error);
            throw new Error(`Не удалось создать БД для устройства: ${error.message}`);
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Сохранение данных в БД устройства
    async saveToDatabase(sensorData) {
        if (!this.connectedDevice) {
            throw new Error('Устройство не подключено');
        }

        try {
            const deviceName = this.connectedDevice.name;
            const response = await fetch(`https://192.168.99.14:3000/api/device/${deviceName}/data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sensorData)
            });

            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Данные сохранены в БД:', result.data);
                return result.data;
            } else {
                throw new Error(result.error || 'Ошибка сохранения данных');
            }
        } catch (error) {
            console.error('❌ Ошибка сохранения данных:', error);
            throw error;
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Получение данных из БД устройства
    async getFromDatabase(limit = 50) {
        if (!this.connectedDevice) {
            throw new Error('Устройство не подключено');
        }

        try {
            const deviceName = this.connectedDevice.name;
            const response = await fetch(`https://192.168.99.14:3000/api/device/${deviceName}/data?limit=${limit}`);

            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                console.log(`✅ Получено ${result.data.length} записей из БД`);
                return result.data;
            } else {
                throw new Error(result.error || 'Ошибка получения данных');
            }
        } catch (error) {
            console.error('❌ Ошибка получения данных:', error);
            throw error;
        }
    }

    handleDisconnect() {
        console.log('⚠️ Устройство отключилось');
        this.connectedDevice = null;
        this.server = null;
    }

    async disconnect() {
        if (this.connectedDevice && this.connectedDevice.gatt.connected) {
            this.connectedDevice.gatt.disconnect();
        }
        this.connectedDevice = null;
        this.server = null;
        this.clearSavedDevice();
    }

    saveDeviceToStorage(device) {
        const deviceInfo = {
            name: device.name || 'Unknown_Device',
            id: device.id,
            connectedAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
        };

        localStorage.setItem('bluetooth_device', JSON.stringify(deviceInfo));
        console.log('💾 Устройство сохранено в LocalStorage:', deviceInfo.name);
    }

    getSavedDevice() {
        const saved = localStorage.getItem('bluetooth_device');
        return saved ? JSON.parse(saved) : null;
    }

    clearSavedDevice() {
        localStorage.removeItem('bluetooth_device');
        this.connectedDevice = null;
        this.server = null;
    }

    async readBatteryLevel() {
        try {
            if (!this.server) {
                throw new Error('Нет подключения к устройству');
            }

            const batteryService = await this.server.getPrimaryService('battery_service');
            const characteristic = await batteryService.getCharacteristic('battery_level');
            const value = await characteristic.readValue();
            return value.getUint8(0);
        } catch (error) {
            console.warn('Не удалось прочитать уровень батареи:', error);
            return null;
        }
    }

    // Проверка состояния подключения
    isConnected() {
        return this.connectedDevice && this.connectedDevice.gatt.connected;
    }

    // 🔥 НОВЫЙ МЕТОД: Получение имени подключенного устройства
    getConnectedDeviceName() {
        return this.connectedDevice ? this.connectedDevice.name : null;
    }
}

// Глобальный экземпляр
window.bluetoothService = new BluetoothService();
