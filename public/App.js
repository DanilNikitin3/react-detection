import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppMain from './app-main.js';
import HistoryPage from './history.js';
import UserPage from './root.js';
import React from 'react'; // ДОЛЖНО БЫТЬ

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Автоматическое перенаправление с корня на /anomalies */}
        <Route path="/" element={<Navigate to="/anomalies" replace />} />

        {/* Основные маршруты */}
        <Route path="/anomalies" element={<AppMain />} />
        <Route path="/monitoring" element={<HistoryPage />} />
        <Route path="/user" element={<UserPage />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
