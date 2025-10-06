const { Pool } = require('pg');

class DatabaseService {
    constructor() {
        // Используем единые учетные данные для всех подключений
        this.dbConfig = {
            user: 'postgres',
            host: '192.168.99.14',
            password: '1234',
            port: 5432, // Стандартный порт PostgreSQL
        };
        
        this.masterPool = new Pool({
            ...this.dbConfig,
            database: 'postgres',
        });
    }

    // Создание БД для устройства если не существует
    async ensureDatabaseExists(deviceName) {
        const dbName = this.sanitizeDBName(deviceName);
        
        try {
            // Проверяем существует ли БД
            const dbExists = await this.masterPool.query(
                `SELECT 1 FROM pg_database WHERE datname = $1`,
                [dbName]
            );

            if (dbExists.rows.length === 0) {
                // Создаем новую БД
                await this.masterPool.query(`CREATE DATABASE ${dbName}`);
                console.log(`Создана БД: ${dbName}`);
                
                // Создаем таблицы в новой БД
                const devicePool = new Pool({
                    ...this.dbConfig,
                    database: dbName,
                });
                
                // Создаем таблицу sensor_data
                await devicePool.query(`
                    CREATE TABLE sensor_data (
                        id SERIAL PRIMARY KEY,
                        device_name VARCHAR(100) NOT NULL,
                        data_type VARCHAR(50) NOT NULL,
                        value DECIMAL,
                        unit VARCHAR(20),
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        raw_data JSONB
                    )
                `);
                
                // Создаем таблицу devices
                await devicePool.query(`
                    CREATE TABLE devices (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(100) UNIQUE NOT NULL,
                        mac_address VARCHAR(17),
                        connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        status VARCHAR(20) DEFAULT 'disconnected'
                    )
                `);
                
                await devicePool.end();
                console.log(`✅ Таблицы созданы в БД: ${dbName}`);
            } else {
                console.log(`✅ БД уже существует: ${dbName}`);
            }
            
            return dbName;
        } catch (error) {
            console.error('❌ Ошибка создания БД:', error);
            throw new Error(`Ошибка создания БД: ${error.message}`);
        }
    }

    // Сохранение данных в БД устройства
    async saveSensorData(deviceName, sensorData) {
        const dbName = this.sanitizeDBName(deviceName);
        const devicePool = new Pool({
            ...this.dbConfig,
            database: dbName,
        });

        try {
            // Проверяем существование таблицы перед вставкой
            const tableExists = await this.checkTableExists(devicePool, 'sensor_data');
            if (!tableExists) {
                // Если таблицы нет, создаем ее
                await this.createTables(devicePool);
            }
            
            const query = `
                INSERT INTO sensor_data (device_name, data_type, value, unit, raw_data) 
                VALUES ($1, $2, $3, $4, $5) 
                RETURNING *
            `;
            
            const values = [
                deviceName,
                sensorData.dataType || 'sensor_data',
                sensorData.value,
                sensorData.unit || '',
                sensorData.rawData || null
            ];
            
            const result = await devicePool.query(query, values);
            console.log(`✅ Данные сохранены в БД ${dbName}:`, result.rows[0]);
            return result.rows[0];
        } catch (error) {
            console.error('❌ Ошибка сохранения данных:', error);
            throw error;
        } finally {
            await devicePool.end();
        }
    }

    // Вспомогательный метод для создания таблиц
    async createTables(devicePool) {
        await devicePool.query(`
            CREATE TABLE IF NOT EXISTS sensor_data (
                id SERIAL PRIMARY KEY,
                device_name VARCHAR(100) NOT NULL,
                data_type VARCHAR(50) NOT NULL,
                value DECIMAL,
                unit VARCHAR(20),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                raw_data JSONB
            )
        `);
        
        await devicePool.query(`
            CREATE TABLE IF NOT EXISTS devices (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                mac_address VARCHAR(17),
                connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) DEFAULT 'disconnected'
            )
        `);
        
        console.log('✅ Таблицы созданы/проверены');
    }

    // Вспомогательный метод для проверки существования таблицы
    async checkTableExists(devicePool, tableName) {
        try {
            const result = await devicePool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                )
            `, [tableName]);
            return result.rows[0].exists;
        } catch (error) {
            console.error(`❌ Ошибка проверки таблицы ${tableName}:`, error);
            return false;
        }
    }

    // Получение данных из БД устройства
    async getDeviceData(deviceName, limit = 100) {
        const dbName = this.sanitizeDBName(deviceName);
        const devicePool = new Pool({
            ...this.dbConfig,
            database: dbName,
        });

        try {
            const query = `
                SELECT * FROM sensor_data 
                WHERE device_name = $1 
                ORDER BY timestamp DESC 
                LIMIT $2
            `;

            console.log(`🔍 Запрос данных из БД ${dbName}, лимит: ${limit}`);
            
            const result = await devicePool.query(query, [deviceName, limit]);
            console.log(`✅ Получено ${result.rows.length} записей из БД ${dbName}`);
            return result.rows;
        } catch (error) {
            console.error('❌ Ошибка получения данных:', error);
            throw error;
        } finally {
            await devicePool.end();
        }
    }

    sanitizeDBName(name) {
        return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }

    // ... остальные методы (updateDeviceStatus, getDatabaseInfo и т.д.) остаются без изменений
}

module.exports = DatabaseService;
