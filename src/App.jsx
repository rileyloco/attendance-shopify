// App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import Home from './pages/Home';
import Customers from './pages/Customers';
import Attendance from './pages/Attendance';
import Log from './pages/Log';
import Orders from './pages/Orders';
import Console from './pages/Console';
import Kiosk from './pages/Kiosk';

function App() {
  return (
    <Router>
      <NavBar />
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '0 2rem'
      }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/log" element={<Log />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/console" element={<Console />} />
          <Route path="/kiosk" element={<Kiosk />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;