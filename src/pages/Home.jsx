// src/pages/Home.jsx
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function Home() {
  const [termInfo, setTermInfo] = useState('');

  useEffect(() => {
    loadTermInfo();
  }, []);

  async function loadTermInfo() {
    try {
      const { data, error } = await supabase
        .from('console_settings')
        .select('*')
        .single();

      if (!error && data) {
        const termDisplay = `Term ${data.term} Block ${data.block}`;
        let dateRange = '';
        
        if (data.start_date && data.end_date) {
          const start = new Date(data.start_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
          const end = new Date(data.end_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
          dateRange = ` (${start} - ${end})`;
        }
        
        setTermInfo(termDisplay + dateRange);
        
        // Also update localStorage and navbar
        localStorage.setItem('termDisplay', termDisplay + dateRange);
        window.dispatchEvent(new Event('termSettingsUpdated'));
      }
    } catch (err) {
      console.error('Error loading term info:', err);
    }
  }

  const pages = [
    {
      to: '/customers',
      label: 'Customers',
      description: 'Manage customer database'
    },
    {
      to: '/attendance',
      label: 'Attendance',
      description: 'Track student attendance for paid classes'
    },
    {
      to: '/log',
      label: 'Check-in Log',
      description: 'Review and process student check-ins'
    },
    {
      to: '/orders',
      label: 'Orders',
      description: 'Sync and manage Shopify orders'
    },
    {
      to: '/console',
      label: 'Console',
      description: 'System settings and data management'
    },
    {
      to: '/kiosk',
      label: 'Kiosk',
      description: 'Student self check-in system',
      action: 'window'
    }
  ];

  function handleNavigation(page) {
    if (page.action === 'window') {
      window.open(page.to, '_blank', 'width=800,height=600');
    }
  }

  const cardGradients = [
    { value: 'linear-gradient(135deg, var(--accent-warm) 0%, var(--accent-gold) 100%)', border: 'linear-gradient(90deg, var(--accent-warm), var(--accent-gold), var(--accent-coral))' },
    { value: 'linear-gradient(135deg, var(--accent-teal) 0%, var(--accent-coral) 100%)', border: 'linear-gradient(90deg, var(--accent-teal), var(--accent-coral), var(--accent-warm))' },
    { value: 'linear-gradient(135deg, var(--accent-gold) 0%, var(--accent-teal) 100%)', border: 'linear-gradient(90deg, var(--accent-gold), var(--accent-teal), var(--accent-coral))' },
    { value: 'linear-gradient(135deg, var(--accent-coral) 0%, var(--accent-warm) 100%)', border: 'linear-gradient(90deg, var(--accent-coral), var(--accent-warm), var(--accent-gold))' },
    { value: 'linear-gradient(135deg, var(--accent-warm) 0%, var(--accent-teal) 100%)', border: 'linear-gradient(90deg, var(--accent-warm), var(--accent-teal), var(--accent-gold))' },
    { value: 'linear-gradient(135deg, var(--accent-gold) 0%, var(--accent-coral) 100%)', border: 'linear-gradient(90deg, var(--accent-gold), var(--accent-coral), var(--accent-teal))' }
  ];

  return (
    <div style={{ padding: '4rem 0', minHeight: '100vh' }}>
      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '2.5rem'
      }}>
        {pages.map((page, index) => (
          page.action === 'window' ? (
            <button
              key={page.to}
              onClick={() => handleNavigation(page)}
              style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(25px)',
                WebkitBackdropFilter: 'blur(25px)',
                border: '1px solid var(--glass-border)',
                borderRadius: '28px',
                padding: '3rem',
                textAlign: 'center',
                transition: 'all 0.4s ease',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                textDecoration: 'none',
                color: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-10px) scale(1.02)';
                e.currentTarget.style.background = 'var(--glass-hover)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.background = 'var(--glass-bg)';
                e.currentTarget.style.borderColor = 'var(--glass-border)';
              }}
            >
              <div style={{
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: cardGradients[index].border,
                opacity: '0.7'
              }}></div>
              <div style={{
                fontSize: '2.5rem',
                fontWeight: '800',
                marginBottom: '0.8rem',
                background: cardGradients[index].value,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>{page.label}</div>
            </button>
          ) : (
            <Link
              key={page.to}
              to={page.to}
              style={{
                display: 'block',
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(25px)',
                WebkitBackdropFilter: 'blur(25px)',
                border: '1px solid var(--glass-border)',
                borderRadius: '28px',
                padding: '3rem',
                textAlign: 'center',
                transition: 'all 0.4s ease',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                textDecoration: 'none',
                color: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-10px) scale(1.02)';
                e.currentTarget.style.background = 'var(--glass-hover)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.background = 'var(--glass-bg)';
                e.currentTarget.style.borderColor = 'var(--glass-border)';
              }}
            >
              <div style={{
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: cardGradients[index].border,
                opacity: '0.7'
              }}></div>
              <div style={{
                fontSize: '2.5rem',
                fontWeight: '800',
                marginBottom: '0.8rem',
                background: cardGradients[index].value,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>{page.label}</div>
            </Link>
          )
        ))}
      </div>
    </div>
  );
}

export default Home;