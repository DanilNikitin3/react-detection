import React, { useState, useEffect, useCallback } from 'react';
import { 
  FaBluetooth, 
  FaSearch, 
  FaPlug, 
  FaSignal, 
  FaBatteryHalf,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle } 
from 'react-icons/fa';
import './bluetooth.css';

const BluetoothApp = () => {
  const [devices, setDevices] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [error, setError] = useState('');
  const [isSupported, setIsSupported] = useState(true);

  const scanDevices = useCallback(async () => {
    if (!isSupported) return;

    setIsScanning(true);
    setError('');

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service', 'device_information']
      });

      if (device) {
        setDevices(prev => {
          const exists = prev.find(d => d.id === device.id);
          if (!exists) {
            return [...prev, {
              id: device.id,
              name: device.name || 'Unknown Device',
              connected: false
            }];
          }
          return prev;
        });
      }
    } catch (err) {
      if (err.name !== 'NotFoundError') {
        setError(`Ошибка поиска: ${err.message}`);
      }
    } finally {
      setIsScanning(false);
    }
  }, [isSupported]);

  const connectToDevice = useCallback(async (deviceId) => {
    setError('');
    
    try {
      const device = devices.find(d => d.id === deviceId);
      if (!device) return;

      const server = await navigator.bluetooth.connect();
      setConnectedDevice(device);
      
      // Обновляем статус устройства
      setDevices(prev => prev.map(d => 
        d.id === deviceId ? { ...d, connected: true } : d
      ));

      // Здесь можно добавить логику для работы с сервисами
      console.log('Connected to device:', device.name);

    } catch (err) {
      setError(`Ошибка подключения: ${err.message}`);
    }
  }, [devices]);

  const disconnectDevice = useCallback(async () => {
    if (connectedDevice) {
      try {
        await navigator.bluetooth.disconnect();
        setDevices(prev => prev.map(d => 
          d.id === connectedDevice.id ? { ...d, connected: false } : d
        ));
        setConnectedDevice(null);
      } catch (err) {
        setError(`Ошибка отключения: ${err.message}`);
      }
    }
  }, [connectedDevice]);

  return (
    <div className="bluetooth-app">
  <header className="app-header">
    <div className="header-content">
      <FaBluetooth className="header-icon" />
      <h1>Bluetooth Manager</h1>
      <div className="connection-status">
        {connectedDevice ? (
          <span className="status-connected">
            <FaCheckCircle /> Подключено
          </span>
        ) : (
          <span className="status-disconnected">
            <FaTimesCircle /> Не подключено
          </span>
        )}
      </div>
    </div>
  </header>

  <div className="app-content">
    {!isSupported && (
      <div className="error-banner">
        <FaExclamationTriangle />
        <span>{error}</span>
      </div>
    )}

    {error && (
      <div className="error-banner">
        <FaExclamationTriangle />
        <span>{error}</span>
      </div>
    )}

    <div className="control-panel">
      <button 
        className={`scan-btn ${isScanning ? 'scanning' : ''}`}
        onClick={scanDevices}
        disabled={isScanning || !isSupported || connectedDevice}
      >
        <FaSearch />
        {isScanning ? 'Поиск...' : 'Найти устройства'}
      </button>

      {connectedDevice && (
        <button 
          className="disconnect-btn"
          onClick={disconnectDevice}
        >
          <FaTimesCircle />
          Отключиться
        </button>
      )}
    </div>

    {!connectedDevice && (
      <div className="devices-section">
        <h2>Доступные устройства</h2>
        <div className="devices-list">
          {devices.length === 0 ? (
            <div className="empty-state">
              <FaBluetooth />
              <p>Устройства не найдены</p>
              <span>Нажмите "Найти устройства" для поиска</span>
            </div>
          ) : (
            devices.map(device => (
              <DeviceCard
                key={device.id}
                device={device}
                onConnect={connectToDevice}
                isConnected={false}
              />
            ))
          )}
        </div>
      </div>
    )}

    {connectedDevice && (
      <div className="device-info">
        <h3>Информация об устройстве</h3>
        <div className="info-card">
          <div className="info-row">
            <span>Имя:</span>
            <span>{connectedDevice.name}</span>
          </div>
          <div className="info-row">
            <span>Статус:</span>
            <span className="status-connected">
              <FaCheckCircle /> Подключено
            </span>
          </div>
          <div className="info-row">
            <span>ID:</span>
            <span className="device-id">{connectedDevice.id}</span>
          </div>
        </div>
      </div>
    )}
  </div>
</div>
);
};

const DeviceCard = ({ device, onConnect, isConnected }) => {
  return (
    <div className="device-card">
      <div className="device-icon">
        <FaBluetooth />
      </div>
      
      <div className="device-info">
        <h4>{device.name}</h4>
        <span className="device-id">{device.id.slice(0, 8)}...</span>
      </div>

      <div className="device-actions">
        <button 
          className="btn-connect"
          onClick={() => onConnect(device.id)}
        >
          <FaPlug />
          Подключить
        </button>
      </div>
    </div>
  );
};

export default BluetoothApp;
