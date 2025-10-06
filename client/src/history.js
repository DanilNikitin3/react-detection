import React, { useState } from 'react';
import './history.css';
import WeekCharts from './diagrams';
import MonthCharts from './diagram';
import { 
  FaHome, 
  FaBolt, 
  FaChartLine, 
  FaBold
} from 'react-icons/fa';

const HistoryPage = () => {
  const [activeView, setActiveView] = useState(null);

  const renderContent = () => {
    switch (activeView) {
      case 'week':
        return <WeekCharts />;
      case 'month':
        return <MonthCharts />;
      default:
        return (
          <div className="content-ar" id="content-area">
            <div className="welcome-message">
              <div className='welcome-icon'>
                <FaChartLine/>
              </div>
              <h3 className="welcome-title">Анализ аномалий напряжения</h3>
              <p className="welcome-text">Выберите период для отображения статистики. Нажмите на кнопку "Неделя" или "Месяц" для просмотра детальной информации.</p>
            </div>
          </div>
        );
    }
  };

  const handleViewToggle = (viewName) => {
    setActiveView(activeView === viewName ? null : viewName);
  };

  return (
    <div className="container">
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo-icon"><FaBolt/></div>
        </div>
        <div className="sidebar-menu">
          <ul>
            <li><a href="/app-main">
              <FaHome/>
            </a></li>
            <li><a href="/history" className="active">
              <FaBolt/>
            </a></li>
            <li><a href="/root">
              <FaChartLine/>
            </a></li>
          </ul>
        </div>
      </div>

      <div className="main-content">
        <div className="header">
          <h1 className="header-title">Мониторинг аномалий напряжения</h1>
          <div className="user-info">
            <div className="tablo">
              <img src="https://ui-avatars.com/api/?name=ON&background=06c000&color=fff" alt="User" />
              <div className="user-details">
                <div className="user-name">Bluetooth</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="period-header">
          <h2 className="period-title">Статистика напряжения</h2>
          <div className="period-switcher">
            <button onClick={() => handleViewToggle('week')} className={`combo-btn combo-btn-left ${activeView === 'week' ? 'activation' : ''}`}>Week</button>
            <button onClick={() => handleViewToggle('month')} className={`combo-btn combo-btn-right ${activeView === 'month' ? 'activation' : ''}`}>Month</button>
          </div>
        </div>

        <div className="charts-content">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;

