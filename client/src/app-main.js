import React, { useState, useEffect } from 'react';
import './app-main.css';
import { FaExclamationTriangle, FaChartLine, FaBolt, FaHome, FaDownload, FaArrowUp, FaShieldAlt, FaArrowDown } from 'react-icons/fa';
import { v4 as uuidv4 } from 'uuid';

const AppMain = () => {
  const [voltage, setVoltage] = useState(229.4);
  const [anomalies, setAnomalies] = useState(14);
  const [average, setAverage] = useState(231.2);
  const [stability, setStability] = useState(98.7);
  const [pushStatus, setPushStatus] = useState({ message: '', type: 'info' });
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [anomalyData] = useState([
    { time: '12:45:23', type: 'Скачок напряжения', value: '287 В', duration: '120 мс', status: 'critical', statusText: 'Критическая' },
    { time: '12:30:11', type: 'Просадка напряжения', value: '195 В', duration: '450 мс', status: 'warning', statusText: 'Предупреждение' },
    { time: '11:15:47', type: 'Колебание', value: '218 В', duration: '1.2 с', status: 'normal', statusText: 'Норма' },
    { time: '10:22:56', type: 'Скачок напряжения', value: '276 В', duration: '80 мс', status: 'warning', statusText: 'Предупреждение' },
    { time: '09:45:12', type: 'Просадка напряжения', value: '187 В', duration: '620 мс', status: 'critical', statusText: 'Критическая' },
  ]);

  const [voltageTrend, setVoltageTrend] = useState({
    direction: 'up',
    value: '2.3',
  });

  // Initialize device ID
  useEffect(() => {
    let storedDeviceId = localStorage.getItem('deviceId');
    if (!storedDeviceId) {
      storedDeviceId = `${uuidv4()}-${Date.now()}`;
      localStorage.setItem('deviceId', storedDeviceId);
    }
    setDeviceId(storedDeviceId);
    console.log('Device ID initialized:', storedDeviceId);
  }, []);

  // Update status message and log to console
  const updateStatus = (message, type = 'info') => {
    setPushStatus({ message, type });
    console.log(`${type.toUpperCase()}: ${message}`);
  };

  // Register push notifications
  const registerPush = async () => {
    try {
      if (!deviceId) {
        updateStatus('Идентификатор устройства не найден', 'error');
        console.error('No deviceId available');
        return;
      }

      if (!('Notification' in window)) {
        updateStatus('Уведомления не поддерживаются браузером', 'error');
        console.error('Notifications not supported by browser');
        return;
      }

      if (!('serviceWorker' in navigator)) {
        updateStatus('Service Worker не поддерживаются', 'error');
        console.error('Service Worker not supported');
        return;
      }

      const currentPermission = Notification.permission;
      updateStatus(`Текущее разрешение: ${currentPermission}`, 'info');
      console.log('Notification permission:', currentPermission);

      if (currentPermission === 'denied') {
        updateStatus('Уведомления заблокированы. Сбросьте настройки в браузере.', 'error');
        console.error('Notification permission denied');
        return;
      }

      if (currentPermission === 'granted') {
        updateStatus('Уведомления уже разрешены', 'success');
      } else {
        const permission = await Notification.requestPermission();
        updateStatus(`Результат запроса: ${permission}`, permission === 'granted' ? 'success' : 'error');
        console.log('Permission result:', permission);
        if (permission !== 'granted') {
          updateStatus('Разрешение на уведомления отклонено', 'error');
          return;
        }
      }

      console.log('Registering Service Worker...');
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service Worker registered:', registration);

      await navigator.serviceWorker.ready;
      console.log('Service Worker ready for device:', deviceId);

      let subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        updateStatus('Найдена существующая подписка', 'info');
        console.log('Existing subscription:', JSON.stringify(subscription));
      } else {
        console.log('Creating new subscription...');
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: 'BHBjxuWrOU0dXE_HRaL0N7QITNfspQbKNsdJ-LWqBHaFYqVyE0c3yttX-QJ1jEj0X38sn2ZByek1FTyGgRG41J8',
        });
        updateStatus('Новая подписка создана', 'success');
        console.log('New subscription created:', JSON.stringify(subscription));
      }

      console.log('Sending subscription to server for device:', deviceId);
      const response = await fetch('/web-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription,
          deviceId,
        }),
      });

      if (response.ok) {
        updateStatus('Подписка успешно отправлена на сервер', 'success');
        setIsSubscribed(true);
      } else {
        const errorText = await response.text();
        console.error('Server response error:', errorText);
        throw new Error(`Ошибка при отправке подписки: ${response.status} ${errorText}`);
      }
    } catch (err) {
      console.error('Ошибка при регистрации push:', err);
      updateStatus(`Ошибка: ${err.message}`, 'error');
    }
  };

  // Send test notification to specific device
  const sendTestNotification = async () => {
    try {
      if (!deviceId) {
        updateStatus('Идентификатор устройства не найден', 'error');
        console.error('No deviceId available');
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        updateStatus('Service Worker не зарегистрирован', 'error');
        console.error('No active Service Worker');
        setIsSubscribed(false);
        return;
      }

      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        updateStatus('Подписка не найдена. Пожалуйста, зарегистрируйтесь заново.', 'error');
        console.error('No subscription found');
        setIsSubscribed(false);
        return;
      }

      console.log('Sending test notification for device:', deviceId, 'Subscription:', JSON.stringify(subscription));
      const response = await fetch('/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          title: 'Тестовое уведомление',
          body: `Это тестовое push-уведомление для устройства ${deviceId}!`,
        }),
      });

      if (response.ok) {
        updateStatus('Тестовое уведомление отправлено', 'success');
        console.log('Test notification request successful');
      } else {
        const errorText = await response.text();
        console.error('Server response error:', errorText);
        throw new Error(`Ошибка отправки уведомления: ${response.status} ${errorText}`);
      }
    } catch (err) {
      console.error('Ошибка тестового уведомления:', err);
      updateStatus(`Ошибка: ${err.message}`, 'error');
    }
  };

  // Simulate live voltage updates
  useEffect(() => {
    const interval = setInterval(() => {
      const randomChange = (Math.random() * 0.8 + 228.5).toFixed(1);
      setVoltage(randomChange);

      const isPositive = Math.random() > 0.5;
      if (isPositive) {
        setVoltageTrend({
          direction: 'up',
          value: (Math.random() * 0.5 + 2.0).toFixed(1),
        });
      } else {
        setVoltageTrend({
          direction: 'down',
          value: (Math.random() * 0.3 + 0.5).toFixed(1),
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Automatically register push on component mount
  useEffect(() => {
    if (deviceId) {
      registerPush();
    }
  }, [deviceId]);

  const Arrow = ({ value }) => {
    return value > 1 ? <FaArrowUp /> : <FaArrowDown />;
  };

  const StatusBadge = ({ status, text }) => {
    return <span className={`status ${status}`}>{text}</span>;
  };

  return (
    <div className="container">
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo-icon"><FaBolt /></div>
        </div>
        <div className="sidebar-menu">
          <ul>
            <li><a href="/app-main" className="active"><FaHome /></a></li>
            <li><a href="/history"><FaBolt /></a></li>
            <li><a href="/root"><FaChartLine /></a></li>
          </ul>
        </div>
      </div>

      <div className="main-content">
        <div className="header">
          <h1>Мониторинг аномалий напряжения</h1>
          <div className="user-info">
            <div className="tablo">
              <img src="https://ui-avatars.com/api/?name=ON&background=06c000&color=fff" alt="User" />
              <div className="user-details">
                <div className="user-name"><p>Bluetooth</p></div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="metrics">
          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-title">ТЕКУЩЕЕ НАПРЯЖЕНИЕ</div>
              <div className="metric-icon"><FaBolt /></div>
            </div>
            <div className="metric-value">{voltage} В</div>
            <div className={`metric-change ${voltageTrend.direction}`}>
              <Arrow value={voltageTrend.value} />
              {voltageTrend.value}% с прошлого часа
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-title">АНОМАЛИЙ СЕГОДНЯ</div>
              <div className="metric-icon"><FaExclamationTriangle /></div>
            </div>
            <div className="metric-value">{anomalies}</div>
            <div className="metric-change down">
              <FaArrowDown /> 5.7% с вчерашнего дня
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-title">СРЕДНЕЕ ЗНАЧЕНИЕ</div>
              <div className="metric-icon"><FaChartLine /></div>
            </div>
            <div className="metric-value">{average} В</div>
            <div className="metric-change up">
              <FaArrowUp /> 1.1% с прошлой недели
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-title">СТАБИЛЬНОСТЬ СЕТИ</div>
              <div className="metric-icon"><FaShieldAlt /></div>
            </div>
            <div className="metric-value">{stability}%</div>
            <div className="metric-change up">
              <FaArrowUp /> 0.3% с прошлого месяца
            </div>
          </div>
        </div>

        <div className="anomalies-container">
          <div className="table-header">
            <div className="chart-title">Последние аномалии</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Время</th>
                <th>Тип аномалии</th>
                <th>Значение</th>
                <th>Длительность</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {anomalyData.map((item, index) => (
                <tr key={index}>
                  <td>{item.time}</td>
                  <td>{item.type}</td>
                  <td>{item.value}</td>
                  <td>{item.duration}</td>
                  <td><StatusBadge status={item.status} text={item.statusText} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AppMain;
