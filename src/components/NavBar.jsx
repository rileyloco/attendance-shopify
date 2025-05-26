// src/components/NavBar.jsx
import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

function NavBar() {
  const location = useLocation();
  const [termDisplay, setTermDisplay] = useState('');
  
  const mainLinks = [
    { to: '/', label: 'Home' },
    { to: '/customers', label: 'Customers' },
    { to: '/attendance', label: 'Attendance' },
    { to: '/log', label: 'Log' },
    { to: '/orders', label: 'Orders' },
    { to: '/console', label: 'Console' },
  ];

  // Load term display on mount and listen for updates
  useEffect(() => {
    // Load initial value
    const savedDisplay = localStorage.getItem('termDisplay');
    if (savedDisplay) {
      setTermDisplay(savedDisplay);
    }

    // Listen for updates
    const handleTermUpdate = () => {
      const updatedDisplay = localStorage.getItem('termDisplay');
      if (updatedDisplay) {
        setTermDisplay(updatedDisplay);
      }
    };

    window.addEventListener('termSettingsUpdated', handleTermUpdate);
    
    return () => {
      window.removeEventListener('termSettingsUpdated', handleTermUpdate);
    };
  }, []);

  // Open Kiosk in new window
  function openKiosk() {
    const height = window.screen.height * 0.9; // 90% of screen height
    const width = 800;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    
    window.open(
      '/kiosk', 
      '_blank', 
      `width=${width},height=${height},left=${left},top=${top},location=no,toolbar=no,menubar=no,status=no`
    );
  }

  return (
    <nav style={{
      backdropFilter: 'blur(30px)',
      WebkitBackdropFilter: 'blur(30px)',
      background: 'var(--glass-bg)',
      borderBottom: '1px solid var(--glass-border)',
      padding: '0 2rem',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '85px'
      }}>
        {/* Logo and Term Display */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <Link to="/" style={{
            fontSize: '26px',
            fontWeight: '800',
            background: 'linear-gradient(135deg, var(--accent-warm) 0%, var(--accent-gold) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textDecoration: 'none',
            lineHeight: '1'
          }}>
            LocoMojo
          </Link>
          
          {termDisplay && (
            <div style={{ fontSize: '13px', marginTop: '2px' }}>
              <span style={{ 
                fontWeight: '500', 
                color: 'var(--text-secondary)' 
              }}>
                {termDisplay}
              </span>
            </div>
          )}
        </div>

        {/* Center Navigation */}
        <div style={{
          display: 'flex',
          gap: '3rem'
        }}>
          {mainLinks.map(({ to, label }) => {
            const isActive = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                style={{
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  textDecoration: 'none',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  fontSize: '16px'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                {label}
                {isActive && (
                  <span style={{
                    content: '""',
                    position: 'absolute',
                    bottom: '-10px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '6px',
                    height: '6px',
                    background: 'var(--accent-warm)',
                    borderRadius: '50%',
                    boxShadow: '0 0 15px var(--accent-warm)'
                  }} />
                )}
              </Link>
            );
          })}
        </div>

        {/* Kiosk Button */}
        <button
          onClick={openKiosk}
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-primary)',
            padding: '14px 28px',
            borderRadius: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            fontFamily: 'inherit'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--glass-hover)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 25px rgba(255, 107, 53, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--glass-bg)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Open Kiosk
        </button>
      </div>
    </nav>
  );
}

export default NavBar;