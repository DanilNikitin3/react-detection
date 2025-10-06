import { useState, useEffect } from 'react';

export const useDeviceSystem = () => {
    const [bluetooth, setBluetooth] = useState('disconnected');
    const [database, setDatabase] = useState('disconnected');
    const [deviceName, setDeviceName] = useState('');
    const [deviceData, setDeviceData] = useState([]);
    const [error, setError] = useState('');
    const [hasSavedDevice, setHasSavedDevice] = useState(false);

    useEffect(() => {
        checkSavedDevice();
        checkDatabaseConnection();
    }, []);

    const checkSavedDevice = () => {
        const saved = window.bluetoothService.getSavedDevice();
        setHasSavedDevice(!!saved);
        if (saved) {
            setDeviceName(saved.name);
        }
    };

    const checkDatabaseConnection = async () => {
        try {
            setDatabase('connecting');
            // Проверка подключения к БД
            setDatabase('connected');
        } catch (error) {
            setDatabase('error');
            setError('Ошибка подключения к базе данных');
        }
    };

    const connectDevice = async () => {
        try {
            setBluetooth('connecting');
            setError('');
            
            const deviceInfo = await window.bluetoothService.connectToDevice();
            setDeviceName(deviceInfo.name);
            setBluetooth('connected');
            
        } catch (error) {
            setBluetooth('error');
            setError(error.message);
        }
    };

    const disconnectDevice = async () => {
        try {
            await window.bluetoothService.disconnect();
            setBluetooth('disconnected');
            setDeviceName('');
            setDeviceData([]);
        } catch (error) {
            setError('Ошибка отключения: ' + error.message);
        }
    };

    const refreshData = async () => {
        try {
            // Загрузка данных из БД
            const data = await window.databaseService.getData();
            setDeviceData(data || []);
        } catch (error) {
            setError('Ошибка загрузки данных: ' + error.message);
        }
    };

    return {
        bluetooth,
        database,
        deviceName,
        deviceData,
        error,
        connectDevice,
        disconnectDevice,
        refreshData,
        hasSavedDevice
    };
};
