-- -- Подключение к PostgreSQL
-- psql -U postgres

-- -- Создание БД
-- CREATE DATABASE jbl_charge_5;

-- -- Создание пользователя
-- CREATE USER device_user WITH PASSWORD 'device_password';
-- GRANT ALL PRIVILEGES ON DATABASE jbl_charge_5 TO device_user;

-- -- Подключение к БД устройства
-- \c jbl_charge_5;

-- -- Таблица для данных
-- CREATE TABLE sensor_data (
--     id SERIAL PRIMARY KEY,
--     device_name VARCHAR(100) NOT NULL,
--     data_type VARCHAR(50) NOT NULL,
--     value DECIMAL,
--     unit VARCHAR(20),
--     timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     raw_data JSONB
-- );

-- -- Таблица устройств
-- CREATE TABLE devices (
--     id SERIAL PRIMARY KEY,
--     name VARCHAR(100) UNIQUE NOT NULL,
--     mac_address VARCHAR(17),
--     connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     status VARCHAR(20) DEFAULT 'disconnected'
-- );

