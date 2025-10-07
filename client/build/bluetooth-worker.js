// Bluetooth Web Worker для фонового управления соединением
let bluetoothDevice = null;
let gattServer = null;
let dataCharacteristic = null;
let isConnected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;

self.onmessage = async function(e) {
  const { type, data } = e.data;

  try {
    switch (type) {
      case 'INIT_DEVICE':
        if (data.deviceId) {
          await attemptReconnection(data.deviceId);
        }
        break;

      case 'CONNECT_DEVICE':
        await connectToDevice(data.device);
        break;

      case 'SEND_DATA':
        await sendDataToDevice(data);
        break;

      case 'READ_BATTERY':
        await readBatteryLevel();
        break;

      case 'DISCONNECT':
        await disconnectDevice();
        break;

      case 'RECONNECT':
        await attemptReconnection(data.deviceId);
        break;
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      data: { message: error.message }
    });
  }
};

async function attemptReconnection(deviceId) {
  try {
    self.postMessage({
      type: 'STATUS_UPDATE',
      data: { status: 'reconnecting' }
    });

    const devices = await navigator.bluetooth.getDevices();
    const device = devices.find(d => d.id === deviceId);
    
    if (device) {
      await connectToDevice({
        id: device.id,
        name: device.name
      }, true);
    }
  } catch (error) {
    console.error('Reconnection failed:', error);
    // Автоматический retry с exponential backoff
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      setTimeout(() => attemptReconnection(deviceId), delay);
    }
  }
}

async function connectToDevice(deviceInfo, isReconnect = false) {
  try {
    self.postMessage({
      type: 'STATUS_UPDATE',
      data: { status: 'connecting' }
    });

    let device;
    if (isReconnect) {
      const devices = await navigator.bluetooth.getDevices();
      device = devices.find(d => d.id === deviceInfo.id);
    } else {
      device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['battery_service'] }],
        optionalServices: ['battery_service', 'generic_access', 'device_information']
      });
    }

    if (!device) throw new Error('Device not found');

    bluetoothDevice = device;
    gattServer = await device.gatt.connect();
    isConnected = true;
    reconnectAttempts = 0;

    // Настройка сервисов и характеристик для обмена данными
    try {
      const batteryService = await gattServer.getPrimaryService('battery_service');
      const batteryCharacteristic = await batteryService.getCharacteristic('battery_level');
      
      // Подписка на уведомления о батарее
      await batteryCharacteristic.startNotifications();
      batteryCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
        const value = event.target.value;
        const level = value.getUint8(0) / 100;
        self.postMessage({
          type: 'BATTERY_UPDATE',
          data: { level }
        });
      });

      // Поиск сервиса для обмена данными (адаптируйте под ваше устройство)
      try {
        const dataService = await gattServer.getPrimaryService('generic_access');
        dataCharacteristic = await dataService.getCharacteristic('gap.device_name');
        
        // Подписка на входящие данные
        await dataCharacteristic.startNotifications();
        dataCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
          const value = event.target.value;
          const textDecoder = new TextDecoder();
          const data = textDecoder.decode(value);
          
          self.postMessage({
            type: 'DATA_RECEIVED',
            data: {
              timestamp: Date.now(),
              message: data,
              type: 'incoming'
            }
          });
        });

      } catch (error) {
        console.warn('Data service not available:', error);
      }

    } catch (error) {
      console.warn('Could not setup all services:', error);
    }

    // Слушатель отключения
    device.addEventListener('gattserverdisconnected', () => {
      isConnected = false;
      self.postMessage({
        type: 'CONNECTION_LOST'
      });
    });

    self.postMessage({
      type: 'STATUS_UPDATE',
      data: {
        status: 'connected',
        deviceInfo: {
          serialNumber: device.id,
          connectedTo: device.name || 'Unknown Device'
        }
      }
    });

  } catch (error) {
    throw new Error(`Connection failed: ${error.message}`);
  }
}

async function sendDataToDevice(data) {
  if (!isConnected || !dataCharacteristic) {
    throw new Error('Not connected to device');
  }

  try {
    const textEncoder = new TextEncoder();
    const dataBuffer = textEncoder.encode(data);
    
    await dataCharacteristic.writeValue(dataBuffer);
    
    // Отправляем подтверждение обратно в UI
    self.postMessage({
      type: 'DATA_RECEIVED',
      data: {
        timestamp: Date.now(),
        message: data,
        type: 'outgoing'
      }
    });

  } catch (error) {
    throw new Error(`Send data failed: ${error.message}`);
  }
}

async function readBatteryLevel() {
  if (!isConnected) return;

  try {
    const batteryService = await gattServer.getPrimaryService('battery_service');
    const characteristic = await batteryService.getCharacteristic('battery_level');
    const value = await characteristic.readValue();
    const level = value.getUint8(0) / 100;
    
    self.postMessage({
      type: 'BATTERY_UPDATE',
      data: { level }
    });
  } catch (error) {
    console.warn('Battery read failed:', error);
  }
}

async function disconnectDevice() {
  if (bluetoothDevice && bluetoothDevice.gatt.connected) {
    if (dataCharacteristic) {
      try {
        await dataCharacteristic.stopNotifications();
      } catch (error) {
        console.warn('Error stopping notifications:', error);
      }
    }
    await bluetoothDevice.gatt.disconnect();
  }
  
  bluetoothDevice = null;
  gattServer = null;
  dataCharacteristic = null;
  isConnected = false;
  
  self.postMessage({
    type: 'STATUS_UPDATE',
    data: { status: 'disconnected' }
  });
}

