class BluetoothBatteryMonitor {
    constructor() {
        this.device = null;
        this.server = null;
        this.batteryCharacteristic = null;
        this.isConnected = false;
        
        this.connectButton = document.getElementById('connectButton');
        this.disconnectButton = document.getElementById('disconnectButton');
        this.refreshButton = document.getElementById('refreshButton');
        this.statusDiv = document.getElementById('status');
        this.batteryLevelSpan = document.getElementById('batteryLevel');
        this.batteryFillDiv = document.getElementById('batteryFill');
        this.deviceNameSpan = document.getElementById('deviceName');
        this.deviceIdSpan = document.getElementById('deviceId');
        this.deviceInfoDiv = document.getElementById('deviceInfo');
        
        this.initializeEventListeners();
        this.checkBluetoothSupport();
    }
    
    initializeEventListeners() {
        this.connectButton.addEventListener('click', () => this.connectToDevice());
        this.disconnectButton.addEventListener('click', () => this.disconnectFromDevice());
        this.refreshButton.addEventListener('click', () => this.readBatteryLevel());
    }
    
    checkBluetoothSupport() {
        if (!navigator.bluetooth) {
            this.showError('Web Bluetooth не поддерживается вашим браузером');
            this.connectButton.disabled = true;
        }
    }
    
    async connectToDevice() {
        try {
            this.updateStatus('Поиск устройств...', 'disconnected');
            
            // Запрос устройства с сервисом батареи :cite[3]:cite[8]
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ services: ['battery_service'] }],
                optionalServices: ['battery_service', 'device_information']
            });
            
            this.updateStatus(`Подключение к ${this.device.name}...`, 'disconnected');
            
            // Подключение к GATT серверу
            this.server = await this.device.gatt.connect();
            
            // Обработчик отключения устройства
            this.device.addEventListener('gattserverdisconnected', () => {
                this.handleDisconnection();
            });
            
            // Получение сервиса батареи
            const batteryService = await this.server.getPrimaryService('battery_service');
            
            // Получение характеристики уровня батареи
            this.batteryCharacteristic = await batteryService.getCharacteristic('battery_level');
            
            this.isConnected = true;
            this.updateStatus(`Подключено к: ${this.device.name}`, 'connected');
            this.updateUI();
            
            // Чтение уровня батареи
            await this.readBatteryLevel();
            
            // Подписка на уведомления об изменении уровня батареи :cite[10]
            await this.batteryCharacteristic.startNotifications();
            this.batteryCharacteristic.addEventListener('characteristicvaluechanged', 
                (event) => this.handleBatteryLevelChange(event));
                
        } catch (error) {
            this.handleError(error);
        }
    }
    
    async readBatteryLevel() {
        if (!this.isConnected || !this.batteryCharacteristic) {
            this.showError('Не подключено к устройству');
            return;
        }
        
        try {
            const value = await this.batteryCharacteristic.readValue();
            const batteryLevel = value.getUint8(0);
            this.updateBatteryLevel(batteryLevel);
        } catch (error) {
            this.handleError(error);
        }
    }
    
    handleBatteryLevelChange(event) {
        const batteryLevel = event.target.value.getUint8(0);
        this.updateBatteryLevel(batteryLevel);
    }
    
    updateBatteryLevel(level) {
        this.batteryLevelSpan.textContent = level;
        this.batteryFillDiv.style.width = `${level}%`;
        
        // Изменение цвета в зависимости от уровня заряда
        if (level > 50) {
            this.batteryFillDiv.style.backgroundColor = '#4caf50'; // Зеленый
        } else if (level > 20) {
            this.batteryFillDiv.style.backgroundColor = '#ff9800'; // Оранжевый
        } else {
            this.batteryFillDiv.style.backgroundColor = '#f44336'; // Красный
        }
    }
    
    disconnectFromDevice() {
        if (this.device && this.device.gatt.connected) {
            this.device.gatt.disconnect();
        }
        this.handleDisconnection();
    }
    
    handleDisconnection() {
        this.isConnected = false;
        this.device = null;
        this.server = null;
        this.batteryCharacteristic = null;
        
        this.updateStatus('Отключено', 'disconnected');
        this.updateUI();
    }
    
    updateUI() {
        this.connectButton.disabled = this.isConnected;
        this.disconnectButton.disabled = !this.isConnected;
        this.refreshButton.disabled = !this.isConnected;
        
        if (this.isConnected && this.device) {
            this.deviceNameSpan.textContent = this.device.name;
            this.deviceIdSpan.textContent = this.device.id;
            this.deviceInfoDiv.style.display = 'block';
        } else {
            this.deviceInfoDiv.style.display = 'none';
            this.batteryLevelSpan.textContent = '-';
            this.batteryFillDiv.style.width = '0%';
        }
    }
    
    updateStatus(message, status) {
        this.statusDiv.textContent = message;
        this.statusDiv.className = `status ${status}`;
    }
    
    showError(message) {
        this.updateStatus(`Ошибка: ${message}`, 'error');
        console.error(message);
    }
    
    handleError(error) {
        let errorMessage = 'Неизвестная ошибка';
        
        if (error.name === 'NotFoundError') {
            errorMessage = 'Устройства с сервисом батареи не найдены';
        } else if (error.name === 'SecurityError') {
            errorMessage = 'Ошибка безопасности. Убедитесь, что страница загружена по HTTPS';
        } else if (error.name === 'NetworkError') {
            errorMessage = 'Сетевая ошибка. Устройство отключилось';
        } else {
            errorMessage = error.message;
        }
        
        this.showError(errorMessage);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new BluetoothBatteryMonitor();
});