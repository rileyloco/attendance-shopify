// src/components/NavBar.jsx
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [termDisplay, setTermDisplay] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
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
    <>
      <nav className="navbar" style={{
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
                className="nav-logo"
                style={{
                  height: '71.875px',
                  width: 'auto',
                  opacity: 0.9
                }}
              />
            </Link>
            
            {termDisplay && (
              <div className="term-display" style={{ 
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

          {/* Desktop Navigation */}
          <div className="desktop-nav" style={{
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

          {/* Desktop Kiosk Button */}
          <button
            className="desktop-kiosk-btn"
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

          {/* Mobile Menu Button */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: 'none',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.5rem'
            }}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu" style={{
          position: 'fixed',
          top: '85px',
          left: 0,
          right: 0,
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          borderBottom: '1px solid var(--glass-border)',
          padding: '1rem',
          zIndex: 99,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          {mainLinks.map(({ to, label }) => {
            const isActive = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  textDecoration: 'none',
                  fontWeight: '600',
                  padding: '1rem',
                  borderRadius: '8px',
                  background: isActive ? 'var(--glass-hover)' : 'transparent',
                  display: 'block'
                }}
              >
                {label}
              </Link>
            );
          })}
          <button
            onClick={() => {
              openKiosk();
              setMobileMenuOpen(false);
            }}
            style={{
              background: 'var(--glass-hover)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
              padding: '1rem',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              textAlign: 'center',
              width: '100%'
            }}
          >
            Open Kiosk
          </button>
        </div>
      )}
    </>
  );
}

export default NavBar;