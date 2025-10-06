// import React from 'react';
// import { BrowserRouter, Routes, Route } from 'react-router-dom';
// import RootPage from './root';
// import AppMainPage from './app-main';
// import HistoryPage from './history';
// import { BluetoothProvider } from './BluetoothContext';
// import './root.css';

// function App() {
//   return (
//     <BluetoothProvider>
//       <BrowserRouter>
//         <Routes>
//           <Route path="/app-main" element={<AppMainPage />} />
//           <Route path="/history" element={<HistoryPage />} />
//           <Route path="/root" element={<RootPage />} />
//           <Route path="/" element={<RootPage />} />
//         </Routes>
//       </BrowserRouter>
//     </BluetoothProvider>
//   );
// }

// export default App;
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import RootPage from './root';
import AppMain from './app-main';
import History from './history';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<AppMain />} />
          <Route path="/app-main" element={<AppMain />} />
          <Route path="/root" element={<RootPage />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
