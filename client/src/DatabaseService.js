class DatabaseService {
    constructor() {
        this.baseURL = 'https://192.168.99.14:3000/api';
        this.deviceName = null;
        this.isConnected = false;
    }

    async connectToDeviceDB(deviceName) {
        try {
            this.deviceName = deviceName;
            
            const response = await fetch(`${this.baseURL}/device/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceName })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.isConnected = true;
                console.log(`✅ Подключено к БД: ${result.database}`);
                return true;
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error) {
            console.error('❌ Ошибка подключения к БД:', error);
            this.isConnected = false;
            throw error;
        }
    }

    async saveData(data) {
        if (!this.isConnected || !this.deviceName) {
            throw new Error('База данных не подключена');
        }

        const response = await fetch(`${this.baseURL}/device/${this.deviceName}/data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Данные сохранены в БД:', result);
        return result;
    }

    async getData(limit = 100) {
        if (!this.isConnected || !this.deviceName) {
            throw new Error('База данных не подключена');
        }

        const response = await fetch(
            `${this.baseURL}/device/${this.deviceName}/data?limit=${limit}`
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log(`✅ Получено ${result.data.length} записей из БД`);
        return result.data || [];
    }

    async getDeviceInfo() {
        if (!this.isConnected || !this.deviceName) {
            throw new Error('База данных не подключена');
        }

        const response = await fetch(
            `${this.baseURL}/device/${this.deviceName}/info`
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    // Новый метод для получения информации о БД
    async getDatabaseInfo() {
        if (!this.isConnected || !this.deviceName) {
            throw new Error('База данных не подключена');
        }

        const response = await fetch(
            `${this.baseURL}/device/${this.deviceName}/database-info`
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }
}

// Глобальный экземпляр
window.databaseService = new DatabaseService();
