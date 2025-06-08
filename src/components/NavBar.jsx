// src/components/NavBar.jsx
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
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

  // Navigate to Kiosk page
  function openKiosk() {
    navigate('/kiosk?mode=kiosk');
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/" style={{
            display: 'flex',
            alignItems: 'center'
          }}>
            <img 
              src="/logo7.png" 
              alt="LocoMojo" 
              style={{
                height: '71.875px',
                width: 'auto',
                opacity: 0.9
              }}
            />
          </Link>
          
          {termDisplay && (
            <div style={{ 
              fontSize: '12px',
              lineHeight: '1.3',
              maxWidth: '150px'
            }}>
              <span style={{ 
                fontWeight: '500', 
                color: 'var(--text-secondary)',
                display: 'block'
              }}>
                {termDisplay.split('(')[0].trim()}
              </span>
              {termDisplay.includes('(') && (
                <span style={{ 
                  fontWeight: '400', 
                  color: 'var(--text-muted)',
                  fontSize: '11px'
                }}>
                  ({termDisplay.split('(')[1]}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Center Navigation */}
        <div style={{
          display: 'flex',
          gap: '1rem'
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
                  fontSize: '16px',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '12px',
                  background: isActive 
                    ? 'linear-gradient(135deg, rgba(232, 93, 47, 0.15) 0%, rgba(245, 200, 66, 0.15) 100%)' 
                    : 'transparent',
                  border: isActive 
                    ? '1px solid rgba(232, 93, 47, 0.3)' 
                    : '1px solid transparent',
                  backdropFilter: isActive ? 'blur(10px)' : 'none',
                  WebkitBackdropFilter: isActive ? 'blur(10px)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--text-primary)';
                    e.currentTarget.style.background = 'var(--glass-hover)';
                    e.currentTarget.style.border = '1px solid var(--glass-border)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.border = '1px solid transparent';
                  }
                }}
              >
                {label}
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