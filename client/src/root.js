import React, { useState, useEffect, useCallback } from 'react';
import {
  FaBolt, FaChartLine, FaExclamationTriangle, FaHome, FaCheckCircle,
  FaTimesCircle, FaSync, FaBluetooth, FaPlug, FaClock, FaInfoCircle,
  FaDatabase, FaBatteryFull, FaBatteryThreeQuarters, FaBatteryHalf,
  FaBatteryQuarter, FaBatteryEmpty, FaBell, FaArrowUp, FaBellSlash
} from 'react-icons/fa';
import './root.css';

// Утилита exponential backoff с поддержкой пробуждения Bluetooth
const exponentialBackoff = async (maxAttempts, initialDelay, toTry, success, fail, bluetoothManager) => {
  let attempt = 0;

  const tryAttempt = async () => {
    try {
      if (bluetoothManager) {
        await bluetoothManager.wakeUpBluetooth();
      }
      const result = await toTry();
      success(result);
    } catch (err) {
      attempt++;
      console.log(`Ошибка при попытке: ${err.message}, retry через ${initialDelay}с (попытка ${attempt})`);
      if (bluetoothManager?.shouldRetry(err) && attempt < maxAttempts) {
        const delay = bluetoothManager.calculateDelay(attempt, err);
        setTimeout(tryAttempt, delay);
      } else {
        fail(err);
      }
    }
  };

  tryAttempt();
};

// Менеджер для пробуждения Bluetooth стека и поддержания соединения
class BluetoothReconnectManager {
  constructor() {
    this.reconnectAttempts = 0;
    this.isBluetoothAwake = false;
    this.keepAliveInterval = null;
  }

  async startPersistentBluetoothKeepAlive() {
    console.log('Запуск постоянного поддержания активности Bluetooth...');
    await this.wakeUpBluetooth();
    this.keepAliveInterval = setInterval(async () => {
      try {
        await this.intensiveWakeUpBluetooth();
        this.isBluetoothAwake = true;
      } catch (error) {
        console.log('Keep-alive ошибка:', error);
        this.isBluetoothAwake = false;
      }
    }, 8000);
    console.log('Постоянное поддержание активности Bluetooth запущено');
  }

  async intensiveWakeUpBluetooth() {
    try {
      await navigator.bluetooth.getAvailability();
      await new Promise(resolve => setTimeout(resolve, 50));
      await navigator.bluetooth.getDevices();
      await new Promise(resolve => setTimeout(resolve, 50));
      return true;
    } catch (error) {
      throw error;
    }
  }

  async wakeUpBluetooth() {
    console.log('Пробуждение Bluetooth стека...');
    for (let i = 0; i < 3; i++) {
      try {
        const isAvailable = await navigator.bluetooth.getAvailability();
        if (!isAvailable) {
          throw new Error('Bluetooth-адаптер недоступен');
        }
        const devices = await navigator.bluetooth.getDevices();
        console.log('Найдено ранее разрешенных устройств:', devices.length);
        await new Promise(resolve => setTimeout(resolve, 500));
        this.isBluetoothAwake = true;
        console.log('Bluetooth стек активирован');
        return true;
      } catch (error) {
        console.log(`Попытка ${i + 1} активации Bluetooth не удалась:`, error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    throw new Error('Не удалось активировать Bluetooth стек');
  }

  stopAll() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
      console.log('Процессы поддержания активности Bluetooth остановлены');
    }
  }

  shouldRetry(error) {
    const retryableErrors = [
      'not in range', 'no longer in range', 'not available',
      'device not found', 'gatt server not connected', 'network error', 'Таймаут'
    ];
    return retryableErrors.some(retryError =>
      error.message.toLowerCase().includes(retryError.toLowerCase())
    );
  }

  calculateDelay(attempt, error) {
    const baseDelay = 1000;
    if (error.message.includes('not in range') || error.message.includes('no longer in range')) {
      return Math.min(baseDelay * Math.pow(2, attempt) + 2000, 15000);
    }
    return Math.min(baseDelay * Math.pow(2, attempt), 10000);
  }

  async intensiveDeviceScan() {
    console.log('Интенсивный поиск устройства...');
    for (let i = 0; i < 5; i++) {
      try {
        const devices = await navigator.bluetooth.getDevices();
        console.log('Найдено устройств:', devices.length);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return true;
      } catch (error) {
        console.log(`Попытка ${i + 1} не удалась:`, error);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    throw new Error('Не удалось найти устройства');
  }
}

const RootPage = () => {
  const [isActive, setIsActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [deviceData, setDeviceData] = useState({
    serialNumber: '—',
    macAddress: '—',
    connectedTo: '—',
    connectionTime: '—'
  });
  const [devices, setDevices] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [error, setError] = useState('');
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [connectionTimer, setConnectionTimer] = useState(0);
  const [isSupported, setIsSupported] = useState(true);
  const [pushStatus, setPushStatus] = useState({ message: '', type: 'info' });
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [browserInfo, setBrowserInfo] = useState('');
  const [savedDeviceId, setSavedDeviceId] = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [databaseStatus, setDatabaseStatus] = useState('not_created');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationStatus, setNotificationStatus] = useState('Нет уведомлений');
  const [bluetoothManager] = useState(new BluetoothReconnectManager());

  // Загрузка сохраненного deviceId и уведомлений
  useEffect(() => {
    const savedId = localStorage.getItem('bluetoothDeviceId');
    if (savedId) {
      setSavedDeviceId(savedId);
      console.log('Найден сохраненный deviceId:', savedId);
    }

    if (!navigator.bluetooth) {
      setIsSupported(false);
      setError('Web Bluetooth не поддерживается вашим браузером');
    }

    const savedNotifications = localStorage.getItem('deviceNotifications');
    if (savedNotifications) {
      setNotifications(JSON.parse(savedNotifications));
      updateUnreadCount(JSON.parse(savedNotifications));
    }
  }, []);

  // Генерация уникального deviceId
  useEffect(() => {
    const generateDeviceId = () => {
      const userAgent = navigator.userAgent;
      const platform = navigator.platform;
      const language = navigator.language;
      const browserId = `${platform}-${language}-${userAgent.length}`;
      const hash = stringToHash(browserId);
      return `device-${hash}-${Date.now()}`;
    };

    const stringToHash = (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(36);
    };

    let storedId = localStorage.getItem('deviceId');
    if (!storedId) {
      storedId = generateDeviceId();
      localStorage.setItem('deviceId', storedId);
    }
    setDeviceId(storedId);
    const info = `${navigator.platform} - ${navigator.userAgent.split(' ')[0]}`;
    setBrowserInfo(info);
    console.log('Device ID:', storedId);
    console.log('Browser info:', info);
  }, []);

  // Проверка подписки
  useEffect(() => {
    const checkSubscription = async () => {
      if (!deviceId) return;
      try {
        const response = await fetch('/check-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId }),
        });
        if (response.ok) {
          const result = await response.json();
          setIsSubscribed(result.exists);
          if (result.exists) {
            updateStatus('Подписка активна для этого устройства', 'success');
          }
        }
      } catch (error) {
        console.error('Ошибка проверки подписки:', error);
      }
    };
    if (deviceId) checkSubscription();
  }, [deviceId]);

  // Таймер подключения
  useEffect(() => {
    let timer;
    if (connectionStatus === 'connected') {
      timer = setInterval(() => {
        setConnectionTimer(prev => prev + 1);
      }, 1000);
    } else {
      setConnectionTimer(0);
    }
    return () => clearInterval(timer);
  }, [connectionStatus]);

  // Интервал для проверки уведомлений
  useEffect(() => {
    const notificationInterval = setInterval(() => {
      if (connectedDevice && databaseStatus === 'created') {
        fetchDeviceNotifications();
      }
    }, 30000);
    return () => clearInterval(notificationInterval);
  }, [connectedDevice, databaseStatus]);

  // Инициализация Bluetooth и автопереподключение
  useEffect(() => {
    const initializeBluetoothSupport = async () => {
      await bluetoothManager.startPersistentBluetoothKeepAlive();
      if (savedDeviceId && !isActive) {
        console.log('Попытка автопереподключения...');
        autoReconnect();
      }
    };
    initializeBluetoothSupport();
    return () => bluetoothManager.stopAll();
  }, [bluetoothManager, savedDeviceId, isActive]);

  // Реакция на возвращение на вкладку
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        console.log('Вкладка активирована, пробуждаем Bluetooth...');
        await bluetoothManager.wakeUpBluetooth();
        if (savedDeviceId && !isActive && !isReconnecting) {
          setTimeout(() => autoReconnect(), 500);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isActive, isReconnecting, savedDeviceId]);

  // Проверка доступности Bluetooth
  useEffect(() => {
    const handleAvailabilityChanged = async (event) => {
      const isAvailable = event.target.value;
      console.log('Bluetooth availability changed:', isAvailable);
      if (!isAvailable) {
        setError('Bluetooth-адаптер отключен.');
        setConnectionStatus('disconnected');
        setIsActive(false);
        setIsReconnecting(false);
      } else {
        setError('');
        await bluetoothManager.wakeUpBluetooth();
        if (savedDeviceId && !isActive) autoReconnect();
      }
    };

    if (navigator.bluetooth) {
      navigator.bluetooth.addEventListener('availabilitychanged', handleAvailabilityChanged);
    }
    return () => {
      if (navigator.bluetooth) {
        navigator.bluetooth.removeEventListener('availabilitychanged', handleAvailabilityChanged);
      }
    };
  }, [bluetoothManager, savedDeviceId, isActive]);

  // Форматирование времени подключения
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}ч ${minutes}м ${secs}с`;
    if (minutes > 0) return `${minutes}м ${secs}с`;
    return `${secs}с`;
  };

  // Форматирование времени уведомлений
  const formatNotificationTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    return date.toLocaleDateString();
  };

  // Иконка уровня батареи
  const BatteryIcon = ({ level }) => {
    if (level >= 0.8) return <FaBatteryFull />;
    if (level >= 0.6) return <FaBatteryThreeQuarters />;
    if (level >= 0.4) return <FaBatteryHalf />;
    if (level >= 0.2) return <FaBatteryQuarter />;
    return <FaBatteryEmpty />;
  };

  // Обновление статуса
  const updateStatus = (message, type = 'info') => {
    setPushStatus({ message, type });
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  // Создание базы данных
  const createDeviceDatabase = async (deviceName) => {
    try {
      setDatabaseStatus('creating');
      console.log(`🔄 Создание БД для устройства: ${deviceName}`);
      const response = await fetch('https://192.168.99.14:3000/api/bluetooth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceName, deviceId, timestamp: new Date().toISOString() })
      });
      if (!response.ok) {
        throw new Error(`Ошибка HTTP: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        console.log(`✅ БД создана: ${result.database}`);
        setDatabaseStatus('created');
        updateStatus(`База данных создана: ${result.database}`, 'success');
        setTimeout(() => fetchDeviceNotifications(), 1000);
        return result.database;
      } else {
        throw new Error(result.error || 'Ошибка создания БД');
      }
    } catch (error) {
      console.error('❌ Ошибка создания БД:', error);
      setDatabaseStatus('error');
      updateStatus(`Ошибка создания БД: ${error.message}`, 'error');
      throw error;
    }
  };

  // Получение уведомлений
  const fetchDeviceNotifications = async () => {
    if (!connectedDevice) return;
    try {
      const deviceName = connectedDevice.name || 'unknown_device';
      const response = await fetch(`https://192.168.99.14:3000/api/bluetooth/${deviceName}/notifications?limit=10`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const newNotifications = result.data.map(notification => ({
            ...notification,
            id: notification.id || Date.now().toString(),
            timestamp: notification.timestamp || new Date().toISOString(),
            read: false
          }));
          const updatedNotifications = [...newNotifications, ...notifications]
            .filter((notification, index, self) =>
              index === self.findIndex(n => n.id === notification.id)
            )
            .slice(0, 20);
          setNotifications(updatedNotifications);
          updateUnreadCount(updatedNotifications);
          localStorage.setItem('deviceNotifications', JSON.stringify(updatedNotifications));
          updateStatus(`Получено ${newNotifications.length} уведомлений`, 'success');
        }
      }
    } catch (error) {
      console.error('Ошибка получения уведомлений:', error);
    }
  };

  // Обновление счетчика непрочитанных уведомлений
  const updateUnreadCount = (notificationsList) => {
    const unread = notificationsList.filter(notification => !notification.read).length;
    setUnreadCount(unread);
    setNotificationStatus(unread > 0 ? `Не прочитано: ${unread}` : 'Нет уведомлений');
  };

  // Отметить уведомление как прочитанное
  const markAsRead = (notificationId) => {
    const updatedNotifications = notifications.map(notification =>
      notification.id === notificationId ? { ...notification, read: true } : notification
    );
    setNotifications(updatedNotifications);
    updateUnreadCount(updatedNotifications);
    localStorage.setItem('deviceNotifications', JSON.stringify(updatedNotifications));
  };

  // Очистить все уведомления
  const clearAllNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
    setNotificationStatus('Нет уведомлений');
    localStorage.removeItem('deviceNotifications');
    updateStatus('Все уведомления очищены', 'success');
  };

  // Чтение уровня батареи
  const readBatteryLevel = useCallback(async (server) => {
    if (!server || !server.connected) return null;
    try {
      const batteryService = await server.getPrimaryService('battery_service');
      const characteristic = await batteryService.getCharacteristic('battery_level');
      const value = await characteristic.readValue();
      const level = value.getUint8(0) / 100;
      setBatteryLevel(level);
      return level;
    } catch (error) {
      console.warn('Не удалось прочитать уровень батареи:', error);
      return null;
    }
  }, []);

  // Отключение устройства
  const handleDisconnect = useCallback(() => {
    if (connectedDevice && connectedDevice.gatt) {
      connectedDevice.gatt.disconnect();
    }
    setConnectionStatus('disconnected');
    setIsActive(false);
    setConnectedDevice(null);
    setBatteryLevel(null);
    setDeviceData({
      serialNumber: '—',
      macAddress: '—',
      connectedTo: '—',
      connectionTime: '—'
    });
    setDatabaseStatus('not_created');
    console.log('Устройство отключено, но deviceId сохранен');
  }, [connectedDevice]);

  // Автопереподключение
  const autoReconnect = async () => {
    if (!savedDeviceId || isReconnecting) return;

    setIsReconnecting(true);
    setConnectionStatus('connecting');
    setError('');

    try {
      await bluetoothManager.wakeUpBluetooth();
      const devices = await navigator.bluetooth.getDevices();
      const device = devices.find(d => d.id === savedDeviceId);

      if (!device) {
        throw new Error('Устройство не найдено в разрешенных. Нажмите "Подключить".');
      }

      setConnectedDevice(device);
      console.log('Найдено сохранённое устройство:', device.name);

      if (!(await navigator.bluetooth.getAvailability())) {
        throw new Error('Bluetooth-адаптер недоступен.');
      }

      try {
        console.log('Запуск watchAdvertisements для проверки зоны...');
        const abortController = new AbortController();
        await device.watchAdvertisements({ signal: abortController.signal });

        const advertisementPromise = new Promise((resolve, reject) => {
          device.addEventListener('advertisementreceived', (evt) => {
            console.log('Advertisement received! Устройство в зоне.');
            abortController.abort();
            resolve(evt);
          });
          setTimeout(() => {
            abortController.abort();
            reject(new Error('Advertisement не получено в течение 10 сек.'));
          }, 10000);
        });

        await advertisementPromise;
      } catch (err) {
        console.log('Ошибка watchAdvertisements:', err);
        throw new Error('Устройство не активно или вне зоны действия.');
      }

      console.log('Попытка подключения после watchAdvertisements...');
      await new Promise((resolve, reject) => {
        exponentialBackoff(
          7,
          1500,
          () => Promise.race([
            device.gatt.connect(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('Таймаут подключения')), 10000))
          ]),
          async (server) => {
            setConnectionStatus('connected');
            setIsActive(true);
            setIsReconnecting(false);
            setDeviceData({
              serialNumber: device.id || '—',
              macAddress: '—',
              connectedTo: device.name || 'Неизвестное устройство',
              connectionTime: new Date().toLocaleTimeString()
            });
            await createDeviceDatabase(device.name);
            setTimeout(() => readBatteryLevel(server), 1000);
            device.addEventListener('gattserverdisconnected', handleDisconnect);
            console.log('✅ Переподключено к:', device.name);
            resolve();
          },
          async (err) => {
            console.log('Не удалось переподключиться:', err.message);
            if (!bluetoothManager.shouldRetry(err)) {
              localStorage.removeItem('bluetoothDeviceId');
              setSavedDeviceId(null);
              setError('Устройство не отвечает. Нажмите "Подключить".');
            }
            reject(err);
          },
          bluetoothManager
        );
      });
    } catch (err) {
      if (!err.message.includes('no longer in range') && !err.message.includes('Таймаут')) {
        setError(err.message);
      }
      setConnectionStatus('disconnected');
      setIsReconnecting(false);
    }
  };

  // Подключение к устройству
  const connectToDevice = async () => {
    setError('');
    setBatteryLevel(null);
    setDatabaseStatus('not_created');

    try {
      if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth API не поддерживается.');
      }

      setConnectionStatus('connecting');
      setIsScanning(true);
      await bluetoothManager.wakeUpBluetooth();

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['generic_access', 'battery_service', 'device_information']
      });

      if (!device) {
        setConnectionStatus('disconnected');
        setIsScanning(false);
        return;
      }

      setDevices([{
        id: device.id,
        name: device.name || 'Неизвестное устройство',
        connected: false,
        deviceObject: device
      }]);

      localStorage.setItem('bluetoothDeviceId', device.id);
      setSavedDeviceId(device.id);
      console.log('Device ID сохранен:', device.id);

      await new Promise((resolve, reject) => {
        exponentialBackoff(
          3,
          2000,
          () => Promise.race([
            device.gatt.connect(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('Таймаут подключения')), 10000))
          ]),
          async (server) => {
            setConnectionStatus('connected');
            setIsActive(true);
            setConnectedDevice(device);
            setDeviceData({
              serialNumber: device.id || '—',
              macAddress: '—',
              connectedTo: device.name || 'Неизвестное устройство',
              connectionTime: new Date().toLocaleTimeString()
            });
            await createDeviceDatabase(device.name);
            setTimeout(() => readBatteryLevel(server), 1000);
            device.addEventListener('gattserverdisconnected', handleDisconnect);
            console.log('✅ Успешно подключено к:', device.name);
            resolve();
          },
          (err) => {
            reject(err);
          },
          bluetoothManager
        );
      });
    } catch (err) {
      setError(err.name === 'NotFoundError' ? 'Устройства не найдены' : `Ошибка подключения: ${err.message}`);
      setConnectionStatus('disconnected');
      setIsActive(false);
    } finally {
      setIsScanning(false);
    }
  };

  // Очистка сохраненного deviceId
  const clearSavedDevice = useCallback(() => {
    localStorage.removeItem('bluetoothDeviceId');
    setSavedDeviceId(null);
    setError('Сохраненное устройство удалено');
    console.log('Device ID очищен');
  }, []);

  // Кнопка для отладки
  const openBluetoothInternals = () => {
    alert('Откройте chrome://bluetooth-internals/ в новой вкладке для проверки адаптера.');
  };

  // Управление уведомлениями
  const registerPush = async () => {
    setIsLoading(true);
    try {
      if (!deviceId) throw new Error('ID устройства не найден');
      if (!('Notification' in window)) throw new Error('Браузер не поддерживает уведомления');
      if (!('serviceWorker' in navigator)) throw new Error('Service Worker не поддерживается');

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Разрешение не получено');

      const registration = await navigator.serviceWorker.register('/service-worker.js');
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: 'BHBjxuWrOU0dXE_HRaL0N7QITNfspQbKNsdJ-LWqBHaFYqVyE0c3yttX-QJ1jEj0X38sn2ZByek1FTyGgRG41J8'
      });

      const response = await fetch('/web-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription,
          deviceId,
          browserInfo,
          timestamp: new Date().toISOString()
        }),
      });

      if (!response.ok) throw new Error('Ошибка сервера');

      setIsSubscribed(true);
      updateStatus('Подписка создана для ЭТОГО устройства', 'success');
    } catch (error) {
      console.error('Ошибка регистрации:', error);
      updateStatus(error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribePush = async () => {
    setIsLoading(true);
    try {
      if (!deviceId) throw new Error('ID устройства не найден');

      const response = await fetch('/web-push', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });

      if (!response.ok) throw new Error('Ошибка удаления подписки');

      setIsSubscribed(false);
      updateStatus('Подписка удалена для ЭТОГО устройства', 'success');
    } catch (error) {
      console.error('Ошибка отписки:', error);
      updateStatus(error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestNotification = async () => {
    setIsLoading(true);
    try {
      if (!deviceId) throw new Error('ID устройства не найден');

      const response = await fetch('/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          title: `Тест с ${navigator.platform}`,
          body: `Уведомление отправлено с этого устройства! Время: ${new Date().toLocaleTimeString()}`
        }),
      });

      if (!response.ok) throw new Error('Ошибка отправки уведомления');

      updateStatus('Уведомление отправлено НА ЭТО УСТРОЙСТВО', 'success');
    } catch (error) {
      console.error('Ошибка отправки:', error);
      updateStatus(error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Статус подключения
  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Подключено';
      case 'connecting':
        return isReconnecting ? 'Переподключение...' : 'Подключение...';
      default:
        return 'Не подключено';
    }
  };

  const getStatusClass = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'status-connected';
      case 'connecting':
        return 'status-connecting';
      default:
        return 'status-disconnected';
    }
  };

  const getDatabaseStatusText = () => {
    switch (databaseStatus) {
      case 'not_created':
        return 'БД не создана';
      case 'creating':
        return 'Создание БД...';
      case 'created':
        return 'БД создана';
      case 'error':
        return 'Ошибка создания БД';
      default:
        return 'Неизвестно';
    }
  };

  const InfoItem = ({ label, value, showPlaceholder = false }) => (
    <div className="info-item">
      <div className="info-label">{label}</div>
      <p>{showPlaceholder ? '—' : value}</p>
    </div>
  );

  return (
    <div className="app-root">
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo-icon"><FaBolt /></div>
        </div>
        <div className="sidebar-menu">
          <ul>
            <li><a href="/app-main"><FaHome /></a></li>
            <li><a href="/history"><FaBluetooth /></a></li>
            <li><a href="/root" className="active"><FaChartLine /></a></li>
          </ul>
        </div>
      </div>

      <div className="main-content">
        <div className="info-container">
          <div className="info-header">
            <div className="device-name">Настройки подключения Bluetooth</div>
            <div className="connection-status">
              <span className={getStatusClass()}>
                {connectionStatus === 'connected' ? <FaCheckCircle /> :
                 connectionStatus === 'connecting' ? <FaSync className="fa-spin" /> :
                 <FaTimesCircle />}
                {getStatusText()}
              </span>
            </div>
          </div>

          {error && (
            <div className="error-banner">
              <FaExclamationTriangle />
              <span>{error}</span>
            </div>
          )}

          {!isSupported && (
            <div className="warning-banner">
              <FaExclamationTriangle />
              <span>Web Bluetooth не поддерживается вашим браузером. Используйте Chrome или Edge.</span>
            </div>
          )}

          <div className="touch">
            <div className="oval-toggle" onClick={connectToDevice}>
              <div className={`toggle-track ${isActive ? 'active' : ''}`}>
                <div className="toggle-knob">{isActive ? 'ON' : 'OFF'}</div>
                <div className="running-dots">
                  <div className="running-dot dot-1"></div>
                  <div className="running-dot dot-2"></div>
                  <div className="running-dot dot-3"></div>
                  <div className="running-dot dot-4"></div>
                </div>
              </div>
              <p>{isActive ? 'Устройство подключено' : 'Нажмите для подключения'}</p>
            </div>
          </div>

          <div className="info-grid">
            <InfoItem
              label="Серийный номер"
              value={deviceData.serialNumber}
              showPlaceholder={!isActive}
            />
            <InfoItem
              label="MAC-адрес"
              value={deviceData.macAddress}
              showPlaceholder={!isActive}
            />
            <InfoItem
              label="Подключено к"
              value={deviceData.connectedTo}
              showPlaceholder={!isActive}
            />
            <InfoItem
              label="Время подключения"
              value={deviceData.connectionTime}
              showPlaceholder={!isActive}
            />
          </div>
        </div>

        {notifications.length > 0 && (
          <div className="notifications-list-container">
            <div className="notification-header">
              <h3>История уведомлений ({notifications.length})</h3>
              <button
                onClick={clearAllNotifications}
                className="btn-clear-all"
                title="Очистить все уведомления"
              >
                <FaTimesCircle /> Очистить все
              </button>
            </div>
            <div className="notifications-list">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="notification-content">
                    <div className="notification-title">
                      {notification.title || 'Новое уведомление'}
                    </div>
                    <div className="notification-body">
                      {notification.body || notification.message || 'Нет описания'}
                    </div>
                    <div className="notification-time">
                      {formatNotificationTime(notification.timestamp)}
                    </div>
                  </div>
                  {!notification.read && (
                    <div className="notification-indicator"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="notification-container">
          <div className="notification-header">
            <h3>Управление уведомлениями</h3>
          </div>
          <div className="notification-grid">
            <button
              onClick={registerPush}
              disabled={isSubscribed || isLoading}
              className={`notification-cell ${isSubscribed ? 'disabled' : 'primary'}`}
            >
              <div className="notification-icon">
                <FaBell />
              </div>
              <div className="notification-content">
                <span className="notification-label">Подписаться</span>
                <span className="notification-desc">Активировать уведомления</span>
              </div>
              {isLoading && <div className="notification-loader"></div>}
            </button>
            <button
              onClick={sendTestNotification}
              disabled={!isSubscribed || isLoading}
              className={`notification-cell ${!isSubscribed ? 'disabled' : 'success'}`}
            >
              <div className="notification-icon">
                <FaArrowUp />
              </div>
              <div className="notification-content">
                <span className="notification-label">Тест</span>
                <span className="notification-desc">Отправить тестовое уведомление</span>
              </div>
              {isLoading && <div className="notification-loader"></div>}
            </button>
            <button
              onClick={unsubscribePush}
              disabled={!isSubscribed || isLoading}
              className={`notification-cell ${!isSubscribed ? 'disabled' : 'danger'}`}
            >
              <div className="notification-icon">
                <FaBellSlash />
              </div>
              <div className="notification-content">
                <span className="notification-label">Отписаться</span>
                <span className="notification-desc">Отключить уведомления</span>
              </div>
              {isLoading && <div className="notification-loader"></div>}
            </button>
          </div>
        </div>

        {devices.length > 0 && !isActive && (
          <div className="devices-section">
            <h4>Найденные устройства ({devices.length})</h4>
            <div className="devices-list">
              {devices.map(device => (
                <div key={device.id} className="device-card">
                  <div className="device-info">
                    <h4>{device.name}</h4>
                    <span className="device-id">{device.id}</span>
                  </div>
                  <div className="device-actions">
                    <button
                      className="btn-connect"
                      onClick={connectToDevice}
                    >
                      <FaPlug /> Подключить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RootPage;



// import React, { useState, useEffect, useCallback } from 'react';
// import {
//   FaDownload, FaArrowUp, FaShieldAlt, FaArrowDown, FaCopy, FaBell, FaBellSlash,
//   FaHome, 
//   FaBolt, 
//   FaChartLine, 
//   FaExclamationTriangle, 
//   FaCog, 
//   FaQuestionCircle, 
//   FaSignOutAlt,
//   FaCheckCircle,
//   FaTimesCircle,
//   FaSync,
//   FaBluetooth,
//   FaSearch,
//   FaPlug,
//   FaBatteryFull,
//   FaBatteryThreeQuarters,
//   FaBatteryHalf,
//   FaBatteryQuarter,
//   FaBatteryEmpty,
//   FaClock,
//   FaInfoCircle
// } from 'react-icons/fa';
// import './root.css';

// const RootPage = () => {
//   const [isActive, setIsActive] = useState(false);
//   const [connectionStatus, setConnectionStatus] = useState('disconnected');
//   const [deviceData, setDeviceData] = useState({
//     serialNumber: '—',
//     macAddress: '—',
//     connectedTo: '—',
//     connectionTime: '—'
//   });
//   const [devices, setDevices] = useState([]);
//   const [isScanning, setIsScanning] = useState(false);
//   const [connectedDevice, setConnectedDevice] = useState(null);
//   const [error, setError] = useState('');
//   const [batteryLevel, setBatteryLevel] = useState(null);
//   const [connectionTimer, setConnectionTimer] = useState(0);
//   const [isSupported, setIsSupported] = useState(true);
//   const [pushStatus, setPushStatus] = useState({ message: '', type: 'info' });
//   const [isSubscribed, setIsSubscribed] = useState(false);
//   const [deviceId, setDeviceId] = useState(null);
//   const [isLoading, setIsLoading] = useState(false);
//   const [browserInfo, setBrowserInfo] = useState('');
//   const [savedDeviceId, setSavedDeviceId] = useState(null);
//   const [isReconnecting, setIsReconnecting] = useState(false);

//   // Загрузка сохраненного deviceId при монтировании компонента
//   useEffect(() => {
//     const savedId = localStorage.getItem('bluetoothDeviceId');
//     if (savedId) {
//       setSavedDeviceId(savedId);
//       console.log('Найден сохраненный deviceId:', savedId);
//     }

//     // Проверка поддержки Web Bluetooth
//     if (!navigator.bluetooth) {
//       setIsSupported(false);
//       setError('Web Bluetooth не поддерживается вашим браузером');
//     }
//   }, []);

//   // Таймер подключения
//   useEffect(() => {
//     let timer;
//     if (connectionStatus === 'connected') {
//       timer = setInterval(() => {
//         setConnectionTimer(prev => prev + 1);
//       }, 1000);
//     } else {
//       setConnectionTimer(0);
//     }

//     return () => clearInterval(timer);
//   }, [connectionStatus]);

//   // Генерация уникального deviceId на основе браузера и устройства
//   useEffect(() => {
//     const generateDeviceId = () => {
//       const userAgent = navigator.userAgent;
//       const platform = navigator.platform;
//       const language = navigator.language;
      
//       const browserId = `${platform}-${language}-${userAgent.length}`;
//       const hash = stringToHash(browserId);
      
//       return `device-${hash}-${Date.now()}`;
//     };

//     const stringToHash = (str) => {
//       let hash = 0;
//       for (let i = 0; i < str.length; i++) {
//         const char = str.charCodeAt(i);
//         hash = ((hash << 5) - hash) + char;
//         hash = hash & hash;
//       }
//       return Math.abs(hash).toString(36);
//     };

//     let storedId = localStorage.getItem('deviceId');
//     if (!storedId) {
//       storedId = generateDeviceId();
//       localStorage.setItem('deviceId', storedId);
//     }
    
//     setDeviceId(storedId);
    
//     const info = `${navigator.platform} - ${navigator.userAgent.split(' ')[0]}`;
//     setBrowserInfo(info);
    
//     console.log('Device ID:', storedId);
//     console.log('Browser info:', info);
//   }, []);

//   // Проверка существующей подписки
//   useEffect(() => {
//     const checkSubscription = async () => {
//       if (!deviceId) return;

//       try {
//         const response = await fetch('/check-subscription', {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify({ deviceId }),
//         });

//         if (response.ok) {
//           const result = await response.json();
//           setIsSubscribed(result.exists);
//           if (result.exists) {
//             updateStatus('Подписка активна для этого устройства', 'success');
//           }
//         }
//       } catch (error) {
//         console.error('Ошибка проверки подписки:', error);
//       }
//     };

//     if (deviceId) {
//       checkSubscription();
//     }
//   }, [deviceId]);

//   // Автопереподключение при загрузке страницы если есть сохраненный deviceId
//   useEffect(() => {
//     if (savedDeviceId && !isActive) {
//       console.log('Попытка автопереподключения...');
//       autoReconnect();
//     }
//   }, [savedDeviceId, isActive]);

//   // Форматирование времени подключения
//   const formatTime = (seconds) => {
//     const hours = Math.floor(seconds / 3600);
//     const minutes = Math.floor((seconds % 3600) / 60);
//     const secs = seconds % 60;
    
//     if (hours > 0) return `${hours}ч ${minutes}м ${secs}с`;
//     if (minutes > 0) return `${minutes}м ${secs}с`;
//     return `${secs}с`;
//   };

//   // Иконка уровня батареи
//   const BatteryIcon = ({ level }) => {
//     if (level >= 0.8) return <FaBatteryFull />;
//     if (level >= 0.6) return <FaBatteryThreeQuarters />;
//     if (level >= 0.4) return <FaBatteryHalf />;
//     if (level >= 0.2) return <FaBatteryQuarter />;
//     return <FaBatteryEmpty />;
//   };

//   // Чтение уровня батареи
//   const readBatteryLevel = useCallback(async (server) => {
//     if (!server || !server.connected) return null;
    
//     try {
//       const batteryService = await server.getPrimaryService('battery_service');
//       const characteristic = await batteryService.getCharacteristic('battery_level');
//       const value = await characteristic.readValue();
//       const level = value.getUint8(0) / 100;
//       setBatteryLevel(level);
//       return level;
//     } catch (error) {
//       console.warn('Не удалось прочитать уровень батареи:', error);
//       return null;
//     }
//   }, []);

//   // Отключение от устройства
//   const handleDisconnect = useCallback(() => {
//     if (connectedDevice && connectedDevice.gatt) {
//       connectedDevice.gatt.disconnect();
//     }
//     setConnectionStatus('disconnected');
//     setIsActive(false);
//     setConnectedDevice(null);
//     setBatteryLevel(null);
//     setDeviceData({
//       serialNumber: '—',
//       macAddress: '—',
//       connectedTo: '—',
//       connectionTime: '—'
//     });
    
//     console.log('Устройство отключено, но deviceId сохранен');
//   }, [connectedDevice]);

//   // Функция автоматического переподключения
//   const autoReconnect = useCallback(async () => {
//     if (!savedDeviceId || isReconnecting) return;

//     setIsReconnecting(true);
//     setConnectionStatus('connecting');
//     setError('');

//     try {
//       const devices = await navigator.bluetooth.getDevices();
//       const device = devices.find(d => d.id === savedDeviceId);
      
//       if (device) {
//         console.log('Найдено сохраненное устройство:', device.name);
        
//         const server = await device.gatt.connect();
        
//         setConnectionStatus('connected');
//         setIsActive(true);
//         setConnectedDevice(device);
        
//         setDeviceData({
//           serialNumber: device.id || '—',
//           macAddress: '—',
//           connectedTo: device.name || 'Неизвестное устройство',
//           connectionTime: new Date().toLocaleTimeString()
//         });

//         setTimeout(() => readBatteryLevel(server), 1000);

//         device.addEventListener('gattserverdisconnected', () => {
//           handleDisconnect();
//         });

//         console.log('Автопереподключение выполнено');
//       } else {
//         console.log('Сохраненное устройство не найдено в списке разрешенных');
//         setConnectionStatus('disconnected');
//       }
//     } catch (err) {
//       console.error('Ошибка автопереподключения:', err);
//       setError(`Ошибка переподключения: ${err.message}`);
//       setConnectionStatus('disconnected');
//     } finally {
//       setIsReconnecting(false);
//     }
//   }, [savedDeviceId, readBatteryLevel, handleDisconnect]);

//   // Подключение к устройству
//   const connectToDevice = useCallback(async () => {
//     setError('');
//     setBatteryLevel(null);

//     try {
//       setConnectionStatus('connecting');
      
//       const device = await navigator.bluetooth.requestDevice({
//         acceptAllDevices: true,
//         optionalServices: ['battery_service', 'device_information']
//       });

//       if (!device) {
//         setConnectionStatus('disconnected');
//         return;
//       }

//       // Сохраняем device.id в localStorage
//       localStorage.setItem('bluetoothDeviceId', device.id);
//       setSavedDeviceId(device.id);
//       console.log('Device ID сохранен:', device.id);

//       const server = await device.gatt.connect();
      
//       setConnectionStatus('connected');
//       setIsActive(true);
//       setConnectedDevice(device);
      
//       setDeviceData({
//         serialNumber: device.id || '—',
//         macAddress: '—',
//         connectedTo: device.name || 'Неизвестное устройство',
//         connectionTime: new Date().toLocaleTimeString()
//       });

//       setTimeout(() => readBatteryLevel(server), 1000);

//       device.addEventListener('gattserverdisconnected', () => {
//         handleDisconnect();
//       });

//     } catch (err) {
//       setError(`Ошибка подключения: ${err.message}`);
//       setConnectionStatus('disconnected');
//       setIsActive(false);
//     }
//   }, [readBatteryLevel, handleDisconnect]);

//   // Поиск Bluetooth-устройств
//   const scanDevices = useCallback(async () => {
//     if (!isSupported) return;

//     setIsScanning(true);
//     setError('');
//     setDevices([]);

//     try {
//       const device = await navigator.bluetooth.requestDevice({
//         acceptAllDevices: true,
//         optionalServices: ['battery_service', 'device_information']
//       });

//       if (device) {
//         setDevices([{
//           id: device.id,
//           name: device.name || 'Неизвестное устройство',
//           connected: false,
//           deviceObject: device
//         }]);
//       }
//     } catch (err) {
//       if (err.name === 'NotFoundError') {
//         setError('Устройства не найдены');
//       } else {
//         setError(`Ошибка поиска: ${err.message}`);
//       }
//     } finally {
//       setIsScanning(false);
//     }
//   }, [isSupported]);

//   const toggleButton = () => {
//     if (!isActive) {
//       connectToDevice();
//       localStorage.setItem('Bluetooth','ON');
//     } else {
//       handleDisconnect();
//       localStorage.setItem('Bluetooth','OFF');
//     }
//   };

//   // Очистка сохраненного deviceId
//   const clearSavedDevice = useCallback(() => {
//     localStorage.removeItem('bluetoothDeviceId');
//     setSavedDeviceId(null);
//     setError('Сохраненное устройство удалено');
//     console.log('Device ID очищен');
//   }, []);

//   const updateStatus = (message, type = 'info') => {
//     setPushStatus({ message, type });
//     console.log(`[${type.toUpperCase()}] ${message}`);
//   };

//   const registerPush = async () => {
//     setIsLoading(true);
//     try {
//       if (!deviceId) throw new Error('ID устройства не найден');
//       if (!('Notification' in window)) throw new Error('Браузер не поддерживает уведомления');
//       if (!('serviceWorker' in navigator)) throw new Error('Service Worker не поддерживается');

//       const permission = await Notification.requestPermission();
//       if (permission !== 'granted') throw new Error('Разрешение не получено');

//       const registration = await navigator.serviceWorker.register('/service-worker.js');
//       await navigator.serviceWorker.ready;

//       const subscription = await registration.pushManager.subscribe({
//         userVisibleOnly: true,
//         applicationServerKey: 'BHBjxuWrOU0dXE_HRaL0N7QITNfspQbKNsdJ-LWqBHaFYqVyE0c3yttX-QJ1jEj0X38sn2ZByek1FTyGgRG41J8'
//       });

//       const response = await fetch('/web-push', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           subscription,
//           deviceId,
//           browserInfo,
//           timestamp: new Date().toISOString()
//         }),
//       });

//       if (!response.ok) throw new Error('Ошибка сервера');

//       setIsSubscribed(true);
//       updateStatus('Подписка создана для ЭТОГО устройства', 'success');

//     } catch (error) {
//       console.error('Ошибка регистрации:', error);
//       updateStatus(error.message, 'error');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const unsubscribePush = async () => {
//     setIsLoading(true);
//     try {
//       if (!deviceId) throw new Error('ID устройства не найден');

//       const response = await fetch('/web-push', {
//         method: 'DELETE',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ deviceId }),
//       });

//       if (!response.ok) throw new Error('Ошибка удаления подписки');

//       setIsSubscribed(false);
//       updateStatus('Подписка удалена для ЭТОГО устройства', 'success');

//     } catch (error) {
//       console.error('Ошибка отписки:', error);
//       updateStatus(error.message, 'error');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const sendTestNotification = async () => {
//     setIsLoading(true);
//     try {
//       if (!deviceId) throw new Error('ID устройства не найден');

//       const response = await fetch('/send-notification', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           deviceId,
//           title: `Тест с ${navigator.platform}`,
//           body: `Уведомление отправлено с этого устройства! Время: ${new Date().toLocaleTimeString()}`
//         }),
//       });

//       if (!response.ok) throw new Error('Ошибка отправки уведомления');

//       updateStatus('Уведомление отправлено НА ЭТО УСТРОЙСТВО', 'success');

//     } catch (error) {
//       console.error('Ошибка отправки:', error);
//       updateStatus(error.message, 'error');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const copyDeviceId = () => {
//     navigator.clipboard.writeText(deviceId);
//     updateStatus('ID устройства скопирован', 'success');
//   };

//   const refreshDeviceId = () => {
//     const newId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
//     localStorage.setItem('deviceId', newId);
//     setDeviceId(newId);
//     setIsSubscribed(false);
//     updateStatus('ID устройства обновлен', 'success');
//   };

//   // Функция для получения статуса подключения в текстовом формате
//   const getStatusText = () => {
//     switch(connectionStatus) {
//       case 'connected':
//         return 'Подключено';
//       case 'connecting':
//         return isReconnecting ? 'Переподключение...' : 'Подключение...';
//       default:
//         return 'Не подключено';
//     }
//   };

//   // Функция для получения класса статуса подключения
//   const getStatusClass = () => {
//     switch(connectionStatus) {
//       case 'connected':
//         return 'status-connected';
//       case 'connecting':
//         return 'status-connecting';
//       default:
//         return 'status-disconnected';
//     }
//   };

//   const InfoItem = ({ label, value, showPlaceholder = false }) => (
//     <div className="info-item">
//       <div className="info-label">{label}</div>
//       <p>{showPlaceholder ? '—' : value}</p>
//     </div>
//   );

//   return (
//     <div className="app-root">
//       <div className="sidebar">
//         <div className="sidebar-header">
//           <div className="logo-icon"><FaBolt/></div>
//         </div>
//         <div className="sidebar-menu">
//           <ul>
//             <li><a href="/app-main">
//               <FaHome /> 
//             </a></li>
//             <li><a href="/history">
//               <FaBolt /> 
//             </a></li>
//             <li><a href="/root" className="active">
//               <FaChartLine /> 
//             </a></li>
//           </ul>
//         </div>
//       </div>

//       <div className="main-content">
//         <div className="info-container">
//           <div className="info-header">
//             <div className="device-name">Настройки подключения</div>
//             <div className="connection-status">
//               <span className={getStatusClass()}>
//                 {connectionStatus === 'connected' ? <FaCheckCircle /> : 
//                  connectionStatus === 'connecting' ? <FaSync className="fa-spin" /> : 
//                  <FaTimesCircle />}
//                 {getStatusText()}
//               </span>
//             </div>
//           </div>

//           {error && (
//             <div className="error-banner">
//               <FaExclamationTriangle />
//               <span>{error}</span>
//             </div>
//           )}

//           {!isSupported && (
//             <div className="warning-banner">
//               <FaExclamationTriangle />
//               <span>Web Bluetooth не поддерживается вашим браузером. Используйте Chrome или Edge.</span>
//             </div>
//           )}

//           {savedDeviceId && (
//             <div className="saved-device-info">
//               <div className="status-item">
//                 <FaInfoCircle />
//                 <span>Сохраненное устройство: {savedDeviceId.substring(0, 8)}...</span>
//                 <button 
//                   onClick={clearSavedDevice}
//                   className="btn-clear"
//                   title="Удалить сохраненное устройство"
//                 >
//                   <FaTimesCircle />
//                 </button>
//               </div>
//             </div>
//           )}
          
//           <div className="touch">  
//             <div className="oval-toggle" onClick={toggleButton}>
//               <div className={`toggle-track ${isActive ? 'active' : ''}`}>
//                 <div className="toggle-knob">{isActive ? 'ON' : 'OFF'}</div>
//                 <div className="running-dots">
//                   <div className="running-dot dot-1"></div>
//                   <div className="running-dot dot-2"></div>
//                   <div className="running-dot dot-3"></div>
//                   <div className="running-dot dot-4"></div>
//                 </div>
//               </div>
//               <p>{isActive ? 'Устройство подключено' : 'Нажмите для подключения'}</p>
//             </div>
//           </div>

//           {connectionStatus === 'connected' && (
//             <div className="connection-status-panel">
//               <div className="status-item">
//                 <FaClock />
//                 <span>Время подключения: {formatTime(connectionTimer)}</span>
//               </div>
              
//               {batteryLevel !== null && (
//                 <div className="status-item">
//                   <BatteryIcon level={batteryLevel} />
//                   <span>Заряд: {Math.round(batteryLevel * 100)}%</span>
//                 </div>
//               )}
//             </div>
//           )}

//           <div className="info-grid">
//             <InfoItem 
//               label="Серийный номер" 
//               value={deviceData.serialNumber} 
//               showPlaceholder={!isActive}
//             />
//             <InfoItem 
//               label="MAC-адрес" 
//               value={deviceData.macAddress} 
//               showPlaceholder={!isActive}
//             />
//             <InfoItem 
//               label="Подключено к" 
//               value={deviceData.connectedTo} 
//               showPlaceholder={!isActive}
//             />
//             <InfoItem 
//               label="Время подключения" 
//               value={deviceData.connectionTime} 
//               showPlaceholder={!isActive}
//             />
//           </div>
//         </div>

//         <div className="notification-container">
//           <div className="notification-header">
//             <h3>Управление уведомлениями</h3>
//           </div>
          
//           <div className="notification-grid">
//             <button 
//               onClick={registerPush} 
//               disabled={isSubscribed || isLoading}
//               className={`notification-cell ${isSubscribed ? 'disabled' : 'primary'}`}
//             >
//               <div className="notification-icon">
//                 <FaBell />
//               </div>
//               <div className="notification-content">
//                 <span className="notification-label">Подписаться</span>
//                 <span className="notification-desc">Активировать уведомления</span>
//               </div>
//               {isLoading && <div className="notification-loader"></div>}
//             </button>
            
//             <button 
//               onClick={sendTestNotification} 
//               disabled={!isSubscribed || isLoading}
//               className={`notification-cell ${!isSubscribed ? 'disabled' : 'success'}`}
//             >
//               <div className="notification-icon">
//                 <FaArrowUp />
//               </div>
//               <div className="notification-content">
//                 <span className="notification-label">Тест</span>
//                 <span className="notification-desc">Отправить тестовое уведомление</span>
//               </div>
//               {isLoading && <div className="notification-loader"></div>}
//             </button>
            
//             <button 
//               onClick={unsubscribePush} 
//               disabled={!isSubscribed || isLoading}
//               className={`notification-cell ${!isSubscribed ? 'disabled' : 'danger'}`}
//             >
//               <div className="notification-icon">
//                 <FaBellSlash />
//               </div>
//               <div className="notification-content">
//                 <span className="notification-label">Отписаться</span>
//                 <span className="notification-desc">Отключить уведомления</span>
//               </div>
//               {isLoading && <div className="notification-loader"></div>}
//             </button>
//           </div>
//         </div>

//         {devices.length > 0 && !isActive && (
//           <div className="devices-section">
//             <h4>Найденные устройства ({devices.length})</h4>
//             <div className="devices-list">
//               {devices.map(device => (
//                 <div key={device.id} className="device-card">
//                   <div className="device-info">
//                     <h4>{device.name}</h4>
//                     <span className="device-id">{device.id}</span>
//                   </div>
//                   <div className="device-actions">
//                     <button 
//                       className="btn-connect"
//                       onClick={connectToDevice}
//                     >
//                       <FaPlug />
//                       Подключить
//                     </button>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default RootPage;


// import React, { useState, useEffect, useCallback } from 'react';
// import {
//   FaDownload, FaArrowUp, FaShieldAlt, FaArrowDown, FaCopy, FaBell, FaBellSlash,
//   FaHome, 
//   FaBolt, 
//   FaChartLine, 
//   FaExclamationTriangle, 
//   FaCog, 
//   FaQuestionCircle, 
//   FaSignOutAlt,
//   FaCheckCircle,
//   FaTimesCircle,
//   FaSync,
//   FaBluetooth,
//   FaSearch,
//   FaPlug,
//   FaClock,
//   FaInfoCircle,
//   FaDatabase
// } from 'react-icons/fa';
// import './root.css';

// // const RootPage = () => {
// //   const [isActive, setIsActive] = useState(false);
// //   const [connectionStatus, setConnectionStatus] = useState('disconnected');
// //   const [deviceData, setDeviceData] = useState({
// //     serialNumber: '—',
// //     macAddress: '—',
// //     connectedTo: '—',
// //     connectionTime: '—'
// //   });
// //   const [devices, setDevices] = useState([]);
// //   const [isScanning, setIsScanning] = useState(false);
// //   const [connectedDevice, setConnectedDevice] = useState(null);
// //   const [error, setError] = useState('');
// //   const [connectionTimer, setConnectionTimer] = useState(0);
// //   const [isSupported, setIsSupported] = useState(true);
// //   const [pushStatus, setPushStatus] = useState({ message: '', type: 'info' });
// //   const [isSubscribed, setIsSubscribed] = useState(false);
// //   const [deviceId, setDeviceId] = useState(null);
// //   const [isLoading, setIsLoading] = useState(false);
// //   const [browserInfo, setBrowserInfo] = useState('');
// //   const [savedDeviceId, setSavedDeviceId] = useState(null);
// //   const [isReconnecting, setIsReconnecting] = useState(false);
// //   const [databaseStatus, setDatabaseStatus] = useState('not_created');

// //   // Загрузка сохраненного deviceId при монтировании компонента
// //   useEffect(() => {
// //     const savedId = localStorage.getItem('bluetoothDeviceId');
// //     if (savedId) {
// //       setSavedDeviceId(savedId);
// //       console.log('Найден сохраненный deviceId:', savedId);
// //     }

// //     // Проверка поддержки Web Bluetooth
// //     if (!navigator.bluetooth) {
// //       setIsSupported(false);
// //       setError('Web Bluetooth не поддерживается вашим браузером');
// //     }
// //   }, []);

// //   // Таймер подключения
// //   useEffect(() => {
// //     let timer;
// //     if (connectionStatus === 'connected') {
// //       timer = setInterval(() => {
// //         setConnectionTimer(prev => prev + 1);
// //       }, 1000);
// //     } else {
// //       setConnectionTimer(0);
// //     }

// //     return () => clearInterval(timer);
// //   }, [connectionStatus]);

// //   // Генерация уникального deviceId на основе браузера и устройства
// //   useEffect(() => {
// //     const generateDeviceId = () => {
// //       const userAgent = navigator.userAgent;
// //       const platform = navigator.platform;
// //       const language = navigator.language;
      
// //       const browserId = `${platform}-${language}-${userAgent.length}`;
// //       const hash = stringToHash(browserId);
      
// //       return `device-${hash}-${Date.now()}`;
// //     };

// //     const stringToHash = (str) => {
// //       let hash = 0;
// //       for (let i = 0; i < str.length; i++) {
// //         const char = str.charCodeAt(i);
// //         hash = ((hash << 5) - hash) + char;
// //         hash = hash & hash;
// //       }
// //       return Math.abs(hash).toString(36);
// //     };

// //     let storedId = localStorage.getItem('deviceId');
// //     if (!storedId) {
// //       storedId = generateDeviceId();
// //       localStorage.setItem('deviceId', storedId);
// //     }
    
// //     setDeviceId(storedId);
    
// //     const info = `${navigator.platform} - ${navigator.userAgent.split(' ')[0]}`;
// //     setBrowserInfo(info);
    
// //     console.log('Device ID:', storedId);
// //     console.log('Browser info:', info);
// //   }, []);

// //   // Проверка существующей подписки
// //   useEffect(() => {
// //     const checkSubscription = async () => {
// //       if (!deviceId) return;

// //       try {
// //         const response = await fetch('/check-subscription', {
// //           method: 'POST',
// //           headers: { 'Content-Type': 'application/json' },
// //           body: JSON.stringify({ deviceId }),
// //         });

// //         if (response.ok) {
// //           const result = await response.json();
// //           setIsSubscribed(result.exists);
// //           if (result.exists) {
// //             updateStatus('Подписка активна для этого устройства', 'success');
// //           }
// //         }
// //       } catch (error) {
// //         console.error('Ошибка проверки подписки:', error);
// //       }
// //     };

// //     if (deviceId) {
// //       checkSubscription();
// //     }
// //   }, [deviceId]);

// //   // Автопереподключение при загрузке страницы если есть сохраненный deviceId
// //   useEffect(() => {
// //     if (savedDeviceId && !isActive) {
// //       console.log('Попытка автопереподключения...');
// //       autoReconnect();
// //     }
// //   }, [savedDeviceId, isActive]);

// //   // Форматирование времени подключения
// //   const formatTime = (seconds) => {
// //     const hours = Math.floor(seconds / 3600);
// //     const minutes = Math.floor((seconds % 3600) / 60);
// //     const secs = seconds % 60;
    
// //     if (hours > 0) return `${hours}ч ${minutes}м ${secs}с`;
// //     if (minutes > 0) return `${minutes}м ${secs}с`;
// //     return `${secs}с`;
// //   };

// //   // 🔥 ФУНКЦИЯ СОЗДАНИЯ БАЗЫ ДАННЫХ ДЛЯ УСТРОЙСТВА
// //   const createDeviceDatabase = async (deviceName) => {
// //     try {
// //       setDatabaseStatus('creating');
// //       console.log(`🔄 Создание БД для устройства: ${deviceName}`);
      
// //       const response = await fetch('https://192.168.99.14:3000/api/device/connect', {
// //         method: 'POST',
// //         headers: {
// //           'Content-Type': 'application/json',
// //         },
// //         body: JSON.stringify({
// //           deviceName: deviceName
// //         })
// //       });

// //       if (!response.ok) {
// //         throw new Error(`Ошибка HTTP: ${response.status}`);
// //       }

// //       const result = await response.json();
      
// //       if (result.success) {
// //         console.log(`✅ БД создана: ${result.database}`);
// //         setDatabaseStatus('created');
// //         updateStatus(`База данных создана: ${result.database}`, 'success');
// //         return result.database;
// //       } else {
// //         throw new Error(result.error || 'Ошибка создания БД');
// //       }
// //     } catch (error) {
// //       console.error('❌ Ошибка создания БД:', error);
// //       setDatabaseStatus('error');
// //       updateStatus(`Ошибка создания БД: ${error.message}`, 'error');
// //       throw error;
// //     }
// //   };

// //   // Отключение от устройства
// //   const handleDisconnect = useCallback(() => {
// //     if (connectedDevice && connectedDevice.gatt) {
// //       connectedDevice.gatt.disconnect();
// //     }
// //     setConnectionStatus('disconnected');
// //     setIsActive(false);
// //     setConnectedDevice(null);
// //     setDeviceData({
// //       serialNumber: '—',
// //       macAddress: '—',
// //       connectedTo: '—',
// //       connectionTime: '—'
// //     });
// //     setDatabaseStatus('not_created');
    
// //     console.log('Устройство отключено, но deviceId сохранен');
// //   }, [connectedDevice]);

// //   // Функция автоматического переподключения
// //   const autoReconnect = useCallback(async () => {
// //     if (!savedDeviceId || isReconnecting) return;

// //     setIsReconnecting(true);
// //     setConnectionStatus('connecting');
// //     setError('');

// //     try {
// //       const devices = await navigator.bluetooth.getDevices();
// //       const device = devices.find(d => d.id === savedDeviceId);
      
// //       if (device) {
// //         console.log('Найдено сохраненное устройство:', device.name);
        
// //         const server = await device.gatt.connect();
        
// //         setConnectionStatus('connected');
// //         setIsActive(true);
// //         setConnectedDevice(device);
        
// //         setDeviceData({
// //           serialNumber: device.id || '—',
// //           macAddress: '—',
// //           connectedTo: device.name || 'Неизвестное устройство',
// //           connectionTime: new Date().toLocaleTimeString()
// //         });

// //         // 🔥 СОЗДАЕМ БАЗУ ДАННЫХ ПРИ ПЕРЕПОДКЛЮЧЕНИИ
// //         await createDeviceDatabase(device.name);

// //         device.addEventListener('gattserverdisconnected', () => {
// //           handleDisconnect();
// //         });

// //         console.log('Автопереподключение выполнено');
// //       } else {
// //         console.log('Сохраненное устройство не найдено в списке разрешенных');
// //         setConnectionStatus('disconnected');
// //       }
// //     } catch (err) {
// //       console.error('Ошибка автопереподключения:', err);
// //       setError(`Ошибка переподключения: ${err.message}`);
// //       setConnectionStatus('disconnected');
// //     } finally {
// //       setIsReconnecting(false);
// //     }
// //   }, [savedDeviceId, handleDisconnect]);

// //   // Подключение к устройству
// //   const connectToDevice = useCallback(async () => {
// //     setError('');
// //     setDatabaseStatus('not_created');

// //     try {
// //       setConnectionStatus('connecting');
      
// //       const device = await navigator.bluetooth.requestDevice({
// //         acceptAllDevices: true,
// //         optionalServices: ['battery_service', 'device_information']
// //       });

// //       if (!device) {
// //         setConnectionStatus('disconnected');
// //         return;
// //       }

// //       // Сохраняем device.id в localStorage
// //       localStorage.setItem('bluetoothDeviceId', device.id);
// //       setSavedDeviceId(device.id);
// //       console.log('Device ID сохранен:', device.id);

// //       const server = await device.gatt.connect();
      
// //       setConnectionStatus('connected');
// //       setIsActive(true);
// //       setConnectedDevice(device);
      
// //       setDeviceData({
// //         serialNumber: device.id || '—',
// //         macAddress: '—',
// //         connectedTo: device.name || 'Неизвестное устройство',
// //         connectionTime: new Date().toLocaleTimeString()
// //       });

// //       // 🔥 СОЗДАЕМ БАЗУ ДАННЫХ ДЛЯ УСТРОЙСТВА
// //       await createDeviceDatabase(device.name);

// //       device.addEventListener('gattserverdisconnected', () => {
// //         handleDisconnect();
// //       });

// //     } catch (err) {
// //       setError(`Ошибка подключения: ${err.message}`);
// //       setConnectionStatus('disconnected');
// //       setIsActive(false);
// //     }
// //   }, [handleDisconnect]);

// //   // Поиск Bluetooth-устройств
// //   const scanDevices = useCallback(async () => {
// //     if (!isSupported) return;

// //     setIsScanning(true);
// //     setError('');
// //     setDevices([]);

// //     try {
// //       const device = await navigator.bluetooth.requestDevice({
// //         acceptAllDevices: true,
// //         optionalServices: ['battery_service', 'device_information']
// //       });

// //       if (device) {
// //         setDevices([{
// //           id: device.id,
// //           name: device.name || 'Неизвестное устройство',
// //           connected: false,
// //           deviceObject: device
// //         }]);
// //       }
// //     } catch (err) {
// //       if (err.name === 'NotFoundError') {
// //         setError('Устройства не найдены');
// //       } else {
// //         setError(`Ошибка поиска: ${err.message}`);
// //       }
// //     } finally {
// //       setIsScanning(false);
// //     }
// //   }, [isSupported]);

// //   const toggleButton = () => {
// //     if (!isActive) {
// //       connectToDevice();
// //       localStorage.setItem('Bluetooth','ON');
// //     } else {
// //       handleDisconnect();
// //       localStorage.setItem('Bluetooth','OFF');
// //     }
// //   };

// //   // Очистка сохраненного deviceId
// //   const clearSavedDevice = useCallback(() => {
// //     localStorage.removeItem('bluetoothDeviceId');
// //     setSavedDeviceId(null);
// //     setError('Сохраненное устройство удалено');
// //     console.log('Device ID очищен');
// //   }, []);

// //   const updateStatus = (message, type = 'info') => {
// //     setPushStatus({ message, type });
// //     console.log(`[${type.toUpperCase()}] ${message}`);
// //   };

// //   const registerPush = async () => {
// //     setIsLoading(true);
// //     try {
// //       if (!deviceId) throw new Error('ID устройства не найден');
// //       if (!('Notification' in window)) throw new Error('Браузер не поддерживает уведомления');
// //       if (!('serviceWorker' in navigator)) throw new Error('Service Worker не поддерживается');

// //       const permission = await Notification.requestPermission();
// //       if (permission !== 'granted') throw new Error('Разрешение не получено');

// //       const registration = await navigator.serviceWorker.register('/service-worker.js');
// //       await navigator.serviceWorker.ready;

// //       const subscription = await registration.pushManager.subscribe({
// //         userVisibleOnly: true,
// //         applicationServerKey: 'BHBjxuWrOU0dXE_HRaL0N7QITNfspQbKNsdJ-LWqBHaFYqVyE0c3yttX-QJ1jEj0X38sn2ZByek1FTyGgRG41J8'
// //       });

// //       const response = await fetch('/web-push', {
// //         method: 'POST',
// //         headers: { 'Content-Type': 'application/json' },
// //         body: JSON.stringify({
// //           subscription,
// //           deviceId,
// //           browserInfo,
// //           timestamp: new Date().toISOString()
// //         }),
// //       });

// //       if (!response.ok) throw new Error('Ошибка сервера');

// //       setIsSubscribed(true);
// //       updateStatus('Подписка создана для ЭТОГО устройства', 'success');

// //     } catch (error) {
// //       console.error('Ошибка регистрации:', error);
// //       updateStatus(error.message, 'error');
// //     } finally {
// //       setIsLoading(false);
// //     }
// //   };

// //   const unsubscribePush = async () => {
// //     setIsLoading(true);
// //     try {
// //       if (!deviceId) throw new Error('ID устройства не найден');

// //       const response = await fetch('/web-push', {
// //         method: 'DELETE',
// //         headers: { 'Content-Type': 'application/json' },
// //         body: JSON.stringify({ deviceId }),
// //       });

// //       if (!response.ok) throw new Error('Ошибка удаления подписки');

// //       setIsSubscribed(false);
// //       updateStatus('Подписка удалена для ЭТОГО устройства', 'success');

// //     } catch (error) {
// //       console.error('Ошибка отписки:', error);
// //       updateStatus(error.message, 'error');
// //     } finally {
// //       setIsLoading(false);
// //     }
// //   };

// //   const sendTestNotification = async () => {
// //     setIsLoading(true);
// //     try {
// //       if (!deviceId) throw new Error('ID устройства не найден');

// //       const response = await fetch('/send-notification', {
// //         method: 'POST',
// //         headers: { 'Content-Type': 'application/json' },
// //         body: JSON.stringify({
// //           deviceId,
// //           title: `Тест с ${navigator.platform}`,
// //           body: `Уведомление отправлено с этого устройства! Время: ${new Date().toLocaleTimeString()}`
// //         }),
// //       });

// //       if (!response.ok) throw new Error('Ошибка отправки уведомления');

// //       updateStatus('Уведомление отправлено НА ЭТО УСТРОЙСТВО', 'success');

// //     } catch (error) {
// //       console.error('Ошибка отправки:', error);
// //       updateStatus(error.message, 'error');
// //     } finally {
// //       setIsLoading(false);
// //     }
// //   };

// //   const copyDeviceId = () => {
// //     navigator.clipboard.writeText(deviceId);
// //     updateStatus('ID устройства скопирован', 'success');
// //   };

// //   const refreshDeviceId = () => {
// //     const newId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
// //     localStorage.setItem('deviceId', newId);
// //     setDeviceId(newId);
// //     setIsSubscribed(false);
// //     updateStatus('ID устройства обновлен', 'success');
// //   };

// //   // Функция для получения статуса подключения в текстовом формате
// //   const getStatusText = () => {
// //     switch(connectionStatus) {
// //       case 'connected':
// //         return 'Подключено';
// //       case 'connecting':
// //         return isReconnecting ? 'Переподключение...' : 'Подключение...';
// //       default:
// //         return 'Не подключено';
// //     }
// //   };

// //   // Функция для получения класса статуса подключения
// //   const getStatusClass = () => {
// //     switch(connectionStatus) {
// //       case 'connected':
// //         return 'status-connected';
// //       case 'connecting':
// //         return 'status-connecting';
// //       default:
// //         return 'status-disconnected';
// //     }
// //   };

// //   // 🔥 ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ СТАТУСА БАЗЫ ДАННЫХ
// //   const getDatabaseStatusText = () => {
// //     switch(databaseStatus) {
// //       case 'not_created':
// //         return 'БД не создана';
// //       case 'creating':
// //         return 'Создание БД...';
// //       case 'created':
// //         return 'БД создана';
// //       case 'error':
// //         return 'Ошибка создания БД';
// //       default:
// //         return 'Неизвестно';
// //     }
// //   };

// //   const InfoItem = ({ label, value, showPlaceholder = false }) => (
// //     <div className="info-item">
// //       <div className="info-label">{label}</div>
// //       <p>{showPlaceholder ? '—' : value}</p>
// //     </div>
// //   );

// //   return (
// //     <div className="app-root">
// //       <div className="sidebar">
// //         <div className="sidebar-header">
// //           <div className="logo-icon"><FaBolt/></div>
// //         </div>
// //         <div className="sidebar-menu">
// //           <ul>
// //             <li><a href="/app-main">
// //               <FaHome /> 
// //             </a></li>
// //             <li><a href="/history">
// //               <FaBolt /> 
// //             </a></li>
// //             <li><a href="/root" className="active">
// //               <FaChartLine /> 
// //             </a></li>
// //           </ul>
// //         </div>
// //       </div>

// //       <div className="main-content">
// //         <div className="info-container">
// //           <div className="info-header">
// //             <div className="device-name">Настройки подключения</div>
// //             <div className="connection-status">
// //               <span className={getStatusClass()}>
// //                 {connectionStatus === 'connected' ? <FaCheckCircle /> : 
// //                  connectionStatus === 'connecting' ? <FaSync className="fa-spin" /> : 
// //                  <FaTimesCircle />}
// //                 {getStatusText()}
// //               </span>
// //             </div>
// //           </div>

// //           {error && (
// //             <div className="error-banner">
// //               <FaExclamationTriangle />
// //               <span>{error}</span>
// //             </div>
// //           )}

// //           {!isSupported && (
// //             <div className="warning-banner">
// //               <FaExclamationTriangle />
// //               <span>Web Bluetooth не поддерживается вашим браузером. Используйте Chrome или Edge.</span>
// //             </div>
// //           )}

// //           {savedDeviceId && (
// //             <div className="saved-device-info">
// //               <div className="status-item">
// //                 <FaInfoCircle />
// //                 <span>Сохраненное устройство: {savedDeviceId.substring(0, 8)}...</span>
// //                 <button 
// //                   onClick={clearSavedDevice}
// //                   className="btn-clear"
// //                   title="Удалить сохраненное устройство"
// //                 >
// //                   <FaTimesCircle />
// //                 </button>
// //               </div>
// //             </div>
// //           )}
          
// //           <div className="touch">  
// //             <div className="oval-toggle" onClick={toggleButton}>
// //               <div className={`toggle-track ${isActive ? 'active' : ''}`}>
// //                 <div className="toggle-knob">{isActive ? 'ON' : 'OFF'}</div>
// //                 <div className="running-dots">
// //                   <div className="running-dot dot-1"></div>
// //                   <div className="running-dot dot-2"></div>
// //                   <div className="running-dot dot-3"></div>
// //                   <div className="running-dot dot-4"></div>
// //                 </div>
// //               </div>
// //               <p>{isActive ? 'Устройство подключено' : 'Нажмите для подключения'}</p>
// //             </div>
// //           </div>

// //           {connectionStatus === 'connected' && (
// //             <div className="connection-status-panel">
// //               <div className="status-item">
// //                 <FaClock />
// //                 <span>Время подключения: {formatTime(connectionTimer)}</span>
// //               </div>
              
// //               {/* 🔥 ЗАМЕНА УРОВНЯ БАТАРЕИ НА СТАТУС БАЗЫ ДАННЫХ */}
// //               <div className="status-item">
// //                 <FaDatabase />
// //                 <span>База данных: {getDatabaseStatusText()}</span>
// //               </div>
// //             </div>
// //           )}

// //           <div className="info-grid">
// //             <InfoItem 
// //               label="Серийный номер" 
// //               value={deviceData.serialNumber} 
// //               showPlaceholder={!isActive}
// //             />
// //             <InfoItem 
// //               label="MAC-адрес" 
// //               value={deviceData.macAddress} 
// //               showPlaceholder={!isActive}
// //             />
// //             <InfoItem 
// //               label="Подключено к" 
// //               value={deviceData.connectedTo} 
// //               showPlaceholder={!isActive}
// //             />
// //             <InfoItem 
// //               label="Время подключения" 
// //               value={deviceData.connectionTime} 
// //               showPlaceholder={!isActive}
// //             />
// //           </div>
// //         </div>

// //         <div className="notification-container">
// //           <div className="notification-header">
// //             <h3>Управление уведомлениями</h3>
// //           </div>
          
// //           <div className="notification-grid">
// //             <button 
// //               onClick={registerPush} 
// //               disabled={isSubscribed || isLoading}
// //               className={`notification-cell ${isSubscribed ? 'disabled' : 'primary'}`}
// //             >
// //               <div className="notification-icon">
// //                 <FaBell />
// //               </div>
// //               <div className="notification-content">
// //                 <span className="notification-label">Подписаться</span>
// //                 <span className="notification-desc">Активировать уведомления</span>
// //               </div>
// //               {isLoading && <div className="notification-loader"></div>}
// //             </button>
            
// //             <button 
// //               onClick={sendTestNotification} 
// //               disabled={!isSubscribed || isLoading}
// //               className={`notification-cell ${!isSubscribed ? 'disabled' : 'success'}`}
// //             >
// //               <div className="notification-icon">
// //                 <FaArrowUp />
// //               </div>
// //               <div className="notification-content">
// //                 <span className="notification-label">Тест</span>
// //                 <span className="notification-desc">Отправить тестовое уведомление</span>
// //               </div>
// //               {isLoading && <div className="notification-loader"></div>}
// //             </button>
            
// //             <button 
// //               onClick={unsubscribePush} 
// //               disabled={!isSubscribed || isLoading}
// //               className={`notification-cell ${!isSubscribed ? 'disabled' : 'danger'}`}
// //             >
// //               <div className="notification-icon">
// //                 <FaBellSlash />
// //               </div>
// //               <div className="notification-content">
// //                 <span className="notification-label">Отписаться</span>
// //                 <span className="notification-desc">Отключить уведомления</span>
// //               </div>
// //               {isLoading && <div className="notification-loader"></div>}
// //             </button>
// //           </div>
// //         </div>

// //         {devices.length > 0 && !isActive && (
// //           <div className="devices-section">
// //             <h4>Найденные устройства ({devices.length})</h4>
// //             <div className="devices-list">
// //               {devices.map(device => (
// //                 <div key={device.id} className="device-card">
// //                   <div className="device-info">
// //                     <h4>{device.name}</h4>
// //                     <span className="device-id">{device.id}</span>
// //                   </div>
// //                   <div className="device-actions">
// //                     <button 
// //                       className="btn-connect"
// //                       onClick={connectToDevice}
// //                     >
// //                       <FaPlug />
// //                       Подключить
// //                     </button>
// //                   </div>
// //                 </div>
// //               ))}
// //             </div>
// //           </div>
// //         )}
// //       </div>
// //     </div>
// //   );
// // };

// // export default RootPage;


// import React, { useState, useEffect, useCallback } from 'react';
// import {
//   FaDownload, FaArrowUp, FaShieldAlt, FaArrowDown, FaCopy, FaBell, FaBellSlash,
//   FaHome, 
//   FaBolt, 
//   FaChartLine, 
//   FaExclamationTriangle, 
//   FaCog, 
//   FaQuestionCircle, 
//   FaSignOutAlt,
//   FaCheckCircle,
//   FaTimesCircle,
//   FaSync,
//   FaBluetooth,
//   FaSearch,
//   FaPlug,
//   FaBatteryFull,
//   FaBatteryThreeQuarters,
//   FaBatteryHalf,
//   FaBatteryQuarter,
//   FaBatteryEmpty,
//   FaClock,
//   FaInfoCircle,
//   FaDatabase
// } from 'react-icons/fa';
// import './root.css';

// const RootPage = () => {
//   const [isActive, setIsActive] = useState(false);
//   const [connectionStatus, setConnectionStatus] = useState('disconnected');
//   const [deviceData, setDeviceData] = useState({
//     serialNumber: '—',
//     macAddress: '—',
//     connectedTo: '—',
//     connectionTime: '—'
//   });
//   const [devices, setDevices] = useState([]);
//   const [isScanning, setIsScanning] = useState(false);
//   const [connectedDevice, setConnectedDevice] = useState(null);
//   const [error, setError] = useState('');
//   const [batteryLevel, setBatteryLevel] = useState(null);
//   const [connectionTimer, setConnectionTimer] = useState(0);
//   const [isSupported, setIsSupported] = useState(true);
//   const [pushStatus, setPushStatus] = useState({ message: '', type: 'info' });
//   const [isSubscribed, setIsSubscribed] = useState(false);
//   const [deviceId, setDeviceId] = useState(null);
//   const [isLoading, setIsLoading] = useState(false);
//   const [browserInfo, setBrowserInfo] = useState('');
//   const [savedDeviceId, setSavedDeviceId] = useState(null);
//   const [isReconnecting, setIsReconnecting] = useState(false);
//   const [databaseStatus, setDatabaseStatus] = useState('not_created');
  
//   // 🔔 СОСТОЯНИЯ ДЛЯ СИСТЕМЫ УВЕДОМЛЕНИЙ
//   const [notifications, setNotifications] = useState([]);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const [notificationStatus, setNotificationStatus] = useState('Нет уведомлений');

//   // Загрузка сохраненного deviceId при монтировании компонента
//   useEffect(() => {
//     const savedId = localStorage.getItem('bluetoothDeviceId');
//     if (savedId) {
//       setSavedDeviceId(savedId);
//       console.log('Найден сохраненный deviceId:', savedId);
//     }

//     // Проверка поддержки Web Bluetooth
//     if (!navigator.bluetooth) {
//       setIsSupported(false);
//       setError('Web Bluetooth не поддерживается вашим браузером');
//     }

//     // Загрузка уведомлений из localStorage
//     const savedNotifications = localStorage.getItem('deviceNotifications');
//     if (savedNotifications) {
//       setNotifications(JSON.parse(savedNotifications));
//       updateUnreadCount(JSON.parse(savedNotifications));
//     }
//   }, []);

//   // Таймер подключения
//   useEffect(() => {
//     let timer;
//     if (connectionStatus === 'connected') {
//       timer = setInterval(() => {
//         setConnectionTimer(prev => prev + 1);
//       }, 1000);
//     } else {
//       setConnectionTimer(0);
//     }

//     return () => clearInterval(timer);
//   }, [connectionStatus]);

//   // 🔔 ИНТЕРВАЛ ДЛЯ ПРОВЕРКИ УВЕДОМЛЕНИЙ (каждые 30 секунд)
//   useEffect(() => {
//     const notificationInterval = setInterval(() => {
//       if (connectedDevice && databaseStatus === 'created') {
//         fetchDeviceNotifications();
//       }
//     }, 30000);

//     return () => clearInterval(notificationInterval);
//   }, [connectedDevice, databaseStatus]);

//   // Генерация уникального deviceId на основе браузера и устройства
//   useEffect(() => {
//     const generateDeviceId = () => {
//       const userAgent = navigator.userAgent;
//       const platform = navigator.platform;
//       const language = navigator.language;
      
//       const browserId = `${platform}-${language}-${userAgent.length}`;
//       const hash = stringToHash(browserId);
      
//       return `device-${hash}-${Date.now()}`;
//     };

//     const stringToHash = (str) => {
//       let hash = 0;
//       for (let i = 0; i < str.length; i++) {
//         const char = str.charCodeAt(i);
//         hash = ((hash << 5) - hash) + char;
//         hash = hash & hash;
//       }
//       return Math.abs(hash).toString(36);
//     };

//     let storedId = localStorage.getItem('deviceId');
//     if (!storedId) {
//       storedId = generateDeviceId();
//       localStorage.setItem('deviceId', storedId);
//     }
    
//     setDeviceId(storedId);
    
//     const info = `${navigator.platform} - ${navigator.userAgent.split(' ')[0]}`;
//     setBrowserInfo(info);
    
//     console.log('Device ID:', storedId);
//     console.log('Browser info:', info);
//   }, []);

//   // Проверка существующей подписки
//   useEffect(() => {
//     const checkSubscription = async () => {
//       if (!deviceId) return;

//       try {
//         const response = await fetch('/check-subscription', {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify({ deviceId }),
//         });

//         if (response.ok) {
//           const result = await response.json();
//           setIsSubscribed(result.exists);
//           if (result.exists) {
//             updateStatus('Подписка активна для этого устройства', 'success');
//           }
//         }
//       } catch (error) {
//         console.error('Ошибка проверки подписки:', error);
//       }
//     };

//     if (deviceId) {
//       checkSubscription();
//     }
//   }, [deviceId]);

//   // Форматирование времени подключения
//   const formatTime = (seconds) => {
//     const hours = Math.floor(seconds / 3600);
//     const minutes = Math.floor((seconds % 3600) / 60);
//     const secs = seconds % 60;
    
//     if (hours > 0) return `${hours}ч ${minutes}м ${secs}с`;
//     if (minutes > 0) return `${minutes}м ${secs}с`;
//     return `${secs}с`;
//   };

//   // Иконка уровня батареи
//   const BatteryIcon = ({ level }) => {
//     if (level >= 0.8) return <FaBatteryFull />;
//     if (level >= 0.6) return <FaBatteryThreeQuarters />;
//     if (level >= 0.4) return <FaBatteryHalf />;
//     if (level >= 0.2) return <FaBatteryQuarter />;
//     return <FaBatteryEmpty />;
//   };

//   // 🔔 ФУНКЦИИ ДЛЯ СИСТЕМЫ УВЕДОМЛЕНИЙ

//   // Обновление счетчика непрочитанных уведомлений
//   const updateUnreadCount = (notificationsList) => {
//     const unread = notificationsList.filter(notification => !notification.read).length;
//     setUnreadCount(unread);
//     setNotificationStatus(unread > 0 ? `Не прочитано: ${unread}` : 'Нет уведомлений');
//   };

//   // Получение уведомлений с сервера
//   const fetchDeviceNotifications = async () => {
//     if (!connectedDevice) return;

//     try {
//       const deviceName = connectedDevice.name || 'unknown_device';
//       const response = await fetch(`https://192.168.99.14:3000/api/bluetooth/${deviceName}/notifications?limit=10`);
      
//       if (response.ok) {
//         const result = await response.json();
//         if (result.success && result.data) {
//           const newNotifications = result.data.map(notification => ({
//             ...notification,
//             id: notification.id || Date.now().toString(),
//             timestamp: notification.timestamp || new Date().toISOString(),
//             read: false
//           }));

//           const updatedNotifications = [...newNotifications, ...notifications]
//             .filter((notification, index, self) => 
//               index === self.findIndex(n => n.id === notification.id)
//             )
//             .slice(0, 20); // Ограничиваем историю 20 уведомлениями

//           setNotifications(updatedNotifications);
//           updateUnreadCount(updatedNotifications);
//           localStorage.setItem('deviceNotifications', JSON.stringify(updatedNotifications));
          
//           updateStatus(`Получено ${newNotifications.length} уведомлений`, 'success');
//         }
//       }
//     } catch (error) {
//       console.error('Ошибка получения уведомлений:', error);
//     }
//   };

//   // Отметить уведомление как прочитанное
//   const markAsRead = (notificationId) => {
//     const updatedNotifications = notifications.map(notification =>
//       notification.id === notificationId ? { ...notification, read: true } : notification
//     );
    
//     setNotifications(updatedNotifications);
//     updateUnreadCount(updatedNotifications);
//     localStorage.setItem('deviceNotifications', JSON.stringify(updatedNotifications));
//   };

//   // Отметить все как прочитанные
//   const markAllAsRead = () => {
//     const updatedNotifications = notifications.map(notification => ({
//       ...notification,
//       read: true
//     }));
    
//     setNotifications(updatedNotifications);
//     updateUnreadCount(updatedNotifications);
//     localStorage.setItem('deviceNotifications', JSON.stringify(updatedNotifications));
//     updateStatus('Все уведомления отмечены как прочитанные', 'success');
//   };

//   // Очистить все уведомления
//   const clearAllNotifications = () => {
//     setNotifications([]);
//     setUnreadCount(0);
//     setNotificationStatus('Нет уведомлений');
//     localStorage.removeItem('deviceNotifications');
//     updateStatus('Все уведомления очищены', 'success');
//   };

//   // 🔥 ФУНКЦИЯ СОЗДАНИЯ БАЗЫ ДАННЫХ ДЛЯ УСТРОЙСТВА
//   const createDeviceDatabase = async (deviceName) => {
//     try {
//       setDatabaseStatus('creating');
//       console.log(`🔄 Создание БД для устройства: ${deviceName}`);
      
//       const response = await fetch('https://192.168.99.14:3000/api/bluetooth/connect', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           deviceName: deviceName,
//           deviceId: deviceId,
//           timestamp: new Date().toISOString()
//         })
//       });

//       if (!response.ok) {
//         throw new Error(`Ошибка HTTP: ${response.status}`);
//       }

//       const result = await response.json();
      
//       if (result.success) {
//         console.log(`✅ БД создана: ${result.database}`);
//         setDatabaseStatus('created');
//         updateStatus(`База данных создана: ${result.database}`, 'success');
        
//         // 🔔 Автоматически загружаем уведомления после создания БД
//         setTimeout(() => fetchDeviceNotifications(), 1000);
        
//         return result.database;
//       } else {
//         throw new Error(result.error || 'Ошибка создания БД');
//       }
//     } catch (error) {
//       console.error('❌ Ошибка создания БД:', error);
//       setDatabaseStatus('error');
//       updateStatus(`Ошибка создания БД: ${error.message}`, 'error');
//       throw error;
//     }
//   };

//   // Отключение от устройства
//   const handleDisconnect = useCallback(() => {
//     if (connectedDevice && connectedDevice.gatt) {
//       connectedDevice.gatt.disconnect();
//     }
//     setConnectionStatus('disconnected');
//     setIsActive(false);
//     setConnectedDevice(null);
//     setBatteryLevel(null);
//     setDeviceData({
//       serialNumber: '—',
//       macAddress: '—',
//       connectedTo: '—',
//       connectionTime: '—'
//     });
//     setDatabaseStatus('not_created');
    
//     console.log('Устройство отключено, но deviceId сохранен');
//   }, [connectedDevice]);

//   // Функция автоматического переподключения
//   const autoReconnect = useCallback(async () => {
//     if (!savedDeviceId || isReconnecting) return;

//     setIsReconnecting(true);
//     setConnectionStatus('connecting');
//     setError('');

//     try {
//       const devices = await navigator.bluetooth.getDevices();
//       const device = devices.find(d => d.id === savedDeviceId);
      
//       if (device) {
//         console.log('Найдено сохраненное устройство:', device.name);
        
//         const server = await device.gatt.connect();
        
//         setConnectionStatus('connected');
//         setIsActive(true);
//         setConnectedDevice(device);
        
//         setDeviceData({
//           serialNumber: device.id || '—',
//           macAddress: '—',
//           connectedTo: device.name || 'Неизвестное устройство',
//           connectionTime: new Date().toLocaleTimeString()
//         });

//         // 🔥 СОЗДАЕМ БАЗУ ДАННЫХ ПРИ ПЕРЕПОДКЛЮЧЕНИИ
//         await createDeviceDatabase(device.name);

//         // Пытаемся прочитать уровень батареи
//         setTimeout(() => readBatteryLevel(server), 1000);

//         device.addEventListener('gattserverdisconnected', () => {
//           handleDisconnect();
//         });

//         console.log('Автопереподключение выполнено');
//       } else {
//         console.log('Сохраненное устройство не найдено в списке разрешенных');
//         setConnectionStatus('disconnected');
//       }
//     } catch (err) {
//       console.error('Ошибка автопереподключения:', err);
//       setError(`Ошибка переподключения: ${err.message}`);
//       setConnectionStatus('disconnected');
//     } finally {
//       setIsReconnecting(false);
//     }
//   }, [savedDeviceId, handleDisconnect]);

//   // Чтение уровня батареи
//   const readBatteryLevel = useCallback(async (server) => {
//     if (!server || !server.connected) return null;
    
//     try {
//       const batteryService = await server.getPrimaryService('battery_service');
//       const characteristic = await batteryService.getCharacteristic('battery_level');
//       const value = await characteristic.readValue();
//       const level = value.getUint8(0) / 100;
//       setBatteryLevel(level);
//       return level;
//     } catch (error) {
//       console.warn('Не удалось прочитать уровень батареи:', error);
//       return null;
//     }
//   }, []);

//   // Подключение к устройству
//   const connectToDevice = useCallback(async () => {
//     setError('');
//     setBatteryLevel(null);
//     setDatabaseStatus('not_created');

//     try {
//       setConnectionStatus('connecting');
      
//       const device = await navigator.bluetooth.requestDevice({
//         acceptAllDevices: true,
//         optionalServices: ['battery_service', 'device_information']
//       });

//       if (!device) {
//         setConnectionStatus('disconnected');
//         return;
//       }

//       // Сохраняем device.id в localStorage
//       localStorage.setItem('bluetoothDeviceId', device.id);
//       setSavedDeviceId(device.id);
//       console.log('Device ID сохранен:', device.id);

//       const server = await device.gatt.connect();
      
//       setConnectionStatus('connected');
//       setIsActive(true);
//       setConnectedDevice(device);
      
//       setDeviceData({
//         serialNumber: device.id || '—',
//         macAddress: '—',
//         connectedTo: device.name || 'Неизвестное устройство',
//         connectionTime: new Date().toLocaleTimeString()
//       });

//       // 🔥 СОЗДАЕМ БАЗУ ДАННЫХ ДЛЯ УСТРОЙСТВА
//       await createDeviceDatabase(device.name);

//       setTimeout(() => readBatteryLevel(server), 1000);

//       device.addEventListener('gattserverdisconnected', () => {
//         handleDisconnect();
//       });

//     } catch (err) {
//       setError(`Ошибка подключения: ${err.message}`);
//       setConnectionStatus('disconnected');
//       setIsActive(false);
//     }
//   }, [readBatteryLevel, handleDisconnect]);

//   // Поиск Bluetooth-устройств
//   const scanDevices = useCallback(async () => {
//     if (!isSupported) return;

//     setIsScanning(true);
//     setError('');
//     setDevices([]);

//     try {
//       const device = await navigator.bluetooth.requestDevice({
//         acceptAllDevices: true,
//         optionalServices: ['battery_service', 'device_information']
//       });

//       if (device) {
//         setDevices([{
//           id: device.id,
//           name: device.name || 'Неизвестное устройство',
//           connected: false,
//           deviceObject: device
//         }]);
//       }
//     } catch (err) {
//       if (err.name === 'NotFoundError') {
//         setError('Устройства не найдены');
//       } else {
//         setError(`Ошибка поиска: ${err.message}`);
//       }
//     } finally {
//       setIsScanning(false);
//     }
//   }, [isSupported]);

//   const toggleButton = () => {
//     if (!isActive) {
//       connectToDevice();
//       localStorage.setItem('Bluetooth','ON');
//     } else {
//       handleDisconnect();
//       localStorage.setItem('Bluetooth','OFF');
//     }
//   };

//   // Очистка сохраненного deviceId
//   const clearSavedDevice = useCallback(() => {
//     localStorage.removeItem('bluetoothDeviceId');
//     setSavedDeviceId(null);
//     setError('Сохраненное устройство удалено');
//     console.log('Device ID очищен');
//   }, []);

//   const updateStatus = (message, type = 'info') => {
//     setPushStatus({ message, type });
//     console.log(`[${type.toUpperCase()}] ${message}`);
//   };

//   // 🔔 ОБНОВЛЕННЫЕ ФУНКЦИИ УВЕДОМЛЕНИЙ

//   const registerPush = async () => {
//     setIsLoading(true);
//     try {
//       if (!deviceId) throw new Error('ID устройства не найден');
//       if (!('Notification' in window)) throw new Error('Браузер не поддерживает уведомления');
//       if (!('serviceWorker' in navigator)) throw new Error('Service Worker не поддерживается');

//       const permission = await Notification.requestPermission();
//       if (permission !== 'granted') throw new Error('Разрешение не получено');

//       const registration = await navigator.serviceWorker.register('/service-worker.js');
//       await navigator.serviceWorker.ready;

//       const subscription = await registration.pushManager.subscribe({
//         userVisibleOnly: true,
//         applicationServerKey: 'BHBjxuWrOU0dXE_HRaL0N7QITNfspQbKNsdJ-LWqBHaFYqVyE0c3yttX-QJ1jEj0X38sn2ZByek1FTyGgRG41J8'
//       });

//       const response = await fetch('/web-push', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           subscription,
//           deviceId,
//           browserInfo,
//           timestamp: new Date().toISOString()
//         }),
//       });

//       if (!response.ok) throw new Error('Ошибка сервера');

//       setIsSubscribed(true);
//       updateStatus('Подписка создана для ЭТОГО устройства', 'success');

//     } catch (error) {
//       console.error('Ошибка регистрации:', error);
//       updateStatus(error.message, 'error');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const unsubscribePush = async () => {
//     setIsLoading(true);
//     try {
//       if (!deviceId) throw new Error('ID устройства не найден');

//       const response = await fetch('/web-push', {
//         method: 'DELETE',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ deviceId }),
//       });

//       if (!response.ok) throw new Error('Ошибка удаления подписки');

//       setIsSubscribed(false);
//       updateStatus('Подписка удалена для ЭТОГО устройства', 'success');

//     } catch (error) {
//       console.error('Ошибка отписки:', error);
//       updateStatus(error.message, 'error');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const sendTestNotification = async () => {
//     setIsLoading(true);
//     try {
//       if (!deviceId) throw new Error('ID устройства не найден');

//       const response = await fetch('/send-notification', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           deviceId,
//           title: `Тест с ${navigator.platform}`,
//           body: `Уведомление отправлено с этого устройства! Время: ${new Date().toLocaleTimeString()}`
//         }),
//       });

//       if (!response.ok) throw new Error('Ошибка отправки уведомления');

//       updateStatus('Уведомление отправлено НА ЭТО УСТРОЙСТВО', 'success');

//     } catch (error) {
//       console.error('Ошибка отправки:', error);
//       updateStatus(error.message, 'error');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const copyDeviceId = () => {
//     navigator.clipboard.writeText(deviceId);
//     updateStatus('ID устройства скопирован', 'success');
//   };

//   const refreshDeviceId = () => {
//     const newId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
//     localStorage.setItem('deviceId', newId);
//     setDeviceId(newId);
//     setIsSubscribed(false);
//     updateStatus('ID устройства обновлен', 'success');
//   };

//   // Функция для получения статуса подключения в текстовом формате
//   const getStatusText = () => {
//     switch(connectionStatus) {
//       case 'connected':
//         return 'Подключено';
//       case 'connecting':
//         return isReconnecting ? 'Переподключение...' : 'Подключение...';
//       default:
//         return 'Не подключено';
//     }
//   };

//   // Функция для получения класса статуса подключения
//   const getStatusClass = () => {
//     switch(connectionStatus) {
//       case 'connected':
//         return 'status-connected';
//       case 'connecting':
//         return 'status-connecting';
//       default:
//         return 'status-disconnected';
//     }
//   };

//   // 🔥 ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ СТАТУСА БАЗЫ ДАННЫХ
//   const getDatabaseStatusText = () => {
//     switch(databaseStatus) {
//       case 'not_created':
//         return 'БД не создана';
//       case 'creating':
//         return 'Создание БД...';
//       case 'created':
//         return 'БД создана';
//       case 'error':
//         return 'Ошибка создания БД';
//       default:
//         return 'Неизвестно';
//     }
//   };

//   const InfoItem = ({ label, value, showPlaceholder = false }) => (
//     <div className="info-item">
//       <div className="info-label">{label}</div>
//       <p>{showPlaceholder ? '—' : value}</p>
//     </div>
//   );

//   // 🔔 ФОРМАТИРОВАНИЕ ВРЕМЕНИ ДЛЯ УВЕДОМЛЕНИЙ
//   const formatNotificationTime = (timestamp) => {
//     const date = new Date(timestamp);
//     const now = new Date();
//     const diffMs = now - date;
//     const diffMins = Math.floor(diffMs / 60000);
//     const diffHours = Math.floor(diffMs / 3600000);
    
//     if (diffMins < 1) return 'только что';
//     if (diffMins < 60) return `${diffMins} мин назад`;
//     if (diffHours < 24) return `${diffHours} ч назад`;
//     return date.toLocaleDateString();
//   };

//   return (
//     <div className="app-root">
//       <div className="sidebar">
//         <div className="sidebar-header">
//           <div className="logo-icon"><FaBolt/></div>
//         </div>
//         <div className="sidebar-menu">
//           <ul>
//             <li><a href="/app-main">
//               <FaHome /> 
//             </a></li>
//             <li><a href="/history">
//               <FaBolt /> 
//             </a></li>
//             <li><a href="/root" className="active">
//               <FaChartLine /> 
//             </a></li>
//           </ul>
//         </div>
//       </div>

//       <div className="main-content">
//         <div className="info-container">
//           <div className="info-header">
//             <div className="device-name">Настройки подключения</div>
//             <div className="connection-status">
//               <span className={getStatusClass()}>
//                 {connectionStatus === 'connected' ? <FaCheckCircle /> : 
//                  connectionStatus === 'connecting' ? <FaSync className="fa-spin" /> : 
//                  <FaTimesCircle />}
//                 {getStatusText()}
//               </span>
//             </div>
//           </div>

//           {error && (
//             <div className="error-banner">
//               <FaExclamationTriangle />
//               <span>{error}</span>
//             </div>
//           )}

//           {!isSupported && (
//             <div className="warning-banner">
//               <FaExclamationTriangle />
//               <span>Web Bluetooth не поддерживается вашим браузером. Используйте Chrome или Edge.</span>
//             </div>
//           )}
          
//           <div className="touch">  
//             <div className="oval-toggle" onClick={toggleButton}>
//               <div className={`toggle-track ${isActive ? 'active' : ''}`}>
//                 <div className="toggle-knob">{isActive ? 'ON' : 'OFF'}</div>
//                 <div className="running-dots">
//                   <div className="running-dot dot-1"></div>
//                   <div className="running-dot dot-2"></div>
//                   <div className="running-dot dot-3"></div>
//                   <div className="running-dot dot-4"></div>
//                 </div>
//               </div>
//               <p>{isActive ? 'Устройство подключено' : 'Нажмите для подключения'}</p>
//             </div>
//           </div>

//           {connectionStatus === 'connected' && (
//             <div className="connection-status-panel">
//               <div className="status-item">
//                 <FaClock />
//                 <span>Время подключения: {formatTime(connectionTimer)}</span>
//               </div>
              
//               {batteryLevel !== null && (
//                 <div className="status-item">
//                   <BatteryIcon level={batteryLevel} />
//                   <span>Заряд: {Math.round(batteryLevel * 100)}%</span>
//                 </div>
//               )}

//               {/* 🔥 СТАТУС БАЗЫ ДАННЫХ */}
//               <div className="status-item">
//                 <FaDatabase />
//                 <span>dbExists: {getDatabaseStatusText()}</span>
//               </div>

//               {/* 🔔 СТАТУС УВЕДОМЛЕНИЙ */}
//               <div className="status-item">
//                 <FaBell className={unreadCount > 0 ? 'notification-badge' : ''} />
//                 <span>Уведомления: {notificationStatus}</span>
//                 {unreadCount > 0 && (
//                   <span className="notification-counter">{unreadCount}</span>
//                 )}
//               </div>
//             </div>
//           )}

//           <div className="info-grid">
//             <InfoItem 
//               label="Серийный номер" 
//               value={deviceData.serialNumber} 
//               showPlaceholder={!isActive}
//             />
//             <InfoItem 
//               label="MAC-адрес" 
//               value={deviceData.macAddress} 
//               showPlaceholder={!isActive}
//             />
//             <InfoItem 
//               label="Подключено к" 
//               value={deviceData.connectedTo} 
//               showPlaceholder={!isActive}
//             />
//             <InfoItem 
//               label="Время подключения" 
//               value={deviceData.connectionTime} 
//               showPlaceholder={!isActive}
//             />
//           </div>
//         </div>

//         {/* 🔔 СЕКЦИЯ СПИСКА УВЕДОМЛЕНИЙ */}
//         {notifications.length > 0 && (
//           <div className="notifications-list-container">
//             <div className="notification-header">
//               <h3>История уведомлений ({notifications.length})</h3>
//               <button 
//                 onClick={clearAllNotifications}
//                 className="btn-clear-all"
//                 title="Очистить все уведомления"
//               >
//                 <FaTimesCircle />
//                 Очистить все
//               </button>
//             </div>
            
//             <div className="notifications-list">
//               {notifications.map(notification => (
//                 <div 
//                   key={notification.id} 
//                   className={`notification-item ${notification.read ? 'read' : 'unread'}`}
//                   onClick={() => markAsRead(notification.id)}
//                 >
//                   <div className="notification-content">
//                     <div className="notification-title">
//                       {notification.title || 'Новое уведомление'}
//                     </div>
//                     <div className="notification-body">
//                       {notification.body || notification.message || 'Нет описания'}
//                     </div>
//                     <div className="notification-time">
//                       {formatNotificationTime(notification.timestamp)}
//                     </div>
//                   </div>
//                   {!notification.read && (
//                     <div className="notification-indicator"></div>
//                   )}
//                 </div>
//               ))}
//             </div>
//           </div>
//         )}

//         <div className="notification-container">
//           <div className="notification-header">
//             <h3>Управление уведомлениями</h3>
//           </div>
          
//           <div className="notification-grid">
//             <button 
//               onClick={registerPush} 
//               disabled={isSubscribed || isLoading}
//               className={`notification-cell ${isSubscribed ? 'disabled' : 'primary'}`}
//             >
//               <div className="notification-icon">
//                 <FaBell />
//               </div>
//               <div className="notification-content">
//                 <span className="notification-label">Подписаться</span>
//                 <span className="notification-desc">Активировать уведомления</span>
//               </div>
//               {isLoading && <div className="notification-loader"></div>}
//             </button>
            
//             <button 
//               onClick={sendTestNotification} 
//               disabled={!isSubscribed || isLoading}
//               className={`notification-cell ${!isSubscribed ? 'disabled' : 'success'}`}
//             >
//               <div className="notification-icon">
//                 <FaArrowUp />
//               </div>
//               <div className="notification-content">
//                 <span className="notification-label">Тест</span>
//                 <span className="notification-desc">Отправить тестовое уведомление</span>
//               </div>
//               {isLoading && <div className="notification-loader"></div>}
//             </button>
            
//             <button 
//               onClick={unsubscribePush} 
//               disabled={!isSubscribed || isLoading}
//               className={`notification-cell ${!isSubscribed ? 'disabled' : 'danger'}`}
//             >
//               <div className="notification-icon">
//                 <FaBellSlash />
//               </div>
//               <div className="notification-content">
//                 <span className="notification-label">Отписаться</span>
//                 <span className="notification-desc">Отключить уведомления</span>
//               </div>
//               {isLoading && <div className="notification-loader"></div>}
//             </button>
//           </div>
//         </div>

//         {devices.length > 0 && !isActive && (
//           <div className="devices-section">
//             <h4>Найденные устройства ({devices.length})</h4>
//             <div className="devices-list">
//               {devices.map(device => (
//                 <div key={device.id} className="device-card">
//                   <div className="device-info">
//                     <h4>{device.name}</h4>
//                     <span className="device-id">{device.id}</span>
//                   </div>
//                   <div className="device-actions">
//                     <button 
//                       className="btn-connect"
//                       onClick={connectToDevice}
//                     >
//                       <FaPlug />
//                       Подключить
//                     </button>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default RootPage;
