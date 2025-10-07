import React, { useEffect } from 'react';
import { FaExclamationTriangle, FaChartLine, FaUser } from 'react-icons/fa';
import './css-main.css';

const HistoryPage = () => {
    useEffect(() => {
        // Загрузка скриптов после монтирования компонента
        const loadScripts = async () => {
            try {
                // Загрузка utils.js
                await import('/Users/emac/Documents/VSCode/server_test/public/utils.js');
                // Загрузка diagrams.js
                await import('/Users/emac/Documents/VSCode/server_test/public/diagrams.js');
            } catch (error) {
                console.error('Error loading scripts:', error);
            }
        };

        loadScripts();
    }, []);

    return (
        <div className="app-container">
            <div className="sidebar">
                <a href="./app-main.html" className="nav-icon" title="Аномалии">
                    <FaExclamationTriangle />
                </a>
                <a href="./hisroty.html" className="nav-icon active" title="Мониторинг">
                    <FaChartLine />
                </a>
                <a href='./root.html' className="nav-icon" title="Пользователь">
                    <FaUser />
                </a>
            </div>

            <div className="main-content">
                <div className="chart-container">
                    <h3>Недельная статистика</h3>
                </div>
                <div className="chart-container" id="charts-container"></div>
            </div>
        </div>
    );
};

export default HistoryPage;
