// App.jsx
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import NavBar from './components/NavBar';
import Home from './pages/Home';
import Customers from './pages/Customers';
import Attendance from './pages/Attendance';
import Log from './pages/Log';
import Orders from './pages/Orders';
import Console from './pages/Console';
import Kiosk from './pages/Kiosk';
import Reports from './pages/Reports';

function AppContent() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isKioskMode = location.pathname === '/kiosk' && searchParams.get('mode') === 'kiosk';
  
  return (
    <>
      {!isKioskMode && <NavBar />}
      <div style={{
        maxWidth: isKioskMode ? '100%' : '900px',
        margin: '0 auto',
        padding: isKioskMode ? '0' : '0 2rem'
      }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/log" element={<Log />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/console" element={<Console />} />
          <Route path="/kiosk" element={<Kiosk />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </div>
    </>
  );
}

function App() {
  console.log('App reloaded');
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;