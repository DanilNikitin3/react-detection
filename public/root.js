import React, { useState } from 'react';
import { FaExclamationTriangle, FaChartLine, FaUser } from 'react-icons/fa';
import './css-main.css';

const RootPage = () => {
  return (
    <>
      <div className="sidebar">
        <a href="./app-main.html" className="nav-icon" title="Аномалии">
          <i className="fas fa-exclamation-triangle"></i>
        </a>
        <a href="./hisroty.html" className="nav-icon" title="Мониторинг">
          <i className="fas fa-chart-line"></i>
        </a>
        <a href='./root.html' className="nav-icon active" title="Пользователь">
          <i className="fas fa-user"></i>
        </a>
      </div>

      <div className="main-content">
        <div className="main-tab">
          <form className="auth-form">
            <div className="input-field">
              <input type="text" id="username" required autoComplete="off" />
              <label htmlFor="username">USERNAME</label>
              <div className="pulse-bar"></div>
            </div>

            <div className="input-field">
              <input type="password" id="password" required />
              <label htmlFor="password">PASSWORD</label>
              <div className="pulse-bar"></div>
            </div>

            <button type="submit" className="cyber-button">
              <span>ACCESS SYSTEM</span>
              <div className="glow"></div>
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default RootPage;
